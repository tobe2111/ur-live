/**
 * 📉 **유어애즈 일일 읽기 예산 — 스스로 멈추는 차단기** (2026-09-02, D1 계정 일일 읽기 한도 사고 후속).
 *
 * ## 왜
 * D1 무료 읽기 한도(하루 500만 행)는 **계정 단위**다. 유어애즈 레인 하나가 폭주하면(9/2 실측: "1회 마이그레이션"이
 * 부팅마다 다시 돌아 12시간에 1억 1,500만 행) 유어딜 소비자 API 가 통째로 500 이 된다. 대표 우선순위는
 * *"유어딜이 가장 중요해. 유어애즈는 문제가 있더라도."* — 그러니 유어애즈는 **자기 몫을 넘기면 스스로 멈춰야**
 * 한다. 사람이 대시보드에서 끄는 것(`ADS_LANES_PAUSED`)은 사고가 난 **뒤**의 일이고, 이 차단기는 사고 **전**에 선다.
 *
 * ## 어떻게
 * · 원장은 **DO 인스턴스 하나**(`AdsLaneDurableObject` 의 `idFromName('read-budget')`). 레인은 회차가 끝날 때
 *   자기 계량기(`d1-read-meter`)의 `rr` 를 `/budget?rr=N` 으로 보내고, 게이트는 `/budget` 으로 상태를 읽는다.
 *   D1 을 안 거친다 — 예산 원장이 예산을 먹으면 안 된다.
 * · 하루 경계는 **UTC 자정**(= 09:00 KST) — Cloudflare 가 한도를 되돌리는 시각과 같아야 "오늘 얼마 썼나"가 맞다.
 * · 넘으면 그 날 **남은 시간 동안** 일시정지와 같은 동작(cron kick 은 등록만 · 알람은 체인만 잇고 안 돌림 ·
 *   사람 대면 두 레인은 면제). 자정이 지나면 다시 돈다. 학습 상태(runs/failStreak/runHistory)는 무접촉.
 * · 기본 150만 행(무료 한도의 30%). 유료 전환 뒤엔 "장애 방지"가 아니라 **비용 상한**이 된다 — 그때 값을 올린다.
 *   `0` 이면 끈다(무제한). ⚠️ 원장을 못 읽으면 **넘은 것으로** 본다(fail-closed) — 모르는 채 읽는 쪽이 유어딜에 더 위험하다.
 *
 * ## 못 막는 것
 * · 레인 **밖**의 읽기(서비스몰 API 요청, 부팅 마이그레이션처럼 `ensure*` 가 첫 요청에서 도는 것). 후자가 9/2 의
 *   원인이었고 그건 #1302 가 따로 막았다. 이 차단기는 **레인 회차**가 보고하는 것만 센다.
 * · 이미 시작한 회차 — 게이트는 회차 **앞**에서만 본다. 한 회차가 예산을 통째로 먹으면 그 회차는 끝까지 간다.
 *
 * 🔻 롤백: `ADS_DAILY_READ_BUDGET=0`(끔) 또는 이 모듈 호출부 3곳 제거. 원장 DO 는 남아도 무해(알람 없음).
 */
export const READ_BUDGET_ENV = 'ADS_DAILY_READ_BUDGET'
export const DEFAULT_DAILY_READ_BUDGET = 1_500_000

