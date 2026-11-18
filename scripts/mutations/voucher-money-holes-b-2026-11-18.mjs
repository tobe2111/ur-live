/** 되돌려-검증 주입 — 이용권 돈 구멍 4건 (2026-11-18 대표 승인). 가드: voucher-money-holes-b-2026-11-18.test.ts */
const T = 'src/tests/unit/voucher-money-holes-b-2026-11-18.test.ts'
const G = 'src/worker/utils/order-refund-guards.ts'
const H = 'src/features/group-buy/api/voucher-self-cancel-refund.ts'
export default [
  { name: 'moneyb: 결제수단 빈 값을 그대로 둔다', file: 'src/features/group-buy/api/group-buy.routes.ts',
    find: "body.payment_method ?? 'deal'", replace: "body.payment_method as 'deal' | 'toss'", test: T, why: '공짜 발급(교환권이면 실제 MMS).' },
  { name: 'moneyb: 사용한 이용권 주문도 전체 취소', file: G,
    find: "  if (p.cancelQty === undefined && live.some((v) => String(v.status).toLowerCase() !== 'unused')) {", replace: "  if (false) {", test: T, why: '쓰고 나서 전액 환불, 매장 손해.' },
  { name: 'moneyb: 금액만 적은 취소 허용', file: G,
    find: "  if (p.cancelAmount !== undefined) return { error:", replace: "  if (false) return { error:", test: T, why: '이용권은 남고 딜만 돌려받는다.' },
  { name: 'moneyb: 7일 규칙 없음', file: G,
    find: "&& Number(v.fresh) !== 1)) {", replace: "&& false)) {", test: T, why: '청약철회 기간 밖 셀프 취소.' },
  { name: 'moneyb: 주문에 안 적고 돌려준다', file: H,
    find: "  if (!(await bookVoucherRefundOnOrder(DB, v.order_id, refundAmount))) {", replace: "  if (false) {", test: T, why: '이어서 주문 취소로 이중 환불.' },
  { name: 'moneyb: 총액 상한 없음', file: G,
    find: "      WHERE id = ? AND COALESCE(refunded_amount, 0) + ? <= total_amount`,\n  ).bind(a, orderId, a).run()", replace: "      WHERE id = ? AND ? >= 0`,\n  ).bind(a, orderId, a).run()", test: T, why: '총액보다 많이 환불된다.' },
  { name: 'moneyb: 혼합결제 전액을 카드로', file: H,
    find: "  const split = splitPartialRefund({ remainingDeal: Number(order?.deal_used ?? 0), refundAmount,", replace: "  const split = splitPartialRefund({ remainingDeal: 0, refundAmount,", test: T, why: '딜 몫이 영영 안 돌아온다.' },
  { name: 'moneyb: 매장 부분환불 4xx 도 성공', file: H,
    find: "      if (status >= 400 && status < 500) return { ok: false,", replace: "      if (false) return { ok: false,", test: T, why: '카드엔 0원인데 환불됐다고 뜬다.' },
  { name: 'moneyb: 날짜만 기한 그대로', file: 'src/shared/voucher-validity.ts',
    find: "? `${raw} 14:59:59` : raw", replace: "? raw : raw", test: T, why: '마지막 날 오전 9시에 만료.' },
  { name: 'moneyb: 장바구니 재고 이중 복원', file: 'src/features/group-buy/api/cart-checkout.routes.ts',
    find: "      qty: 0,", replace: "      qty: priced.lines.reduce((s, l) => s + l.qty, 0),", test: T, why: '첫 상품 재고가 늘어 초과 판매.' },
]
