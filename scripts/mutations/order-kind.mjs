/**
 * 🧾 주문 종류 / 주문관리 배송 UI 분기 — 되돌려-검증 주입 (2026-09-21).
 *
 * 각 항목은 "고치기 전의 코드"로 되돌린다. 빨간불이 안 뜨면 그 가드는 지키는 척만 하는 것이다.
 */
export default [
  {
    name: '🧾 이용권을 다시 "교환권"이라 부른다 (어드민 종류 칸 — 실사고 원본)',
    file: 'src/pages/AdminOrdersPage.tsx',
    find: "const kind = orderKindOf(getNoShippingKind({ category, deal_only: dealOnly }) ?? 'shipping')",
    replace: "const kind = category && ['meal_voucher','beauty_voucher','stay_voucher','etc_voucher'].includes(category) ? 'deal' : 'shipping'",
    test: 'src/tests/unit/order-kind-2026-09-21.test.ts',
    why:
      '카테고리만으로 갈라 `meal_voucher`(카드 결제 이용권)를 교환권으로 찍던 그 판정이다. ' +
      '명칭 SSOT 가 못 박은 구분이 화면에서 뒤집히고, 아무 에러도 안 난다.',
  },
  {
    name: '🧾 어드민 쿼리에서 deal_only 를 뺀다 (이용권↔교환권이 구조적으로 안 갈린다)',
    file: 'src/features/admin/api/admin-orders.routes.ts',
    find: '               (SELECT p.deal_only FROM order_items oi JOIN products p ON p.id = oi.product_id WHERE oi.order_id = o.id ORDER BY oi.id LIMIT 1) as first_item_deal_only',
    replace: '               NULL as first_item_deal_only',
    test: 'src/tests/unit/order-kind-2026-09-21.test.ts',
    why: '판정에 필요한 값을 서버가 안 보내면 화면은 전부 이용권으로 본다 — 교환권이 사라진다.',
  },
  {
    name: '🧾 서버가 주문 종류를 안 붙인다 (주문관리가 모든 주문을 택배로 가정하던 상태)',
    file: 'src/worker/utils/order-list-enrich.ts',
    find: '        o.order_kind = orderKindOfItems(flows)',
    replace: '        void flows',
    test: 'src/tests/unit/order-kind-2026-09-21.test.ts',
    why: '이 한 줄이 없으면 이용권 주문이 배송 정보 빈 칸 셋과 "준비중으로 변경" 버튼을 달고 뜬다.',
  },
  {
    name: '💸 enrich 가 price 를 다시 안 싣는다 (셀러 주문 상세 상품 금액이 전부 0원)',
    file: 'src/worker/utils/order-list-enrich.ts',
    find: '      `SELECT order_id, product_id, product_name, quantity, price, unit_price, subtotal, options, product_image',
    replace: '      `SELECT order_id, product_id, product_name, quantity, unit_price, subtotal, options, product_image',
    test: 'src/tests/unit/order-kind-2026-09-21.test.ts',
    why:
      '화면은 `item.price` 를 읽는다. 서버가 안 보내면 `undefined * quantity → NaN → formatNumber → "0"` — ' +
      '에러 없이 **모든 주문의 상품 금액이 0원**이 된다(2026-08-02~09-21 실제로 그랬다).',
  },
  {
    name: '🧾 이용권 주문에서도 배송 상태 전이를 제안한다 ("준비중"으로 변경)',
    file: 'src/pages/seller-orders/OrderDetailModal.tsx',
    find: '  const next = noShipping ? null : nextStatusOf(order.status)',
    replace: '  const next = nextStatusOf(order.status)',
    test: 'src/tests/unit/order-kind-2026-09-21.test.ts',
    why: '이용권엔 배송준비·발송·배송완료가 없다. 셀러가 누를 수 있는 유일한 버튼이 이 주문과 무관해진다.',
  },
  {
    name: '🧾 이용권 주문에 운송장 등록 폼을 되살린다',
    file: 'src/pages/seller-orders/OrderDetailModal.tsx',
    find: "            {!noShipping && order.status !== 'DELIVERED' && order.status !== 'CANCELLED' && (",
    replace: "            {order.status !== 'DELIVERED' && order.status !== 'CANCELLED' && (",
    test: 'src/tests/unit/order-kind-2026-09-21.test.ts',
    why: '배송이 없는 주문에 택배사·송장번호를 입력하라고 요구하는 화면이 된다.',
  },
  {
    name: '🧾 화면이 종류를 스스로 판정한다 (서버 값을 무시)',
    file: 'src/pages/seller-orders/OrderDetailModal.tsx',
    find: '  const kind = orderKindOf(order.order_kind)',
    replace: "  const kind = order.shipping_address ? 'shipping' as const : 'voucher' as const",
    test: 'src/tests/unit/order-kind-2026-09-21.test.ts',
    why:
      '판정이 화면마다 갈리기 시작하는 자리다. 배송지가 아직 안 붙은 배송 주문이 이용권으로 보이고, ' +
      '그 순간 셀러가 송장을 넣을 방법이 사라진다.',
  },
  {
    name: '🔴 어드민 주문 SQL 이 라이브에 없는 컬럼을 다시 SELECT 한다 (폴백이 조용히 돈다)',
    file: 'src/features/admin/api/admin-orders.routes.ts',
    // 두 쿼리에 같은 줄이 있어 `tracking_number,''`(공백 없음)까지 넣어야 목록 쿼리 쪽으로 유일해진다.
    find: "COALESCE(o.shipping_postal_code, '') as shipping_zipcode,   -- 2026-09-21: 옛 우편번호 컬럼은 라이브에 없다(쿼리 전체가 던져 폴백이 돌았다)\n               COALESCE(o.courier, o.shipping_company, '') as courier,   -- 2026-08-02: tracking_company 는 실컬럼 아님(쿼리 전체가 던졌다)\n               COALESCE(o.tracking_number,'') as tracking_number,",
    replace: "COALESCE(o.shipping_zipcode, o.shipping_postal_code, '') as shipping_zipcode,\n               COALESCE(o.courier, o.shipping_company, '') as courier,\n               COALESCE(o.tracking_number,'') as tracking_number,",
    test: 'src/tests/unit/order-kind-2026-09-21.test.ts',
    why:
      '실사고 원본. SQLite 는 없는 컬럼에 파싱 단계에서 던지므로 **쿼리 전체가 죽고**, ' +
      '폴백이 고객명·셀러명·상품명·주문종류를 빈 값으로 서빙하면서 success:true 로 돌려준다 — ' +
      '어드민 주문관리가 몇 달간 반쪽이었는데 아무도 몰랐다.',
  },
  {
    name: '🔴 폴백 경고를 다시 DEV 게이트 뒤로 숨긴다 (프로덕션에서 안 보인다)',
    file: 'src/features/admin/api/admin-orders.routes.ts',
    find: "      console.error('[Admin] orders primary query failed",
    replace: "      if (import.meta.env.DEV) console.error('[Admin] orders primary query failed",
    test: 'src/tests/unit/order-kind-2026-09-21.test.ts',
    why: '이 게이트가 바로 그 사고를 몇 달간 안 보이게 만든 것이다 — 폴백은 소리를 내야 한다.',
  },
  {
    name: '🛠️ 셀러 상품 상세가 라이브에 없는 컬럼을 다시 무조건 SELECT 한다 (편집 화면 500)',
    file: 'src/features/seller/api/seller-orders.routes.ts',
    find: "         p.live_stream_id,${withLive ? ' p.live_only_price, p.live_price_enabled,' : ''}",
    replace: '         p.live_stream_id, p.live_only_price, p.live_price_enabled,',
    test: 'src/tests/unit/order-kind-2026-09-21.test.ts',
    why:
      '실사고 원본. 편집 화면이 아예 안 열려 삭제 버튼에도 못 닿았다(대표 신고 "이용권 편집 및 삭제하려니까 안돼").',
  },
  {
    name: '🛠️ 컬럼 부재 폴백이 모든 에러를 삼킨다 (다음 결함이 조용해진다)',
    file: 'src/features/seller/api/seller-orders.routes.ts',
    find: "        if (!/no such column/i.test(String((e as Error)?.message || ''))) throw e",
    replace: '        // (아무 에러나 폴백)',
    test: 'src/tests/unit/order-kind-2026-09-21.test.ts',
    why: '권한·바인딩 오류까지 조용히 2차 쿼리로 넘어가면 진짜 원인이 영영 안 보인다.',
  },
]
