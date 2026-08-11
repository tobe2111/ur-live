/**
 * 🚦 **인보케이션 예산 — 한 정각에 몇 개의 레인을 띄울 것인가**
 *
 * ## 왜 필요한가 (2026-08-01 라이브 실측, 14:00 UTC 회차)
 *
 * 부모(cron 디스패처)가 매 정각에 레인 15개를 **전부 동시에** `env.SELF.fetch` 로 띄우고
 * `ctx.waitUntil` 로 전부 매달고 있었다. 그 결과가 이거다:
 *
 * ```
 *   성공 8개:  0ms · 0ms · 0ms · 0ms · 2,773 · 5,479 · 5,542 · 8,316
 *   실패 7개:  10,505 · 10,513 · 10,513 · 10,513 · 10,513 · 10,513 · 10,663
 * ```
 *
 * 7개가 각자 실패한 게 아니다 — **같은 순간에 한꺼번에 잘렸다.** 8.3초짜리는 살고 10.5초에
 * 걸린 건 전멸했다. 부모가 죽으면서 매달린 자식을 다 끌고 간 모양이다(자식은 부모보다 오래
 * 살 수 없다). 같은 날 스냅샷에 런타임이 직접 붙인 문자열이 남아 있다:
 *
 * ```
 *   "KICK_FAILED: … — Worker exceeded CPU time limit."
 * ```
 *
 * ⇒ **한 부모의 예산 안에 15개는 안 들어간다.** 그런데 지금 구조는 매시간 15개를 밀어 넣고
 * 매시간 7개를 버린다. 버려지는 7개는 *늘 뒤쪽의 같은 레인들*이라 — 실측상 값을 만드는
 * `enrich-influencer-driver`(측정=이메일 생산)가 07:00 UTC 이후 **한 번도 차례를 못 받았다.**
 * 정지 10시간의 정체가 이것이다. 고장이 아니라 **구조적 기아**다.
 *
 * ## 설계 — 굶기지 말고 **나눠서 돌린다**
 *
 * 매시간 전부 띄우는 대신, 매시간 **예산만큼만** 띄우고 나머지는 다음 시간에 돌린다.
 * 총 처리량은 같지만(어차피 8개밖에 못 끝냈다) **버려지는 일이 0 이 되고, 모든 레인이
 * 정해진 시간 안에 반드시 자기 차례를 받는다.**
 *
 * ## 💰 유료 전환 시 **자연히 늘어난다** (2026-08-01 대표 지시)
 *
 * 이 파일이 그 지시의 실체다. 한도를 코드 곳곳에 박지 않고 **여기 한 곳**에 둔다:
 *
 * ```
 *   Free  기본 6  → 15개 레인이 3개 조로 나뉨 → 각 레인 3시간마다(2026-08-02 재측정)
 *   Paid 기본 64  → 조가 1개 → 전 레인 매시간 (= 오늘 이전 동작)
 * ```
 *
 * **유료 전환에 코드 변경이 필요 없다.** 대시보드에서 `ADS_PLAN=paid` 한 줄이면 조가 합쳐지며
 * 모든 레인의 주기가 자동으로 짧아진다. 중간값이 필요하면 `ADS_LANES_PER_TICK` 로 직접 준다
 * (예: 12 → 조 2개지만 한쪽이 12/3 으로 기울어 더 자주). **분산 구조 자체가 스케일 노브다.**
 *
 * ⚠️ **이 숫자는 이론이 아니라 실측이다**(한 정각에 완주한 개수). 레인이 무거워지거나 가벼워지면
 * 다시 측정해야 한다 — 코드는 이 값의 타당성을 알 수 없다.
 * 재측정 방법: 어드민 `cron-heartbeats` 에서 한 정각의 `ok=true` 개수를 센다.
 * 🔻 실제로 한 번 낡았다: 08-01 에 8 이었는데 08-02 재측정에서 **완주 2** 였다(아래 상수 주석).
 */

import { ADS_DOMAINS, domainBudgets, isKnownLane, laneDomain, type AdsDomain } from './lane-domains'

/** 요금제 — `ADS_PLAN` env 값. 미설정이면 free(현재 상태). */
export type AdsPlan = 'free' | 'paid'

