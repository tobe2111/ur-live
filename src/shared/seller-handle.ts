/**
 * 🏷️ **기계가 지어 준 셀러 아이디는 손님에게 보여주지 않는다** (2026-09-03 대표 신고).
 *
 * 대표가 상품 상세에서 본 것: `홍대돈까스 ✅ 검증 셀러` 아래 `@store_mt9rvbhg1i6`.
 * 이 값은 사람이 고른 아이디가 아니라 **매장을 만들 때 서버가 자동 발급한 내부 식별자**다
 * (`seller-stores.routes.ts` — `store_${Date.now().toString(36)}${랜덤}`,
 *  어드민 수기 등록은 `store_${전화번호}`). 손님에게는 아무 정보도 주지 않으면서
 * "관리가 안 된 화면"으로 읽히고, 전화번호형은 **번호가 그대로 노출**되기까지 한다.
 *
 * ⚠️ 그렇다고 `@아이디`를 통째로 지우지는 않는다 — 사람이 직접 고른 아이디
 * (`tobe2111`, `jea1612` …)는 그 셀러를 부르는 이름이고 유어샵 주소와도 이어진다.
 * **자동 발급분만** 가린다.
 */

/** 서버가 자동 발급한 셀러 아이디인가(= 손님에게 감출 값인가). */
export function isAutoSellerUsername(username: string | null | undefined): boolean {
  return /^store_[a-z0-9]+$/i.test(String(username ?? '').trim())
}

/** 손님 화면에 쓸 `@아이디` — 자동 발급분이면 `null`(그 줄을 그리지 않는다). */
export function publicSellerHandle(username: string | null | undefined): string | null {
  const u = String(username ?? '').trim()
  if (!u || isAutoSellerUsername(u)) return null
  return u
}
