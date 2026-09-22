/**
 * 💸 결제된 주문의 `payment_status` (2026-09-21) — 주입 매니페스트.
 * 가드: src/tests/unit/order-payment-status-2026-09-21.test.ts
 */
const TEST = 'src/tests/unit/order-payment-status-2026-09-21.test.ts'
const GB = 'src/features/group-buy/api/group-buy.routes.ts'

export default [
  {
    name: '💸 공구 카드 주문이 다시 payment_status 없이 저장된다',
    file: GB,
    find: "'KRW', 'PAID', 'approved', 'toss', ?, ?)",
    replace: "'KRW', 'PAID', 'toss', ?, ?)",
    test: TEST,
    why: '기본값 pending 에 남으면 소비자 환불 요청이 400 으로 막히고 매출 집계에서 빠진다 — 에러가 안 나서 아무도 모른다.',
  },
  {
    name: '💸 공구 딜 주문이 다시 payment_status 없이 저장된다',
    file: GB,
    find: "'KRW', 'PAID', 'approved', ?, ?)",
    replace: "'KRW', 'PAID', ?, ?)",
    test: TEST,
    why: '딜로 산 이용권도 같은 구멍에 빠진다(라이브 id 85 가 그 상태였다).',
  },
  {
    name: '💸 장바구니 결제가 다시 payment_status 없이 저장된다',
    file: 'src/features/group-buy/api/cart-checkout.routes.ts',
    find: "'KRW', 'PAID', 'approved', 'toss', ?, ?)",
    replace: "'KRW', 'PAID', 'toss', ?, ?)",
    test: TEST,
    why: '같은 클래스라 한 곳만 고치면 다음 경로에서 재발한다.',
  },
  {
    name: '💸 checkout.ts 의 bind 에서 approved 가 빠진다',
    file: 'src/worker/utils/checkout.ts',
    find: ".bind(orderNumber, userId, amount, 'PAID', 'approved', paymentKey, paymentKey)",
    replace: ".bind(orderNumber, userId, amount, 'PAID', paymentKey, paymentKey)",
    test: TEST,
    why: '컬럼만 늘리고 값을 안 넣으면 바인딩 개수가 어긋나 런타임에 죽는다 — 컬럼↔값 쌍을 같이 고정한다.',
  },
  {
    name: '💸 0원 체험단에도 approved 를 찍는다',
    file: 'src/features/group-buy/api/experience-campaign.routes.ts',
    find: "currency, status, payment_method)\n      VALUES (?, ?, ?, 0, 0, 0, 0, 'KRW', 'PAID', 'experience')",
    replace: "currency, status, payment_status, payment_method)\n      VALUES (?, ?, ?, 0, 0, 0, 0, 'KRW', 'PAID', 'approved', 'experience')",
    test: TEST,
    why: '돈이 오간 적 없는 0원 주문이 매출 건수와 온보딩 first_payment 에 섞인다.',
  },
  {
    name: '💸 환불해도 payment_status 가 approved 로 남는다 (공유 루틴)',
    file: 'src/worker/utils/order-refund.ts',
    find: ", payment_status: 'refunded' },",
    replace: ' },',
    test: TEST,
    why: '환불된 주문이 일일 다이제스트에서 매출로 계속 잡히고 환불 건수에선 빠진다(머니 룰 #2 대칭 붕괴).',
  },
  {
    name: '💸 소비자 환불 요청 경로만 되돌리기를 빠뜨린다',
    file: 'src/worker/routes/order.routes.ts',
    find: "        payment_status: 'refunded', // 💸 안 되돌리면 환불된 주문이 계속 매출로 집계된다(머니 룰 #2)\n",
    replace: '',
    test: TEST,
    why: '환불 경로가 둘인데 한쪽만 되돌리면 어느 경로로 환불했느냐에 따라 장부가 갈린다.',
  },
  {
    name: '💸 저장소가 payment_status 를 받기만 하고 SET 하지 않는다',
    file: 'src/worker/repositories/order.repository.ts',
    find: "{ setFields.push('payment_status = ?'); params.push(extra.payment_status); }",
    replace: '{ void extra.payment_status; }',
    test: TEST,
    why: '타입만 받고 버리면 호출부는 고쳤는데 DB 는 안 바뀐다 — 가장 조용한 실패다.',
  },
  {
    name: '💸 backfill 이 결제 흔적 없는 행까지 approved 로 만든다',
    file: 'src/worker/routes/repair-schema/column-repairs.ts',
    find: "         AND ( payment_key IS NOT NULL\n            OR toss_payment_key IS NOT NULL\n            OR payment_method = 'deal_points' )",
    replace: '',
    test: TEST,
    why: '어떤 경로로 생겼는지 모르는 행을 결제됨으로 단정한다 — 프로덕션 데이터라 되돌릴 수 없다.',
  },
  {
    name: '💸 backfill 이 CANCELLED 까지 approved 로 만든다',
    file: 'src/worker/routes/repair-schema/column-repairs.ts',
    find: "AND UPPER(status) IN ('PAID', 'DONE', 'DELIVERED')",
    replace: "AND UPPER(status) IN ('PAID', 'DONE', 'DELIVERED', 'CANCELLED')",
    test: TEST,
    why: '결제 전 취소와 결제 후 취소가 섞인 57건을 한 값으로 덮어 환불 건수 집계를 되레 망친다.',
  },
  {
    name: '🪙 부분결제 주문이 PENDING 으로 들어간다 (웹훅 이중차감)',
    file: GB,
    find: "'KRW', 'PAID', 'approved', 'toss', ?, ?)",
    replace: "'KRW', 'PENDING', 'approved', 'toss', ?, ?)",
    test: 'src/tests/unit/voucher-partial-deal.test.ts',
    why:
      '내 변경이 그 시험의 앵커를 깨뜨려 재조준했으므로(붙어 있던 두 리터럴 → status 자리의 값), ' +
      '재조준한 판정이 **여전히 PENDING 을 잡는지**를 여기서 고정한다. PENDING 이면 웹훅이 ' +
      'orders.deal_used 를 읽어 같은 딜을 한 번 더 뺀다.',
  },
]