/**
 * ✍️ **쓰기 예산** (2026-09-02 추가 — 대표 *"$5 에서 더 추가 비용이 발생되어선 안돼"*).
 *
 * ## 왜 읽기만으로는 부족한가 (같은 날 실측)
 * 요금을 실제로 터뜨릴 뻔한 축은 읽기가 아니라 **쓰기**였다:
 * ```
 *   09-02 00~13시  업체 DB 쓴 행 시간당 210만~780만   ← "1회 마이그레이션" 무한 반복
 *   월 환산 4.8억 행 · 유료 포함분 5,000만/월 → 9.5배 초과 ≈ 월 $427
 *   09-02 13시 #1302 배포 → 14시 이후 0 · 0 · 14,969   (200배 감소)
 * ```
 * 읽기 차단기는 이걸 **못 막는다** — 그 UPDATE 들은 읽기도 많았지만, 읽기 한도를 넘기 전에
 * 쓰기 요금이 먼저 붙는 구간이 있다(포함분 비율이 읽기 250억 vs 쓰기 5,000만 = 500배 차이).
 *
 * ## 기본값 근거 — 150만 → **120만** (2026-09-03 대표 승인 "응 그렇게 하자")
 *
 * ✅ **먼저: 이 차단기는 라이브에서 실제로 돈다.** 유료 전환 첫날(9/2 UTC 날) 시간별 누적이
 * 정확히 예산에서 멈췄다 — 추측이 아니라 실측이다:
 * ```
 *   05시 KST  누적 1,511,523  ← 150만 돌파
 *   06시      누적 1,627,367
 *   07·08시   +0  +0          ← 레인 정지
 *   09시 KST(=UTC 자정)        ← 리셋 후 재개
 * ```
 * 계량기 정확도도 같은 시간대 Cloudflare 분석과 맞춰 확인했다:
 * **쓰기 원장 147,064 vs 실측 132,495(111% — 넉넉히 셈) · 읽기 95%.** 안전한 방향으로 틀린다.
 *
 * ## 왜 150만이 아니라 120만인가 — **본진 몫을 안 빼고 있었다**
 * 포함분은 **계정 단위**인데 150만은 유어애즈만 보고 잡은 값이다. 유어딜 본진이 하루 약 10만 행을
 * 쓰므로(9/3 실측 시간당 4,062) 실제 월 합계는:
 * ```
 *   유어애즈 150만×30 = 4,500만  +  본진 10만×30 = 300만  =  4,800만 / 5,000만 = 96%   ← 여유 4%
 *   유어애즈 120만×30 = 3,600만  +  본진        300만  =  3,900만 / 5,000만 = 78%   ← 여유 22%
 * ```
 * 대표 지시 *"유료요금제 용량을 넘어선 안돼"* 에 4% 여유는 얇다 — 본진 트래픽은 사용자가 늘면 커지고,
 * 그때 넘는 것은 **유어애즈가 아니라 계정**이다. 맞교환은 유어애즈 처리량 약 20% 감소(레인이 하루
 * 3~4시간 일찍 멈춘다)이고, 대표에게 그 대가를 밝히고 승인받았다.
 *
 * ⚠️ **폭주 방어력은 그대로다** — 시간당 300만짜리 폭주는 120만이든 150만이면 어차피 30분 안에 걸린다.
 * 이 값이 정하는 것은 "정상 수집을 하루 몇 시간 돌리나"지 "폭주를 막나"가 아니다.
 * `0` 이면 끈다(무제한).
 */
export const WRITE_BUDGET_ENV = 'ADS_DAILY_WRITE_BUDGET'
export const DEFAULT_DAILY_WRITE_BUDGET = 1_200_000
/** 원장 DO 인스턴스 이름 — 레인 이름과 겹치면 안 된다(`lane-alarm-runners` 등록부에 없어야 `alarm()` 이 무시한다). */
export const READ_BUDGET_DO = 'read-budget'
/** 하트비트 이름(`ads:` 접두는 adsBeat 가 붙인다). */
export const READ_BUDGET_BEAT = 'read-budget'
export const READ_BUDGET_PATH = '/budget'

export interface ReadBudgetState { day: string; used: number; written?: number }
export interface ReadBudgetView extends ReadBudgetState {
  budget: number; over: boolean; unknown?: boolean
  /** 쓰기 쪽 — 원장은 하나이고 축만 둘이다(경계·DO·게이트를 두 벌 만들 이유가 없다). */
  written: number; writeBudget: number; writeOver: boolean
}

/** Cloudflare 가 일일 한도를 되돌리는 경계 = UTC 자정. */
export function utcDay(nowMs: number): string { return new Date(nowMs).toISOString().slice(0, 10) }

/** env 값 → 예산(행). 없거나 못 읽으면 기본값, 0 이하는 0(= 끔). */
export function resolveReadBudget(env: unknown): number {
  return resolveBudget(env, READ_BUDGET_ENV, DEFAULT_DAILY_READ_BUDGET)
}

