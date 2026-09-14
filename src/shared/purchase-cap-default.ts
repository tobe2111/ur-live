/**
 * 🧾 1인당 구매 상한의 화면 기본값 (2026-09-14)
 *
 * 상한의 **진실은 서버**다(`worker/utils/purchase-cap.ts` — 상품별 값 ?? `platform_settings`).
 * 이 파일은 그 값이 응답에 없을 때(구 캐시·조회 실패) 화면이 쓸 폴백 하나만 갖는다.
 *
 * 🔑 클라가 worker util 을 직접 import 할 수 없어서(그쪽은 `D1Database` 타입을 쓴다) 상수만 여기 둔다.
 * **두 곳이 같은 수를 들고 있으므로 바꿀 때 함께 바꾼다** — `purchase-cap.test.ts` 가 그걸 고정한다.
 */
export const DEFAULT_QTY_CAP = 10