/**
 * Free: 한 정각에 완주 가능한 레인 수.
 *
 * ## 🔻 8 → 6 (2026-08-02 재측정)
 * 위 주석이 시킨 대로 다시 셌다(*"한 정각의 `ok=true` 개수"*). **8 은 어제 값이었고 오늘은 틀렸다** —
 * 풀이 42k 로 커지며 레인이 무거워졌다. KST 16:00 회차 실측:
 * ```
 *   디스패치 8  →  완주 2 (driver · social-maintenance)
 *                  사망 4 (CPU 한도, ms 3,880~4,152 — 값이 같다 = 같은 순간에 끊김)
 *                  기록조차 없음 2 (collect-maker · enrich-prospects)
 * ```
 * 세 정각 연속 같은 모양이었다(14:00 사망 5 · 15:00 사망 2 · 16:00 사망 4).
 *
 * ## 왜 벽시계 4초에 죽나 — 자식 CPU 는 **호출자 몫**이다
 * `kick` 은 레인들을 **동시에** 띄우고 기다린다. 서비스 바인딩 피호출자의 CPU 는 호출자에게 청구되므로
 * 부모의 CPU 는 **동시 레인 수 × 각자의 시간**으로 쌓인다:
 * ```
 *   8 레인 × 각 ~4초  =  ~32초 CPU   (벽시계로는 4초)   ← 무료 cron 한도 30초를 넘는다
 *   6 레인 × 각 ~4초  =  ~24초 CPU                      ← 한도 안
 * ```
 * (같은 메커니즘을 같은 날 어드민 버튼에서도 확인했다 — 그쪽은 호출자가 HTTP 요청이라 더 빨리 죽는다.)
 *
 *
 * ## 🍰 왜 4 가 아니라 6 인가 — **총량과 비율은 다른 사람이 정한다**
 * CPU 실측만 보면 4 가 더 안전하다. 그런데 `domainBudgets(4)` 는 **1/1/1/1** 이 되어
 * 대표 확정 비율(3:3:1:1, `DOMAIN_SHARE`)이 최소-1 바닥에 눌려 사라진다.
 * `domainBudgets(6)` = **2/2/1/1** 로 비율이 살아 있고 CPU 도 한도 안이다.
 * ⇒ **총량은 플랫폼 한도가 정하고, 비율은 대표가 정한다.** 둘을 한 값에 묶으면 한쪽을 못 고친다.
 * ⚠️ **몫을 줄이면 각 레인의 주기가 길어진다.** 그런데 8 로 두면 절반이 *죽는다* —
 *   도는 레인이 절반인 편이 죽는 레인이 절반인 것보다 낫다(죽으면 그 회차 일이 통째로 버려진다).
 * ⚠️ 이 값은 **이론이 아니라 실측**이다. 레인이 더 무거워지면 또 내려야 하고, 커서로 잘라
 *   가벼워지면 올릴 수 있다. 재측정: 어드민 `cron-heartbeats` 에서 한 정각의 `ok=true` 개수.
 */
export const FREE_LANES_PER_TICK = 6
/**
 * Paid: 사실상 상한 없음(현재 등록 레인 15개). 조를 1개로 만들어 **전 레인 매시간**으로 되돌린다.
 * ⚠️ 큰 값을 쓰는 이유: 레인이 늘어도 유료에서는 계속 조가 1개로 유지되게 하기 위함이다.
 */
export const PAID_LANES_PER_TICK = 64

export interface DispatchEnv {
  ADS_PLAN?: string
  ADS_LANES_PER_TICK?: string
  /** 측정 레인 몫의 비율 — `MEASURE_SHARE_DEFAULT` 참조. */
  ADS_MEASURE_SHARE?: string
}

/** `ADS_PLAN` 해석 — 오타/대소문자/공백에 관대하되, **모르는 값은 free**(안전한 쪽). */
export function resolvePlan(env: DispatchEnv | undefined | null): AdsPlan {
  const raw = String(env?.ADS_PLAN ?? '').trim().toLowerCase()
  return raw === 'paid' ? 'paid' : 'free'
}

/**
 * 이 회차에 띄울 레인 수.
 * 우선순위: **명시값(`ADS_LANES_PER_TICK`) > 학습값 > 요금제 기본값.**
 *
 * 🎚️ `learned` 는 `lane-aimd.ts` 가 직전 회차 결과로 갱신한 값이다. 위 상수들은 이제
 *   **시작값**일 뿐이고, 실제 자리는 라이브가 정한다 — 그 상수가 하루 만에 낡는 걸 두 번 봤다.
 * ⚠️ 명시값이 학습을 **완전히 이긴다**(= 킬 스위치). 학습기가 이상하게 굴면 대표가 env 한 줄로 고정한다.
 * ⚠️ 0 이하·비숫자는 **무시하고 다음 순위**로 간다 — 오타 하나로 파이프라인이 통째로 멈추면 안 된다
 *    (이 레포가 반복해 만난 "실패가 아니라 조용한 부재" 클래스를 여기서 만들지 않는다).
 */
export function lanesPerTick(env: DispatchEnv | undefined | null, learned?: number | null): number {
  const explicit = Number(String(env?.ADS_LANES_PER_TICK ?? '').trim())
  if (Number.isFinite(explicit) && explicit >= 1) return Math.floor(explicit)
  if (Number.isFinite(learned as number) && (learned as number) >= 1) return Math.floor(learned as number)
  return resolvePlan(env) === 'paid' ? PAID_LANES_PER_TICK : FREE_LANES_PER_TICK
}

/** 디스패치 후보 한 건. `hourly=false`(일 1회·N시간마다)는 **절대 미루지 않는다** — 아래 참조. */
export interface LaneCandidate {
  /** 하트비트 이름 — 조 배정의 **안정 키**. 경로가 아니라 이 이름을 쓴다(경로는 바뀔 수 있다). */
  beat: string
  /**
   * 침묵 판정 임계(분) — `staleGapMinutes` = 주기×2+30 으로 **부풀린** 값이다(하트비트 `g`).
   * ⚠️ 주기가 아니다. 미룰 수 있는지의 근거로 쓰지 말 것 — `periodMin` 을 볼 것(`isDeferrable` 주석).
   */
  gapMin?: number
  /** 이 레인의 **실제 주기**(분). 60 이하면 매시간 레인 = 미룰 수 있다. */
  periodMin?: number
  /** 역할. 생략하면 이름으로 판정(`laneRole`) — 등록부를 안 고쳐도 되게. */
  role?: LaneRole
}

/**
 * 🎭 **레인의 역할** — 몫을 정하는 기준.
 *
 * - `measure` … 백로그를 **줄이는** 레인(보강/측정). 이게 값을 만든다.
 * - `other` … 나머지 전부(수집·정비·동기화). 수집은 백로그를 **늘린다**.
 */
