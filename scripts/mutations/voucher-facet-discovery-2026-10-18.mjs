/**
 * 🎁 교환권 facet 발견 경로 — sitemap 제출(재고 집계) + 허브 내부 링크 (2026-10-18) — 주입 매니페스트.
 * 가드: src/tests/unit/voucher-facet-discovery-2026-10-18.test.ts
 *
 * 절반이 **반대 방향**이다 — 발견 경로를 넓히려다 ① 빈 목록을 색인 요청하거나 ② noindex 상세로
 * 크롤 예산을 보내거나 ③ 집계 실패를 "재고 0" 으로 읽어 이미 색인된 것을 빼는 쪽이 더 조용하고
 * 더 나쁘다.
 */
const TEST = 'src/tests/unit/voucher-facet-discovery-2026-10-18.test.ts'
const SSOT = 'src/shared/seo/voucher-facet.ts'
const SITEMAP = 'src/worker/routes/sitemap.routes.ts'
const NOSCRIPT = 'src/worker/utils/crawler-noscript.ts'

export default [
  {
    name: '🎁 sitemap 이 집계 대신 하드코딩 3개로 돌아간다',
    file: SITEMAP,
    find: 'const facets = voucherFacetsByStock(facetRows.results || []);',
    replace: 'const facets = voucherFacetsByStock([]);',
    test: TEST,
    why: '제출이 폴백 3개로 되돌아가 17종이 다시 발견 경로 0 이 된다(이 PR 이 고친 그 상태).',
  },
  {
    name: '🎁 집계가 허용목록(canonical 이 믿는 집합)을 안 본다',
    file: SSOT,
    find: "if (!cat || !VOUCHER_FILTER_CATEGORIES.includes(cat)) continue",
    replace: 'if (!cat) continue',
    test: TEST,
    why: '`건강/식품/주방` 같은 값이 제출되는데 canonical 은 `/vouchers` 로 통합한다 — 제출한 URL 의 정본이 다른 곳을 가리킨다.',
  },
  {
    name: '🎁 재고 문턱이 사라진다(빈 목록을 색인 요청)',
    file: SSOT,
    find: 'if (!Number.isFinite(n) || n < VOUCHER_FACET_MIN_ITEMS) continue',
    replace: 'if (!Number.isFinite(n)) continue',
    test: TEST,
    why: '2026-07-29 영문 슬러그 6건 사고와 같은 클래스 — 0건 facet 이 soft-404 로 집계돼 크롤 예산을 깎는다.',
  },
  {
    name: '🎁 폴백이 집계 결과를 덮는다(항상 3개)',
    file: SITEMAP,
    find: 'if (facetsEmitted === 0) {',
    replace: 'if (true) {',
    test: TEST,
    why: '제출이 20 + 3 중복이 되고, 집계가 거른 0건 카테고리도 다시 제출된다.',
  },
  {
    name: '🎁 (반대 방향) 집계 실패 폴백이 사라진다',
    file: SITEMAP,
    find: 'if (facetsEmitted === 0) {',
    replace: 'if (false) {',
    test: TEST,
    why: 'DB 부재·쿼리 실패를 "재고 0" 으로 읽어 facet 제출이 통째로 0 이 된다 — 이미 색인된 3건이 빠지고 색인은 돌아오는 데 수주다.',
  },
  {
    name: '🎁 허브 facet 링크가 사라진다',
    file: NOSCRIPT,
    find: "const facetLinks = path === '/vouchers' ? facetLinksHtml() : ''",
    replace: "const facetLinks = ''",
    test: TEST,
    why: '허브 a태그가 다시 0 이 되어 facet 20개가 sitemap 으로만 발견된다(내부 링크 가치 0).',
  },
  {
    name: '🎁 (반대 방향) facet 링크를 모든 목록 표면에 낸다',
    file: NOSCRIPT,
    find: "const facetLinks = path === '/vouchers' ? facetLinksHtml() : ''",
    replace: 'const facetLinks = facetLinksHtml()',
    test: TEST,
    why: '`/browse`·`/map`·`/stays` 가 자기에게 없는 교환권 facet 으로 링크한다 — 그 표면들엔 category 체계가 없다.',
  },
  {
    name: '🎁 (반대 방향) 교환권 상세(noindex)에 a태그를 단다',
    file: NOSCRIPT,
    find: 'const facetLinks = ',
    replace: "const facetLinks = `<ul><li><a href=\"/vouchers/1\">x</a></li></ul>` + ",
    test: TEST,
    why: '교환권 상세는 2026-07-07 결정으로 noindex 다 — 색인 말라고 한 URL 로 크롤 예산을 보낸다.',
  },
  {
    name: '🎁 주소 조립이 URLSearchParams 로 바뀐다(공백이 `+`)',
    file: SSOT,
    find: 'return `/vouchers?category=${encodeURIComponent(category)}`',
    replace: "return `/vouchers?category=${new URLSearchParams({ category }).get('category') ? new URLSearchParams({ category }).toString().slice(9) : ''}`",
    test: TEST,
    why: '`3사 통합데이터 상품` 이 `+` 로 인코딩돼 canonical(`%20`)과 갈린다 — 같은 facet 을 두 URL 로 말한다.',
  },
  {
    name: '🎁 집계가 `gift_catalog` JOIN 기준으로 센다(화면 칩 기준)',
    file: SITEMAP,
    find: '`SELECT category, COUNT(*) AS n FROM products\n         WHERE is_active = 1 AND deal_only = 1',
    replace: '`SELECT gc.goods_type_detail AS category, COUNT(*) AS n FROM products\n         INNER JOIN gift_catalog gc ON gc.gift_code = products.kt_alpha_gift_code\n         WHERE is_active = 1 AND deal_only = 1',
    test: TEST,
    why: '본문을 만드는 쿼리와 기준이 달라진다 — 실측에서 `건강/식품/주방` 이 0 ↔ 3 으로 갈렸다(제출의 짝은 본문이다).',
  },
  {
    name: '🎁 집계에서 `deal_only = 1` 이 빠진다',
    file: SITEMAP,
    find: 'WHERE is_active = 1 AND deal_only = 1\n           AND category IS NOT NULL',
    replace: 'WHERE is_active = 1\n           AND category IS NOT NULL',
    test: TEST,
    why: '쇼핑·이용권 상품이 교환권 facet 재고로 세어져, 교환권이 0건인 카테고리도 제출된다.',
  },
  {
    name: '🎁 집계에서 가시성 SSOT 가 빠진다',
    file: SITEMAP,
    find: "           AND ${consumerVisibleProductSql('products')}${productScope}\n         GROUP BY category",
    replace: '           AND 1 = 1\n         GROUP BY category',
    test: TEST,
    why: '도매 원본 상품이 재고로 세어진다 — 소비자 목록엔 안 뜨므로 제출했는데 본문이 비는 짝 주장 위반이 된다.',
  },
  {
    name: '🎁 링크 라벨에 꼬리를 붙인다',
    file: SSOT,
    find: 'return VOUCHER_FILTER_CATEGORIES.map((c) => ({ label: c, href: voucherFacetPath(c) }))',
    replace: "return VOUCHER_FILTER_CATEGORIES.map((c) => ({ label: `${c} 교환권`, href: voucherFacetPath(c) }))",
    test: TEST,
    why: '`regionChildLinks` 와 다른 규율이 되고 20줄이 같은 꼬리를 단다(허브 h1 이 이미 "교환권" 이다).',
  },
]
