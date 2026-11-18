/** 되돌려-검증 주입 — 장부 조정 (2026-11-18). 가드: src/tests/unit/ledger-correction-2026-11-18.test.ts */
const T = 'src/tests/unit/ledger-correction-2026-11-18.test.ts'
const F = 'src/worker/utils/ledger-correction.ts'
export default [
  { name: 'ledgeradj: 원장 기록이 실패해도 지급 행을 안 되돌린다', file: F,
    find: "      await DB.prepare(`UPDATE payouts SET amount = amount + ? WHERE id = ? AND status = 'pending'`).bind(p.amount, p.payoutId).run()", replace: "      void 0", test: T,
    why: '원장은 그대로인데 지급 행만 줄어 매장이 덜 받는다.' },
  { name: 'ledgeradj: 승인된 지급 행도 줄인다', file: F,
    find: "    if (row.status !== 'pending') return", replace: "    if (false) return", test: T,
    why: '이미 승인·송금된 돈을 장부에서만 지우게 된다.' },
  { name: 'ledgeradj: 지급 대상 확인을 건너뛴다', file: F,
    find: "    if (!debitKeys.includes(p.debitAccount)) return", replace: "    if (false) return", test: T,
    why: '매장 A 의 지급 행을 줄이면서 매장 B 의 원장을 깎는다.' },
  { name: 'ledgeradj: 금액 상한 없음', file: F,
    find: "(p.amount as number) > ADJUSTMENT_MAX", replace: "false", test: T,
    why: '오타 한 번으로 수백만 원이 움직인다.' },
  { name: 'ledgeradj: 몫 취소가 잔액을 안 뺀다', file: F,
    find: "  await DB.prepare(`UPDATE influencer_balances SET ${col}", replace: "  void DB; if (0) await DB.prepare(`UPDATE influencer_balances SET ${col}", test: T,
    why: '적립은 취소됐는데 지급 잔액이 남아 그대로 나간다.' },
  { name: 'ledgeradj: 몫 취소가 원장을 안 되돌린다', file: F,
    find: "    shares: [{ attributionId: a.id, influencerId: a.influencer_id, source: a.source, share: amount }],", replace: "    shares: [],", test: T,
    why: '매장 26 의 −620 이 영구히 남는다.' },
]
