/**
 * 🏪 "판매하세요" 목적지 SSOT (2026-08-26 대표 — 소비자↔셀러 간극 전수조사)
 *
 * 🩸 고치는 사고: PC 상단 네비와 계정 메뉴의 "유어딜에서 판매하세요" 두 곳이 모두 `/seller` 로
 *   보내고 있었다. 그런데 `/seller` 는 `ProtectedRoute requireSeller` 라, 셀러 토큰이 없으면
 *   `/seller/login` 으로 튕긴다 — **관심을 보인 사장님을 입점 안내가 아니라 "로그인하세요" 벽으로
 *   보내고 있었다.** 아직 셀러가 아닌 사람에게 로그인 화면은 안내가 아니라 문 닫힘이다.
 *
 * 판정은 하나뿐이다: **이미 셀러인가.**
 *   - 셀러  → `/seller` (자기 대시보드로 직행 — 이 사람에게 입점 안내는 소음이다)
 *   - 아니면 → `/partners` (입점 안내 랜딩. 거기 CTA 가 `/seller/register/supplier` 로 이어진다)
 *
 * ⚠️ 같은 판단을 호출부마다 손으로 쓰면 반드시 갈린다(이 레포가 반복해 겪은 클래스 —
 *   `linkshopPath` 가 BottomNav 와 useLinkshopPath 에서 갈렸던 2026-06-19 사고). 그래서 함수 하나로 둔다.
 */

/** 셀러 토큰 보유 여부 — SSR/프리렌더(localStorage 없음)에서는 '아니다'로 본다(안전한 쪽). */
export function hasSellerToken(): boolean {
  try {
    return !!localStorage.getItem('seller_token')
  } catch {
    return false // 프리렌더·시크릿 모드에서 접근이 던질 수 있다
  }
}

/** "판매하세요" 를 눌렀을 때 갈 곳. */
export function sellerEntryPath(): string {
  return hasSellerToken() ? '/seller' : '/partners'
}
