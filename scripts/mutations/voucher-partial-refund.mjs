/**
 * 🎟️ 이용권 일부 환불 (2026-09-28 대표 *"일부 환불 가능하게 해줘"*) — 주입 매니페스트.
 * 가드: src/tests/unit/voucher-partial-refund-2026-09-28.test.ts
 *
 * 🔴 머니 경로다. 여기서 헛도는 가드는 "돈은 나가고 물건은 남는" 사고를 못 막는다.
 */
const TEST = 'src/tests/unit/voucher-partial-refund-2026-09-28.test.ts'
const PLAN = 'src/shared/partial-voucher-refund.ts'
const IMPL = 'src/worker/utils/voucher-partial-refund.ts'
const CLAW = 'src/worker/utils/voucher-settlement-clawback.ts'
const ROUTE = 'src/worker/routes/order.routes.ts'

export default [
  {
    name: '🎟️ 이미 쓴 이용권도 무를 수 있게 된다',
    file: PLAN,
    find: "    .filter(v => String(v.status || '').toLowerCase() === 'unused')",
    replace: '    .filter(() => true)',
    test: TEST,
    why:
      '매장이 이미 음식을 내줬는데 손님이 셀프로 환불한다. 매장은 돈도 못 받고 재료도 나갔다 — ' +
      '분쟁이 되고, 그 분쟁을 우리가 만든 것이 된다.',
  },
  {
    name: '🎟️ 고른 장수보다 많이 회수한다',
    file: PLAN,
    find: '  const k = Math.min(qty, refundable.length)',
    replace: '  const k = refundable.length',
    test: TEST,
    why: '1장만 무르겠다고 했는데 남은 3장이 전부 무효가 된다. 환불이 아니라 몰수다.',
  },
  {
    name: '🎟️ 환불 금액이 잔액을 넘는다',
    file: PLAN,
    find: '    amount: Math.max(0, Math.min(amount, remaining)),',
    replace: '    amount: Math.max(0, amount),',
    test: TEST,
    why:
      '이미 일부 환불된 주문에서 장당가를 그대로 더하면 결제액보다 많이 나간다. ' +
      'CAS 가 막긴 하지만 그때는 이미 "왜 실패하지" 를 사람이 파야 한다 — 계산에서 막는 게 맞다.',
  },
  {
    name: '🎟️ 회수할 장을 실행마다 다르게 고른다',
    file: PLAN,
    find: '    .sort((a, b) => a.id - b.id)',
    replace: '    .sort(() => Math.random() - 0.5)',
    test: TEST,
    why:
      '같은 요청을 두 번 보내면 다른 장이 무효가 된다. 재시도·중복 요청이 있는 세상에서 ' +
      '"어느 장이 살아 있는가" 를 아무도 설명할 수 없게 된다.',
  },
  {
    name: '🎟️ 전액인데 반올림 합으로 계산해 몇 원이 남는다',
    file: PLAN,
    find: '    return { ok: true, voucherIds: picked.map(v => v.id), amount: remaining, isFull: true }',
    replace: '    return { ok: true, voucherIds: picked.map(v => v.id), amount: 1, isFull: true }',
    test: TEST,
    why: '전부 물렀는데 주문에 잔액이 남아 "환불 완료" 가 안 된다. 1원 때문에 CS 가 생긴다.',
  },
  {
    name: '🎟️ 게이트가 없어져 바로 라이브에 열린다',
    file: IMPL,
    find: "  if (!(await isVoucherPartialRefundEnabled(DB))) {",
    replace: '  if (false) {',
    test: TEST,
    why:
      '머니 경로는 staging 실결제 전에 열면 안 된다(CLAUDE.md). 게이트가 빠지면 머지 즉시 ' +
      '라이브에서 돈이 움직인다.',
  },
  {
    name: '🎟️ 게이트 기본값이 ON 이 된다',
    file: IMPL,
    find: "  return String(row?.value ?? 'false') === 'true'",
    replace: '  return String(row?.value ?? \'true\') !== \'false\'',
    test: TEST,
    why: '설정이 없는 환경(=지금 라이브)에서 켜진 것으로 읽힌다. 기본값은 항상 꺼짐이어야 한다.',
  },
  {
    name: '🎟️ 토스보다 먼저 잔액을 선점하지 않는다',
    file: IMPL,
    find: '  const reserve = await DB.prepare(',
    replace: '  const reserve = { meta: { changes: 1 } }; const _unused = await DB.prepare(',
    test: TEST,
    why:
      '동시 요청 둘이 같은 잔액을 읽고 각자 토스를 부르면 **이중 환불**이다. ' +
      '머니 룰 #1(claim-before-credit)이 정확히 이 사고를 막으려고 있다.',
  },
  {
    name: '🎟️ 토스가 거절해도 예약을 안 되돌린다',
    file: IMPL,
    find: "      await rollback('toss')",
    replace: '      void 0',
    test: TEST,
    why:
      '환불은 실패했는데 `refunded_amount` 만 올라간다 → 그만큼 다시는 환불할 수 없다. ' +
      '손님 돈이 장부상으로만 사라진다.',
  },
  {
    name: '🎟️ 결제키를 한 칸만 본다 (이용권 주문이 막혀 있던 그 이유)',
    file: IMPL,
    find: 'const paymentKey = pay?.toss_payment_key || pay?.payment_key',
    replace: 'const paymentKey = pay?.toss_payment_key',
    test: TEST,
    why:
      '이용권 카드 주문은 `payment_key` 에만 키가 있다. 한 칸만 보면 이 기능이 정작 ' +
      '이용권에서 422 로 막힌다 — 고치려던 것이 그대로 남는다.',
  },
  {
    name: '🎟️ 주문의 이용권을 통째로 회수한다',
    file: IMPL,
    find: 'clawbackVoucherSettlementOnRefund(DB, orderId, `voucher_partial:${reason}`, plan.voucherIds)',
    replace: 'clawbackVoucherSettlementOnRefund(DB, orderId, `voucher_partial:${reason}`)',
    test: TEST,
    why:
      '1장 값만 돌려주고 3장을 전부 무효로 만든다. 손님은 2장을 빼앗긴다 — ' +
      '이 기능이 낼 수 있는 가장 나쁜 사고다.',
  },
  {
    name: '🎟️ 빈 목록을 "전체" 로 넓힌다',
    file: CLAW,
    find: '  if (onlyVoucherIds && onlyVoucherIds.length === 0) return out',
    replace: '  if (false) return out',
    test: TEST,
    why:
      '호출부가 실수로 빈 배열을 넘기는 날, "아무것도 회수하지 않는다" 가 "전부 회수한다" 로 ' +
      '뒤집힌다. 실패 방향이 반대인 것이 제일 비싸다.',
  },
  {
    name: '🎟️ 부분 환불에 전액 역전 헬퍼를 부른다',
    file: IMPL,
    find: '  let voided = 0',
    replace: "  const { reverseOrderAncillaryOnRefund } = await import('./order-refund'); await reverseOrderAncillaryOnRefund(DB, orderId, order.order_number, reason); let voided = 0",
    test: TEST,
    why:
      '1장만 물렀는데 주문 전체의 커미션·쿠폰·추천 적립이 회수된다 — 손님이 **가지고 있는 장**의 ' +
      '몫까지 남에게서 뺏는다. 과다 역전은 과소 역전보다 나쁘다.',
  },
  {
    name: '🎟️ 전부 무르는 경우를 부분 경로가 삼킨다',
    file: IMPL,
    find: '  if (plan.isFull) return null',
    replace: '  if (false) return null',
    test: TEST,
    why:
      '주문 전체 취소인데 상태가 `CANCELLED` 로 안 가고 쿠폰·커미션 대칭 역전도 안 된다. ' +
      '겉보기엔 환불이 됐는데 장부만 어긋난다.',
  },
  {
    name: '🎟️ 라우트가 장수를 안 넘긴다',
    file: ROUTE,
    find: 'const vPartial = await tryVoucherPartialRefund(c, order, body.cancel_qty, reason)',
    replace: 'const vPartial = await tryVoucherPartialRefund(c, order, undefined, reason)',
    test: TEST,
    why:
      '모듈은 완벽한데 라우트가 항상 undefined 를 넘겨 기능이 **한 번도 실행되지 않는다**. ' +
      '에러가 없어서 "켰는데 왜 안 되지" 만 남는다.',
  },
]
