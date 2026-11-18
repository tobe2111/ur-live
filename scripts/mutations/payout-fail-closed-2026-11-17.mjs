/**
 * 💸 지급 금액 조회 실패를 0 으로 치지 않는다 (2026-11-17) — 주입 매니페스트.
 * 가드: src/tests/unit/payout-fail-closed-2026-11-17.test.ts
 */
const TEST = 'src/tests/unit/payout-fail-closed-2026-11-17.test.ts'

export default [
  {
    name: '💸 주간 생성이 지급분 조회 실패를 다시 빈 목록으로 삼킨다(전기간 누적액 pending 생성)',
    file: 'src/worker/cron/payouts-generate.ts',
    find: '    const paid = await DB.prepare(payoutPaidSql()).all<{ account: string; total: number }>()\n',
    replace: '    const paid = await DB.prepare(payoutPaidSql()).all<{ account: string; total: number }>().catch(() => ({ results: [] as Array<{ account: string; total: number }> }))\n',
    test: TEST,
    why: '이미 나간 돈을 0 으로 세면 모든 payee 에게 지금까지 번 전액이 다시 대기 지급으로 생긴다.',
  },
  {
    name: '💸 지급 가능액 헬퍼가 지급분 조회 실패를 다시 0 으로 친다',
    file: 'src/worker/utils/ledger.ts',
    find: "  ).bind(...paidKeys).first<{ total: number }>() // 💸 2026-11-17: 실패를 0 으로 치면 지급 가능액이 과대 — 던진다\n",
    replace: "  ).bind(...paidKeys).first<{ total: number }>().catch(() => ({ total: 0 }))\n",
    test: TEST,
    why: '카카오 챗봇 "정산" 과 지급 판단이 과대 금액을 본다.',
  },
]