export type LaneRole = 'measure' | 'other'

/**
 * 이름으로 역할을 판정한다 — `enrich-*` 만 `measure`.
 *
 * ⚠️ **왜 이름으로 판정하나**: 역할을 등록부(`index.ts` 의 `kick` 17곳)에 달면 그 파일이
 * 여러 세션의 충돌 지점이 된다. 이름 규칙은 한 곳에서 바뀌고, 예외가 필요한 레인은
 * `LaneCandidate.role` 로 **명시 지정**하면 이 함수를 이긴다.
 *
 * ⚠️ **이 판정이 틀리면 조용히 틀린다** — 새 보강 레인을 `enrich-` 없는 이름으로 만들면
 * 그 레인은 `other` 로 분류돼 수집 레인들과 몫을 나눠 갖는다(에러 없음). 새 측정 레인을
 * 만들 때는 이름을 `enrich-` 로 시작하거나 `role: 'measure'` 를 붙일 것.
 */
export function laneRole(lane: LaneCandidate): LaneRole {
  if (lane.role === 'measure' || lane.role === 'other') return lane.role
  return assignKey(lane.beat).startsWith('enrich') ? 'measure' : 'other'
}

/**
 * 측정 레인이 가져갈 **매시간 몫의 비율** (2026-08-02 대표 확정 "무료 유지 — 배분 정책 재설계").
 *
 * ## 왜 비율로 못박나 — 실측이 드러낸 결함
 * 커서 라운드로빈(#929)은 모든 매시간 레인을 **동등하게** 돌린다. 그런데 레인은 동등하지 않다:
 * 수집 레인은 백로그를 만들고 보강 레인은 백로그를 줄인다. 동등 배분이면 **각 기능의 몫이
 * "누가 레인을 몇 개 등록했나"로 정해진다.** 라이브 실측(08-02 20:32 UTC):
 *
 * ```
 *   collect-*  13개  :  인플루언서 측정 레인  1개
 *   → 한 사이클에 수집 13번 도는 동안 측정 1번
 *   → nb_unmeasured  20,497 → 21,192 (상승)
 * ```
 * 게다가 **데이터 소스를 붙일 때마다 수집 레인이 하나 늘어** 측정의 몫이 자동으로 깎인다.
 * 한 방향으로만 흐르는 드리프트다. ⇒ 몫을 **역할로** 정한다. 수집 레인이 몇 개가 되든 측정은
 * 자기 비율을 유지한다.
 *
 * ⚠️ **0.5 는 추정이다.** 유입과 측정의 실제 처리량 비를 재서 정한 값이 아니다(회차당 측정
 *   처리량을 이 세션이 깨끗하게 못 쟀다). 판정 근거는 `nb_unmeasured` 의 **방향**이다 —
 *   계속 오르면 올리고, 꺾이면 그대로 둔다. 무배포 조정: `ADS_MEASURE_SHARE`.
 *
 * ⚠️ **올릴 때 같이 봐야 하는 것 — 팬아웃 비용.** `enrich-influencer-driver` 는 자식 K개를
 *   `SELF.fetch` 로 띄운다(`ADS_INFLUENCER_ENRICH_FANOUT`, 기본 4). 이 레인이 도는 회차마다
 *   부모가 K번 더 fetch 한다. **레인 수는 그대로여도 부모 비용은 올라간다** — 08-01 에 부모가
 *   CPU 한도로 죽으며 자식을 다 끌고 간 사고(#927)가 이 비용 때문이었다. 비율을 올렸는데
 *   부모가 죽기 시작하면 비율이 아니라 **K 를 먼저 내려라**(둘 다 무배포).
 */
export const MEASURE_SHARE_DEFAULT = 0.5

/** env(`ADS_MEASURE_SHARE`) → 0~1 사이 비율. 범위 밖·비숫자·부재는 기본값(안전한 쪽). */
export function resolveMeasureShare(env: DispatchEnv | undefined | null): number {
  const n = Number(String((env as { ADS_MEASURE_SHARE?: string } | undefined | null)?.ADS_MEASURE_SHARE ?? '').trim())
  return Number.isFinite(n) && n > 0 && n < 1 ? n : MEASURE_SHARE_DEFAULT
}

/**
 * 몫을 역할로 나눈다 — **남는 몫은 버리지 않고 상대에게 넘긴다**(예산을 놀리지 않는다).
 *
 * ⚠️ `cap === 1` 은 나눌 수 없다(한 역할이 가져가면 다른 역할은 0). 0 인 역할은 그 회차에
 *   커서가 안 움직이므로, 그 상태가 반복되면 **그 역할 전체가 굶는다** — 이 파일이 막으려는
 *   바로 그 사고. 그래서 `cap === 1` 일 때는 회차(`tick`)로 **번갈아** 준다.
 */
