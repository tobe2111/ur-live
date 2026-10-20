/**
 * 🌱 **신선도 자동 조율기** — 발굴량이 떨어지면 스스로 신선한 키워드를 더 들인다 (2026-08-17 대표 지시
 *   "자동으로 계속 조율하게끔 해서 매일 수집·발굴량을 유지 혹은 늘리도록. 줄어들면 안 돼").
 *
 * ## 왜 필요한가 (라이브 실측 — 이 모듈이 존재하는 이유)
 * 발굴량은 **레인 안정성 × 키워드 신선도**의 곱이다(CLAUDE.md 유어애즈 절). 레인은 안정적인데
 * 신선도 공급이 상수 하나(`MAX_AUTO_KEYWORDS`)에 막혀 08-12 정점에서 4일 만에 −41% 가 났다:
 * ```
 *   08-12  6,366명 (키워드당 74.0)   ← 08-10 마지막 승격 물결의 정점
 *   08-16  3,773명 (키워드당 32.8)   ← 같은 키워드를 계속 돌아 신규율만 떨어짐
 *   회차 found 620~840 은 **안 줄었다** — 그물은 그대로인데 잡히는 사람이 이미 아는 사람
 *   auto 활성 120 = 캡 정확히 포화 · 승격 대기 3,996 · 마지막 활성화 08-10(7일 전)
 * ```
 * 즉 사람이 상수를 올려 줄 때만 발굴량이 오르는 구조였다. **그 손을 자동화한다.**
 *
 * ## 규칙 — 노브는 **열리는 방향으로만** 움직인다
 * 대표 지시가 "줄어들면 안 돼"이므로, 수확이 좋아졌다고 캡을 되돌리지 않는다(그러면 다시 마르고
 * 톱니처럼 요동한다). 대신 **상한**과 **한 회차 증분**으로 폭주를 막는다.
 *
 * ⚠️ **자동 확장을 멈추는 조건이 진짜 안전장치다**:
 *   · `blocked > 0` (네이버 차단) → 즉시 동결. 차단은 발굴 전체를 멎게 하므로 어떤 이득보다 크다.
 *   · 자리가 이미 남아 있으면(`autoActive < cap`) 확장은 무의미하다 — 못 채우는 이유는 캡이 아니다.
 *   · 증거가 모자라면(회차 표본 부족) 아무것도 안 한다 — 좁은 창으로 단정하는 것이 이 레포의 상습 오진이다.
 *
 * ⚠️ **이 모듈이 못 하는 것**(정직하게): 후보 풀(`hits >= AUTO_PROMOTE_HITS` 대기)이 마르면 캡을
 *   올려도 채울 것이 없다. 그때 발굴량은 캡이 아니라 **해시태그 유입**에 묶인다. 그리고 무료 티어의
 *   회차당 서브리퀘스트(56)·YT 검색 쿼터(90/일)는 이 조율기 밖의 하드 상한이다.
 *   ⇒ "절대 안 줄어든다"는 **보장할 수 없다.** 이 조율기는 *사람이 개입하지 않아도 마르지 않게*
 *      하는 장치이고, 외부 한도에 부딪히면 그 사실을 `reason` 으로 남긴다(추측 대신 관측).
 */

/** 자동 조율된 auto 키워드 캡이 저장되는 자리. 읽기·쓰기가 같은 문자열을 봐야 한다(#930 클래스). */
export const FRESHNESS_CAP_KEY = 'ads_auto_keyword_cap'

/**
 * 캡의 하한 = 종전 상수(120). **아래로 내려가지 않는다** — 조율기가 고장 나거나 설정이 손상돼도
 * 발굴이 지금보다 나빠지는 일은 구조적으로 없다(대표 지시 "줄어들면 안 돼"의 코드적 표현).
 */
export const FRESHNESS_CAP_MIN = 120

/**
 * 캡의 상한. 풀이 커지면 한 바퀴가 길어진다(실측 459개 → 2.1일). 300 이면 대략 3.5일이고,
 * 그 이상은 "자주 안 도는 키워드"가 늘어 신선도 효과가 상쇄되기 시작한다.
 * ⚠️ 이 값을 올리려면 **한 바퀴 시간과 키워드당 수확을 함께 재고** 올릴 것(둘 중 하나만 보면 오판한다).
 */
export const FRESHNESS_CAP_MAX = 300

/** 한 번에 늘리는 폭. 크게 늘리면 승격 물결이 몰려 요동하고(수확 급등→급락), 작으면 반응이 느리다. */
export const FRESHNESS_CAP_STEP = 20

/** 최근 절반이 이전 절반의 이 비율 밑으로 떨어지면 "하락"으로 본다(15% 하락). */
export const FRESHNESS_DECLINE_RATIO = 0.85

/** 판단에 필요한 최소 회차 표본. 이 레포의 상습 오진("좁은 창으로 단정")을 코드로 막는다. */
export const FRESHNESS_MIN_ROUNDS = 8

export type FreshnessReason =
  | 'blocked-freeze'        // 네이버 차단 — 확장 금지
  | 'room-available'        // 자리가 남아 있다 — 캡이 병목이 아니다
  | 'insufficient-evidence' // 회차 표본 부족
  | 'yield-declining'       // 수확 하락 → 확장
  | 'at-ceiling'            // 하락했지만 상한 도달(사람 판단 필요)
  | 'stable'                // 유지

