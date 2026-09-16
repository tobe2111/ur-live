/**
 * 🧬 딜 사용 선택 — 되돌려-검증 주입 (2026-09-13).
 *
 * 지키는 규칙:
 *   ① 고른 값이 서버까지 간다 (안 가면 선택이 장식이다)
 *   ② **안 고르면 종전과 완전히 같다** (기존 흐름을 깨지 않는다)
 *   ③ 화면이 잔액으로 추정하지 않는다 (게이트가 꺼지면 안내가 거짓말이 된다)
 *
 * 규약: `export default [ … ]` 하나. 이름은 전체에서 유일해야 한다.
 */
export default [
  {
    name: '🪙선택 고른 값이 서버로 안 간다 (선택이 장식이 된다)',
    file: 'src/features/group-buy/api/group-buy.routes.ts',
    find: `resolvePartialDealPlan(DB, { userId, totalAmount, requested: deal_use })`,
    replace: `resolvePartialDealPlan(DB, { userId, totalAmount })`,
    test: 'src/tests/unit/deal-use-chooser-2026-09-13.test.ts',
    why:
      '화면은 "딜 5,000 · 카드 11,500" 이라고 말해 놓고 서버는 딜을 최대한 쓴다. ' +
      '에러가 안 나고 카드 청구액만 다르다 — 사용자는 명세서를 봐야 안다.',
  },
  {
    name: '🪙선택 안 골라도 0 을 보낸다 (종전 동작이 뒤집힌다)',
    file: 'src/pages/GroupBuyDetailPage.tsx',
    find: `...(dealUse == null ? {} : { deal_use: dealUse }),`,
    replace: `deal_use: dealUse ?? 0,`,
    test: 'src/tests/unit/deal-use-chooser-2026-09-13.test.ts',
    why:
      '안 고른 사람에게 "딜 0" 을 보내면 종전에 자동 차감되던 흐름이 조용히 카드 전액이 된다. ' +
      '부작용이 반대 방향(사용자가 더 낸다)이라 더 나쁘다.',
  },
  {
    name: '🪙선택 화면이 잔액으로 혼자 판단한다',
    file: 'src/pages/group-buy/DealUseChooser.tsx',
    find: `  if (!plan || !plan.enabled || plan.max_deal_usable <= 0) return null`,
    replace: `  if (!plan) return null`,
    test: 'src/tests/unit/deal-use-chooser-2026-09-13.test.ts',
    why:
      '게이트가 꺼져 있는데 선택지를 그리면 "딜 11,200 쓸 수 있어요" 가 거짓말이 된다. ' +
      '사용자는 카드에서 전액이 빠진 뒤에야 안다(2026-09-04 audit log 가 못 박은 규칙).',
  },
  {
    name: '🪙선택 조회 엔드포인트가 총액을 다른 식으로 센다',
    file: 'src/features/group-buy/api/deal-plan.routes.ts',
    find: `        const totalAmount = Math.round(product.price * (1 - maxTierDiscount(product.group_buy_tiers) / 100)) * qty`,
    replace: `        const totalAmount = product.price * qty`,
    test: 'src/tests/unit/deal-use-chooser-2026-09-13.test.ts',
    why:
      '화면의 "카드 5,300원" 과 실제 청구액이 갈린다. 같은 상품을 두 식으로 세면 ' +
      '할인이 걸린 순간 어긋나고, 그건 화면이 거짓을 말하는 것이다.',
  },
  {
    name: '🪙선택 고르는 자리가 구매 버튼 아래로 내려간다',
    // 🧺 2026-09-15: 모바일 바가 `DealBottomBar` 로 이사했다 — 성질은 그대로라 자리만 재조준.
    file: 'src/pages/group-buy/DealBottomBar.tsx',
    find: `      <DealUseChooser plan={dealPlan} value={dealUse ?? dealPlan?.max_deal_usable ?? 0} onChange={setDealUse} />
      <button`,
    replace: `      <button`,
    test: 'src/tests/unit/deal-use-chooser-2026-09-13.test.ts',
    why:
      '모바일 결제 바에서 고르는 자리가 누르는 버튼 **아래**로 가면 순서가 거꾸로다. ' +
      '게다가 이 바는 fixed bottom-0 이라 아래로 자란 만큼이 모든 방문자 화면을 영구히 먹는다.',
  },
  {
    name: '🪙선택 PC 구매 박스에서 선택이 사라진다',
    file: 'src/pages/GroupBuyDetailPage.tsx',
    find: `          dealSlot={<DealUseChooser plan={!isPrelaunch && isJoinable ? dealPlan : null} value={dealUse ?? dealPlan?.max_deal_usable ?? 0} onChange={setDealUse} />}\n`,
    replace: ``,
    test: 'src/tests/unit/deal-use-chooser-2026-09-13.test.ts',
    why:
      'PC(lg+)는 하단 바 대신 DealPurchaseBox 를 쓴다. 여기가 빠지면 PC 사용자는 종전대로 ' +
      '**말없이 딜이 빠지는** 상태로 남는데, 에러가 안 나서 아무도 모른다.',
  },
  {
    name: '🪙선택 접힌 줄이 결과 숫자를 안 말한다',
    file: 'src/pages/group-buy/DealUseChooser.tsx',
    find: `          딜 <b style={{ color: 'var(--gbd-ink)' }}>{formatNumber(used)}</b>
          {' · '}카드 <b style={{ color: 'var(--gbd-ink)' }}>{formatNumber(card)}원</b>`,
    replace: `          딜 사용 가능`,
    test: 'src/tests/unit/deal-use-chooser-2026-09-13.test.ts',
    why:
      '접힌 한 줄이 "딜 N · 카드 M원" 을 말해 주기 때문에 펼치지 않아도 무슨 일이 일어날지 안다. ' +
      '그 줄이 없으면 "말 안 하고 내 돈을 쓰는" 원래 문제가 그대로 남는다.',
  },
]
