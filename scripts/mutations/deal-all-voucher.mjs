/**
 * 🪙 이용권 딜 100% 결제 — 되돌려-검증 주입 (2026-10-06).
 */
const TEST = 'src/tests/unit/deal-all-voucher-2026-10-06.test.ts'
export default [
  {
    name: '🪙 기본값이 다시 "최대(총액−100)" — 카드 100원이 붙는다',
    file: 'src/pages/group-buy/DealUseChooser.tsx',
    find: '  return plan.can_pay_all_with_deal ? plan.total_amount : plan.max_deal_usable',
    replace: '  return plan.max_deal_usable',
    test: TEST,
    why: '딜이 충분한 사람도 큰 버튼을 누르면 카드 100원이 붙는다 — 대표가 "왜 100%가 안 되냐" 고 물은 그 상태(라이브 주문 90).',
  },
  {
    name: '🪙 덮어도 전부-딜 흐름으로 안 간다 (부분결제로 남음)',
    file: 'src/pages/GroupBuyDetailPage.tsx',
    find: "    if (flow === 'voucher_deal' || payWithDeal || (canPayWithDeal && coversAll(dealPlan, dealUse))) {",
    replace: "    if (flow === 'voucher_deal' || payWithDeal) {",
    test: TEST,
    why: '부분결제는 카드최소 100원 때문에 구조적으로 100% 에 못 간다 — 그러면 전부를 골라도 카드가 탄다.',
  },
  {
    name: '🪙 PC 구매 박스가 다시 전부-딜을 모른다',
    file: 'src/pages/GroupBuyDetailPage.tsx',
    find: '          allDeal={canPayWithDeal && !isPrelaunch && isJoinable && coversAll(dealPlan, dealUse)}',
    replace: '          allDeal={false}',
    test: TEST,
    why: '종전 PC 에는 전부-딜 길이 아예 없었다 — 모바일에서만 되는 결제가 된다.',
  },
  {
    name: '🪙 딜 전액 완료 화면이 토스 승인을 부른다',
    file: 'src/pages/GroupBuyConfirmPaymentPage.tsx',
    find: '    if (isDealOnly && productId && amount > 0) {',
    replace: '    if (false && isDealOnly && productId && amount > 0) {',
    test: TEST,
    why: 'paymentKey 가 없어 "결제 정보가 올바르지 않습니다" 로 끝난다 — 딜로 산 사람이 실패 화면을 본다.',
  },
]
