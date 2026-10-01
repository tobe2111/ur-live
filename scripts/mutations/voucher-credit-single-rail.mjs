/**
 * 💸 이용권 적립 단일 레일 가드의 되돌려-검증 (2026-10-01, 대표 "최대한 이상적으로 다 해줘").
 * 가드: src/tests/unit/voucher-credit-single-rail-2026-10-01.test.ts
 * 결재: docs/decisions/2026-09-30-voucher-credit-double-rail.md
 *
 * 지키는 것(둘, 성질이 다르다):
 *   ① 구매 적립이 **매장에 가지 않는다**(escrow 경유) — 미사용·환불 이용권까지 지급되지 않게.
 *   ② `merchant:N` 과 `seller:N` 이 **한 payee** 로 접힌다 — 같은 가게에 두 번 송금하지 않게,
 *      그리고 `seller:N` 의 차감(인플 커미션·중개사 몫)이 매장 적립에서 **빠지게**.
 */
const SSOT = 'src/worker/utils/payout-account.ts'
const GB = 'src/features/group-buy/api/group-buy.routes.ts'
const CART = 'src/features/group-buy/api/cart-checkout.routes.ts'
const CRON = 'src/worker/cron/payouts-generate.ts'
const ADMIN = 'src/features/admin/api/admin-payouts.routes.ts'
const TEST = 'src/tests/unit/voucher-credit-single-rail-2026-10-01.test.ts'

export default [
  {
    name: '💸 구매 적립이 다시 매장 계정으로 간다 (이중적립 부활 — 실측 185%)',
    file: SSOT,
    find: "    ? { account: 'platform:escrow', carriesFee: false }",
    replace: "    ? { account: `seller:${id}`, carriesFee: true }",
    test: TEST,
    why: '이것이 원래 결함이다 — 구매 시점에 매장에 적립하면 사용 시점 적립과 합쳐 1,000원 판매가 1,850원으로 집계된다.',
  },
  {
    name: '💸 merchant:N 과 seller:N 이 다시 다른 payee 가 된다 (한 가게에 송금 2회)',
    file: SSOT,
    find: "  if (prefix === 'merchant' || prefix === 'seller') return { kind: 'seller', id }",
    replace: "  if (prefix === 'merchant') return { kind: 'merchant', id }\n  if (prefix === 'seller') return { kind: 'seller', id }",
    test: TEST,
    why: '접지 않으면 seller:N 의 차감이 merchant:N 적립에서 빠지지 않는다 — 매장이 부담할 커미션을 아무도 안 낸다(플랫폼 손실).',
  },
  {
    name: '💸 집계 SQL 이 계정 문자열로 다시 GROUP BY 한다',
    file: SSOT,
    find: "        SELECT ${canonicalPayeeSql('credit_account')} AS account, amount - COALESCE(fee_amount, 0) AS net",
    replace: '        SELECT credit_account AS account, amount - COALESCE(fee_amount, 0) AS net',
    test: TEST,
    why: 'SQL 쪽만 되돌려도 같은 사고가 난다 — JS 판정과 SQL 조각이 갈리면 둘 중 느슨한 쪽이 이긴다.',
  },
  {
    name: '💸 이미 생성된 payout 의 store_owner 라벨이 접히지 않는다 (차감 실패 → 이중지급)',
    file: SSOT,
    find: "  if (payeeType === 'store_owner' || payeeType === 'seller') return { kind: 'seller', id }",
    replace: "  if (payeeType === 'seller') return { kind: 'seller', id }",
    test: TEST,
    why: 'credit 은 seller:N 으로 접히는데 paid 가 store_owner:N 으로 남으면 이미 보낸 돈이 안 빠져 매주 다시 생성된다.',
  },
  {
    // 🎯 2026-10-01 재조준: 계정·수수료를 **한 호출이 함께** 내도록 바꿨다(`purchaseCreditFields`) —
    //   호출부에서 둘을 따로 적을 수 없으니 짝 불일치가 구조적으로 불가능해졌다. ⇒ 주입은 SSOT 쪽에서
    //   그 짝을 깨뜨린다(매장 상품인데 수수료를 싣는다).
    name: '💸 구매 적립이 수수료를 그때 떼어 escrow 가 총액이 아니게 된다',
    file: SSOT,
    find: '  return { credit_account: account, fee_amount: carriesFee ? feeAmount : 0 }',
    replace: '  return { credit_account: account, fee_amount: feeAmount }',
    test: TEST,
    why: '사용 시점 세 분개가 escrow 에서 총액을 꺼내므로, 구매 때 수수료를 빼 두면 escrow 가 모자란다(수수료를 두 번 뗀 셈).',
  },
  {
    name: '💸 장바구니 구매 적립만 옛 경로로 돌아간다 (한 자리만 새도 같은 사고)',
    file: CART,
    find: '...purchaseCreditFields(sid, commissionAmount), // 💸 escrow 경유(이중적립 제거)',
    replace: "credit_account: `seller:${sid}`, fee_amount: commissionAmount,",
    test: TEST,
    why: '구매 경로가 셋(딜·카드·장바구니)이라 하나만 빠뜨리면 그 경로로 산 이용권에서만 이중적립이 난다 — 가장 찾기 어려운 모양이다.',
  },
  {
    // 🩸 처음엔 CRON 의 `let payeeType = …` 를 다른 모양으로 하드코딩했는데 **시험이 통과했다**
    //   (그 시험이 '접두어 삼항이 없는가' 라는 *모양*만 봤다). 그래서 판정을 순수 함수로 빼고
    //   여기서 그 **동작**을 깨뜨린다.
    name: '💸 payee_type 이 셀러 역할을 안 보고 매장으로 고정된다 (주간 이중레일 경보 오보)',
    file: SSOT,
    find: "  return isStoreOwner(sellerType) ? 'store_owner' : 'seller'",
    replace: "  return 'store_owner'",
    test: TEST,
    why: '매장 아닌 셀러(인플루언서)까지 store_owner 로 찍히면 주간 이중레일 경보가 오보를 낸다. 반대로 전부 seller 로 통일하면 그 경보가 조용히 0을 센다.',
  },
  {
    name: '💸 cron 이 payee_type 판정을 다시 스스로 한다 (두 경로가 갈린다)',
    file: CRON,
    find: 'payeeType = payoutPayeeType(payee.kind, row?.seller_type)',
    replace: "payeeType = 'store_owner'",
    test: TEST,
    why: 'SSOT 에 위임하지 않으면 cron 과 어드민 수동 생성이 서로 다른 라벨을 쓴다 — 같은 가게에 payout 행이 둘 생긴다.',
  },
  {
    // 🎯 2026-10-01 재조준: 그 집계 문장이 `payout-account.ts payoutPeriodPendingSql()` 로 옮겨졌다
    //   (파일 크기 래칫이 분리를 요구했고, 같은 머니 공식 세 벌의 드리프트를 줄이는 쪽이기도 하다).
    name: '💸 어드민 수동 생성이 다시 credit-only(과다지급) 로 돌아간다',
    file: SSOT,
    find: "      SELECT ${canonicalPayeeSql('credit_account')} as account, SUM(amount - COALESCE(fee_amount, 0)) as total",
    replace: "      SELECT ${canonicalPayeeSql('credit_account')} as account, SUM(amount) as total",
    test: TEST,
    why: '수수료를 안 빼면 gross 를 지급한다. 표시용 집계는 2026-07-01 에 net 으로 고쳐졌는데 이 버튼만 남아 있던 것이 이번에 드러났다.',
  },
]
