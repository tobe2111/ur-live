/**
 * 🔬 **유어딜 예약분을 상수에서 실측으로** (2026-10-06, 대표 *"예약분 실측 자동으로 하자."*).
 *
 * ## 왜 — 상수는 "틀렸다"고 말해 주지 않는다
 * 월 쓰기 예산(`read-budget.ts`)은 포함분에서 **유어딜 몫을 먼저 뗀다**. 포함분이 DB 가 아니라
 * **계정** 단위이기 때문이다. 그런데 그 몫이 손으로 적은 상수였고, 유어애즈 원장은 **자기 쓰기만**
 * 센다 ⇒ 본진이 커지면 **에러 없이 청구서로만** 드러난다. 10/6 실측이 그 자리에 도착해 있었다:
 * ```
 *   유어딜 31일 실측 1,373,461  vs  옛 예약분 1,500,000  →  91.6% (1.09배만 커져도 초과)
 * ```
 * 대표 하드 제약은 **초과 $0**("$5 이상을 넘으면 절대 안돼")이고 *"유어딜 사용자 많아지는 것도
 * 감안"* 이다. 상수를 4.4배(6,000,000)로 올려 급한 불은 껐지만, 그건 **다음 번 재측정까지 틀린 값**이다.
 *
 * ## 어떻게
 * `ur-ads` 는 **본진 DB(`DB`)를 이미 바인딩**하고 그 DB 의 `platform_settings` 에 CF API 토큰이 있다
 * (`wrangler-ads.toml` · CLAUDE.md "☁️ Cloudflare API 접근"). ⇒ CF GraphQL
 * (`d1AnalyticsAdaptiveGroups`)로 **계정 전체 쓴 행**을 읽어 유어애즈 DB 둘을 빼면 나머지가 본진 몫이다.
 * ```
 *   other(= 유어딜 예약분 원천) = 계정 전체 − ads-leads − ads-company
 *   예약분 = max(바닥 2,000,000, ceil(이번 달 추정 other × 1.3))
 * ```
 * **스스로 따라간다** — 유어딜이 자라면 다음 갱신에서 예약분이 커지고 유어애즈 몫이 줄어든다.
 * 사람이 재측정해 상수를 고치는 단계가 사라진다(그 단계가 이번에 실제로 밀려 있었다).
 *
 * ## 🔒 자격증명 취급
 * · 토큰은 **헤더에만** 실린다 — 쿼리·본문·반환값·하트비트 어디에도 안 들어간다.
 * · 이 파일엔 `console` 이 **한 줄도 없다**(시험이 고정) — 실패는 `null` 로만 말한다.
 * · 호출 대상은 `api.cloudflare.com` **하나**. 읽기 전용 쿼리이고 쓰기 API 는 부르지 않는다.
 * · 못 읽거나(토큰 없음·권한 없음·CF 오류) 낡으면 **상수로 되돌아간다**(fail-safe — 아래 `effectiveReserve`).
 *
 * ## 못 하는 것
 * · 계정의 **다른 D1 전부**가 `other` 로 뭉친다(본진 + 유어애즈가 본진 DB 에 쓰는 하트비트·설정 + 잔여 5개).
 *   분리할 수 없고, 분리하지 않는 쪽이 **안전한 방향**이다(예약분이 커지면 유어애즈가 줄어든다).
 * · CF 분석 집계는 수 분 지연된다 — 그래서 지출 판정은 원장(즉시)과 **큰 쪽**을 쓴다(`read-budget.ts`).
 */
import { utcDay, utcDaysInMonth, utcMonth, utcMonthElapsedDays } from './budget-calendar'

/** 한 번의 계정 실측. `at` 은 **측정 시각**(신선도 판정) — 월이 다르면 통째로 못 쓴다. */
export interface AccountUsage {
  /** 측정한 UTC 월(`2026-10`). */ month: string
  /** 유어애즈 DB 둘을 뺀 나머지 계정 쓰기(= 유어딜 몫 원천), 이번 달 누적. */ other: number
  /** 유어애즈 DB 둘의 실제 쓰기, 이번 달 누적 — **원장의 교차검증값**. */ ads: number
  /** 측정 시각(ms). */ at: number
}

export const CF_GRAPHQL_URL = 'https://api.cloudflare.com/client/v4/graphql'