/**
 * 🚨 **2026년 9월 한시 스로틀 — 10/1 UTC 에 스스로 풀린다.**
 *
 * 9/2 하루에 **4,554만 행**을 쓴 폭주(업체 DB 전면 재기록)가 월 포함분 5,000만을 통째로 먹었다.
 * 그래서 9월 남은 기간은 **누가 쓰든 전부 과금 구간**이다 — 유어딜 본진의 하루 4.5만 행도 포함이다
 * (포함분은 DB 가 아니라 **계정** 단위다). 대표 지시 2026-09-07: *"이번 달은 과금 안 되게"*.
 *
 * 실측 기반 선택지(9/7 21:00 KST 기준, 남은 23.5일):
 * ```
 *   유어애즈 쓰기/일        9월 총 초과      금액
 *              0           2,350,952      $2.35   ← 바닥(본진 몫, 못 멈춘다)
 *         30,000           3,055,952      $3.06   ← 채택
 *      1,200,000          30,550,952     $30.55   ← 그대로 뒀을 때
 * ```
 * 잃는 것이 거의 없어 채택했다 — 제휴 제안 발송은 "한참 뒤"(대표 확정)이고 **백로그는 썩지 않는다**.
 * 6개월 뒤에 측정해도 그때의 현재 활동을 재는 것이라 결과가 같다(CLAUDE.md 유어애즈 절).
 *
 * ⚠️ **`0` 을 쓰면 안 된다** — 아래 `resolveBudget` 에서 0 은 "끔"(**무제한**)이다. 정반대가 된다.
 * ⚠️ **날짜로 스스로 풀리게 한 이유**: 되돌리는 것을 잊어 수집이 영영 묶이는 사고를 막기 위해서다.
 *   이 레포가 반복해 만난 *"실패가 아니라 조용한 부재"* 를 여기서 만들지 않는다.
 * ⚠️ env `ADS_DAILY_WRITE_BUDGET` 를 명시하면 **그 값이 이긴다** — 대표가 언제든 되돌릴 수 있다.
 *
 * 🔭 **근본 처방은 따로다**(이번 범위 밖): 이 예산은 *일일* 상한이라 **월 포함분이 이미 소진됐는지를
 *   모른다**. 그래서 폭주가 월초에 한도를 태워도 남은 날들이 태연히 과금 구간으로 걸어 들어간다.
 *   월 인식 예산이 있었다면 이번 $29 는 애초에 안 생겼다.
 */
export const SEPT_2026_WRITE_THROTTLE = 30_000
export const SEPT_2026_THROTTLE_UNTIL_MS = Date.parse('2026-10-01T00:00:00Z')

/** 쓰기 예산 — 읽기와 **같은 규약**(빈값/이상값이면 기본값, 0 이하면 끔) + 위 한시 스로틀. */
export function resolveWriteBudget(env: unknown, nowMs: number = Date.now()): number {
  const raw = (env as Record<string, unknown> | undefined)?.[WRITE_BUDGET_ENV]
  const explicit = raw !== undefined && raw !== null && String(raw).trim() !== ''
  if (explicit) return resolveBudget(env, WRITE_BUDGET_ENV, DEFAULT_DAILY_WRITE_BUDGET)
  return nowMs < SEPT_2026_THROTTLE_UNTIL_MS ? SEPT_2026_WRITE_THROTTLE : DEFAULT_DAILY_WRITE_BUDGET
}

function resolveBudget(env: unknown, key: string, fallback: number): number {
  const raw = (env as Record<string, unknown> | undefined)?.[key]
  if (raw === undefined || raw === null || String(raw).trim() === '') return fallback
  const n = Math.floor(Number(String(raw).trim()))
  if (!Number.isFinite(n)) return fallback
  return n > 0 ? n : 0
}

/** 원장에 회차 읽기량을 더한다 — 날이 바뀌었으면 0 에서 다시. 음수·NaN 은 0 으로. */
export function applyRead(prev: ReadBudgetState | null | undefined, rr: number, nowMs: number, rw = 0): ReadBudgetState {
  const day = utcDay(nowMs)
  const pos = (n: number) => (Number.isFinite(n) && n > 0 ? Math.floor(n) : 0)
  const same = prev && prev.day === day
  return {
    day,
    used: (same ? prev.used : 0) + pos(rr),
    written: (same ? prev.written || 0 : 0) + pos(rw),
  }
}

export function budgetOver(state: ReadBudgetState | null | undefined, budget: number, nowMs: number): boolean {
  if (!(budget > 0) || !state) return false
  return state.day === utcDay(nowMs) && state.used >= budget
}

/** 쓰기 초과 판정 — 읽기와 같은 모양(날이 바뀌면 자동 해제). */
export function writeBudgetOver(state: ReadBudgetState | null | undefined, budget: number, nowMs: number): boolean {
  if (!(budget > 0) || !state) return false
  return state.day === utcDay(nowMs) && (state.written || 0) >= budget
}

interface StorageLike { get<T>(key: string): Promise<T | undefined>; put(key: string, value: unknown): Promise<void> }
export const READ_BUDGET_STORAGE_KEY = 'readBudget'

/**
 * 원장 DO 의 `/budget` 처리 — 순수하게 떼어 둔 것은 테스트 때문이다(`cloudflare:workers` 의 DO 클래스는 vitest 에서
 * 못 올린다). `?rr=N` 이 있으면 더하고, 없으면 읽기만. 응답은 언제나 현재 상태.
 */