export interface FreshnessVerdict {
  cap: number
  reason: FreshnessReason
  /** 관측된 키워드당 수확(이전 절반 → 최근 절반). 판단 근거를 밖에서 볼 수 있게 남긴다. */
  yieldBefore: number
  yieldAfter: number
}

/** `saved / processed` = 이 회차의 키워드당 신규 수확. processed 0 인 회차는 표본에서 제외. */
function perKeywordYield(rounds: readonly { processed?: number; saved?: number }[]): number[] {
  const out: number[] = []
  for (const r of rounds) {
    const p = Number(r?.processed) || 0
    if (p <= 0) continue
    out.push((Number(r?.saved) || 0) / p)
  }
  return out
}

function median(xs: readonly number[]): number {
  if (!xs.length) return 0
  const s = [...xs].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}

/**
 * 다음 회차에 쓸 auto 키워드 캡을 정한다 — **순수**(유닛으로 고정).
 *
 * @param recent 회차 이력(오래된 → 최신). `funnel.recent` 를 그대로 넘긴다.
 * @param cap 현재 캡(손상/부재면 하한으로 clamp)
 * @param autoActive 지금 활성인 auto 키워드 수
 * @param blocked 오늘 네이버 차단 건수
 */
export function planFreshnessCap(s: {
  recent: readonly { processed?: number; saved?: number }[]
  cap: number
  autoActive: number
  blocked: number
}): FreshnessVerdict {
  const raw = Number(s?.cap)
  const cur = Math.max(FRESHNESS_CAP_MIN, Math.min(FRESHNESS_CAP_MAX,
    Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : FRESHNESS_CAP_MIN))
  const ys = perKeywordYield(s?.recent || [])
  const half = Math.floor(ys.length / 2)
  const before = median(ys.slice(0, half))
  const after = median(ys.slice(half))
  const base: Omit<FreshnessVerdict, 'cap' | 'reason'> = { yieldBefore: before, yieldAfter: after }

  // ① 차단이면 무조건 동결 — 차단은 발굴 전체를 멎게 하므로 어떤 수확 이득보다 크다.
  if ((Number(s?.blocked) || 0) > 0) return { cap: cur, reason: 'blocked-freeze', ...base }

  // ② 자리가 남아 있으면 캡은 병목이 아니다(못 채우는 이유가 캡이 아니라 후보 부족이다).
  //    포화(autoActive >= cap)일 때만 캡을 논한다.
  if ((Number(s?.autoActive) || 0) < cur) return { cap: cur, reason: 'room-available', ...base }

  // ③ 표본 부족 — 좁은 창으로 단정하지 않는다.
  if (ys.length < FRESHNESS_MIN_ROUNDS) return { cap: cur, reason: 'insufficient-evidence', ...base }

  // ④ 하락 판정 — 최근 절반이 이전 절반보다 뚜렷하게 낮은가.
  const declining = before > 0 && after < before * FRESHNESS_DECLINE_RATIO
  if (!declining) return { cap: cur, reason: 'stable', ...base }
  if (cur >= FRESHNESS_CAP_MAX) return { cap: cur, reason: 'at-ceiling', ...base }
  return { cap: Math.min(FRESHNESS_CAP_MAX, cur + FRESHNESS_CAP_STEP), reason: 'yield-declining', ...base }
}

/** 저장된 캡 읽기 — 손상/부재는 하한으로(경보 아님, 발굴이 나빠지지 않는 쪽으로 실패한다). */
export function parseFreshnessCap(raw: string | null | undefined): number {
  const v = Number.parseInt(String(raw ?? ''), 10)
  if (!Number.isFinite(v) || v <= 0) return FRESHNESS_CAP_MIN
  return Math.max(FRESHNESS_CAP_MIN, Math.min(FRESHNESS_CAP_MAX, v))
}

/**
 * 🔌 **수집 루프용 어댑터** — 설정 맵과 이 회차 통계를 그대로 받아 캡과 기록 스탬프를 낸다.
 *
 *   호출부(`influencer-auto-collect`)를 얇게 유지하려고 분리했다(600줄 래칫). 파싱·판단·기록 형식이
 *   한곳에 모여 있어야 **"읽는 키와 쓰는 키가 갈라지는"** 사고(#930)가 구조적으로 안 생긴다.
 *   ⚠️ 반환된 `cap` 은 **반드시 저장**해야 한다 — 안 하면 조율기가 계산만 하고 아무 일도 안 한다.
 */
export function decideFreshness(
  settings: Record<string, string | null | undefined>,
  recent: readonly { processed?: number; saved?: number }[],
  autoActive: number,
): { cap: number; stamp: { cap: number; prev_cap: number; reason: string; yield_before: number; yield_after: number } } {
  const prev = parseFreshnessCap(settings[FRESHNESS_CAP_KEY])
  // 🚨 오늘 네이버 차단 — 조율기의 최우선 동결 조건(확장이 차단을 부르면 발굴 전체가 멎는다).
  let blocked = 0
  try { blocked = Math.max(0, Number(JSON.parse(settings['ads_naver_crawl_block'] || '{}')?.blocked) || 0) } catch { blocked = 0 }
  const v = planFreshnessCap({ recent, cap: prev, autoActive, blocked })
  const r1 = (x: number) => Math.round(x * 10) / 10
  return { cap: v.cap, stamp: { cap: v.cap, prev_cap: prev, reason: v.reason, yield_before: r1(v.yieldBefore), yield_after: r1(v.yieldAfter) } }
}
