/**
 * 🎟️ 미사용 만료 환불 가드의 되돌려-검증 (2026-09-30, 대표 "모두 고쳐줘 완벽해질 때까지").
 * 가드: src/tests/unit/expired-voucher-refund-2026-09-30.test.ts
 *
 * 지키는 것: 만료 표시를 누가 했든 **환불 안 된 건은 잡힌다** · 처리된 건은 다시 안 잡힌다 ·
 * 선점은 한 번만 성공한다 · 조회 후 사용된 건은 선점하지 않는다 · 결과를 기록한다.
 */
const SQL = 'src/worker/cron/expired-voucher-refund-sql.ts'
const CRON = 'src/worker/cron/auto-settlement.ts'
const TEST = 'src/tests/unit/expired-voucher-refund-2026-09-30.test.ts'

export default [
  {
    name: "🎟️ 조회가 2026-09-30 이전으로 되돌아간다 (status='unused' 만 — 환불 영구 0건)",
    file: SQL,
    find: "AND (v.status = 'unused'${withRefundStatus ? \" OR v.status = 'expired'\" : ''})",
    replace: "AND v.status = 'unused'",
    test: TEST,
    why: '이것이 원래 결함이다 — 매시 도는 청소 cron 이 먼저 expired 로 바꿔 놓으면 환불 대상이 영구히 0건이 되고, 에러도 안 나서 아무도 모른다.',
  },
  {
    name: '🎟️ 이미 처리된 건을 다시 잡는다 (이중 환불)',
    file: SQL,
    find: "${withRefundStatus ? \"AND COALESCE(v.refund_status, '') = ''\" : ''}",
    replace: '',
    test: TEST,
    why: '처리 결과가 남은 건을 다시 고르면 매일 같은 이용권을 환불한다 — 플랫폼 현금이 계속 빠져나간다.',
  },
  {
    name: '🎟️ 선점 근거가 다시 표시 상태(status)로 돌아간다',
    file: SQL,
    find: "WHERE id = ? AND COALESCE(refund_status, '') = '' AND status IN ('unused', 'expired')",
    replace: "WHERE id = ? AND status = 'unused'",
    test: TEST,
    why: 'status 는 만료 표시이고 그것을 쓰는 자리가 셋이다 — 선점 근거로 쓰면 다른 cron 이 먼저 바꿔 놓아 환불이 사라진다.',
  },
  {
    name: '🎟️ 조회 후 사용된 건까지 선점한다 (쓰고도 환불받는다)',
    file: SQL,
    find: "AND status IN ('unused', 'expired')",
    replace: '',
    test: TEST,
    why: '조회와 선점 사이에 매장에서 소각된 이용권을 강제 만료시켜 환불하면 손님이 쓰고도 돈을 받는다.',
  },
  {
    name: '🎟️ 선점이 refund_status 를 안 남긴다 (다음 실행이 또 선점)',
    file: SQL,
    find: "UPDATE vouchers SET status = 'expired', refund_status = 'claimed'",
    replace: "UPDATE vouchers SET status = 'expired'",
    test: TEST,
    why: '선점 표시가 없으면 같은 건이 매 실행마다 다시 선점돼 환불이 반복된다.',
  },
  {
    name: '🎟️ 환불 cron 이 SSOT 조회를 안 쓴다 (자기 SQL 로 갈라진다)',
    file: CRON,
    find: 'await DB.prepare(expiredVoucherSelectSql(true)).all()',
    replace: "await DB.prepare(\"SELECT v.id FROM vouchers v WHERE v.status = 'unused'\").all()",
    test: TEST,
    why: 'SQL 이 두 벌이 되면 가드가 보는 쪽과 도는 쪽이 갈린다 — 갈린 쪽은 아무도 안 본다.',
  },
  {
    name: '🎟️ 처리 결과를 확정하지 않는다 (claimed 로 영구 방치)',
    file: CRON,
    find: "await DB.prepare('UPDATE vouchers SET refund_status = ? WHERE id = ?')",
    replace: "await DB.prepare('UPDATE vouchers SET code = code WHERE id = ?')",
    test: TEST,
    why: "무엇이 일어났는지 모르는 'claimed' 행이 남으면 다음 세션이 과거분 회수를 판단할 수 없다 — 이번에 판단을 막은 것이 정확히 그 부재였다.",
  },
  {
    name: '🎟️ 청소 cron 이 환불까지 하게 된다 (환불 주인이 둘)',
    file: 'src/worker/cron/scheduled-cleanup.ts',
    find: "      UPDATE vouchers\n      SET status = 'expired'",
    replace: "      UPDATE vouchers\n      SET refund_status = 'refunded', status = 'expired'",
    test: TEST,
    why: '환불 주인이 둘이 되면 한쪽이 환불 없이 처리 완료로 표시해 환불이 다시 사라진다(같은 사고의 재발 경로).',
  },
]
