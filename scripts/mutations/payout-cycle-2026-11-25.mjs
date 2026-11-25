/** 💸 2026-11-25 지급 한 주기 — 가드: payout-cycle-full-2026-11-25.test.ts · influencer-settlement-screen-2026-11-25.test.tsx */
const T = 'src/tests/unit/payout-cycle-full-2026-11-25.test.ts'
const S = 'src/tests/unit/influencer-settlement-screen-2026-11-25.test.tsx'

export default [
  {
    name: '[payout-cycle] 에이전시 몫이 다시 시간만으로 확정된다',
    file: 'src/worker/utils/agency-share-payout.ts',
    find: "  return `(available_at <= strftime('%Y-%m-%dT%H:%M:%fZ','now') ${gate.sql})`",
    replace: "  return `(available_at <= strftime('%Y-%m-%dT%H:%M:%fZ','now'))`",
    test: T,
    why: '안 쓴 이용권의 몫이 먼저 지급되고, 그 뒤 만료 환불되면 매장이 그 돈을 문다.',
  },
  {
    name: '[payout-cycle] 계좌 없이 현금 지급 완료로 처리된다',
    file: 'src/features/group-buy/api/marketing/payouts.ts',
    find: "    if (body.method === 'cash' && !String(balance.bank_account || '').trim()) {",
    replace: "    if (body.method === 'cash_x' && !String(balance.bank_account || '').trim()) {",
    test: T,
    why: '보낼 곳이 없는데 잔액이 0 으로 밀리고 되돌릴 길이 없다.',
  },
  {
    name: '[payout-cycle] 지급 방식 없이 보내면 현금으로 처리된다',
    file: 'src/features/group-buy/api/marketing/payouts.ts',
    find: "    if (!['cash', 'deal'].includes(String(body.method))) return",
    replace: "    if (false) return",
    test: T,
    why: '빈 요청 한 번에 잔액이 현금 지급 완료로 넘어간다.',
  },
  {
    name: '[payout-cycle] 회계 자료의 원천징수 합계에서 에이전시분이 빠진다',
    file: 'src/features/admin/api/admin-tax.routes.ts',
    find: "    if (whtAg) { wht.n += Number(whtAg.n) || 0;",
    replace: "    if (false && whtAg) { wht.n += Number(whtAg.n) || 0;",
    test: T,
    why: '개인 에이전시에게 뗀 3.3% 가 신고 자료에서 빠진다.',
  },
  {
    name: '[payout-cycle] 정산 화면의 훅이 조기 반환 밑으로 내려간다',
    file: 'src/pages/InfluencerSettlementPage.tsx',
    find: "  const back = useSafeBack('/u/me/manage')\n\n  if (loading) return <BrandLoader fullScreen />",
    replace: "  if (loading) return <BrandLoader fullScreen />\n  const back = useSafeBack('/u/me/manage')\n",
    test: S,
    why: '데이터가 도착하는 순간 화면이 통째로 떨어진다(Rendered more hooks).',
  },
  {
    name: "[payout-cycle] '딜 +20%' 가 다시 상수로 적힌다",
    file: 'src/pages/InfluencerSettlementPage.tsx',
    find: "(dealBonusPct > 0 ? `딜 +${dealBonusPct}%` : '딜')",
    replace: "'딜 +20%'",
    test: S,
    why: '설정은 0% 인데 화면이 20% 를 더 준다고 약속한다.',
  },
]
