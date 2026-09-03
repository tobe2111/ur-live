/**
 * 🧱 **소비자에게 보여도 되는 상품인가** — 서비스 분리(도매몰 ↔ 소비자)의 SQL 조각.
 *
 * ## 왜 이 파일이 생겼나 (2026-09-03 QA 1라운드)
 * 라이브 유어샵 `/u/jongmun` 에 담긴 핀이 **도매 원본 상품**(`Canvas Tote Bag`, id 6)이었다.
 * 카드는 이름·가격·별점까지 멀쩡히 떴는데(핀 행이 상품을 JOIN 해서 그린다) 클릭하면 **404** 였다 —
 * 그 상품은 소비자 API 어디에도 없기 때문이다:
 * ```
 *   /api/group-buy/products/6 → 404      /api/products/6 → 404
 *   /u/jongmun/p/6 → 302 /products/6?ref=24 → 404
 * ```
 * 2026-06-26 에 소비자 카탈로그 5개 쿼리에서 도매 원본을 뺐는데(`ProductRepository` 등),
 * **유어샵 핀 조회는 그 규칙을 안 따랐다.** 같은 파일 안에서도 *담을 상품을 고르는* 쿼리엔
 * 이 조건이 있고 *담긴 것을 보여 주는* 쿼리엔 없었다 — 규칙이 복사돼 퍼지면 반드시 한 곳이 빠진다.
 *
 * ## 규칙
 * 도매 **원본**(`is_supply_product=1` 이면서 `supply_source_id` 없음)만 가린다.
 * 판매사가 재판매하는 **복제본**(`supply_source_id` 있음)·플랫폼 상품·일반 소비자 상품은 그대로 보인다
 * — 도매 카탈로그 자신의 정의와 같은 기준이다.
 *
 * ## ⚠️ 이 상수가 아직 못 덮는 곳
 * 같은 술어가 `sitemap.routes`(2곳) · `group-buy-feed-cache` · `section-rules` · `ProductRepository` 에
 * **인라인으로 복사돼** 있다. 그쪽은 잠긴 로딩 경로라 이번에 건드리지 않았다 —
 * 다음에 그 파일을 만질 때 이 상수로 모으면 된다.
 */

/** `alias` 는 products 테이블의 별칭(예: `'p'`). 별칭 없이 쓰려면 `'products'` 를 넘긴다. */
export function consumerVisibleProductSql(alias: string): string {
  return `NOT (COALESCE(${alias}.is_supply_product,0) = 1 AND COALESCE(${alias}.supply_source_id,0) = 0)`
}
