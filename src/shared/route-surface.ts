/**
 * 🧭 주소 → 화면 표면(surface) 판정 — **워커와 앱이 같은 함수**를 쓴다 (2026-10-15).
 *
 * 표면 이름은 `scripts/generate-route-chunk-map.mjs` 의 `ROUTES`·`PRELOAD_ONLY_ROUTES` 키와 같다.
 *   - 워커: 그 표면의 페이지 청크를 modulepreload 로 싣는다(하드로드 청크 병렬화).
 *   - 앱(main.tsx): 같은 표면의 페이지 모듈을 **첫 렌더 전에** 준비해서, React 가 "페이지 로딩 중" 을
 *     한 번 그렸다가 바꾸는 단계를 건너뛴다(`lib/boot-page.ts` 머리말 — 그 단계에 React 의 0.5초
 *     공개 지연이 걸려 있었다).
 *
 * 종전엔 이 판정이 `worker/index.ts` 안에만 있었다. 앱이 같은 판단을 하려면 사본이 필요했고,
 * 사본은 언젠가 갈린다(갈려도 에러가 안 난다 — 미리받기만 조용히 빗나간다).
 *
 * @param mobileUa 홈만 갈린다(폰 = home, 넓은 화면 = homePc). 워커는 UA, 앱도 UA 로 판정한다.
 * @param authed   로그인 전 탭(guest*)은 세션이 없을 때만. 워커는 `ur_session` 쿠키, 앱은 로컬 로그인 흔적.
 */
export type RouteSurface =
  | 'home' | 'homePc' | 'gbDetail' | 'voucherDetail' | 'product'
  | 'guestUShop' | 'guestMy' | 'guestPass'
  | 'cart' | 'search' | 'faq' | 'stays' | 'stayDetail' | 'region'
  | 'linkshop' | 'vouchers' | 'browse' | 'map' | 'urshorts' | 'blog' | 'blogPost' | 'life' | 'lifePro'

/**
 * 홈이 PC 홈을 그리는 경계 — `HomeRoute` 가 이 쿼리로 두 홈을 고른다(Tailwind \`md\`).
 * 앱 부팅은 UA 가 아니라 **이 쿼리로** 홈 표면을 고른다: 렌더러가 뷰포트로 고르는데 부팅이 UA 로 고르면
 * 좁은 창의 데스크톱 브라우저(또는 넓은 태블릿)에서 안 그릴 홈을 미리 받는다(2026-10-15 chunks 검사가 잡았다).
 * 워커는 뷰포트를 모르므로 UA 로 판정한다 — 그쪽은 추정이 최선이다.
 */
export const HOME_DESKTOP_QUERY = '(min-width: 768px)'

/** 유어샵 표면 안에서 어느 페이지가 그리는가 — `/u/*` 는 CuratorPage, `/profile/*`·`/s/*` 는 SellerPublicPage. */
export function isCuratorShopPath(pathname: string): boolean {
  return /^\/u(\/|$)/.test(pathname)
}

export function routeSurface(pathname: string, mobileUa: boolean, authed: boolean): RouteSurface | null {
  const p = pathname
  if (p === '/' || p === '/index.html') return mobileUa ? 'home' : 'homePc'
  if (/^\/(?:pass|group-buy)\/\d+(?:[/?#]|$)/.test(p)) return 'gbDetail'
  if (/^\/vouchers\/\d+(?:[/?#]|$)/.test(p)) return 'voucherDetail'
  if (/^\/products\/\d+(?:[/?#]|$)/.test(p)) return 'product'
  if (p === '/u/me' && !authed) return 'guestUShop'
  if (p === '/user/profile') return authed ? null : 'guestMy'
  if (p === '/my-vouchers') return authed ? null : 'guestPass'
  if (p === '/cart') return 'cart'
  if (p === '/search') return 'search'
  if (p === '/faq') return 'faq'
  if (p === '/stays') return 'stays'
  if (/^\/stays\/\d+(?:[/?#]|$)/.test(p)) return 'stayDetail'
  if (/^\/region(?:\/|$)/.test(p)) return 'region'
  if (/^\/(u|profile|s)(\/|$)/.test(p)) return 'linkshop'
  if (p === '/vouchers') return 'vouchers'
  if (p === '/browse') return 'browse'
  if (p === '/map') return 'map'
  if (p === '/urshorts') return 'urshorts'
  if (p === '/blog') return 'blog' // 🏨 2026-10-15 색인 진입점(generate-route-chunk-map PRELOAD_ONLY_ROUTES)
  if (p.startsWith('/blog/')) return 'blogPost'
  if (p === '/life') return 'life' // 🏠 2026-10-26 생활 허브·업체 등록(색인 진입점 — PRELOAD_ONLY_ROUTES)
  if (p === '/life/pro') return 'lifePro'
  return null
}
