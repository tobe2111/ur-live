/**
 * 🗺️ 앱 라우트 표의 **최상위 모양** — 등록 안 된 경로를 알아보기 위한 SSOT (2026-10-12, 대표 "응 모두 해줘").
 *
 * ## 무엇이 결함이었나 (라이브 실측, Googlebot UA)
 * **등록되지 않은 모든 경로가 색인 가능한 soft-404** 였다:
 *
 *     /zzz-nonexistent-abc   200 · index, follow · canonical 자기자신 · 본문 6자
 *     /이런페이지는없다        200 · index, follow · canonical 자기자신 · 본문 6자
 *     /products              200 · index, follow · canonical 자기자신 · 본문 6자  ← 라우트가 없다
 *
 * 워커 catch-all 이 SPA 셸을 200 으로 주고 canonical 을 경로 그대로 찍기 때문이다.
 * **피해가 무한하다** — 오타 링크·외부 스팸 링크·봇이 찍는 아무 URL 이 전부 색인 후보가 된다.
 * 구글은 그걸 soft-404 로 집계하고 그만큼 크롤 예산을 실제 상품 페이지에서 뺀다.
 *
 * 🔎 **기계는 이미 있었다** — `shouldNoindexMissingEntity`(엔티티 슬롯이 self-fetch 404 를 받으면
 * 404+noindex)와 `isRetiredSurface`(410). `/blog/없는글` 이 제대로 404 를 받는 게 그 증거다.
 * 문제는 **라우트 표에 없는 경로가 그 기계에 도달조차 안 하는 것**이었다.
 *
 * ## 왜 "정확한 라우트 목록" 이 아니라 이 모양인가
 * 🔴 **방향이 뒤집히면 피해가 훨씬 크다** — 허용목록이 낡으면 **멀쩡한 페이지가 404** 가 되고 색인은
 * 돌아오는 데 수주다. 그래서 두 겹으로만 판정한다:
 *   - **2세그먼트 이상**: 최상위 세그먼트만 본다(`/seller/orders/xyz` 처럼 깊은 경로를 절대 안 자른다)
 *   - **1세그먼트**: 정확히 일치해야 한다(그래야 `/products` 처럼 *세그먼트는 있는데 목록 라우트가
 *     없는* 경우를 잡는다). 일치하지 않으면 **몰 슬러그 후보**이므로 워커가 MALL 슬롯에 맡긴다.
 *
 * 🩸 **목록을 App.tsx 하나에서 뽑으면 안 된다** — 라우트는 **네 파일**에 있고(App.tsx ·
 * `admin.routes` · `seller.routes` · `agency-console.routes`) 뒤 셋은 전부 절대경로다.
 * App.tsx 만 읽으면 대시보드 ~180개를 404 로 만든다. 가드가 네 파일을 다시 읽어 양방향으로 대조한다.
 *
 * ⚠️ 최상위 세그먼트는 **전부 ASCII** 다 — `url.pathname` 은 한글이 퍼센트 인코딩돼 오지만
 * 비교 대상은 첫 세그먼트뿐이라 영향이 없다.
 *
 * ⚠️ 이 모듈이 **못 보는 것**: 최상위 세그먼트는 맞는데 그 아래가 없는 경로
 * (`/vouchers/nonexistent-xyz`). 그건 엔티티 슬롯의 일이고, 그 API 가 404 대신 **400** 을 주는
 * 자리가 남아 있다 — 별건.
 */

/** 라우트 표에 등장하는 최상위 세그먼트(동적 패턴의 리터럴 포함). 2세그먼트 이상에서 쓴다. */
export const KNOWN_TOP_SEGMENTS: ReadonlySet<string> = new Set([
  '500', 'about', 'account', 'admin', 'ads', 'agency', 'area-report', 'auth',
  'blog', 'browse', 'business', 'campaign', 'cart', 'checkout', 'community-group-buy', 'coupon',
  'creator', 'creators', 'design', 'district', 'experience', 'fail', 'faq', 'following',
  'g', 'gb-market', 'gdpr', 'gift', 'group-buy', 'host', 'i', 'influencer',
  'interest-list', 'introduce', 'join', 'kakao-debug', 'local', 'login', 'mall-admin', 'map',
  'meal-vouchers', 'my', 'my-appointments', 'my-commissions', 'my-coupons', 'my-deal-history', 'my-gifticons', 'my-orders',
  'my-returns', 'my-reviews', 'my-stays', 'my-store', 'my-vouchers', 'mypage', 'new-openings', 'notifications',
  'orders', 'partners', 'partnership', 'pass', 'pay', 'payment', 'points', 'privacy',
  'privacy-policy', 'product', 'products', 'profile', 'referral', 'refund', 'refund-policy', 'region',
  'register', 'restaurant-map', 's', 'search', 'seller', 'shipping-policy', 'soon', 'stays',
  'store', 'success', 'terms', 'terms-of-service', 'toss-debug', 'u', 'urshorts', 'user',
  'v', 'videos', 'vouchers', 'wishlist',
])

