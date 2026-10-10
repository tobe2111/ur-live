/**
 * 💸 2026-10-10 머니 경로 감사 — 주입 매니페스트.
 *
 * 각 주입은 이번에 고친 결함을 그대로 되살린다. 가드 테스트가 빨간불이 안 나면 그 테스트는 헛돈다.
 */
export default [
  {
    name: '💸감사1010 셀러 정산 화면이 store_owner payout 을 다시 못 본다',
    file: 'src/features/seller/api/seller-settlements/payouts.ts',
    find: 'const keys = paidPayeeAliases(`seller:${sellerId}`)',
    replace: 'const keys = [`seller:${sellerId}`]',
    test: 'src/tests/unit/seller-payouts-store-owner-2026-10-10.test.ts',
    why: 'cron 은 매장 몫 payout 을 store_owner 로 만든다 — seller 만 보면 사장님 정산 이력이 0건이다(에러 없음).',
  },
  {
    name: '💸감사1010 셀러 유보액이 merchant:N 적립을 다시 못 본다',
    file: 'src/features/seller/api/seller-settlements/payouts.ts',
    find: 'const accounts = ledgerAccountAliases(`seller:${sellerId}`)',
    replace: 'const accounts = [`seller:${sellerId}`]',
    test: 'src/tests/unit/seller-payouts-store-owner-2026-10-10.test.ts',
    why: '이용권 매출은 사용 시점 merchant:N 에만 쌓인다 — seller:N 만 보면 유보 0원으로 보인다.',
  },
  {
    name: '💸감사1010 cron payout 이 다시 은행명 없이 만들어진다 (이체 파일에서 빠짐)',
    file: 'src/worker/cron/payouts-generate.ts',
    find: 'acct.bankName, acct.accountNumber, acct.accountHolder).run()',
    replace: 'null, acct.accountNumber, acct.accountHolder).run()',
    test: 'src/tests/unit/payout-payee-account-2026-10-10.test.ts',
    why: 'isTransferable 은 은행·번호·예금주 셋 다 요구한다 — bank_name 이 NULL 이면 cron 정산 전부가 일괄이체 CSV 에서 빠진다.',
  },
  {
    name: '💸감사1010 예금주에 다시 상호를 먼저 적는다',
    file: 'src/worker/utils/payout-payee-account.ts',
    find: 'return clean(accountHolder) ?? clean(businessName)',
    replace: 'return clean(businessName) ?? clean(accountHolder)',
    test: 'src/tests/unit/payout-payee-account-2026-10-10.test.ts',
    why: '상호와 예금주가 다르면 은행이 그 이체를 반려하고, 파일 전체를 반려하는 은행도 있다.',
  },
  {
    name: '💸감사1010 수동 생성 기간 창이 다시 user: 차감에만 걸린다 (OR 우선순위)',
    file: 'src/worker/utils/payout-account.ts',
    find: '       WHERE (${PAYOUT_DEBIT_COND})\n         AND created_at BETWEEN ? AND ?',
    replace: '       WHERE ${PAYOUT_DEBIT_COND}\n         AND created_at BETWEEN ? AND ?',
    test: 'src/tests/unit/payout-payee-account-2026-10-10.test.ts',
    why: 'A OR B OR C OR D AND 기간 은 D AND 기간 으로 묶인다 — 매장·에이전시 차감이 기간 밖에서도 빠진다.',
  },
  {
    name: '💸감사1010 계좌 재확인 전인데 송금 완료가 통과한다',
    file: 'src/worker/utils/payout-sent.ts',
    find: '  if (!acct.accountVerified) {',
    replace: '  if (false) {',
    test: 'src/tests/unit/payout-account-unverified-2026-10-10.test.ts',
    why: '계좌를 바꾼 뒤(세션 탈취 포함) 어드민 재확인 전에 주간 정산이 그 계좌로 나간다.',
  },
  {
    name: '💸감사1010 생성 뒤 바뀐 계좌인데 옛 스냅샷으로 송금된다',
    file: 'src/worker/utils/payout-sent.ts',
    find: '  if (acct.accountNumber && row.account_number && digits(',
    replace: '  if (false && digits(',
    test: 'src/tests/unit/payout-account-unverified-2026-10-10.test.ts',
    why: '재확인을 마쳐도 행에는 생성 시점 계좌가 박혀 있다 — 탈취자가 바꿨다 되돌린 경우 그 계좌로 나간다.',
  },
  {
    name: '💸감사1010 일괄 승인이 계좌 검사를 건너뛴다',
    file: 'src/features/admin/api/admin-payouts.routes.ts',
    find: '      if (!chk.ok) { blocked.push({ id, code: chk.code, error: chk.error }); continue }',
    replace: '',
    test: 'src/tests/unit/payout-account-unverified-2026-10-10.test.ts',
    why: '단건만 막고 일괄이 통과시키면 가드가 갈린다 — 갈린 쪽이 조용히 미재확인 계좌를 승인한다.',
  },
]
