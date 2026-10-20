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
  return `(${approvedStatusSql(alias)} AND ${exposureReadySql(alias)})`
}

/** 승인 상태만 묻는 조각 — `approvedSellerProductSql` 의 절반. 테스트가 따로 잰다. */
export function approvedStatusSql(alias: string): string {
  return `NOT EXISTS (
    SELECT 1 FROM sellers s_appr
     WHERE s_appr.id = ${alias}.seller_id
       AND COALESCE(s_appr.status, '') NOT IN ('approved', 'active')
  )`
}

/**
 * ⏳ **신규 매장 노출 유예** (2026-09-21 — 사기 방어 ②).
 *
 * 승인은 났지만 **아직 노출 시작 시각이 오지 않은** 매장의 상품을 가린다. 목적은 하나다 —
 * 승인 직후 몇 시간을 벌어, 그 사이에 확인 통화(`store_verify_calls`)나 제보(`store_reports`)가
 * 들어올 수 있게 하는 것. 확인이 끝나면 마커가 지워져 **즉시** 보인다.
 *
 * ## 🔒 기본은 아무것도 안 가린다
 * 마커(`seller_meta.store_exposure_from`)는 **유예 설정이 켜져 있을 때만** 쓰인다
 * (`markExposureGrace`). 설정이 0/미설정이면 행 자체가 안 생기므로 이 술어는 **항상 참** —
 * 즉 오늘 라이브와 byte-동일하게 동작한다.
 *
 * ## ⚠️ 관대한 쪽으로 기운 자리 (의도적 — 위 `approvedSellerProductSql` 과 같은 이유)
 * 마커가 없으면 보인다. 기존 매장 전부가 여기 해당한다 — 소급 적용하면 라이브가 통째로 빈다.
 */
export function exposureReadySql(alias: string): string {
  return `NOT EXISTS (
    SELECT 1 FROM seller_meta sm_exp
     WHERE sm_exp.seller_id = ${alias}.seller_id
       AND sm_exp.key = 'store_exposure_from'
       AND sm_exp.value > datetime('now')
  )`
}

/**
 * 🚫 **정지·비활성 매장의 상품은 소비자 목록에서 가린다** (2026-04-22 규칙, 2026-10-01 SSOT 로 수습).
 *
 * `ProductRepository.findAll` 머리말이 2026-04-22 부터 이 규칙을 *"(검색/브라우즈 방어)"* 라고
 * 적어 두고 있었는데, **검색 쪽은 그 방어를 갖고 있지 않았다.** 2026-09-03 FTS 재작성이
 * `searchProducts` 를 새로 쓰면서 셀러 술어만 따라오지 않았고, 자동완성(`search-suggestions`)은
 * 애초에 가진 적이 없다. 둘 다 `p.is_active = 1` 은 있어서 **평소엔 증상이 안 보인다** —
 * 정지 엔드포인트가 그 매장 상품을 전부 `is_active = 0` 으로 만들기 때문이다.
 *
 * 2026-10-01 에 "메인에선 숨기고 직링크로는 팔리게" 를 만들며 **매장만 정지 + 상품은 활성**
 * 조합이 생기자 즉시 드러났다: 피드·섹션·카탈로그에선 사라졌는데 `이용권`·`분식` 검색과
 * 자동완성에는 그대로 떴다.
 *
 * ## 판정
 * `sellers.is_active = 0` 인 매장의 상품만 가린다. `seller_id IS NULL`(플랫폼 교환권·KT·데모)과
 * **셀러 행이 아예 없는 dangling `seller_id`** 는 통과 — 이 파일의 다른 술어와 같은 이유로
 * 관대한 쪽이다(조인이 깨진 날 멀쩡한 상품이 통째로 사라지면 안 된다).
 *
 * ## ⚠️ `approvedSellerProductSql` 과 다른 축이다
 * 그쪽은 *"승인됐는가"*(`status`)를 묻고 **메인 노출**에만 걸린다. 이쪽은 *"살아 있는 매장인가"*
 * (`is_active`)를 묻고 **소비자 목록 전반**에 걸린다. 겹쳐 쓰지 말 것 — 어느 쪽이 가렸는지
 * 못 읽게 된다(`approvedSellerProductSql` 주석의 같은 경고).
 *
 * ## ⚠️ 쌍둥이가 둘 남아 있다
 * `ProductRepository` 의 `findAll`·`count` 는 같은 술어를 **인라인으로** 갖고 있다
 * (`products` 별칭, 잠긴 로딩 경로라 이번에 건드리지 않았다). 가드가 넷이 안 갈리는지 검사한다.
 */
export function activeSellerProductSql(alias: string): string {
  return `NOT EXISTS (
    SELECT 1 FROM sellers s_act
     WHERE s_act.id = ${alias}.seller_id
       AND s_act.is_active = 0
  )`
}
