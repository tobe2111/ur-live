/**
 * 🧺 이용권 장바구니 결제 (2026-09-15) — 주입 매니페스트.
 * 가드: src/tests/unit/voucher-cart-checkout-2026-09-15.test.ts
 *
 * 전부 **돈이 어긋나는 자리**다. 하나라도 초록으로 통과하면 그 가드는 헛돈 것이다.
 */
const TEST = 'src/tests/unit/voucher-cart-checkout-2026-09-15.test.ts'
const ROUTES = 'src/features/group-buy/api/cart-checkout.routes.ts'
const LINES = 'src/features/group-buy/api/cart-lines.ts'
const INTENT = 'src/features/group-buy/api/cart-intent.ts'
const CLIENT = 'src/pages/cart/voucher-checkout.ts'

export default [
  {
    name: '[장바구니] 품목을 클라가 보낸 값에서 읽는다 (총액 같은 상품으로 바꿔치기)',
    file: ROUTES,
    find: '  const priced = await priceCartLines(DB, userId, intent.items)',
    replace: '  const priced = await priceCartLines(DB, userId, (body as { items?: never[] }).items ?? intent.items)',
    test: TEST,
    why: '복귀 URL 은 브라우저를 거친다 — 품목을 거기서 받으면 1만원 A 를 결제하고 1만원 B 를 받아 갈 수 있다.',
  },
  {
    name: '[장바구니] 의사를 남의 것도 읽는다 (주인 확인 제거)',
    file: INTENT,
    find: "'SELECT items_json, total_amount FROM gb_cart_intents WHERE order_id = ? AND user_id = ? LIMIT 1',\n  ).bind(orderId, String(userId))",
    replace: "'SELECT items_json, total_amount FROM gb_cart_intents WHERE order_id = ? LIMIT 1',\n  ).bind(orderId)",
    test: TEST,
    why: '주문번호만 알면 남의 장바구니를 확정하게 된다.',
  },
  {
    name: '[장바구니] 게이트 조회 실패를 켜진 것으로 읽는다 (fail-open)',
    file: ROUTES,
    find: '  } catch { return false }',
    replace: '  } catch { return true }',
    test: TEST,
    why: '머니 경로의 fail-open — DB 가 흔들리는 순간 staging 전에 라이브가 열린다.',
  },
  {
    name: '[장바구니] 확정만 게이트를 보고 시작은 안 본다',
    file: ROUTES,
    find: `  if (!await cartEnabled(DB)) return c.json(GATE_OFF, 403)

  const userId = await resolveUserIdString(DB, user.id, user.isDbId)
  type InitBody`,
    replace: `
  const userId = await resolveUserIdString(DB, user.id, user.isDbId)
  type InitBody`,
    test: TEST,
    why: '한쪽만 막으면 다른 쪽으로 들어온다 — 결제 시작이 열리면 토스 창까지 뜬다.',
  },
  {
    name: '[장바구니] 재고를 못 잡아도 앞서 잡은 것을 안 되돌린다',
    file: ROUTES,
    find: '      await rollbackStock()\n      try {\n        const { cancelTossPayment }',
    replace: '      try {\n        const { cancelTossPayment }',
    test: TEST,
    why: '앞 줄 재고만 빠진 채 환불되면 그 상품은 팔리지도 않고 재고만 사라진다.',
  },
  {
    name: '[장바구니] 딜 차감 실패 시 재고를 안 되돌린다',
    file: ROUTES,
    find: '    if (!spent.ok) {\n      await rollbackStock()',
    replace: '    if (!spent.ok) {',
    test: TEST,
    why: '카드만 긁히고 딜은 안 빠진 채 재고가 사라진다 — 그 차액은 그대로 미수다.',
  },
  {
    name: '[장바구니] 발급을 줄마다 따로 batch 한다 (부분 발급 가능)',
    file: ROUTES,
    find: '    await DB.batch(stmts)',
    replace: '    for (const st of stmts) await DB.batch([st])',
    test: TEST,
    why: '중간에 끊기면 일부만 발급된다 — 사용자는 무엇을 샀는지 모르고 우리는 부분 환불을 해야 한다.',
  },
  {
    name: '[장바구니] 발급 실패에도 딜을 복원하지 않는다',
    file: ROUTES,
    find: '    if (dealUsed > 0) await restorePartialDeal(DB, { userId, dealUsed, orderNumber })',
    replace: '    /* 딜 복원 제거 */',
    test: TEST,
    why: '주문이 안 생겨 환불 헬퍼가 못 찾는 유일한 구간이다 — 여기서 안 되돌리면 딜이 증발한다.',
  },
  {
    name: '[장바구니] 금액 검증을 과금 뒤로 미룬다',
    file: ROUTES,
    find: `  const derived = await derivePartialDeal(DB, { userId, expectedAmount, chargedAmount })
  if (!derived.ok) return c.json({ success: false, error: derived.error, code: derived.code }, 400)
  const dealUsed = derived.dealUsed`,
    replace: `  const dealUsed = 0`,
    test: TEST,
    why: '승인 뒤에 막으면 환불이 필요해진다 — 단일 경로가 승인 전에 막는 이유다.',
  },
  {
    name: '[장바구니] 막힌 줄을 건너뛰고 나머지만 결제한다',
    file: LINES,
    find: "    if (!p) return { ok: false, error: '판매 중이 아닌 상품이 있습니다', code: 'PRODUCT_UNAVAILABLE', productId }",
    replace: '    if (!p) continue',
    test: TEST,
    why: '부분 구매가 생긴다 — 사용자는 뭘 샀는지 모르고 금액도 어긋난다.',
  },
  {
    name: '[장바구니] 선착순을 fail-open 으로 바꾼다',
    file: LINES,
    find: '    const fcfs = await checkFcfsPurchasable(DB, productId, userId)',
    replace: '    const fcfs = await (async () => { try { return await checkFcfsPurchasable(DB, productId, userId) } catch { return { ok: true as const } } })()',
    test: TEST,
    why: '"당첨자만" 은 하드 룰이다 — 조회 실패를 통과로 읽으면 추첨이 무의미해진다.',
  },
  {
    name: '[장바구니] 같은 상품 두 줄을 안 합친다 (1인당 한도 우회)',
    file: LINES,
    find: '    merged.set(pid, (merged.get(pid) ?? 0) + qty)',
    replace: '    merged.set(pid, qty)',
    test: TEST,
    why: '줄마다 한도 검사가 따로 돌아 각각은 통과하고 합계는 초과한다.',
  },
  {
    name: '[장바구니] 도매 원본이 장바구니로 새어 든다',
    file: LINES,
    find: '        AND NOT (COALESCE(is_supply_product,0) = 1 AND supply_source_id IS NULL)`,',
    replace: '        `,',
    test: TEST,
    why: '서비스 분리 위반 — 도매 B2B 원본이 소비자 결제로 들어온다.',
  },
  {
    name: '[장바구니] 이용권을 소비자 orders 레일로 태운다',
    file: CLIENT,
    find: "  if (kind === 'voucher') {",
    replace: "  if (false as boolean) {",
    test: TEST,
    why: '그 레일엔 발급이 0건이다 — 결제는 되고 이용권은 안 나온다.',
  },
  {
    name: '[장바구니] 섞인 장바구니를 그냥 결제한다',
    file: CLIENT,
    find: "  if (kind === 'mixed') return '함께 결제할 수 없는 상품이 섞여 있어요.",
    replace: '  /* 섞임 차단 제거 */',
    test: TEST,
    why: '한 결제로 묶으면 둘 중 한쪽 레일의 후처리가 반드시 빠진다.',
  },
  {
    name: '[장바구니] 결제창 이름이 길면 "외 N건" 이 잘려 나간다',
    file: LINES,
    find: '  const head = first.length > room ? `${first.slice(0, Math.max(1, room - 1))}…` : first\n  return `${head}${suffix}`',
    replace: '  const raw = `${first}${suffix}`\n  return raw.length > 100 ? `${raw.slice(0, 97)}...` : raw',
    test: TEST,
    why: '내가 처음 쓴 코드 그대로다 — 무엇을 사는지 가리는 결제창은 금액이 맞아도 틀린 화면이다.',
  },
  // ⑦ 교환권(딜) ↔ 이용권(카드) — 게이트 켜기 직전에 실측으로 드러난 머니 버그 자리
  {
    name: '[장바구니] 교환권을 이용권과 한 덩어리로 본다 (딜로 살 것을 카드로 청구)',
    file: CLIENT,
    find: "  const deal = items.filter(isDealOnlyCartItem).length",
    replace: "  const deal = 0",
    test: TEST,
    why: '첫 판이 정확히 이랬다 — 둘 다 배송이 없다는 이유로 갈리지 않아 교환권이 카드 레일로 갔다.',
  },
  {
    name: '[장바구니] 교환권만 담겨도 카드 레일로 보낸다',
    file: CLIENT,
    find: "  if (deal === items.length) return 'deal'",
    replace: "  if (deal === items.length) return 'voucher'",
    test: TEST,
    why: '`/checkout` 이 강제하던 딜 모드를 건너뛴다 — 13,500딜짜리를 13,500원으로 받는다.',
  },
  {
    name: '[장바구니] 교환권+이용권 섞임을 섞임으로 안 본다',
    file: CLIENT,
    find: "  const card = items.filter((i) => isVoucherCartItem(i) && !isDealOnlyCartItem(i)).length",
    replace: "  const card = items.filter(isVoucherCartItem).length",
    test: TEST,
    why: '교환권이 card 에도 세어져 섞인 장바구니가 `voucher` 로 통과한다(총액이 딜+원화 합산).',
  },
  {
    name: '[장바구니·서버] 교환권을 카드 레일에서 거절하지 않는다',
    file: LINES,
    find: "    if (Number(p.deal_only) === 1) {",
    replace: "    if (false) {",
    test: TEST,
    why: '경계는 서버다 — 화면을 우회해 상품 id 를 직접 보내면 여기서만 막힌다.',
  },
]
