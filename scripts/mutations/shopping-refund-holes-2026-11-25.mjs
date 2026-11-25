/** 🛒💸 2026-11-25 쇼핑 환불 구멍 — 가드: src/tests/unit/shopping-refund-holes-2026-11-25.test.ts */
const T = 'src/tests/unit/shopping-refund-holes-2026-11-25.test.ts'

export default [
  {
    name: '[shop-refund] 손님이 다시 금액을 정해 일부만 환불받는다(/refund)',
    file: 'src/worker/routes/order.routes.ts',
    find: "if (c.get('user').type !== 'admin' && body.refund_amount != null && Math.round(Number(body.refund_amount)) !== Number(order.total_amount)) return c.json({ success: false, error: PARTIAL_SELF_REFUND_BLOCKED, code: 'PARTIAL_NOT_ALLOWED' }, 400);",
    replace: "",
    test: T,
    why: '99% 를 돌려받고도 주문은 결제 완료로 남아 상품이 전부 배송되고 정산은 전액으로 잡힌다.',
  },
  {
    name: '[shop-refund] 손님이 다시 금액을 정해 일부만 취소한다(/:id/cancel)',
    file: 'src/worker/routes/order.routes.ts',
    find: "if (!isFullCancel && c.get('user').type !== 'admin') return c.json({ success: false, error: PARTIAL_SELF_REFUND_BLOCKED, code: 'PARTIAL_NOT_ALLOWED' }, 400);",
    replace: "",
    test: T,
    why: '같은 구멍의 다른 문이다.',
  },
  {
    name: '[shop-refund] 손님 환불 길의 선물 검사가 빠진다',
    file: 'src/worker/routes/order.routes.ts',
    find: "if (c.get('user').type !== 'admin' && (await orderHasGiftedVoucher(c.env.DB, String(order.id)) || await orderHasPendingGift(c.env.DB, String(order.id)))) return c.json({ success: false, error: GIFTED_REFUND_BLOCKED, code: 'GIFTED' }, 400);",
    replace: "",
    test: T,
    why: '선물로 넘긴 이용권이 든 주문을 환불해 받은 사람의 이용권이 죽는다.',
  },
  {
    name: '[shop-refund] 이미 환불된 주문의 반품에 딜을 또 준다',
    file: 'src/features/returns/api/returns.routes.ts',
    find: "  if (['REFUNDED', 'CANCELLED'].includes(String(order.status))) {",
    replace: "  if (false) {",
    test: T,
    why: '셀러가 먼저 환불한 주문의 반품을 처리하면 같은 딜이 두 번 나간다.',
  },
  {
    name: '[shop-refund] 반품 환불이 이미 환불한 금액을 안 뺀다',
    file: 'src/features/returns/api/returns.routes.ts',
    find: "  if (returnRecord.refund_amount > orderAmount - Number(order.refunded_amount ?? 0)) return",
    replace: "  if (returnRecord.refund_amount > orderAmount) return",
    test: T,
    why: '일부 환불된 주문에 반품 환불을 전액으로 한 번 더 한다.',
  },
  {
    name: '[shop-refund] 반품 환불이 장부(refunded_amount)에 안 적힌다',
    file: 'src/features/returns/api/returns.routes.ts',
    find: "  await DB.prepare('UPDATE orders SET refunded_amount = MIN(COALESCE(total_amount, 0), COALESCE(refunded_amount, 0) + ?) WHERE id = ?').bind(Number(returnRecord.refund_amount) || 0, returnRecord.order_id).run().catch(() => null); const { transitionOrderStatus }",
    replace: "  const { transitionOrderStatus }",
    test: T,
    why: '다른 환불 길의 상한이 0 인 채로 남아 같은 돈이 또 나갈 수 있다.',
  },
  {
    name: '[shop-refund] 카드 취소가 실패해도 반품 건이 닫힌 채 남는다',
    file: 'src/features/returns/api/returns.routes.ts',
    find: "    if (!cancelResult.success) { await DB.prepare(`UPDATE returns SET status = 'inspected', refunded_at = NULL WHERE id = ? AND status = 'refunded'`).bind(returnId).run().catch(() => null) // 선점을 되돌린다(돈이 안 나갔다)",
    replace: "    if (!cancelResult.success) {",
    test: T,
    why: '돈은 안 돌아갔는데 반품은 "환불 완료" 로 보이고 다시 처리할 수도 없다.',
  },
  {
    name: '[shop-refund] 딜 화면이 다시 "후원" 이라고 부른다',
    file: 'src/pages/AdminDealMonitorPage.tsx',
    find: "sub={`사용 ${fmt(s?.donations.total_donated)}딜`}",
    replace: "sub={`후원 ${fmt(s?.donations.total_donated)}딜`}",
    test: T,
    why: '이 숫자는 이용권·교환권 구매를 포함한 딜 사용 전체다 — 후원으로 읽으면 틀린다.',
  },
]
