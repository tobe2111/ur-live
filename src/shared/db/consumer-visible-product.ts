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

/**
 * 🏪 **승인된 매장의 상품만 메인에 노출한다** (2026-09-16 대표 지시).
 *
 * > 대표: *"최종 이용권 등록은 되지만 반려가 아닌 승인이 되어야 메인에 노출이 되게끔 하고."*
 *
 * 같은 날 셀러 대시보드를 **대기·반려 상태에서도 열어 줬다**(당근 모델 — 들여보내고, 배너로
 * 알린다). 그러면 승인 전에도 이용권을 등록할 수 있게 되므로, **노출 쪽에 벽이 없으면**
 * 사기꾼이 가입 직후 남의 가게 이름으로 만든 이용권이 메인 피드에 뜬다. 이 조각이 그 벽이다.
 *
 * ## 판정
 * `sellers.status` 가 `approved`·`active` 가 **아닌** 상품만 가린다. 판매자가 없는 상품
 * (`seller_id IS NULL` — 플랫폼 교환권·KT·데모)은 그대로 보인다: 심사할 매장이 없다.
 *
 * ## ⚠️ 관대한 쪽으로 기운 자리 둘 (의도적)
 *   1. **셀러 행이 아예 없는 dangling `seller_id`** 는 통과시킨다. 숨기는 쪽으로 짜면
 *      조인이 깨진 날 멀쩡한 상품이 통째로 사라진다 — `ProductRepository` 의 기존
 *      `is_active = 0` 필터도 같은 `NOT EXISTS` 모양이라 판정이 갈리지 않는다.
 *   2. **`suspended` 는 이 조각이 아니라 `is_active`/운영이 막는다.** 여기서는
 *      "승인됐는가" 하나만 묻는다 — 조건을 겹쳐 쓰면 어느 쪽이 가렸는지 못 읽는다.
 *
 * ## ⚠️ 이 조각이 못 막는 것 (그대로 보고할 것)
 * **직링크 상세·구매는 막지 않는다.** 대표 지시는 *"메인에 노출"* 이고, 구매 차단은
 * 결제 경로(등급 C)를 건드리는 별건이다. 승인 전 매장이 자기 링크를 직접 뿌리면
 * 여전히 팔 수 있다 — 다만 그 돈은 `payout_requires_voucher_use` 게이트가 잡는다.
 *
 * `alias` 는 products 테이블의 별칭(예: `'p'`). 별칭 없이 쓰려면 `'products'`.
 */
export function approvedSellerProductSql(alias: string): string {
  return `NOT EXISTS (
    SELECT 1 FROM sellers s_appr
     WHERE s_appr.id = ${alias}.seller_id
       AND COALESCE(s_appr.status, '') NOT IN ('approved', 'active')
  )`
}