export function splitCapByRole(
  cap: number, nMeasure: number, nOther: number, share: number, tick: number,
): { measure: number; other: number } {
  if (cap <= 0) return { measure: 0, other: 0 }
  if (nMeasure === 0) return { measure: 0, other: Math.min(cap, nOther) }
  if (nOther === 0) return { measure: Math.min(cap, nMeasure), other: 0 }
  // cap 1 은 나눌 수 없다 — 회차마다 번갈아(양쪽 다 전진한다).
  if (cap === 1) {
    const toMeasure = ((Math.trunc(tick) % 2) + 2) % 2 === 0
    return toMeasure ? { measure: 1, other: 0 } : { measure: 0, other: 1 }
  }
  // 비율대로 나누되 양쪽 최소 1 — 한쪽이 0 이면 그 역할의 커서가 안 움직인다.
  let m = Math.min(Math.max(1, Math.round(cap * share)), cap - 1, nMeasure)
  let o = cap - m
  // 상대가 가진 레인보다 몫이 크면 남는다 → 넘긴다(양방향).
  if (o > nOther) { m = Math.min(nMeasure, m + (o - nOther)); o = nOther }
  if (m > nMeasure) { o = Math.min(nOther, o + (m - nMeasure)); m = nMeasure }
  return { measure: m, other: o }
}

/** 역할별 커서 + 회차 카운터. `tick` 은 `cap === 1` 교대에 쓴다. */
export interface LaneCursors {
  measure: number
  other: number
  tick: number
}

/**
 * 저장값 → 커서. **구 포맷(숫자 하나)을 받아준다** — 배포 시점에 라이브에 숫자가 들어 있다.
 * 깨진 값은 0 에서 시작한다(정확성은 커서와 무관하고 공평성만 약해진다 — fail-soft).
 */
export function readCursors(raw: unknown): LaneCursors {
  const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? Math.trunc(n) : 0 }
  if (typeof raw === 'number') return { measure: 0, other: num(raw), tick: 0 }
  if (typeof raw === 'string') {
    const t = raw.trim()
    if (t.startsWith('{')) {
      try {
        const o = JSON.parse(t) as Record<string, unknown>
        return { measure: num(o.measure), other: num(o.other), tick: num(o.tick) }
      } catch { return { measure: 0, other: 0, tick: 0 } }
    }
    return { measure: 0, other: num(t), tick: 0 }   // 구 포맷
  }
  if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>
    return { measure: num(o.measure), other: num(o.other), tick: num(o.tick) }
  }
  return { measure: 0, other: 0, tick: 0 }
}

/** 정렬된 목록에서 커서부터 `want` 개를 집는다 — 역할 하나의 라운드로빈. */
function pickFrom<T extends LaneCandidate>(lanes: T[], want: number, cursor: number) {
  const n = lanes.length
  if (n === 0) return { run: [] as T[], deferred: [] as T[], next: 0 }
  const c = Number.isFinite(cursor) ? ((Math.trunc(cursor) % n) + n) % n : 0   // 음수·NaN 안전
  const take = Math.min(Math.max(0, Math.trunc(want) || 0), n)
  const ordered = [...lanes].sort((a, b) => {
    const ka = assignKey(a.beat), kb = assignKey(b.beat)
    return ka < kb ? -1 : ka > kb ? 1 : 0
  })
  if (take === 0) return { run: [] as T[], deferred: ordered, next: c }
  const picked = new Set<number>()
  const run: T[] = []
  for (let i = 0; i < take; i++) {
    const idx = (c + i) % n
    picked.add(idx)
    run.push(ordered[idx])
  }
  return { run, deferred: ordered.filter((_, i) => !picked.has(i)), next: (c + take) % n }
}

/**
 * 매시간 레인만 미룰 수 있다.
 *
 * ⚠️ **이게 이 파일에서 가장 위험한 부분이다.** 일 1회 레인(예: 19:00 UTC 야간 재보정)을 조에
 * 넣으면, 그 레인의 조 차례가 19시가 아닌 시간에 걸리는 순간 **영원히 안 돈다.** 침묵이 아니라
 * 부재라 경보에도 안 잡힌다 — 이 레포가 `MAINT_SCHEDULE` 주석에 같은 경고를 적어 둔 바로 그 사고다.
 * 그래서 주기가 1시간보다 긴 레인은 **무조건 이번 회차에 돈다**(그 시간에만 조건이 참이므로).
 *
 * 🕳️ **`gapMin` 으로 판정하면 안 된다** (2026-08-03 라이브에서 잡음 — 오늘 세 번째 같은 형태).
 *   `gapMin` 은 *침묵 판정 임계*(`staleGapMinutes` = 주기×2+30)이지 주기가 아니다. 늦게 도착한
 *   레인을 오탐하지 않으려고 **일부러 부풀린 값**이다. 그런데 #1006 이 관측을 고치려고 매시간 레인에
 *   `hourlyGapMinutes() = 150` 을 채우자, 여기서 `150 > 60` 이 되어 **매시간 레인 14개가 통째로
 *   "미룰 수 없음"** 이 됐다(실측 12:00 KST: 네 도메인 전부 `deferred: 0`). 예산·학습기가 통제하는
 *   대상은 미룰 수 있는 레인뿐이므로, **통제 대상이 0 개**가 되어 #1007 수리가 옳고도 무력해졌다.
 *   의도와 정반대다 — 매시간 레인은 다음 시간에 또 오니 **가장 미루기 쉬운** 레인인데, 그 주기를
 *   기록했다는 이유로 가장 미룰 수 없는 레인이 됐다.
 *
 * ⇒ 주기는 `periodMin` 으로 **따로** 싣는다. `gapMin` 폴백은 남겨 둔다 — `periodMin` 을 안 싣는
 *   게이트 레인(일 1회·N시간·스케줄)은 종전 그대로 `always` 여야 하고, 그 값들은 전부 60 을 넘는다.
 *   ⚠️ 부풀린 값에서 주기를 **역산하지 말 것**(`(gap−30)/2`) — 공식이 바뀌는 순간 조용히 깨진다.
 */