export async function handleBudgetRequest(url: URL, storage: StorageLike, env: unknown, nowMs = Date.now()): Promise<ReadBudgetView> {
  const budget = resolveReadBudget(env)
  const writeBudget = resolveWriteBudget(env)
  const prev = (await storage.get<ReadBudgetState>(READ_BUDGET_STORAGE_KEY)) ?? null
  const rr = Number(url.searchParams.get('rr') || 0)
  const rw = Number(url.searchParams.get('rw') || 0)
  // ⚠️ 둘 중 **하나라도** 보고되면 원장을 갱신한다. `rr>0` 만 보던 예전 조건을 그대로 두면
  //   읽기 없이 쓰기만 한 회차(전수 UPDATE 가 정확히 그렇다)가 **한 행도 안 세진다.**
  const reported = rr > 0 || rw > 0
  const next = reported
    ? applyRead(prev, rr, nowMs, rw)
    : (prev && prev.day === utcDay(nowMs) ? prev : { day: utcDay(nowMs), used: 0, written: 0 })
  if (reported) await storage.put(READ_BUDGET_STORAGE_KEY, next)
  return {
    ...next, written: next.written || 0,
    budget, over: budgetOver(next, budget, nowMs),
    writeBudget, writeOver: writeBudgetOver(next, writeBudget, nowMs),
  }
}

type NsEnv = { ADS_LANE?: DurableObjectNamespace } | undefined
function ledger(env: unknown): DurableObjectStub | null {
  const ns = (env as NsEnv)?.ADS_LANE
  return ns ? ns.get(ns.idFromName(READ_BUDGET_DO)) : null
}

/**
 * 게이트가 부른다 — 오늘 얼마나 썼고 넘었는가. ⚠️ **원장을 못 읽으면 넘은 것으로**(`unknown: true`) — 예산 원장이
 * 죽었을 때 "모르니까 돈다"는 9/2 의 유어딜을 다시 만드는 쪽이다. 예산이 0(끔)이면 원장을 묻지도 않는다.
 */
export async function readBudgetState(env: unknown): Promise<ReadBudgetView> {
  const budget = resolveReadBudget(env)
  const writeBudget = resolveWriteBudget(env)
  const day = utcDay(Date.now())
  const idle = { day, used: 0, written: 0, budget, writeBudget }
  // 둘 다 꺼져 있을 때만 원장을 안 묻는다 — 한쪽만 켜도 원장이 필요하다.
  if (budget <= 0 && writeBudget <= 0) return { ...idle, over: false, writeOver: false }
  const stub = ledger(env)
  if (!stub) return { ...idle, over: true, writeOver: true, unknown: true }
  try {
    const res = await stub.fetch(`https://ur-ads${READ_BUDGET_PATH}`)
    const body = (await res.json()) as ReadBudgetView
    return {
      day: body.day, used: Number(body.used) || 0, written: Number(body.written) || 0,
      budget, over: !!body.over, writeBudget, writeOver: !!body.writeOver,
    }
  } catch {
    return { ...idle, over: true, writeOver: true, unknown: true }
  }
}

/** 회차가 끝나며 부른다 — 자기 읽기량을 원장에 더한다. 실패해도 조용히(관측이 레인을 죽이면 안 된다). */
export async function reportReadUsage(env: unknown, rr: number | undefined, rw?: number | undefined): Promise<void> {
  const r = rr && rr > 0 ? Math.floor(rr) : 0
  const w = rw && rw > 0 ? Math.floor(rw) : 0
  if (r === 0 && w === 0) return
  if (resolveReadBudget(env) <= 0 && resolveWriteBudget(env) <= 0) return
  const stub = ledger(env)
  if (!stub) return
  try { await stub.fetch(`https://ur-ads${READ_BUDGET_PATH}?rr=${r}&rw=${w}`, { method: 'POST' }) } catch { /* 원장 실패는 삼킨다 */ }
}

/** 하트비트에 싣는 요약 — 숫자·불리언만(summarizeResult 가 `k=v` 로 편다). */
export function budgetBeatFields(v: ReadBudgetView): Record<string, number | boolean> {
  return {
    used: v.used, budget: v.budget, over: v.over,
    written: v.written, wbudget: v.writeBudget, wover: v.writeOver,
    ...(v.unknown ? { unknown: true } : {}),
  }
}

/** 게이트의 단일 판정 — 어느 축이든 넘으면 멈춘다. */
export function budgetBlocked(v: ReadBudgetView): boolean { return v.over || v.writeOver }