/**
 * 유어애즈 소유 D1 — 이 둘만 "유어애즈 쓰기"다(`wrangler-ads.toml` 의 `ADS_DB`·`ADS_COMPANY_DB`).
 *
 * ⚠️ 본진 `DB`(d9530ba6)는 **일부러 넣지 않는다** — 유어애즈가 그 DB 에 쓰는 하트비트·설정까지
 *   보수적으로 유어딜 몫으로 잡는다(예약분이 커지는 쪽 = 안전한 방향).
 * ⚠️ 새 유어애즈 DB 를 붙이면 **여기에 한 줄**. 빠뜨리면 그 DB 의 쓰기가 유어딜 몫으로 잡혀
 *   유어애즈가 스스로를 굶긴다 — 시험이 `wrangler-ads.toml` 과 대조해 드리프트를 막는다.
 * 🏷️ 이름에 `ADS_` 접두를 **쓰지 않는다**(그래서 `OWN_D1_IDS` 다) — `ads-env-drift.test.ts` 가
 *   `src/worker-ads` 안의 `ADS_*` 토큰을 전부 **env 키 후보**로 긁어, 상수여도 목록 누락으로 신고한다.
 */
export const OWN_D1_IDS: readonly string[] = [
  'd4630482-b97e-4e96-bb96-abde4ef8cc95',   // ADS_DB         — ad_influencer_leads
  '0e9a8f82-32fb-4584-878c-cdaec6c0aff0',   // ADS_COMPANY_DB — ad_company_leads
]

/** 실측이 이보다 낡으면 **추정에 못 쓴다**(상수로 폴백). 보고는 보고마다 갱신되므로 하루면 넉넉하다. */
export const ACCT_STALE_MS = 26 * 60 * 60 * 1000
/** 갱신 시도 간격 — 실패해도 이 간격 전엔 다시 안 부른다(매 회차 재시도하면 모든 보고에 지연이 붙는다). */
export const ACCT_RETRY_MS = 60 * 60 * 1000
/** 추정치에 곱하는 성장 여유. 대표 *"유어딜 사용자 많아지는 것도 감안"* 의 수치화. */
export const ACCT_GROWTH_FACTOR = 1.3
/** 예약분 바닥 — 실측이 0 에 가까운 월초에도 본진 몫을 0 으로 두지 않는다(10/6 실측 월 1.37M 의 1.46배). */
export const ACCT_MIN_RESERVE = 2_000_000
/** 일당 속도를 낼 때의 분모 하한(일) — 월 첫 몇 분에 0 으로 나누는 것만 막는다. */
export const ACCT_MIN_ELAPSED_DAYS = 0.25

/** CF GraphQL 본문. **토큰은 안 들어간다**(헤더 전용) — 이 값은 로그에 실려도 안전하다. */
export function accountUsageBody(accountTag: string, from: string, to: string): Record<string, unknown> {
  return {
    query: `query($acct:String!,$from:Date!,$to:Date!){viewer{accounts(filter:{accountTag:$acct}){`
      + `d1AnalyticsAdaptiveGroups(limit:1000,filter:{date_geq:$from,date_leq:$to})`
      + `{sum{rowsWritten}dimensions{date databaseId}}}}}`,
    variables: { acct: accountTag, from, to },
  }
}

interface UsageGroup { sum?: { rowsWritten?: number }; dimensions?: { databaseId?: string } }

/**
 * CF 응답 → 실측. **모양이 조금이라도 다르면 `null`** — 추측한 숫자로 예약분을 정하면
 * 그 오류가 청구서로만 드러난다(상수 폴백이 언제나 더 낫다).
 *
 * ⚠️ 그룹이 **빈 배열인 것은 정상**이다(월초에 아직 쓴 행이 없음) → `other=0, ads=0`.
 *   권한·토큰 문제는 CF 가 `errors` 로 말하고, 그건 위에서 `null` 로 걸러진다.
 */
export function parseAccountUsage(json: unknown, month: string, nowMs: number): AccountUsage | null {
  const j = json as { errors?: unknown[]; data?: { viewer?: { accounts?: Array<{ d1AnalyticsAdaptiveGroups?: UsageGroup[] }> } } } | null
  if (!j || (Array.isArray(j.errors) && j.errors.length > 0)) return null
  const acct = j.data?.viewer?.accounts?.[0]
  if (!acct) return null
  const groups = acct.d1AnalyticsAdaptiveGroups
  if (!Array.isArray(groups)) return null
  let ads = 0, other = 0
  for (const g of groups) {
    const w = Number(g?.sum?.rowsWritten)
    if (!Number.isFinite(w) || w <= 0) continue
    if (OWN_D1_IDS.includes(String(g?.dimensions?.databaseId || ''))) ads += w
    else other += w
  }
  return { month, other: Math.floor(other), ads: Math.floor(ads), at: nowMs }
}

