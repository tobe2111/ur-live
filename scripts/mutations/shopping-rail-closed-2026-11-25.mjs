/** 🛒 2026-11-25 숨긴 쇼핑 탭의 서버 문 · 사장님 주문 상태 제한 — 가드: src/tests/unit/shopping-rail-closed-2026-11-25.test.ts */
const T = 'src/tests/unit/shopping-rail-closed-2026-11-25.test.ts'

export default [
  {
    name: '[shop-closed] 카드 쇼핑 주문 길이 다시 열린다',
    file: 'src/worker/routes/order.routes.ts',
    find: "  if (SHOPPING_TAB_HIDDEN) return c.json({ success: false, error: '지금은 쇼핑 주문을 받지 않아요', code: 'SHOPPING_CLOSED' }, 410);",
    replace: '',
    test: T,
    why: '이용권을 이 길로 사면 돈만 나가고 이용권이 발급되지 않는다.',
  },
  {
    name: '[shop-closed] 딜 쇼핑 결제 길이 다시 열린다',
    file: 'src/features/points/api/points.routes.ts',
    find: "  if (SHOPPING_TAB_HIDDEN) return c.json({ success: false, error: '지금은 쇼핑 주문을 받지 않아요', code: 'SHOPPING_CLOSED' }, 410);",
    replace: '',
    test: T,
    why: '이용권 값에 배송비까지 딜로 빠지고 이용권이 안 나온다(시험: 13,000딜 차감).',
  },
  {
    name: '[shop-closed] 사장님이 미결제 주문을 결제 완료로 바꾼다',
    file: 'src/features/seller/api/seller-orders.routes.ts',
    find: "const VALID_STATUSES = ['PREPARING', 'SHIPPING', 'DELIVERED', 'CANCELLED'];",
    replace: "const VALID_STATUSES = ['PREPARING', 'SHIPPING', 'DELIVERED', 'CANCELLED', 'DONE', 'PAID', 'PENDING'];",
    test: T,
    why: '돈이 안 들어온 주문이 정산 대상이 되고, 환불된 주문이 DONE 으로 되살아난다.',
  },
]
