/** 🐢 2026-11-03 마이 '내 딜' 잔액 병렬 — 시험: src/tests/unit/my-deal-balance-parallel-2026-11-03.test.ts */
export default [
  {
    name: "🐢 '내 딜' 처리 중 환급 조회가 다시 잔액 뒤로(직렬 2왕복)",
    file: 'src/features/points/api/points.routes.ts',
    find: '    const p = await pendingP;',
    replace: "    const p = await DB.prepare(\"SELECT amount FROM deal_refund_requests WHERE user_id = ? AND status = 'requested'\").bind(userId).first<{ amount: number }>().catch(() => null);",
    test: 'src/tests/unit/my-deal-balance-parallel-2026-11-03.test.ts',
    why: '원본 DB 직렬 왕복 하나가 한국에서 ~0.17초.',
  },
]
