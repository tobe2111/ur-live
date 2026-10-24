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
 *   - **2세그먼트 이상**: 최상위 세그먼트만 본다(`/seller/orders/xyz` 처럼 깊은 경로를 절대 안 자른다).
 *     🔁 2026-10-14 — 그 최상위를 (부모 ∪ 잎) 전체가 아니라 **`KNOWN_PARENT_SEGMENTS`**
 *     (자식 라우트가 실제로 있는 것)로 본다. 사유·실측은 그 상수 주석에.
 *
 * 🪦 **`KNOWN_TOP_SEGMENTS`(= 부모 ∪ 잎)는 2026-10-14 에 삭제했다. 되살리지 말 것.**
 *   위 전환으로 **프로덕션이 읽는 곳이 0** 이 됐는데(남은 참조는 주석·시험·주입뿐) 그 상태가
 *   곧 사고를 냈다 — `unknown-path-404` 의 *"반대 방향 — 세그먼트 목록에서 대시보드를 뺀다"* 주입이
 *   그 죽은 집합을 고치고 있어서 **결함을 심어도 시험이 통과**했다(= 헛도는 가드). CI 가 잡았다.
 *   ⇒ 쓰이지 않는데 **load-bearing 처럼 보이는 상수**는 이 레포에서 다음 헛도는 가드의 씨앗이다.
 *   그 집합이 하던 교차검사는 더 강한 것으로 대체돼 있다: 가드가 **라우트 네 파일을 다시 읽어**
 *   부모 집합과 양방향으로 대조한다(`seo-path-normalize-leaf-404-2026-10-14.test.ts` ②).
 *   다시 필요해지면 손으로 적지 말고 그 파일들에서 파생할 것.
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
 * ⚠️ 이 모듈이 **못 보는 것**: **자식이 있는** 최상위 아래의 쓰레기 꼬리(`/vouchers/abc`·
 * `/terms/zzzqqq`). 🩸 2026-10-14 실측 — 그 경로들은 슬롯 정규식이 `(\d+)` 라 **SSR 슬롯에
 * 안 잡히고**(`x-ssr-status` 헤더 자체가 없다) 엔티티 기계에 도달조차 못 한다. 닫으려면 리터럴
 * 자식 + 동적 자식 모양 모델이 필요하고, `/group-buy/confirm-payment` 가 그 위험의 증거다
 * (숫자 전용 규칙을 통째로 걸면 결제 복귀 URL 이 404) — 별건.
 */

/** 세그먼트가 하나뿐인 **정적** 라우트. 1세그먼트 경로는 이것과 정확히 일치해야 한다. */
export const KNOWN_SINGLE_ROUTES: ReadonlySet<string> = new Set([
  '500', 'about', 'admin', 'ads', 'agency', 'area-report', 'blog', 'browse',
  'business', 'cart', 'checkout', 'creator', 'creators', 'experience', 'fail', 'faq',
  'following', 'gb-market', 'gdpr', 'group-buy', 'host', 'influencer', 'interest-list', 'introduce',
  'join', 'kakao-debug', 'life', 'login', 'mall-admin', 'map', 'meal-vouchers', 'my-appointments', 'my-commissions',
  'my-coupons', 'my-deal-history', 'my-gifticons', 'my-orders', 'my-returns', 'my-reviews', 'my-stays', 'my-store',
  'my-vouchers', 'mypage', 'new-openings', 'notifications', 'orders', 'partners', 'partnership', 'privacy',
  'privacy-policy', 'referral', 'refund', 'refund-policy', 'region', 'register', 'restaurant-map', 'search',
  'seller', 'shipping-policy', 'soon', 'stays', 'success', 'terms', 'terms-of-service', 'toss-debug',
  'urshorts', 'videos', 'vouchers', 'wishlist',
])

/**
 * **자식 라우트가 실제로 있는** 최상위 세그먼트. 2세그먼트 이상 판정에 이것을 쓴다.
 *
 * 🩸 2026-10-14 라이브 실측 — 종전은 `KNOWN_TOP_SEGMENTS`(= 부모 ∪ 잎)로 판정해서, 자식이
 *   **아예 없는** 잎 표면도 아무 꼬리를 달면 통과했다:
 *
 *       /browse/zz · /map/zz · /urshorts/zz · /gdpr/zz · /partners/zz
 *       /join/zz · /videos/zz · /privacy/zz · /refund/zz · /new-openings/zz
 *       /faq/a/b/c                          → 전부 200 + index, follow + 자기 canonical
 *
 *   잎 **51개 × 무한 꼬리** 라 무한 thin URL 이고, 이 모듈 머리말이 "못 보는 것" 으로 적어 둔
 *   바로 그 틈이다. 🔴 **CLAUDE.md 가 2026-10-12 `self-fetch-400` 으로 이걸 닫았다고 적은 것은
 *   틀렸다** — 슬롯 정규식이 `(\d+)` 라 숫자 아닌 id 는 슬롯에 **안 잡히고**(실측: `x-ssr-status`
 *   헤더 자체가 없다) 엔티티 기계에 도달조차 못 한다. `/vouchers/abc` 가 오늘도 200 + index 다.
 *
 * 🔴 **반대 방향이 훨씬 비싸다** — 멀쩡한 경로를 404 로 만들면 색인 복구가 수주다. 그래서
 *   목록을 손으로 고르지 않고 **라우트 네 파일에서 계산한 값 그대로** 두고(가드가 매번 다시
 *   계산해 양방향 대조한다), 잎 아래로 런타임이 만드는 깊은 경로가 있는지 전수 grep 했다.
 *   걸린 둘은 전부 가짜였다: `/checkout/return` 은 **코드 참조 0 의 죽은 자리**(레이아웃 접두
 *   목록과 운영 문서에만 남았고 라우트 표에도 없다) · `/my-orders/{id}` 는 **시험 픽스처**이고
 *   실제 알림은 전부 `/my-orders`(id 없음)로 간다.
 *
 * ⚠️ 이것이 **닫지 못하는 것**: 자식이 *있는* 표면의 쓰레기 꼬리(`/terms/zzzqqq`·`/vouchers/abc`).
 *   그건 리터럴 자식 + 동적 자식 모양 모델이 필요하고, `/group-buy/confirm-payment` 가 그 위험의
 *   증거다 — 숫자 전용 규칙을 통째로 걸면 **결제 복귀 URL 이 404** 가 된다. 별건.
 */
export const KNOWN_PARENT_SEGMENTS: ReadonlySet<string> = new Set([
  'about', 'account', 'admin', 'ads', 'agency', 'area-report', 'auth', 'blog', 'brand',
  'campaign', 'community-group-buy', 'coupon', 'creators', 'design', 'district', 'g', 'gift',
  'group-buy', 'host', 'i', 'influencer', 'life', 'local', 'my', 'mypage', 'pass',
  'pay', 'payment', 'points', 'product', 'products', 'profile', 'referral', 'region',
  's', 'seller', 'stays', 'store', 'terms', 'u', 'user', 'v', 'vouchers',
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
  return KNOWN_PARENT_SEGMENTS.has(segs[0])
}
