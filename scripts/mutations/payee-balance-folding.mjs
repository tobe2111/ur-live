/**
 * 💸 2026-10-01 — payee 잔액 접기(`merchant:N` ↔ `seller:N`, `store_owner:N`) 주입.
 *
 * 이 접기가 빠지면 **가드가 돈을 못 봐서 통과시킨다**(fail-closed 설계가 fail-open 이 된다).
 * 에러도 로그도 없으므로, 시험이 실제로 빨간불을 내는지는 심어 봐야만 안다.
 */
const TEST = 'src/tests/unit/payee-balance-folding-2026-10-01.test.ts'

export default [
  {
    name: 'payee-folding: 원장 별칭을 없앤다 (매장 돈이 다시 안 보인다)',
    file: 'src/worker/utils/payout-account.ts',
    find: "  const m = /^seller:(\\d+)$/.exec(account)\n  return m ? [account, `merchant:${m[1]}`] : [account]",
    replace: "  return [account]",
    why: '구매 적립이 escrow 로 간 뒤 매장 돈은 `merchant:N` 에만 쌓인다. 접기를 없애면 '
       + '`seller:N` 질의가 0 을 읽고, 손바뀜·탈퇴 가드가 못 받은 돈을 남긴 채 통과시킨다.',
    test: TEST,
  },
  {
    name: 'payee-folding: payouts 별칭을 없앤다 (배정분이 안 빠진다)',
    file: 'src/worker/utils/payout-account.ts',
    find: "  const m = /^seller:(\\d+)$/.exec(account)\n  return m ? [account, `store_owner:${m[1]}`] : [account]",
    replace: "  return [account]",
    why: '`payoutPayeeType` 이 매장 payout 에 `store_owner` 를 박으므로, 별칭이 없으면 그 행이 '
       + '안 빠져 미배정 잔액이 과대로 읽힌다 — 마감을 해도 손바뀜이 영원히 막힌다.',
    test: TEST,
  },
  {
    name: 'payee-folding: 원장 집계를 정확히-일치로 되돌린다',
    file: 'src/worker/utils/ledger.ts',
    find: "  const accounts = ledgerAccountAliases(account)",
    replace: "  const accounts = [account]",
    why: '별칭 함수는 멀쩡한데 호출부가 안 쓰는 경우. SSOT 를 만들어 놓고 배선을 빠뜨리는 것이 '
       + '이 레포가 반복해 당한 클래스라, 배선 자체를 따로 심어 본다.',
    test: TEST,
  },
  {
    name: 'payee-folding: 배정분 뺄셈 배선을 끊는다',
    file: 'src/worker/utils/ledger.ts',
    find: "  const paidKeys = paidPayeeAliases(payeeAccount)\n  const paidPh = paidKeys.map(() => '?').join(', ')\n  const earmarked",
    replace: "  const paidKeys = [payeeAccount]\n  const paidPh = paidKeys.map(() => '?').join(', ')\n  const earmarked",
    why: '위와 같은 배선 누락을 `getUnsettledBalance` 쪽에서도 심는다(두 쿼리가 서로 다른 함수라 '
       + '한쪽만 고쳐지는 일이 실제로 일어났다).',
    test: TEST,
  },
  {
    name: 'payee-folding: 너무 넓게 접는다 (agency 까지 끌어온다)',
    file: 'src/worker/utils/payout-account.ts',
    find: "export function ledgerAccountAliases(account: string): string[] {\n  const m = /^seller:(\\d+)$/.exec(account)",
    replace: "export function ledgerAccountAliases(account: string): string[] {\n  const m = /^[a-z_]+:(\\d+)$/.exec(account)",
    why: '접기가 과하면 남의 돈을 자기 잔액으로 센다 — 과소보고보다 나쁘다(없는 돈을 지급한다). '
       + '④ 가 `agency:N` 의 불변을 지키고 있는지 확인한다.',
    test: TEST,
  },
  {
    name: 'payee-folding: payouts 별칭의 라벨 철자를 틀린다',
    file: 'src/worker/utils/payout-account.ts',
    find: "  return m ? [account, `store_owner:${m[1]}`] : [account]",
    replace: "  return m ? [account, `storeowner:${m[1]}`] : [account]",
    test: TEST,
    why: '라벨과 별칭은 **짝**이고, 둘을 잇는 것은 손으로 적은 문자열뿐이다. 한 글자만 틀려도 '
       + '`store_owner` payout 이 안 빠져 미배정 잔액이 과대로 읽힌다 — 에러 없이. '
       + '(라벨 규칙 자체의 회귀는 `voucher-credit-single-rail:74` 가 소유한다.)',
  },
]