/**
 * 이번 달 `other` 최종 추정 = 이미 쓴 것 + 남은 날 × 지금까지의 일당 속도.
 *
 * ⚠️ 남은 날도 **소수**로 센다(`utcMonthElapsedDays`) — 정수로 세면 오늘 하루가 두 번 세어지거나
 *   통째로 빠진다. 월말에는 `remain → 0` 이라 추정이 곧 실측에 수렴한다(그게 맞다).
 */
export function projectOtherMonth(other: number, nowMs: number): number {
  const mtd = Number.isFinite(other) && other > 0 ? Math.floor(other) : 0
  if (mtd === 0) return 0
  const gone = utcMonthElapsedDays(nowMs)
  const remain = Math.max(0, utcDaysInMonth(nowMs) - gone)
  return Math.ceil(mtd + (mtd / Math.max(ACCT_MIN_ELAPSED_DAYS, gone)) * remain)
}

/**
 * 🔑 이번 판정에 쓸 **유어딜 예약분**. 실측이 없거나 다른 달이거나 낡으면 `fallback`(상수).
 *
 * ⚠️ **fail-open 이 아니다** — 못 읽었을 때 "예약분 0"(= 유어애즈가 전부 먹는다)으로 가지 않는다.
 *   상수는 실측의 4.4배라 모르는 동안은 유어애즈가 **덜** 쓴다. 틀릴 때 손해 보는 쪽이 유어애즈여야
 *   한다 — 유어딜이 손해 보는 방향이면 그게 바로 대표가 금지한 청구서다.
 * ⚠️ 신선도는 **예약분에만** 요구한다(추정이라서). 지출 교차검증값(`acct.ads`)은 낡아도 "최소한
 *   이만큼은 썼다"는 하한이라 그대로 쓴다 — 두 값의 성질이 다르다(`read-budget.ts` 가 그렇게 쓴다).
 */
export function effectiveReserve(
  acct: AccountUsage | null | undefined, nowMs: number, fallback: number,
): number {
  if (!acct || acct.month !== utcMonth(nowMs)) return fallback
  if (!(Number(acct.at) > 0) || nowMs - Number(acct.at) > ACCT_STALE_MS) return fallback
  return Math.max(ACCT_MIN_RESERVE, Math.ceil(projectOtherMonth(acct.other, nowMs) * ACCT_GROWTH_FACTOR))
}

type CredEnv = { CLOUDFLARE_API_TOKEN?: string; CLOUDFLARE_ACCOUNT_ID?: string; DB?: D1Database } | undefined

/**
 * CF 자격증명 — env 가 먼저, 없으면 본진 `platform_settings`(CLAUDE.md 가 정한 SSOT).
 * 🔒 **반환값을 로그에 싣지 말 것.** 이 파일 밖으로 나가는 유일한 경로는 `fetch` 헤더다.
 */
async function readCfCreds(env: unknown): Promise<{ token: string; account: string } | null> {
  const e = env as CredEnv
  let token = String(e?.CLOUDFLARE_API_TOKEN || '').trim()
  let account = String(e?.CLOUDFLARE_ACCOUNT_ID || '').trim()
  if (!(token && account) && e?.DB) {
    try {
      const rows = await e.DB.prepare(
        "SELECT key, value FROM platform_settings WHERE key IN ('cf_api_token','cf_account_id')",
      ).all<{ key: string; value: string }>()
      for (const r of rows?.results || []) {
        const v = String(r?.value || '').trim()
        if (r?.key === 'cf_api_token' && !token) token = v
        else if (r?.key === 'cf_account_id' && !account) account = v
      }
    } catch { return null }
  }
  return token && account ? { token, account } : null
}

/**
 * 실측 1회. **절대 throw 하지 않는다** — 이 값을 못 읽는 것이 레인을 죽이면 안 된다(상수로 돈다).
 * 비용: 서브리퀘스트 1 + D1 읽기 2행. 갱신 간격이 1시간이라 하루 24회다.
 */
export async function fetchAccountUsage(env: unknown, nowMs: number): Promise<AccountUsage | null> {
  try {
    const creds = await readCfCreds(env)
    if (!creds) return null
    const month = utcMonth(nowMs)
    const res = await fetch(CF_GRAPHQL_URL, {
      method: 'POST',
      // 🔒 토큰은 **헤더에만**. 본문(`accountUsageBody`)엔 계정 태그만 들어간다.
      headers: { Authorization: `Bearer ${creds.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(accountUsageBody(creds.account, `${month}-01`, utcDay(nowMs))),
    })
    if (!res.ok) return null
    return parseAccountUsage(await res.json(), month, nowMs)
  } catch { return null }
}
