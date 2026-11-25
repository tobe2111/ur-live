/**
 * 💸 손님이 스스로 하는 주문 환불의 규칙 (2026-11-25)
 *
 * 손님은 **전액**만 무른다. 금액을 정해 일부만 돌려받는 길(`/api/orders/refund` 의 `refund_amount` ·
 * `/api/orders/:id/cancel` 의 `cancel_amount`)은 막는다 — 그 길로는 주문이 결제 완료(PAID)로 남아서
 * 99% 를 돌려받고도 상품은 전부 배송되고, 옛 정산 화면은 주문 금액 전액을 매장에 줄 돈으로 셌다.
 * 일부만 돌려받아야 하면 반품 절차(승인 → 회수 → 검수)나 어드민 처리로 간다. 이용권은 장 단위 규칙이 따로 있다
 * (`voucher-partial-refund.ts`).
 */
export const PARTIAL_SELF_REFUND_BLOCKED = '일부만 환불받으려면 반품을 신청하거나 고객센터로 문의해 주세요'
