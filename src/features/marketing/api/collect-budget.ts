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

/**
 * 🚦 학습 상한은 **레인마다 따로** 저장한다(2026-07-28 근본수리).
 *
 *   그 전엔 세 레인이 `ads_subreq_cap` **한 키를 같이 읽고 썼다**. 건당 비용이 전혀 다른데
 *   (전화 스윕·인플루언서 = fetch 1 / 보강 = fetch 4~6 + D1 다수) 학습값을 공유하면 서로의 관측을
 *   덮어써 **어느 레인도 자기 진짜 한도를 학습하지 못한다**. 실제로 전화 스윕은 매시간 예산을 다 써서
 *   ×1.25 로 올리고 인플루언서 레인은 한도에 부딪혀 ×0.8 로 내리며 서로를 밀어, 공유값이 29~55 대역에서
 *   맴돌았다. 보강 레인은 그 값을 **읽기만** 하는 피해자였다(자기 env 예산 300 인데 실제 37 로 굶음).
 *
 *   ⇒ 레인별 키로 분리. 이미 도매 레인(`maker-enrich.ts`)이 같은 이유로 자기 키를 쓰고 있었다.
 *   ⚠️ 새 레인을 추가하면 `SubreqLane` 에 이름을 넣어라 — 남의 키를 재사용하면 이 사고가 재발한다.
 */
export type SubreqLane =
  | 'influencer'      // 인플루언서 자동수집 — 건당 fetch 1
  | 'company_enrich'  // 파트너풀 연락처 보강 — 건당 fetch 4~6 + D1 다수(가장 비쌈)
  | 'kakao_sweep'     // 카카오 전화 스윕 — 건당 fetch 1
/** 레인별 학습 상한 저장 키(platform_settings). */
export const subreqCapKey = (lane: SubreqLane): string => `ads_subreq_cap_${lane}`
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
