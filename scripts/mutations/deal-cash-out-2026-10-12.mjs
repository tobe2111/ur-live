/**
 * 💸 딜 → 현금 정리 (2026-10-12) — 주입 매니페스트.
 * 가드: src/tests/unit/deal-cash-out-2026-10-12.test.ts
 */
const TEST = 'src/tests/unit/deal-cash-out-2026-10-12.test.ts'
const REFUND = 'src/worker/utils/deal-refund.ts'

export default [
  {
    name: '💸딜현금 충전 한도가 사라진다 (소득이 세금 없이 "환급" 으로 나간다)',
    file: REFUND,
    find: "    COALESCE((SELECT total_charged FROM user_points WHERE user_id = ?), 0),",
    replace: "    1000000000 + 0 * COALESCE((SELECT total_charged FROM user_points WHERE user_id = ?), 0),",
    test: TEST,
    why: '유상 잔액엔 충전 말고 커미션(소득)도 섞인다 — 충전 총액으로 안 자르면 원천징수 없이 소득이 현금으로 나간다.',
  },
  {
    name: '💸딜현금 대기 1건 인덱스가 평범한 인덱스가 된다 (더블클릭 두 줄)',
    file: REFUND,
    find: "`CREATE UNIQUE INDEX IF NOT EXISTS idx_deal_refund_one_open",
    replace: "`CREATE INDEX IF NOT EXISTS idx_deal_refund_one_open",
    test: TEST,
    why: '동시 요청 두 개가 각각 신청 행을 만들면 어드민이 두 번 이체할 수 있다.',
  },
  {
    name: '💸딜현금 반려 CAS 가 빠진다 (두 번 반려하면 딜이 두 번 돌아온다)',
    file: REFUND,
    find: "rejection_reason = ?\n      WHERE id = ? AND status = 'requested'`",
    replace: "rejection_reason = ?\n      WHERE id = ?`",
    test: TEST,
    why: '입금 완료된 건을 반려해도 딜이 돌아오고, 반려를 두 번 눌러도 두 번 돌아온다 — 돈이 늘어난다.',
  },
  {
    name: '💸딜현금 원장이 차감을 적립으로 적는다',
    file: REFUND,
    find: "      delta: -input.amount,",
    replace: "      delta: input.amount,",
    test: TEST,
    why: '잔액은 빠졌는데 원장은 늘었다고 적으면 원장 정합 검사가 매일 불일치를 낸다(원인도 못 찾는다).',
  },
  {
    name: '💸딜현금 옛 문이 다시 돈을 움직인다',
    file: 'src/features/points/api/points.routes.ts',
    find: "pointsRoutes.post('/withdraw', requireAuth(), (c) => c.json({",
    replace: "pointsRoutes.post('/withdraw', requireAuth(), (c) => (c.env.DB.prepare('UPDATE user_points SET balance = balance - 1'), c.json({",
    test: TEST,
    why: '한도·장부 규칙을 우회하는 두 번째 문이 생긴다 — 8.8% 를 떼고 충전 한도도 안 본다.',
  },
  {
    name: '💸딜현금 만료 환불이 다시 유상으로만 되돌린다 (무상 딜 세탁)',
    file: 'src/worker/cron/auto-settlement.ts',
    find: "          const r = await refundDealPoints(DB, {",
    replace: "          const r = await adjustUserPoints(DB, {",
    test: TEST,
    why: '리워드 딜로 산 이용권이 만료되면 그 딜이 현금 환급 가능한 딜로 돌아온다.',
  },
  {
    name: '💸딜현금 마이에 환급 시트가 다시 붙는다',
    file: 'src/pages/user-profile/MyStats.tsx',
    // 🔁 2026-11-02 재조준 — 대표 지시로 마이의 환급 입구를 없앴다.
    find: "const DEAL_PATH = TOPUP_DISABLED ? '/my-deal-history' : '/points/charge'",
    replace: "const DEAL_PATH = TOPUP_DISABLED ? '/my-deal-history' : '/points/charge'\nexport const __r = () => import('./RefundSheet')",
    test: TEST,
    why: '대표 2026-11-02 *"충전 딜 환급 … 아예 없애"* — 마이에 환급 입구가 다시 생긴다.',
  },
  {
    name: '💸딜현금 시트가 잔액으로 한도를 지어낸다',
    file: 'src/pages/user-profile/RefundSheet.tsx',
    find: "      .then(({ default: api }) => api.get('/api/points/refund'))",
    replace: "      .then(({ default: api }) => api.get('/api/points/balance'))",
    test: TEST,
    why: '화면이 유상 잔액을 한도로 쓰면 서버가 거절하는 금액을 허락한다(충전 한도를 모른다).',
  },
  {
    name: '💸딜현금 전액 신청 뒤 "처리 중" 이 잔액 응답에서 사라진다',
    file: 'src/features/points/api/points.routes.ts',
    find: "      ...(refundPending !== undefined ? { refund_pending: refundPending } : {}),",
    replace: "",
    test: TEST,
    why: '전액을 신청하면 환급 가능액이 0 이라 버튼이 사라진다 — 처리 중인지 마이에서 다시 볼 길이 없다.',
  },
]