export function isDeferrable(lane: LaneCandidate): boolean {
  const period = Number(lane.periodMin)
  if (Number.isFinite(period) && period > 0) return period <= 60
  const gap = Number(lane.gapMin)
  if (!Number.isFinite(gap) || gap <= 0) return true // 둘 다 미지정 = 매시간(kick 기본값과 같은 해석)
  return gap <= 60
}

/**
 * 조 배정에 쓰는 **안정 키** — 쿼리스트링을 뗀 경로 이름.
 *
 * ⚠️ 이게 없으면 조용히 깨진다. 라이브에 `maintenance?phase=merge` / `?phase=reclassify` 처럼
 * **매 시간 이름이 바뀌는 레인**이 있다. 이름 그대로 정렬하면 그 레인의 정렬 위치가 시간마다 달라지고,
 * 그 사이에 낀 다른 레인들의 인덱스가 한 칸씩 밀려 **조가 튄다** — 어떤 레인은 두 시간 연속 돌고
 * 어떤 레인은 통째로 건너뛴다. 쿼리를 떼면 `maintenance` 는 늘 같은 자리다.
 *
 * (처음엔 이 문제를 못 봤다. "배열을 뒤집어도 같은가" 테스트로 잡으려 했는데 15개 배열의 reverse 는
 *  홀짝을 보존해서 2조 분할에 아무 영향이 없었다 — 가드가 헛돌고 있었다.)
 */
export function assignKey(beat: string): string {
  return String(beat).split('?')[0]
}

export interface LaneSelection<T extends LaneCandidate> {
  /** 이번 회차에 띄울 레인. */
  run: T[]
  /** 이번 회차엔 안 띄우는 레인 — **버리는 게 아니라 미루는 것**(다음 차례에 돈다). */
  deferred: T[]
  /** 이번 회차에 매시간 레인에 실제로 준 몫(= 예산 − 항상돌것). 0 이면 이 시간엔 매시간 레인이 하나도 못 돈다. */
  cap: number
  /** 그 몫을 역할로 나눈 결과 — 배분이 의도대로 됐는지 스냅샷에서 바로 읽으려고 남긴다. */
  capMeasure: number
  capOther: number
  /** 다음 회차가 이어받을 커서(역할별). 호출부가 저장한다. */
  nextCursor: LaneCursors
  /** 항상 돌아야 하는(미룰 수 없는) 레인 수 — 예산을 통째로 먹으면 이 값이 경보다. */
  always: number
}

/**
 * 이번 정각에 띄울 레인을 고른다 — **커서 라운드로빈**.
 *
 * ## 왜 고정 분할(`i % groups === hour % groups`)을 버렸나 — 2026-08-02 실측 결함
 * 첫 구현은 매시간 레인을 `groups` 개의 조로 나눠 시간마다 한 조씩 돌렸다. 그런데 **일 1회·N시간
 * 레인은 미룰 수 없어서**(미루면 영영 안 돈다) 그 시간의 실행 수에 그대로 얹혔다. 결과:
 *
 * ```
 *   예산 8  →  실제 실행 12   (16:00 UTC: dailyAt(16) + everyNHours(2) 가 겹친 시간)
 * ```
 * 그 회차에서 꼬리 3개(`collect-commerce`·`collect-neis`·`collect-nps`)가 26초대에
 * `Worker exceeded CPU time limit` 로 잘렸다. **예산을 지킨다고 해 놓고 안 지키고 있었다.**
 *
 * ⚠️ 그리고 내가 써 둔 "한 회차가 예산을 넘지 않는다" 어서션은 **통과했다** — 픽스처에 일 1회
 *   레인이 하나도 없어 `always` 가 빈 배열이었기 때문이다. 실패할 수 없는 가드였다(오늘 세 번째).
 *
 * ## 고친 방식 — 몫을 줄이되, 굶기지 않는다
 * `cap = 예산 − 항상돌것` 으로 매시간 레인의 몫을 **줄인다**. 그런데 이러면 몫이 시간마다 달라져
 * **고정 분할의 커버리지 증명이 깨진다**(조 개수가 시간마다 바뀌면 어떤 레인은 계속 건너뛸 수 있다).
 * 그래서 분할이 아니라 **커서**로 바꿨다: 정렬된 목록을 커서부터 `cap` 개 집고 커서를 그만큼 민다.
 *
 * ⇒ 몫이 들쭉날쭉해도 **순서대로 도니까 굶는 레인이 구조적으로 없다.** 커버리지는 "cap 이 매번
 *   1 이상이면 최대 n 회차 안에 전원"으로 증명된다(유닛이 변동 몫으로 시뮬레이션해 강제).
 *
 * ⚠️ `cap` 하한은 **1**이다. 항상 돌 레인이 예산을 다 먹어도 매시간 레인 한 개는 전진시킨다 —
 *   0 으로 두면 그 시간대가 반복될 때 커서가 영원히 안 움직인다(= 부재, 이 파일이 막으려는 바로 그것).
 *
 * ## 🎭 그리고 몫을 **역할로** 나눈다 (2026-08-02 대표 확정)
 * 위까지가 "굶는 레인이 없다"는 보장이라면, 이건 "**옳은 레인이 굶지 않는다**"는 보장이다.
 * 커서 라운드로빈은 모든 레인을 동등하게 돌리는데, 레인은 동등하지 않다 — 수집은 백로그를
 * 만들고 보강은 백로그를 줄인다. 동등 배분이면 각 기능의 몫이 **등록된 레인 개수**로 정해지고,
 * 데이터 소스를 붙일 때마다 측정의 몫이 자동으로 깎인다(라이브 실측: 수집 13 : 측정 1,
 * `nb_unmeasured` 20,497 → 21,192 상승). ⇒ `MEASURE_SHARE_DEFAULT` 참조.
 *
 * **역할별로 커서가 따로 돈다.** 하나로 합치면(예: 두 역할의 인덱스를 같은 수에서 유도) 몫과
 * 레인 수의 배수 관계에 따라 특정 레인이 영영 안 걸린다 — 굶는 레인이 없다는 위 증명이 깨진다.
 *
 * @param cursor 지난 회차가 남긴 커서(역할별 + 회차). 숫자 하나(구 포맷)도 받는다 — 배포 시점에
 *               라이브에 숫자가 들어 있다. 없거나 깨져도 정확성은 불변이고 공평성만 약해진다(fail-soft).
 * @param share  측정 레인이 가져갈 몫의 비율. 호출부가 env 로 준다(`resolveMeasureShare`).
 */
