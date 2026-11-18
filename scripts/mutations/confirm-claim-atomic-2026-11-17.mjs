/**
 * 💸 /confirm 선점 원자성 + 결제 증거 있는 주문 자동취소 금지 (2026-11-17) — 주입 매니페스트.
 * 가드: src/tests/unit/confirm-claim-atomic-2026-11-17.test.ts
 */
const TEST = 'src/tests/unit/confirm-claim-atomic-2026-11-17.test.ts'

export default [
  {
    name: '💸 /confirm 선점 오류를 다시 null 로 삼킨다(돈은 Toss 에, 주문은 PENDING → 24h 자동취소)',
    file: 'src/worker/routes/payment.routes.ts',
    find: '.run().catch((e: unknown) => { claimErr = e; return null });',
    replace: '.run().catch(() => null);',
    test: TEST,
    why: '선점 UPDATE 가 던지면 그것을 "이미 처리됨"으로 읽어 success 만 돌려주고, 결제 키가 안 남아 reconciliation 이 24시간 뒤 주문을 취소한다.',
  },
  {
    name: '💸 reconciliation 이 결제 증거(retry 기록) 있는 PENDING 주문도 자동 취소한다',
    file: 'src/worker/cron/reconciliation.ts',
    find: "        AND NOT EXISTS (SELECT 1 FROM webhook_events we WHERE we.order_number = orders.order_number AND we.event_type = 'payment_update_retry')\n",
    replace: '',
    test: TEST,
    why: '/confirm 이 "Toss 결제됨·DB 확정 실패" 를 남긴 주문은 결제된 주문이다 — 취소하면 돈은 받고 상품은 안 준다.',
  },
]
