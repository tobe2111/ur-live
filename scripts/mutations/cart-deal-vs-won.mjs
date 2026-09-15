/**
 * 🧾 장바구니가 딜과 원을 안 더한다 (2026-09-15) — 주입 매니페스트.
 * 가드: src/tests/unit/cart-deal-vs-won-2026-09-15.test.tsx
 *
 * 라이브 번들을 실제로 렌더해 보고서야 드러난 자리다(테스트는 전부 초록이었다).
 * 그래서 이 가드는 **화면에 찍힌 글자**를 보고, 아래 주입은 그 글자를 되돌린다.
 */
const TEST = 'src/tests/unit/cart-deal-vs-won-2026-09-15.test.tsx'
const SUM = 'src/components/cart/CartSummary.tsx'
const PAGE = 'src/pages/CartPage.tsx'

export default [
  {
    name: '[장바구니금액] 딜 줄을 안 그린다 (교환권 금액이 화면에서 사라진다)',
    file: SUM,
    find: '        {dealAmount > 0 && (',
    replace: '        {false && (',
    test: TEST,
    why: '13,500딜을 낸다는 말이 어디에도 없이 결제로 넘어간다.',
  },
  {
    name: '[장바구니금액] 교환권만일 때도 큰 숫자를 "원" 으로 쓴다',
    file: SUM,
    find: '              {dealOnly ? `${fmt(dealAmount)}딜` : `${fmt(total)}${won}`}',
    replace: '              {`${fmt(total)}${won}`}',
    test: TEST,
    why: '결제예정금액이 "0원" 으로 떠 공짜처럼 읽힌다 — 실제로는 13,500딜이 빠진다.',
  },
  {
    name: '[장바구니금액] 섞임 안내를 지운다 (누른 뒤에야 거절당한다)',
    file: SUM,
    find: '      {mixed && (',
    replace: '      {false && (',
    test: TEST,
    why: '되는 줄 알고 누르게 만드는 버튼이다 — 이유는 누르기 전에 화면에 있어야 한다.',
  },
  {
    name: '[장바구니금액] 딜에도 부가세 줄을 붙인다',
    file: SUM,
    find: '          {!dealOnly && total > 0 && (',
    replace: '          {total >= 0 && (',
    test: TEST,
    why: '딜 결제에 "부가세 포함(VAT 10%)" 은 말이 안 된다 — 원화 청구가 없다.',
  },
  {
    name: '[장바구니금액] 합계 루프가 딜을 원에 더한다 (88,000원 재발)',
    file: PAGE,
    find: '      if (isDealOnlyCartItem(item)) { deal += line; dealCount += item.quantity }\n      else sum += line',
    replace: '      sum += line',
    test: TEST,
    why: '라이브에 실제로 떠 있던 값이다 — 74,500원 + 13,500딜 = "88,000원".',
  },
  {
    name: '[장바구니금액] 요약에 딜·종류를 안 넘긴다 (컴포넌트만 고치고 호출부는 그대로)',
    file: PAGE,
    find: '                dealAmount={dealAmount}\n                cartKind={cartKind}\n',
    replace: '',
    test: TEST,
    why: '요약이 기본값(딜 0)으로 떨어져 화면은 종전과 똑같아진다.',
  },
  {
    name: '[장바구니금액] 섞여도 주문 버튼이 살아 있다',
    file: PAGE,
    find: "  const ctaDisabled = selectedIds.size === 0 || updating || cartKind === 'mixed'",
    replace: '  const ctaDisabled = selectedIds.size === 0 || updating',
    test: TEST,
    why: '거절을 모달로만 알리면 사용자는 결제되는 줄 알고 누른다.',
  },
  {
    name: '[장바구니금액] 모바일 하단바만 옛 인라인 라벨로 되돌아간다',
    file: PAGE,
    find: '              <CartCtaButton onClick={handleCheckout} disabled={ctaDisabled} label={ctaLabel} />',
    replace: "              <CartCtaButton onClick={handleCheckout} disabled={selectedIds.size === 0 || updating}\n                label={selectedIds.size === 0 ? t('cart.selectProductsFirst') : t('cart.placeOrder', { amount: formatNumber(total) })} />",
    test: TEST,
    why: 'PC 와 모바일이 서로 다른 금액을 말하게 된다 — 한쪽만 고치는 전형적 자리.',
  },
  {
    name: '[장바구니금액] 섞였는데도 합계를 한 통화로 크게 띄운다',
    file: SUM,
    find: '      {!mixed && (',
    replace: '      {true && (',
    test: TEST,
    why: '결제가 안 열리는데 "74,500원" 이 큰 글씨로 떠 그게 청구될 것처럼 읽힌다.',
  },
  {
    name: '[장바구니금액] 상품금액 개수에 교환권 수량까지 센다',
    file: PAGE,
    find: '                totalItems={totalItems - dealItems}',
    replace: '                totalItems={totalItems}',
    test: TEST,
    why: '"상품금액 (6개) 74,500원" — 개수는 6인데 금액은 원화 3개분이라 줄 하나가 자기모순이다.',
  },
  // 🎛️ 게이트 등재 스캐너의 사각지대 — 이 분기를 지우면 `voucher_cart_enabled` 같은
  //    `const GATE_KEY` + `.bind(GATE_KEY)` 게이트가 다시 안 보인다(등재 없이 배포된다).
  {
    name: '[게이트등재] 바인드+이름상수 게이트를 다시 못 보게 한다',
    file: 'scripts/check-gate-registry.mjs',
    find: "      if (!new RegExp(`\\\\.bind\\\\(\\\\s*${ident}\\\\b`).test(whole)) continue",
    replace: '      continue',
    test: 'src/tests/unit/gate-registry-and-display-2026-09-07.test.ts',
    why: '어드민에 손잡이가 없는 머니 게이트가 조용히 생긴다 — 2026-09-15 에 실제로 그랬다.',
  },
]
