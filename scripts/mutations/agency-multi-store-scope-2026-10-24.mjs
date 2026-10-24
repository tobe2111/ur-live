/**
 * 🤝 한 매장 · 여러 에이전시 · 성과는 이용권 단위 (2026-10-24 대표 확정) — 주입 매니페스트.
 * 가드: src/tests/unit/agency-multi-store-scope-2026-10-24.test.ts
 *
 * 전부 **에러가 안 나는 결함**이다 — 같은 매장의 다른 에이전시·사장님 매출이 조용히 보이거나,
 * 두 번째 에이전시가 조용히 막히거나, 만든 이용권이 주인을 잃는다.
 */
const TEST = 'src/tests/unit/agency-multi-store-scope-2026-10-24.test.ts'
const SCOPE = 'src/worker/utils/agency-product-scope.ts'
const GUARD = 'src/worker/utils/store-seat-guard.ts'
const QUERY = 'src/features/seller/api/seller-products-query.ts'
const ORDERS = 'src/features/seller/api/seller-orders.routes.ts'
const TODAY = 'src/features/agency-console/api/agency-store-today.ts'
const OPS = 'src/features/seller/api/seller-operators.routes.ts'
const NOTIF = 'src/features/seller/api/seller-store-notifications.ts'
const LINK = 'src/features/seller/api/seller-agency-link.routes.ts'

