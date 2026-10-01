/**
 * 🧨 2026-10-01 — "이용권 매출은 한 번만, 한 계정에" 의 되돌려-검증.
 *
 * 되돌리려는 사고: 같은 이용권 한 장이 **구매 시 `seller:N` · 사용 시 `merchant:N`** 으로
 * 두 번 적립되고, payouts 집계가 둘을 **따로 묶어 더해** 1,000원 판매가 1,850원이 되던 것.
 * 전부 **조용한** 실패다 — 에러도 빌드 실패도 화면 변화도 없다.
 */
const TEST = 'src/tests/unit/voucher-credit-single-rail-2026-10-01.test.ts'

export default [
  {
    name: '💰 딜 결제 구매 적립이 매장 계정으로 되돌아간다 (이중 적립 부활)',
    why: '구매와 사용이 둘 다 매장에 쌓이면 지급이 185% 가 된다 — 실측으로 확인된 그 숫자다.',
    file: 'src/features/group-buy/api/group-buy.routes.ts',
    find: '        ...voucherPurchaseCredit(product.seller_id, commissionAmount),\n',
    replace: '        credit_account: sellerLedgerAccount(product.seller_id),\n        fee_amount: commissionAmount,\n',
    test: TEST,
  },
  {
    name: '💰 장바구니 결제만 옛 모델로 남는다 (결제수단에 따라 갈림)',
    why: '한 자리만 새도 그 경로로 산 이용권만 이중 적립된다 — 가장 찾기 어려운 모양이다.',
    file: 'src/features/group-buy/api/cart-checkout.routes.ts',
    find: '          ...voucherPurchaseCredit(sid, commissionAmount),',
    replace: '          credit_account: sellerLedgerAccount(sid),\n          fee_amount: commissionAmount,',
    test: TEST,
  },
  {
    name: '💰 사용 시점 적립이 다시 merchant: 를 만든다 (한 가게에 계정 둘)',
    why: 'payouts 는 계정 문자열로 GROUP BY 한다 — 이름이 둘이면 차감이 적립에서 안 빠지고 둘 다 지급된다.',
    file: 'src/worker/utils/ledger.ts',
    find: '    credit_account: sellerLedgerAccount(params.merchant_id),',
    replace: '    credit_account: `merchant:${params.merchant_id}`,',
    test: TEST,
  },
  {
    name: '💰 owner-promo 차감만 merchant: 로 남는다 (적립과 상쇄되지 않는다)',
    why: '매장이 부담하는 promo 가 적립에서 안 빠져 그만큼 과지급된다. 적립과 차감은 같은 이름이어야 한다.',
    file: 'src/worker/utils/ledger.ts',
    find: '    ownerAccount: sellerLedgerAccount(params.merchant_id),',
    replace: '    ownerAccount: `merchant:${params.merchant_id}`,',
    test: TEST,
  },
  {
    name: '💰 매장 없는 상품까지 escrow 에 담는다 (영원히 안 빠지는 돈)',
    why: '플랫폼 상품(교환권·KT)은 사용 시점 적립이 아예 없다 — escrow 에 넣으면 꺼내는 사람이 없다.',
    file: 'src/worker/utils/ledger.ts',
    find: "  if (account.startsWith('seller:')) {",
    replace: '  if (true) {',
    test: TEST,
  },
  {
    name: '💰 수수료를 구매 시점에도 뗀다 (두 번 뗀다)',
    why: '수수료는 사용 시점 3번째 분개가 인식한다 — 여기서 또 떼면 매장이 받을 돈이 그만큼 줄어든다.',
    file: 'src/worker/utils/ledger.ts',
    find: "    return { credit_account: 'platform:escrow', fee_amount: 0 }",
    replace: "    return { credit_account: 'platform:escrow', fee_amount: commissionAmount }",
    test: TEST,
  },
  {
    name: '💰 매출 조회가 한쪽 계정만 본다 (통일 전후로 매출이 0 이 된다)',
    why: '과거 행은 merchant:, 새 행은 seller: 다. 한쪽만 보면 셀러 화면의 매출이 조용히 사라진다.',
    file: 'src/features/seller/api/seller-analytics.routes.ts',
    find: '       WHERE credit_account IN (?, ?) AND event_type = \'voucher_used\'`,\n    ).bind(`merchant:${sellerId}`, `seller:${sellerId}`)',
    replace: '       WHERE credit_account = ? AND event_type = \'voucher_used\'`,\n    ).bind(`merchant:${sellerId}`)',
    test: TEST,
  },
]
