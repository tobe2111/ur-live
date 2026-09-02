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
/** 원장 DO 인스턴스 이름 — 레인 이름과 겹치면 안 된다(`lane-alarm-runners` 등록부에 없어야 `alarm()` 이 무시한다). */
export const READ_BUDGET_DO = 'read-budget'
/** 하트비트 이름(`ads:` 접두는 adsBeat 가 붙인다). */
export const READ_BUDGET_BEAT = 'read-budget'
export const READ_BUDGET_PATH = '/budget'

export interface ReadBudgetState { day: string; used: number }
export interface ReadBudgetView extends ReadBudgetState { budget: number; over: boolean; unknown?: boolean }

/** Cloudflare 가 일일 한도를 되돌리는 경계 = UTC 자정. */
export function utcDay(nowMs: number): string { return new Date(nowMs).toISOString().slice(0, 10) }

/** env 값 → 예산(행). 없거나 못 읽으면 기본값, 0 이하는 0(= 끔). */
export function resolveReadBudget(env: unknown): number {
  const raw = (env as Record<string, unknown> | undefined)?.[READ_BUDGET_ENV]
  if (raw === undefined || raw === null || String(raw).trim() === '') return DEFAULT_DAILY_READ_BUDGET
  const n = Math.floor(Number(String(raw).trim()))
  if (!Number.isFinite(n)) return DEFAULT_DAILY_READ_BUDGET
  return n > 0 ? n : 0
}

/** 원장에 회차 읽기량을 더한다 — 날이 바뀌었으면 0 에서 다시. 음수·NaN 은 0 으로. */
export function applyRead(prev: ReadBudgetState | null | undefined, rr: number, nowMs: number): ReadBudgetState {
  const day = utcDay(nowMs)
  const add = Number.isFinite(rr) && rr > 0 ? Math.floor(rr) : 0
  return prev && prev.day === day ? { day, used: prev.used + add } : { day, used: add }
}

export function budgetOver(state: ReadBudgetState | null | undefined, budget: number, nowMs: number): boolean {
  if (!(budget > 0) || !state) return false
  return state.day === utcDay(nowMs) && state.used >= budget
}

interface StorageLike { get<T>(key: string): Promise<T | undefined>; put(key: string, value: unknown): Promise<void> }
export const READ_BUDGET_STORAGE_KEY = 'readBudget'

/**
 * 원장 DO 의 `/budget` 처리 — 순수하게 떼어 둔 것은 테스트 때문이다(`cloudflare:workers` 의 DO 클래스는 vitest 에서
 * 못 올린다). `?rr=N` 이 있으면 더하고, 없으면 읽기만. 응답은 언제나 현재 상태.
 */
export async function handleBudgetRequest(url: URL, storage: StorageLike, env: unknown, nowMs = Date.now()): Promise<ReadBudgetView> {
  const budget = resolveReadBudget(env)
  const prev = (await storage.get<ReadBudgetState>(READ_BUDGET_STORAGE_KEY)) ?? null
  const rr = Number(url.searchParams.get('rr') || 0)
  const next = rr > 0 ? applyRead(prev, rr, nowMs) : (prev && prev.day === utcDay(nowMs) ? prev : { day: utcDay(nowMs), used: 0 })
  if (rr > 0) await storage.put(READ_BUDGET_STORAGE_KEY, next)
  return { ...next, budget, over: budgetOver(next, budget, nowMs) }
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
  const day = utcDay(Date.now())
  if (budget <= 0) return { day, used: 0, budget, over: false }
  const stub = ledger(env)
  if (!stub) return { day, used: 0, budget, over: true, unknown: true }
  try {
    const res = await stub.fetch(`https://ur-ads${READ_BUDGET_PATH}`)
    const body = (await res.json()) as ReadBudgetView
    return { day: body.day, used: Number(body.used) || 0, budget, over: !!body.over }
  } catch {
    return { day, used: 0, budget, over: true, unknown: true }
  }
}

/** 회차가 끝나며 부른다 — 자기 읽기량을 원장에 더한다. 실패해도 조용히(관측이 레인을 죽이면 안 된다). */
export async function reportReadUsage(env: unknown, rr: number | undefined): Promise<void> {
  if (!(rr && rr > 0) || resolveReadBudget(env) <= 0) return
  const stub = ledger(env)
  if (!stub) return
  try { await stub.fetch(`https://ur-ads${READ_BUDGET_PATH}?rr=${Math.floor(rr)}`, { method: 'POST' }) } catch { /* 원장 실패는 삼킨다 */ }
}

/** 하트비트에 싣는 요약 — 숫자·불리언만(summarizeResult 가 `k=v` 로 편다). */
export function budgetBeatFields(v: ReadBudgetView): Record<string, number | boolean> {
  return { used: v.used, budget: v.budget, over: v.over, ...(v.unknown ? { unknown: true } : {}) }
}