export function selectLanesForTick<T extends LaneCandidate>(
  lanes: T[], perTick: number, cursor: number | LaneCursors, share: number = MEASURE_SHARE_DEFAULT,
): LaneSelection<T> {
  const always = lanes.filter(l => !isDeferrable(l))
  const movable = lanes.filter(isDeferrable)
  // 🕳️ **`0` 은 "미설정"이 아니라 "이번 회차엔 쉬어라"다** (2026-08-03 라이브에서 잡음).
  //   `domainBudgets` 는 예산이 도메인 수보다 적으면 **일부러 0 을 주고 `tick` 으로 회전**시킨다
  //   (그 함수 docblock: *"매 회차 다른 도메인이 자리를 받게 한다"*). 그런데 여기서 `>= 1` 로 걸러
  //   0 을 기본값 `FREE_LANES_PER_TICK`(6)으로 **바꿔치기**하고 있었다 — 두 함수가 같은 숫자를 정반대로 읽었다.
  //   결과는 **제어 반전**이다: 학습기가 cap 을 조일수록 0 을 받는 도메인이 늘고, 그 도메인들이 오히려
  //   6 으로 풀린다. 실측(11:00 KST, 학습 cap 2 · 4도메인): influencer budget 0 → **3개**,
  //   company budget 0·always 2 → `max(1, 6−2)+2` = **6개**, 총 **11개**가 떴다(예산이 실제로 통제한 건
  //   자리를 받은 prospect 뿐 — deferred 4). 그 붕괴가 부모 꼬리의 `writeTickSummary`·`sheets-sync` 를
  //   지우고 → 빈 회차로 보여 → 학습기가 더 조이는 **폭주 고리**였다.
  //   ⚠️ 굶주림 걱정은 없다 — 쉬는 도메인은 `domainBudgets` 의 회전이 다음 회차에 자리를 준다.
  const budget = Number.isFinite(perTick) && perTick >= 0 ? Math.floor(perTick) : FREE_LANES_PER_TICK
  const cur = readCursors(cursor)
  const tick = cur.tick + 1                     // 회차 카운터 — `cap === 1` 교대에 쓴다
  const n = movable.length
  const base = { always: always.length }
  const zero = { measure: 0, other: 0, tick }
  if (n === 0) return { run: [...always], deferred: [], cap: 0, capMeasure: 0, capOther: 0, nextCursor: zero, ...base }

  // 항상 돌 레인이 먹고 남은 몫. 하한 1 — 위 주석 참조.
  //   단 **예산 0(=쉬는 회차)엔 하한도 없다.** 여기서 1 을 깔면 "쉬어라"가 다시 "1개는 돌려라"가 되고,
  //   미룬 레인은 `deferred` 로 나가 회전 커서가 그대로라 다음 회차에 같은 머리부터 집는다(공평성 불변).
  const cap = budget <= 0 ? 0 : Math.max(1, budget - always.length)
  const measure = movable.filter(l => laneRole(l) === 'measure')
  const other = movable.filter(l => laneRole(l) !== 'measure')
  if (n <= cap) {
    return {
      run: [...always, ...movable], deferred: [], cap,
      capMeasure: measure.length, capOther: other.length, nextCursor: zero, ...base,
    }
  }

  // 🎭 몫을 역할로 나눈다 — 수집 레인이 몇 개든 측정은 자기 비율을 유지한다(`MEASURE_SHARE_DEFAULT`).
  const split = splitCapByRole(cap, measure.length, other.length, share, cur.tick)
  const pm = pickFrom(measure, split.measure, cur.measure)
  const po = pickFrom(other, split.other, cur.other)
  return {
    run: [...always, ...pm.run, ...po.run],
    deferred: [...pm.deferred, ...po.deferred],
    cap, capMeasure: split.measure, capOther: split.other,
    nextCursor: { measure: pm.next, other: po.next, tick },
    ...base,
  }
}

/**
 * 이 회차가 무엇을 돌리고 무엇을 미뤘는지 **스스로 남긴다**(`ads_dispatch_last`).
 *
 * ⚠️ 이게 없으면 "왜 이 레인이 이번 시간에 안 돌았지?"를 구분할 방법이 없다 — 미룬 것과
 * 죽은 것이 똑같이 "기록 없음"으로 보인다. 이 레포에서 그 혼동으로 이미 여러 번 오진했다.
 * (#919 첫 판정에서 실제로 못 봤다 — 쓰기만 하고 진단 API 에 노출을 안 했다.)
 *
 * `over_budget` — 항상 돌 레인만으로 예산을 넘긴 시간. **분산으로 해결 불가**하다는 신호이므로
 * 사람이 보고 그 레인의 시각을 옮기거나 요금제를 올려야 한다.
 */
