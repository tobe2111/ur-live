/** 🔔 2026-11-25 알림 — 가야 할 사람에게 안 가거나 사실과 다른 말을 하던 것 — 가드: src/tests/unit/notify-fixes-2026-11-25.test.ts */
const T = 'src/tests/unit/notify-fixes-2026-11-25.test.ts'

export default [
  {
    name: '[notify] 정산 완료 알림톡이 다시 매장 대표번호로 간다',
    file: 'src/worker/utils/payout-sent-notify.ts',
    find: "    return { phone: t?.phone ?? null, name: t?.businessName ?? t?.name ?? null, sellerId: Number(row.payee_id) || null }",
    replace: "    return { phone: null, name: t?.businessName ?? t?.name ?? null, sellerId: Number(row.payee_id) || null }",
    test: T,
    why: '사장님이 돈이 들어왔다는 알림을 못 받는다(라이브 13곳 중 12곳이 유선 번호).',
  },
  {
    name: '[notify] 일괄 송금 완료가 다시 아무에게도 안 알린다',
    file: 'src/features/admin/api/admin-payouts.routes.ts',
    find: "  c.executionCtx?.waitUntil(Promise.all(ok.filter((r) => r.row).map((r) => notifyPayoutSent(c.env as unknown as Record<string, unknown>, DB, r.row!, txId))).then(() => undefined))\n",
    replace: '',
    test: T,
    why: '은행 파일로 한꺼번에 보낸 주에는 어느 매장도 입금 알림을 못 받는다.',
  },
  {
    name: "[notify] 받는 사람이 'all' 인 어드민 알림이 다시 안 보인다",
    file: 'src/features/notifications/api/dashboard-notifications.routes.ts',
    find: "    whereClause = `recipient_type = 'admin' AND (recipient_id IS NULL OR recipient_id = ? OR recipient_id = 'all')`;",
    replace: "    whereClause = `recipient_type = 'admin' AND (recipient_id IS NULL OR recipient_id = ?)`;",
    test: T,
    why: '인플루언서·에이전시 지급 대기와 분쟁 알림을 아무도 못 본다.',
  },
  {
    name: '[notify] 만료 환불 실패가 다시 로그에만 남는다',
    file: 'src/worker/cron/auto-settlement.ts',
    find: " await notifyAdminEvent(DB, { type: 'refund_failed', title: '만료 환불 실패 — 손으로 환불해야 해요'",
    replace: " void ({ type: 'refund_failed', title: '만료 환불 실패 — 손으로 환불해야 해요'",
    test: T,
    why: '카드 취소가 실패한 손님은 환불을 못 받고, 어드민도 모른다.',
  },
  {
    name: '[notify] 계좌 안내가 다시 "매주 자동으로 정산" 을 약속한다',
    file: 'src/worker/utils/bank-missing.ts',
    find: "message: '이용권이 사용되면 정산 대상이 돼요.",
    replace: "message: '이용권이 팔리고 사용되면 매주 자동으로 정산돼요.",
    test: T,
    why: '실제 지급은 보류 기간 뒤 승인·송금을 거친다 — 지킬 수 없는 약속이다.',
  },
  {
    name: '[notify] 일반 만료 알림이 숙소 이용권에도 간다',
    file: 'src/worker/cron/voucher-expire.ts',
    find: " AND v.stay_booking_id IS NULL --",
    replace: " --",
    test: T,
    why: '숙소 손님이 "매장에서 QR · 안 쓰면 자동 환불" 전제의 안내를 받는다(숙소는 환불되지 않는다).',
  },
]
