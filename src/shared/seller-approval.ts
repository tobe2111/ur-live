/**
 * 🥕 **승인된 매장인가** — 화면이 유어애즈 문을 보여 줄지 정하는 한 줄 (2026-09-16).
 *
 * > 대표: *"유어애즈 인플루언서 DB는 보이지 않게 하자 반려 아닌 승인까지는."*
 *
 * ⚠️ **이것은 방어가 아니라 안내다.** 진짜 벽은 서버(`worker/utils/ads-db-access.ts`)이고,
 * 여기는 *열리지 않을 문을 안 보여 주는 것*뿐이다. 클라이언트 판정을 방어로 쓰면
 * 개발자 도구 한 줄로 뚫린다 — 그래서 서버 쪽에 같은 조건이 따로 있다(중복이 아니라 층이다).
 *
 * ⚠️ **모르면 보여 준다(fail-open).** 값을 쓰는 곳은 `SellerApprovalBanner` 하나인데
 * 그게 아직 안 돌았거나 옛 로그인 세션이면 키가 비어 있다. 비었다고 숨기면 **승인된 매장의
 * 메뉴가 사라진다** — 서버가 어차피 막으므로 보여 주는 쪽이 싸다.
 */

/** 네비가 읽는 localStorage 키. 쓰는 곳은 `SellerApprovalBanner` 하나뿐이다. */
export const SELLER_STATUS_KEY = 'seller_status'

const APPROVED = ['approved', 'active']

/** 저장된 심사 상태로 볼 때 유어애즈 문을 **숨겨야** 하는가. 값이 없으면 숨기지 않는다. */
export function shouldHideAdsDbNav(status: string | null | undefined): boolean {
  const s = String(status || '')
  return s !== '' && !APPROVED.includes(s)
}

/** 브라우저에 저장된 심사 상태(없으면 빈 문자열). SSR 안전. */
export function readSellerStatus(): string {
  if (typeof window === 'undefined') return ''
  try { return localStorage.getItem(SELLER_STATUS_KEY) || '' } catch { return '' }
}