/** 세그먼트가 하나뿐인 **정적** 라우트. 1세그먼트 경로는 이것과 정확히 일치해야 한다. */
export const KNOWN_SINGLE_ROUTES: ReadonlySet<string> = new Set([
  '500', 'about', 'admin', 'ads', 'agency', 'area-report', 'blog', 'browse',
  'business', 'cart', 'checkout', 'creator', 'creators', 'experience', 'fail', 'faq',
  'following', 'gb-market', 'gdpr', 'group-buy', 'host', 'influencer', 'interest-list', 'introduce',
  'join', 'kakao-debug', 'login', 'mall-admin', 'map', 'meal-vouchers', 'my-appointments', 'my-commissions',
  'my-coupons', 'my-deal-history', 'my-gifticons', 'my-orders', 'my-returns', 'my-reviews', 'my-stays', 'my-store',
  'my-vouchers', 'mypage', 'new-openings', 'notifications', 'orders', 'partners', 'partnership', 'privacy',
  'privacy-policy', 'referral', 'refund', 'refund-policy', 'region', 'register', 'restaurant-map', 'search',
  'seller', 'shipping-policy', 'soon', 'stays', 'success', 'terms', 'terms-of-service', 'toss-debug',
  'urshorts', 'videos', 'vouchers', 'wishlist',
])

import { parseMallProductPath } from '../mall/resolve'

/**
 * 이 경로가 앱 라우트 표의 모양과 맞는가(= 404 로 선언하지 **않을** 경로인가).
 *
 * 🔴 애매하면 **true**(= 200 유지)를 돌려준다. 색인을 잃는 쪽이 soft-404 보다 비싸다.
 */
export function isKnownAppPath(pathname: string): boolean {
  const segs = pathname.split('/').filter(Boolean)
  if (segs.length === 0) return true                        // 홈
  if (segs.length === 1) return KNOWN_SINGLE_ROUTES.has(segs[0])
  // `/:mallSlug/p/:id` — 최상위가 파라미터인 유일한 다중 세그먼트 패턴(몰 상품 귀속 경로).
  //
  // 🩸 2026-10-14 — 종전은 `segs[1] === 'p'` 만 보고 **무조건 통과**였다. 그래서 id 가 숫자가
  //   아닌 `/zzqqxx/p/abc` 는 `parseMallProductPath` 가 거부해 **SSR 슬롯이 아예 안 잡히고**
  //   (라이브 실측: `x-ssr-status` 헤더 자체가 없다), 여기서 "아는 경로" 로 통과해
  //   **200 + index,follow + 자기 canonical + 본문 32자** 로 나갔다. 무한 thin URL 이다.
  //
  // 🔑 판정을 **몰 경로 SSOT 와 같은 함수**로 한다 — 두 벌로 적으면 "슬롯은 안 잡는데 아는
  //   경로" 라는 **지금의 틈**이 다시 생긴다(그 틈이 이 결함의 정체다).
  //
  // 🔴 **반대 방향이 훨씬 비싸다**: 실재하는 몰 상품 경로를 404 로 만들면 소개비 귀속 링크가
  //   통째로 죽고 색인 복구는 수주다. 그래서 문법이 맞으면 **여전히 통과**시키고(= 200 유지),
  //   실재 여부는 `shouldNoindexMissingEntity` 가 self-fetch 404 로만 판정한다.
  if (segs.length === 3 && segs[1] === 'p') return parseMallProductPath(pathname) != null
  return KNOWN_TOP_SEGMENTS.has(segs[0])
}
