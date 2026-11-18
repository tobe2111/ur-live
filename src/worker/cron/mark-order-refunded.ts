/**
 * 🧾 2026-11-18 만료 환불 뒤 주문 상태 — 대표 승인 "만료 환불 때 주문·장부 정리".
 *   종전: 딜 결제는 상태를 안 바꿔 환불된 주문이 영원히 '배송완료'(라이브 주문 85) · 카드 결제는 **한 장만** 환불돼도
 *   주문 전체를 REFUNDED 로 찍었다(여러 장 주문에서 남은 장이 '환불됨' 으로 보인다 — #2413 과 같은 클래스).
 *   ⇒ 두 결제수단 모두 **장부상 전액이 환불됐을 때만**(refunded_amount ≥ total_amount) REFUNDED. 커미션 회수는 아래
 *   auto-settlement.ts 의 `clawbackVoucherCommission` 이 이미 한다(원장 셰어 역전 포함).
 */
export async function markOrderRefundedIfFull(DB: D1Database, orderId: unknown): Promise<void> {
  if (orderId == null) return
  await DB.prepare(
    `UPDATE orders SET status = 'REFUNDED', updated_at = datetime('now')
      WHERE id = ? AND status != 'REFUNDED' AND COALESCE(refunded_amount, 0) >= COALESCE(total_amount, 0) AND COALESCE(total_amount, 0) > 0`,
  ).bind(orderId).run().catch((e) => console.error('[auto-settlement] REFUNDED 표시 실패', orderId, e))
}
