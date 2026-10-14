/**
 * 🏪 2026-10-14 — 가게 유어샵의 **정본 URL 을 한 곳**에서 정한다.
 *
 * ## 실측 (Googlebot UA)
 *
 *     /s/store_muxlddtf74b        200 · <title>달빛한스푼 유어샵 - 유어딜 · canonical = 자기자신
 *     /profile/store_muxlddtf74b  200 · 같은 제목                        · canonical = 자기자신
 *
 * 같은 컴포넌트(`SellerPublicPage`)를 렌더하는 **두 별칭**(`routes/seller.routes.tsx`)인데 정본
 * 통합이 없다 — 같은 가게가 두 URL 로 색인 경쟁한다. sitemap 은 `/s/` 만 제출하고 `/profile/` 은
 * 앱 내비(`useLinkshopPath` 의 셀러-only 폴백)가 링크하므로 외부 공유·옛 링크가 그쪽을 가리킨다.
 *
 * 🔑 **정본 규칙은 이미 있었다** — `sitemap.routes.ts` 가 `s.handle ? /u/{handle} : /s/{username||id}`
 *    로 제출한다. 그런데 `buildSellerSurfaceMeta` 는 `canonical` 을 `${origin}${pathname}` 으로,
 *    즉 **요청된 별칭을 그대로** 정본이라 말했다. 조립처가 둘이면 *제출한 URL 이 다른 URL 을 정본이라
 *    말하는* 모순이 조용히 생긴다(#18 숙소 `/pass`↔`/stays`, #27 `/products`↔`/pass` 와 같은 클래스).
 *
 * ## 🔴 위험 방향 — 정본이 **죽은 URL** 을 가리키는 것
 * 핸들이 없는 가게에 `/u/` 를 주면 제출한 URL 이 404 를 정본으로 지목한다(색인에서 통째로 빠지고
 * 복구는 수주다). 그래서 **`handle` 이 빈 값이면 절대 `/u/` 를 쓰지 않는다** — sitemap 과 **같은
 * 술어**이고, 두 곳이 이 함수를 같이 쓰므로 갈릴 수가 없다.
 *
 * ⚠️ **이 모듈이 못 보는 것**: 그 handle 이 라이브에서 실제로 200 인지(DB 조회 시점의 값을 믿는다) ·
 *    구글이 통합을 적용하는지(색인 수일~수주 · 서치콘솔은 **대표만** 본다).
 */

/**
 * 가게(사업자) 유어샵의 정본 경로.
 *
 * - 연결된 유저가 큐레이터 핸들을 가졌으면 `/u/{handle}`(유어샵 단일화 — 2026-06-17 대표 확정)
 * - 아니면 `/s/{username}`, username 도 없으면 `/s/{id}`
 * - 셋 다 없으면 `null` — **정본을 지어내지 않는다**(호출부가 자기 경로를 쓴다).
 */
export function canonicalShopPath(
  handle: string | null | undefined,
  username: string | null | undefined,
  id: number | string | null | undefined,
): string | null {
  const h = String(handle ?? '').trim()
  if (h) return `/u/${h}`
  const u = String(username ?? '').trim()
  if (u) return `/s/${u}`
  const i = String(id ?? '').trim()
  return i ? `/s/${i}` : null
}
