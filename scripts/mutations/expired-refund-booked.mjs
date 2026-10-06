/**
 * 되돌려-검증 주입 — 만료 환불 장부 기록 (2026-10-06)
 * 가드: src/tests/unit/expired-refund-booked-2026-10-06.test.ts
 */
export default [
  {
    name: '만료환불 — 장부 기록이 사라진다(같은 돈이 또 나간다)',
    file: 'src/worker/cron/auto-settlement.ts',
    // ⚠️ 앵커에 뒤 줄까지 넣는다 — 들여쓰기만 다른 카드 경로(12칸)가 이 8칸 문자열을
    //   **부분문자열로 포함**해서 "주입 대상이 2곳" 으로 걸렸다(유일성 검사가 잡아 줬다).
    find: `await bookRefundOnOrder(DB, voucher.order_id, refundAmount, voucher.id);

        // Send notification to user`,
    replace: `/* 장부 기록 없음 */

        // Send notification to user`,
    test: 'src/tests/unit/expired-refund-booked-2026-10-06.test.ts',
    why: '환불은 나가고 상한은 0 으로 남는다 — 어드민·셀러·주문 세 자리에서 1,800 이 또 나간다.',
  },
  {
    name: '만료환불 — 카드(토스) 경로만 안 적는다(결제수단에 따라 상한이 갈린다)',
    file: 'src/worker/cron/auto-settlement.ts',
    find: `await bookRefundOnOrder(DB, voucher.order_id, refundAmount, voucher.id);
            try {`,
    replace: `/* 카드 경로는 안 적음 */
            try {`,
    test: 'src/tests/unit/expired-refund-booked-2026-10-06.test.ts',
    why: '딜로 산 사람은 보호되고 카드로 산 사람은 이중환불에 노출된다 — 가장 찾기 어려운 모양이다.',
  },
  {
    name: '만료환불 — CAS 상한이 사라진다(총액을 넘겨 적는다)',
    file: 'src/worker/cron/expired-voucher-refund-sql.ts',
    find: 'WHERE id = ? AND COALESCE(refunded_amount, 0) + ? <= total_amount',
    replace: 'WHERE id = ?',
    test: 'src/tests/unit/expired-refund-booked-2026-10-06.test.ts',
    why: '장부가 총액을 넘으면 상한이 거짓이 되어 **정당한** 환불을 막는다(반대 방향 사고).',
  },
  {
    name: '만료환불 — COALESCE 가 빠진다(NULL 전파로 조용히 안 적힌다)',
    file: 'src/worker/cron/expired-voucher-refund-sql.ts',
    find: 'SET refunded_amount = COALESCE(refunded_amount, 0) + ?',
    replace: 'SET refunded_amount = refunded_amount + ?',
    test: 'src/tests/unit/expired-refund-booked-2026-10-06.test.ts',
    why: '라이브는 NULL 에서 시작한다 — NULL + 1800 = NULL 이라 에러 없이 안 적힌다.',
  },
  {
    name: '만료환불 — 기록 실패를 삼킨다(사람이 알 길이 없다)',
    file: 'src/worker/cron/auto-settlement.ts',
    find: `    if (!r.meta?.changes) {
      logError('[Cron] expired voucher refund: 장부 기록 실패 — 환불은 나갔다(상한 초과 가능)', {`,
    replace: `    if (false) {
      logError('[Cron] expired voucher refund: 장부 기록 실패 — 환불은 나갔다(상한 초과 가능)', {`,
    test: 'src/tests/unit/expired-refund-booked-2026-10-06.test.ts',
    why: '돈이 나간 뒤 장부가 비었는데 아무도 모른다 — 이 결재가 고친 사고와 같은 조용한 부재다.',
  },
]
