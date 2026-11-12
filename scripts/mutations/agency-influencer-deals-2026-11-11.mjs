/**
 * 🧬 주입 — 에이전시 소개비 계약(총 마케팅 비용 상한 안, 2026-11-11 결재 ⑤).
 * 가드: src/tests/unit/agency-influencer-deals-2026-11-11.test.ts
 */
const T = 'src/tests/unit/agency-influencer-deals-2026-11-11.test.ts'
const F = 'src/features/agency-console/api/agency-influencer-deals.ts'
export default [
  { name: '에이전시소개비 — 정산이 스위치를 안 본다', file: F,
    find: '    if (!(await isAgencyDealsEnabled(DB))) return null\n', replace: '\n', test: T,
    why: '대표가 켜기 전에 에이전시 계약으로 소개비가 적립된다.' },
  { name: '에이전시소개비 — 상한 초과도 바로 발효', file: F,
    find: "  const status: 'active' | 'pending_owner' = fitsBudget(fee, budget, p.pct) ? 'active' : 'pending_owner'",
    replace: "  const status: 'active' | 'pending_owner' = 'active'", test: T,
    why: '사장님이 동의한 총 마케팅 비용을 넘는 소개비가 사장님 모르게 붙는다.' },
  { name: '에이전시소개비 — 정산 때 상한 재확인을 뺀다', file: F,
    find: '  return Math.max(0, Math.min(dealPct, budgetPct - feePct))', replace: '  return dealPct', test: T,
    why: '사장님이 상한을 낮춰도 옛 % 그대로 나간다.' },
  { name: '에이전시소개비 — 맡은 이용권이 아니어도 붙는다', file: F,
    find: '        WHERE pr.product_id = ? AND pr.seller_id = ? AND pr.ended_at IS NULL',
    replace: '        WHERE (pr.product_id = ? OR 1) AND pr.seller_id = ? AND pr.ended_at IS NULL', test: T,
    why: '에이전시 계약이 사장님 이용권까지 번진다.' },
  { name: '에이전시소개비 — 승인이 대기 아닌 것도 바꾼다', file: F,
    find: "      WHERE id = ? AND seller_id = ? AND status = 'pending_owner'`,",
    replace: '      WHERE id = ? AND seller_id = ?`,', test: T,
    why: '거절한 계약을 다시 승인으로 뒤집을 수 있다.' },
  { name: '에이전시소개비 — 카드 결제 경로가 에이전시 계약을 안 본다', file: 'src/features/group-buy/api/helpers.ts',
    find: '      deal_commission_pct: (await agencyDealPctForSale(DB, p.sellerId, p.productId, p.referralInfluencerId)) ?? dealRow?.commission_pct ?? null,',
    replace: '      deal_commission_pct: dealRow?.commission_pct ?? null,', test: T,
    why: '결제 경로마다 소개비가 갈린다.' },
]