export function dispatchSnapshot(
  sel: LaneSelection<LaneCandidate>, plan: AdsPlan, perTick: number, hourUTC: number, atIso: string,
): Record<string, unknown> {
  return {
    at: atIso, hour: hourUTC, plan, per_tick: perTick,
    cap: sel.cap, always: sel.always, cursor_next: sel.nextCursor,
    over_budget: sel.always >= perTick,
    // 🎭 배분이 의도대로 됐는지 **다음 세션이 추측 없이 읽게** — 몫과 실제 실행을 나란히 남긴다.
    cap_measure: sel.capMeasure, cap_other: sel.capOther,
    ran_measure: sel.run.filter(l => laneRole(l) === 'measure').map(l => l.beat).sort(),
    ran: sel.run.map(l => l.beat).sort(),
    deferred: sel.deferred.map(l => l.beat).sort(),
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * 🧭 도메인별 예산 분리 (2026-08-02 대표 지시 — "업체 b2b 와 인플루언서를 분리해서 생각")
 * ──────────────────────────────────────────────────────────────────────────── */

/** 도메인별 커서 묶음. 저장은 JSON 한 덩어리(키 하나 유지 — D1 쓰기를 늘리지 않는다). */
export type DomainCursors = Partial<Record<AdsDomain, LaneCursors>>

/**
 * 저장값 → 도메인별 커서. **구 포맷(단일 커서)이면 전 도메인의 시드로 쓴다** —
 * 배포 직후 첫 회차가 0 에서 다시 시작하지 않게(그러면 그 회차만 배분이 한쪽으로 쏠린다).
 */
export function readDomainCursors(raw: unknown): DomainCursors {
  let obj: Record<string, unknown> | null = null
  if (typeof raw === 'string' && raw.trim().startsWith('{')) { try { obj = JSON.parse(raw) as Record<string, unknown> } catch { obj = null } }
  else if (raw && typeof raw === 'object') obj = raw as Record<string, unknown>
  // 도메인 키가 하나라도 있으면 새 포맷.
  if (obj && ADS_DOMAINS.some(d => d in obj!)) {
    const out: DomainCursors = {}
    for (const d of ADS_DOMAINS) if (d in obj) out[d] = readCursors(obj[d])
    return out
  }
  const seed = readCursors(raw)   // 구 포맷(숫자 또는 {measure,other,tick}) → 전 도메인 시드
  const out: DomainCursors = {}
  for (const d of ADS_DOMAINS) out[d] = { ...seed }
  return out
}

/**
 * 🔁 **놀고 있는 몫을 굶는 도메인에 넘긴다** — work-conserving 배분 (2026-08-11 대표 *"처리량 문제도 해결해줘"*).
 *
 * ## 왜 (라이브 스냅샷이 그대로 답이다 — `ads_dispatch_last`, 02:00 UTC)
 * ```
 *   per_tick 12  plan free
 *   influencer  몫 5  run 3          → 2 놀고 있다
 *   company     몫 5  run 1          → 4 놀고 있다
 *   prospect    몫 1  run 1  미룸 1  ← enrich-prospects 가 여기서 매 회차 밀린다(실측 주기 2시간)
 *   wholesale   몫 1  run 1  미룸 0
 * ```
 * **여섯 자리가 비어 있는데 한 레인이 밀렸다.** 비율(3:3:1:1)은 *경쟁이 있을 때* 나누는 규칙인데,
 * 경쟁이 없는 도메인의 몫까지 붙잡아 두니 총 처리량이 구조적으로 손해다. 예산이 모자란 게 아니라
 * **배분이 낭비하고 있었다** — 유료 전환 없이 코드로 회수할 수 있는 유일한 처리량이다.
 *
 * ## 규칙
 * 1. `need[d]` = 그 도메인의 **미룰 수 있는** 레인 수(`always` 는 몫과 무관하게 도니까 뺀다).
 * 2. 남는 몫(`budget − need`, 양수)을 모아 **부족한 도메인**(`need > budget`)에 준다.
 * 3. 한 번에 1씩 **고정 순서 라운드로빈** — 한 도메인이 잉여를 독식하지 않게. 부족분을 다 채우거나
 *    잉여가 마르면 끝.
 *
 * ## ⚠️ 안전 (이 함수가 절대 깨면 안 되는 것)
 * - **총량 불변.** `Σ budgets` 는 그대로다 — 총량은 CPU 한도가 정하는 값이고(`FREE_LANES_PER_TICK`
 *   docblock 의 실측), 여기서 늘리면 그 실측을 무시하고 부모를 죽이는 쪽으로 되돌아간다.
 * - **필요 이상 안 준다.** 한 도메인의 몫이 자기 레인 수를 넘으면 그 자리는 어차피 논다.
 * - **비율은 경쟁이 있을 때만 유지된다** — 네 도메인이 전부 몫을 다 쓰면 이 함수는 아무것도 안 한다
 *   (그때가 대표가 정한 3:3:1:1 이 실제로 의미를 갖는 유일한 상태다).
 */
export function redistributeSlack(
  budgets: Record<AdsDomain, number>,
  need: Record<AdsDomain, number>,
): Record<AdsDomain, number> {
  const out = { ...budgets }
  let slack = 0
  for (const d of ADS_DOMAINS) {
    const spare = (out[d] || 0) - Math.max(0, need[d] || 0)
    if (spare > 0) { out[d] -= spare; slack += spare }
  }
  if (slack <= 0) return out
  // 고정 순서 라운드로빈 — 회차마다 흔들리면 어떤 도메인이 언제 받을지 예측할 수 없다.
  for (let moved = true; slack > 0 && moved;) {
    moved = false
    for (const d of ADS_DOMAINS) {
      if (slack <= 0) break
      if ((out[d] || 0) >= Math.max(0, need[d] || 0)) continue   // 이미 충분하다
      out[d] = (out[d] || 0) + 1; slack -= 1; moved = true
    }
  }
  // 아무도 안 받으면 원래 자리로 되돌린다(총량 불변 — 위 안전 규칙).
  if (slack > 0) for (const d of ADS_DOMAINS) { if (slack <= 0) break; const back = Math.min(slack, Math.max(0, (budgets[d] || 0) - (out[d] || 0))); out[d] += back; slack -= back }
  return out
}

export interface DomainSelection<T extends LaneCandidate> {
  run: T[]
  deferred: T[]
  /** 도메인별 상세 — "누가 굶었나"를 스냅샷에서 바로 읽으려고 남긴다(예전엔 20개가 한 줄에 섞여 안 보였다). */
  perDomain: Record<AdsDomain, { budget: number; run: string[]; deferred: string[]; always: number }>
  nextCursors: DomainCursors
  /** 표에 없는 레인 이름 — CI 유닛이 막지만, 라이브에서도 **보이게** 남긴다(조용한 드리프트 금지). */
  unknown: string[]
}

/**
 * 🍰 **도메인별로 나눠 고른다.** 각 도메인 안에서는 종전 규칙(항상돌것 → 역할 분할 → 라운드로빈)이 그대로다.
 *
 * ⚠️ **바깥은 도메인, 안은 역할** 이 순서가 중요하다. 반대로 하면(역할 먼저) 도메인 격리가 깨져
 *   측정 몫을 한 도메인이 다 가져갈 수 있다 — 그게 지금 고치려는 결합의 다른 얼굴이다.
 *
 * @param tick 회전 기준(보통 hourUTC) — 예산이 도메인 수보다 작을 때만 쓰인다
 */
export function selectLanesByDomain<T extends LaneCandidate>(
  lanes: T[], perTick: number, cursors: DomainCursors, tick = 0, share: number = MEASURE_SHARE_DEFAULT,
): DomainSelection<T> {
  const budget = Number.isFinite(perTick) && perTick >= 1 ? Math.floor(perTick) : FREE_LANES_PER_TICK
  const byDomain = new Map<AdsDomain, T[]>()
  const unknown: string[] = []
  for (const l of lanes) {
    if (!isKnownLane(l.beat)) unknown.push(l.beat)
    const d = laneDomain(l.beat)
    const arr = byDomain.get(d); if (arr) arr.push(l); else byDomain.set(d, [l])
  }
  const active = ADS_DOMAINS.filter(d => (byDomain.get(d)?.length || 0) > 0)
  // 🍰 비율 배분 → 🔁 **놀고 있는 몫을 굶는 도메인에** (총량은 그대로 — 아래 함수 주석의 실측이 근거)
  const need = {} as Record<AdsDomain, number>
  for (const d of ADS_DOMAINS) need[d] = (byDomain.get(d) || []).filter(isDeferrable).length
  const budgets = redistributeSlack(domainBudgets(budget, active, tick), need)

  const run: T[] = [], deferred: T[] = []
  const nextCursors: DomainCursors = {}
  const perDomain = {} as DomainSelection<T>['perDomain']
  for (const d of ADS_DOMAINS) {
    const group = byDomain.get(d) || []
    if (!group.length) { perDomain[d] = { budget: 0, run: [], deferred: [], always: 0 }; continue }
    const sel = selectLanesForTick(group, budgets[d], cursors[d] ?? 0, share)
    run.push(...sel.run); deferred.push(...sel.deferred)
    nextCursors[d] = sel.nextCursor
    perDomain[d] = { budget: budgets[d], run: sel.run.map(l => l.beat).sort(), deferred: sel.deferred.map(l => l.beat).sort(), always: sel.always }
  }
  return { run, deferred, perDomain, nextCursors, unknown: [...new Set(unknown)].sort() }
}

/** 도메인 분리 스냅샷 — 기존 `dispatchSnapshot` 과 같은 자리에 실린다(어드민이 그대로 읽는다). */
export function domainDispatchSnapshot(
  sel: DomainSelection<LaneCandidate>, plan: AdsPlan, perTick: number, hourUTC: number, atIso: string,
): Record<string, unknown> {
  return {
    at: atIso, hour: hourUTC, plan, per_tick: perTick,
    by_domain: sel.perDomain,
    ran: sel.run.map(l => l.beat).sort(),
    deferred: sel.deferred.map(l => l.beat).sort(),
    cursor_next: sel.nextCursors,
    // 🔴 표에 없는 레인 — 있으면 `lane-domains.ts` 에 한 줄 추가할 것(조용히 다른 조에 얹혀 돌고 있다).
    ...(sel.unknown.length ? { unknown_lanes: sel.unknown } : {}),
  }
}
