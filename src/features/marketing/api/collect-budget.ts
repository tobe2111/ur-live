/**
 * 🩹 서브리퀘스트 예산 자가 교정 (2026-07-28 라이브 재발 대응).
 *
 *   증상: 수집 진단에 `⚠️ FAILED: 검색 요청 오류: Too many subrequests by single Worker invocation` —
 *   한 인보케이션의 외부 fetch 총량이 플랫폼 한도를 넘어 그 레인의 수확이 통째로 버려진다.
 *   기본 예산 300 은 Workers **Paid(1000)** 기준이라, 실제 한도가 그보다 낮은 환경에서는 매 실행 같은
 *   지점에서 죽는다 — 그런데 **플랜/실제 한도를 코드가 알 방법이 없다**.
 *
 *   ⇒ 관측으로 학습한다. 한도에 부딪히면 '이번에 쓴 양'보다 낮은 값을 남기고 다음 실행부터 그 이하만 쓴다.
 *     반대로 학습 상한을 다 쓰고도 한도 오류가 없으면 조금 올려 본다(과학습·플랜 상향 회복).
 *     수확 총량은 self-chain/매시간 cron 이 이어받아 유지된다 — 한 번에 덜 쓰고 여러 번 도는 것뿐.
 */

/** 학습된 상한 저장 키(platform_settings). */
export const SUBREQ_CAP_KEY = 'ads_subreq_cap'
/** 이 아래로는 안 내린다 — 수확이 0 이 되면 학습 자체가 무의미. */
export const SUBREQ_CAP_MIN = 25
/** 회복 시 상향 배율(과학습 되돌리기). */
const RECOVER_RATIO = 1.25
/** 한도 관측 시 하향 배율(부딪힌 지점보다 확실히 아래로). */
const BACKOFF_RATIO = 0.8

/** 응답/에러 메시지에 플랫폼 서브리퀘스트 한도 신호가 있는가. */
export const isSubrequestLimitError = (msg?: string | null): boolean =>
  /too many subrequests/i.test(String(msg || ''))

/** 이번 실행에 쓸 예산 — 학습값이 있으면 env/기본값과 함께 더 작은 쪽. */
export function resolveSubreqBudget(envBudget: number, learnedCap: number): number {
  return learnedCap > 0 ? Math.min(envBudget, learnedCap) : envBudget
}

/**
 * 다음 실행의 상한 — 바꿀 필요가 없으면 null(쓰기 생략).
 * @param spent      이번 실행이 실제로 쓴 fetch 수
 * @param hitLimit   이번 실행에서 한도 오류를 관측했나
 * @param exhausted  예산을 끝까지 다 썼나(안 썼으면 한도 판단 근거가 없다)
 */
export function nextSubreqCap(
  spent: number, hitLimit: boolean, exhausted: boolean, learnedCap: number, envBudget: number,
): number | null {
  if (hitLimit) return Math.max(SUBREQ_CAP_MIN, Math.floor(spent * BACKOFF_RATIO))
  if (learnedCap > 0 && exhausted && learnedCap < envBudget) return Math.min(envBudget, Math.ceil(learnedCap * RECOVER_RATIO))
  return null
}
