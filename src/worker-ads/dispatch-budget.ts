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
 *   Free  기본 8  → 15개 레인이 2개 조로 나뉨 → 각 레인 2시간마다
 *   Paid 기본 64  → 조가 1개 → 전 레인 매시간 (= 오늘 이전 동작)
 * ```
 *
 * **유료 전환에 코드 변경이 필요 없다.** 대시보드에서 `ADS_PLAN=paid` 한 줄이면 조가 합쳐지며
 * 모든 레인의 주기가 자동으로 짧아진다. 중간값이 필요하면 `ADS_LANES_PER_TICK` 로 직접 준다
 * (예: 12 → 조 2개지만 한쪽이 12/3 으로 기울어 더 자주). **분산 구조 자체가 스케일 노브다.**
 *
 * ⚠️ **8 이라는 숫자는 이론이 아니라 실측이다**(위 14:00 회차에서 완주한 개수). 레인이
 * 무거워지거나 가벼워지면 다시 측정해야 한다 — 코드는 이 값의 타당성을 알 수 없다.
 * 재측정 방법: 어드민 `cron-heartbeats` 에서 한 정각의 `ok=true` 개수를 센다.
 */

/** 요금제 — `ADS_PLAN` env 값. 미설정이면 free(현재 상태). */
export type AdsPlan = 'free' | 'paid'

/**
 * Free: 한 정각에 완주 가능한 레인 수(2026-08-01 실측 = 8).
 * ⚠️ 낮추면 각 레인의 주기가 길어진다 — 값을 만드는 레인(보강)의 회차가 줄어드는 직접 비용.
 */
export const FREE_LANES_PER_TICK = 8
/**
 * Paid: 사실상 상한 없음(현재 등록 레인 15개). 조를 1개로 만들어 **전 레인 매시간**으로 되돌린다.
 * ⚠️ 큰 값을 쓰는 이유: 레인이 늘어도 유료에서는 계속 조가 1개로 유지되게 하기 위함이다.
 */
export const PAID_LANES_PER_TICK = 64

export interface DispatchEnv {
  ADS_PLAN?: string
  ADS_LANES_PER_TICK?: string
}

/** `ADS_PLAN` 해석 — 오타/대소문자/공백에 관대하되, **모르는 값은 free**(안전한 쪽). */
export function resolvePlan(env: DispatchEnv | undefined | null): AdsPlan {
  const raw = String(env?.ADS_PLAN ?? '').trim().toLowerCase()
  return raw === 'paid' ? 'paid' : 'free'
}

/**
 * 이 회차에 띄울 레인 수.
 * 우선순위: 명시값(`ADS_LANES_PER_TICK`) > 요금제 기본값.
 * ⚠️ 0 이하·비숫자는 **무시하고 기본값**으로 간다 — 오타 하나로 파이프라인이 통째로 멈추면 안 된다
 *    (이 레포가 반복해 만난 "실패가 아니라 조용한 부재" 클래스를 여기서 만들지 않는다).
 */
export function lanesPerTick(env: DispatchEnv | undefined | null): number {
  const explicit = Number(String(env?.ADS_LANES_PER_TICK ?? '').trim())
  if (Number.isFinite(explicit) && explicit >= 1) return Math.floor(explicit)
  return resolvePlan(env) === 'paid' ? PAID_LANES_PER_TICK : FREE_LANES_PER_TICK
}

/** 디스패치 후보 한 건. `hourly=false`(일 1회·N시간마다)는 **절대 미루지 않는다** — 아래 참조. */
export interface LaneCandidate {
  /** 하트비트 이름 — 조 배정의 **안정 키**. 경로가 아니라 이 이름을 쓴다(경로는 바뀔 수 있다). */
  beat: string
  /** 이 레인의 기대 간격(분). 60 이하면 매시간 레인 = 미룰 수 있다. */
  gapMin?: number
}

/**
 * 매시간 레인만 미룰 수 있다.
 *
 * ⚠️ **이게 이 파일에서 가장 위험한 부분이다.** 일 1회 레인(예: 19:00 UTC 야간 재보정)을 조에
 * 넣으면, 그 레인의 조 차례가 19시가 아닌 시간에 걸리는 순간 **영원히 안 돈다.** 침묵이 아니라
 * 부재라 경보에도 안 잡힌다 — 이 레포가 `MAINT_SCHEDULE` 주석에 같은 경고를 적어 둔 바로 그 사고다.
 * 그래서 `gapMin > 60` 인 레인은 **무조건 이번 회차에 돈다**(그 시간에만 조건이 참이므로).
 */
export function isDeferrable(lane: LaneCandidate): boolean {
  const gap = Number(lane.gapMin)
  if (!Number.isFinite(gap) || gap <= 0) return true // 미지정 = 매시간(kick 기본값과 같은 해석)
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
  /** 다음 회차가 이어받을 커서. 호출부가 저장한다. */
  nextCursor: number
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
 * @param cursor 지난 회차가 남긴 커서. 없으면 0(또는 시각 유도값) — 정확성은 커서 유무와 무관하고,
 *               커서가 없으면 공평성만 약해진다(fail-soft).
 */
export function selectLanesForTick<T extends LaneCandidate>(
  lanes: T[], perTick: number, cursor: number,
): LaneSelection<T> {
  const always = lanes.filter(l => !isDeferrable(l))
  const movable = lanes.filter(isDeferrable)
  const budget = Number.isFinite(perTick) && perTick >= 1 ? Math.floor(perTick) : FREE_LANES_PER_TICK
  const n = movable.length
  const base = { always: always.length }
  if (n === 0) return { run: [...always], deferred: [], cap: 0, nextCursor: 0, ...base }

  // 항상 돌 레인이 먹고 남은 몫. 하한 1 — 위 주석 참조.
  const cap = Math.max(1, budget - always.length)
  if (n <= cap) return { run: [...always, ...movable], deferred: [], cap, nextCursor: 0, ...base }

  const ordered = [...movable].sort((a, b) => {
    const ka = assignKey(a.beat), kb = assignKey(b.beat)
    return ka < kb ? -1 : ka > kb ? 1 : 0
  })
  const c = Number.isFinite(cursor) ? ((Math.trunc(cursor) % n) + n) % n : 0  // 음수·NaN 안전
  const picked = new Set<number>()
  const run: T[] = [...always]
  for (let i = 0; i < cap; i++) {
    const idx = (c + i) % n
    picked.add(idx)
    run.push(ordered[idx])
  }
  const deferred = ordered.filter((_, i) => !picked.has(i))
  return { run, deferred, cap, nextCursor: (c + cap) % n, ...base }
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
    ran: sel.run.map(l => l.beat).sort(),
    deferred: sel.deferred.map(l => l.beat).sort(),
  }
}