export default [
  {
    name: '[멀티에이전시] 허용목록 밖도 통과시킨다(기본 차단을 기본 허용으로)',
    file: SCOPE,
    find: '  return { allow: false }\n}',
    replace: '  return { allow: true }\n}',
    test: TEST,
    why: '매장 전체를 여는 셀러 API 가 하나라도 열리면 같은 매장 다른 에이전시의 매출이 보인다 — 에러 0.',
  },
  {
    name: '[멀티에이전시] 가드가 에이전시 좌석의 차단 판정을 건너뛴다',
    file: GUARD,
    find: '      if (!d.allow) return c.json(agencyScopeDeniedResponse(), 403)',
    replace: '      if (false) return c.json(agencyScopeDeniedResponse(), 403)',
    test: TEST,
    why: '판정 함수가 멀쩡해도 입구가 안 부르면 아무것도 안 막는다.',
  },
  {
    name: '[멀티에이전시] 이용권 하나를 가리키는 요청의 소유 확인을 건너뛴다',
    file: GUARD,
    find: "      if (d.productId != null && (await agencyOwnsProduct(env.DB, agencySeat, d.productId)) !== true) {",
    replace: "      if (false && d.productId != null && (await agencyOwnsProduct(env.DB, agencySeat, d.productId)) !== true) {",
    test: TEST,
    why: '그러면 에이전시 A 가 B 의 이용권 가격을 바꾸고 지운다.',
  },
  {
    name: '[멀티에이전시] 소유 확인을 매장만으로 한다(에이전시를 안 본다)',
    file: SCOPE,
    find: "'SELECT 1 AS ok FROM agency_products WHERE product_id = ? AND agency_id = ? AND seller_id = ? LIMIT 1',\n    ).bind(productId, seat.agencyId, seat.sellerId)",
    replace: "'SELECT 1 AS ok FROM products WHERE id = ? AND seller_id = ? LIMIT 1',\n    ).bind(productId, seat.sellerId)",
    test: TEST,
    why: '같은 매장 이용권이면 다 통과 — 사장님 것도 다른 에이전시 것도 열린다.',
  },
  {
    name: '[멀티에이전시] 목록이 에이전시 필터를 count 에만 건다(목록엔 남의 것이 보인다)',
    file: QUERY,
    find: "  if (agencyId) {\n    query += ` ${agencyProductFilterSql('p')}`\n    params.push(agencyId, sellerId)\n  }",
    replace: '',
    test: TEST,
    why: '목록과 count 가 갈리면 has_more 도 틀리고, 무엇보다 남의 이용권이 목록에 뜬다.',
  },
  {
    name: '[멀티에이전시] 목록 라우트가 에이전시 id 를 안 넘긴다',
    file: ORDERS,
    find: '      sellerId, limit, offset, sort, search, includeDeleted, agencyId,\n',
    replace: '      sellerId, limit, offset, sort, search, includeDeleted,\n',
    test: TEST,
    why: '빌더가 멀쩡해도 라우트가 안 넘기면 매장 전체 목록이 나간다.',
  },
  {
    name: '[멀티에이전시] 만든 이용권에 에이전시를 안 찍는다',
    file: 'src/features/agency-console/api/channel-sales.ts',
    find: "    'INSERT OR IGNORE INTO agency_products (product_id, seller_id, agency_id, created_by_staff_id) VALUES (?, ?, ?, ?)',",
    replace: "    'SELECT ?, ?, ?, ?',",
    test: TEST,
    why: '찍히지 않으면 에이전시는 방금 만든 자기 이용권을 못 보고, 이어지는 이용권 설정이 404 가 된다.',
  },
  {
    name: '[멀티에이전시] 콘솔 오늘 매출을 주문 총액으로 센다(남의 이용권 금액이 섞인다)',
    file: TODAY,
    find: '              COALESCE(SUM(COALESCE(NULLIF(oi.subtotal, 0), oi.price * oi.quantity)), 0) AS rev',
    replace: '              COALESCE(SUM(o.total_amount), 0) AS rev',
    test: TEST,
    why: '한 주문에 사장님·다른 에이전시 이용권이 섞이면 그 금액까지 내 성과로 보인다.',
  },
  {
    name: '[멀티에이전시] 콘솔 숫자가 에이전시 조인을 뺀다(매장 전체 숫자)',
    file: TODAY,
    find: "  const mine = `JOIN agency_product_periods pr ON ${periodMatchSql('pr', 'oi.product_id', 'o.seller_id')} AND pr.agency_id = ?`",
    replace: "  const mine = `JOIN agency_product_periods pr ON ${periodMatchSql('pr', 'oi.product_id', 'o.seller_id')} AND (pr.agency_id = ? OR 1)`",
    test: TEST,
    why: '조인이 에이전시를 안 거르면 이 매장의 모든 에이전시 매출을 내 것으로 센다.',
  },
  {
    name: '[멀티에이전시] 매장 요약이 에이전시 좌석에도 매장 전체 숫자를 준다',
    file: OPS,
    find: '    if (scope.agencyId) return c.json({ success: true, data: await agencySummary(c.env.DB, stores, scope.agencyId, currentSellerId ?? null) }) // 🤝 자기 이용권 숫자만\n',
    replace: '',
    test: TEST,
    why: '/my-stores/summary 는 가드가 건너뛰는 경로라 여기서 직접 거르지 않으면 매장 전체 매출이 나간다.',
  },
  {
    name: '[멀티에이전시] 매장 알림함을 에이전시 좌석에게 보인다',
    file: NOTIF,
    find: '  if (scope.agencyId) return []\n',
    replace: '',
    test: TEST,
    why: '알림함은 매장 단위라 사장님·다른 에이전시의 판매가 섞여 있다.',
  },
  {
    name: '[멀티에이전시] 끊기가 매장의 모든 맡김을 한꺼번에 끊는다',
    file: LINK,
    find: "          WHERE id = ? AND seller_id = ? AND status IN ('pending','active')\n         RETURNING agency_id`,\n      ).bind(g.userId, linkId, g.sellerId)",
    replace: "          WHERE seller_id = ? AND status IN ('pending','active')\n         RETURNING agency_id`,\n      ).bind(g.userId, g.sellerId)",
    test: TEST,
    why: '에이전시 하나를 끊으려다 함께 하던 다른 에이전시까지 조용히 잘린다.',
  },
]
