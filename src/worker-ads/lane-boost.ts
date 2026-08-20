/**
 * 📈 **부족분 자동 보강** — 한 소스가 덜 나오면 다른 곳을 더 돌린다 (2026-08-19 대표 지시).
 *
 * ## 왜 (실측)
 * ```
 * commerce 가 업체(B2B) 유입의 95%   →  외부 API 무응답으로 12회 중 9회 실패
 * 업체 일별  13,409(08-11)  →  4,223(08-17) · 4,427(08-18)
 * ```
 * 원인이 **외부**라 우리 코드로 그 소스를 고칠 수 없다. 그러면 **다른 소스를 더 돌리는 것**이
 * 유일하게 우리 손에 있는 레버다. 그리고 그건 사람이 매번 판단할 일이 아니다 — 그래서 제어 루프다.
 *
 * ## ⚠️ 크기를 정직하게 적어 둔다 (기대치를 잘못 잡으면 다음 세션이 오판한다)
 * ```
 * collect-company(webkr·local)  ~250/일 · 회차당 ~25   →  3배로 올려도 +500/일
 * 부족분                        ~7,500/일
 * ```
 * ⇒ **보강은 부족분의 10% 안팎을 메운다. 대체재가 아니다.** 그래도 하는 이유는 두 가지다:
 *   ① 공짜다 — 네이버 검색 API 쿼터는 25,000/일 중 **0.7%** 만 쓴다(막는 건 우리 예산이지 상대가 아니다).
 *   ② 미실행 키워드 3,279개(잠재 ~49,000 리드)의 소화 속도가 같이 빨라진다.
 *
 * ## 설계 — 조이기·감속과 같은 비대칭
 * · 보강은 **하루 1회 판정**(유입 감시와 같은 회차)에서만 켜진다.
 * · **유효기간이 있다** — 감시가 멎으면 보강도 자동으로 풀린다(켜진 채 잊히는 것이 제일 위험하다).
 * · 대상 레인이 **스스로 건강할 때만** 올린다. 실패 중인 레인을 더 돌리면 실패만 3배가 된다.
 * · 핫패스에 D1 읽기를 얹지 않는다 — 보강값은 **DO 자기 저장소**에 넣는다(서브리퀘스트 0).
 *   ⚠️ 레인 러너는 DO 알람 인보케이션 **안에서** 돈다. 여기서 D1 을 한 번 읽으면 그만큼
 *     러너의 서브리퀘스트 예산(무료 ~50)을 빼앗는다.
 */
import type { LaneRunEntry } from './lane-run-history'

/** 시간당 최대 회차. 이 위로는 안 올린다 — 외부 API 예의와 우리 CPU 양쪽의 안전선. */
export const MAX_BOOST_RUNS_PER_HOUR = 3
/** 보강 유효기간(ms). 하루 1회 판정보다 넉넉히 — 한 번 걸렀다고 바로 꺼지면 진동한다. */
export const BOOST_TTL_MS = 30 * 60 * 60 * 1000

/**
 * **어떤 축이 부족할 때 어떤 레인을 더 돌릴 것인가.**
 *
 * ⚠️ 인플루언서 `collect` 레인은 **일부러 뺐다.** 그 레인의 `runsPerHour: 1` 은 CLAUDE.md 가
 *   *"이 값을 올리려면 네이버 차단 리스크를 다시 판단할 것 — 대표 확인 사항"* 이라고 못 박은 값이고,
 *   그건 공식 API 쿼터가 아니라 **직접 크롤 차단** 문제다. 자동 루프가 넘볼 자리가 아니다.
 *   여기 있는 `collect-company` 는 **공식 네이버 검색 API**(쿼터 0.7% 사용)라 성격이 다르다.
 */
export const COMPENSATORS: Readonly<Record<string, readonly string[]>> = {
  company: ['collect-company'],
}

export interface BoostState { runs: number; until: number }

/** 보강해도 되는 레인인가 — **자기가 건강해야** 한다(실패 중인 레인을 3배로 돌리면 실패가 3배다). */
export function laneCanAbsorb(history: readonly LaneRunEntry[]): boolean {
  const recent = history.slice(0, 4)
  if (recent.length < 2) return false                       // 근거 부족이면 안 올린다
  if (recent.some(r => !r.ok)) return false                 // 최근에 실패가 있으면 안 올린다
  return recent.some(r => typeof r.n === 'number' && r.n > 0) // 실제로 뭔가 캐고 있어야 한다
}

/**
 * 부족 정도(0~1, 낮을수록 심각)로 보강 배수를 정한다.
 * @param ratio 유입 감시가 낸 `recent/baseline`. `null`(근거 없음)이면 보강하지 않는다.
 */
export function planBoostRuns(ratio: number | null, base = 1): number {
  if (ratio == null || !Number.isFinite(ratio) || ratio >= 0.7) return base
  // 반토막 미만이면 최대, 그 사이는 한 단계. 계단으로 두는 이유: 연속값이면 매일 미세하게 흔들린다.
  return Math.min(MAX_BOOST_RUNS_PER_HOUR, ratio < 0.5 ? base + 2 : base + 1)
}

/** 저장된 보강값 해석 — **기한이 지났으면 없는 것**(켜진 채 잊히지 않게). */
export function readBoost(raw: unknown, now: number): number {
  const b = (raw && typeof raw === 'object' ? raw : null) as Partial<BoostState> | null
  if (!b || !Number.isFinite(Number(b.runs)) || !Number.isFinite(Number(b.until))) return 0
  if (Number(b.until) <= now) return 0
  return Math.max(0, Math.min(MAX_BOOST_RUNS_PER_HOUR, Math.floor(Number(b.runs))))
}
