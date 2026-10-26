/**
 * 🧬 주입 — 충전 딜 환급을 가게 정산 계좌로(2026-10-26). 가드: src/tests/unit/refund-store-account-2026-10-26.test.ts
 */
const T = 'src/tests/unit/refund-store-account-2026-10-26.test.ts'
const F = 'src/worker/utils/deal-refund-store-account.ts'
export default [
  {
    name: '환급 가게 계좌 — 운영자(대행) 좌석까지 주인으로 센다',
    file: F,
    find: "                             AND o.role = 'owner' AND o.revoked_at IS NULL))",
    replace: "                             AND o.revoked_at IS NULL))",
    test: T,
    why: '운영자의 개인 환급이 그 가게 사장님 통장으로 간다 — 에러가 안 난다.',
  },
  {
    name: '환급 가게 계좌 — 회수된 주인 좌석을 살린다',
    file: F,
    find: "                             AND o.role = 'owner' AND o.revoked_at IS NULL))",
    replace: "                             AND o.role = 'owner'))",
    test: T,
    why: '권한을 잃은 옛 주인의 계좌로 환급이 나간다.',
  },
  {
    name: '환급 가게 계좌 — 화면에 전체 계좌번호를 싣는다',
    file: F,
    find: "    bank_account_masked: `****${digits.slice(-4)}`,",
    replace: "    bank_account_masked: a.bank_account,",
    test: T,
    why: '정산 계좌 마스킹(2026-06-12)을 손님 화면이 우회한다.',
  },
  {
    name: '환급 가게 계좌 — 서버가 계좌 칸을 안 덮어쓴다',
    file: 'src/features/points/api/points.routes.ts',
    find: '      body.bank_account = acc.bank_account\n',
    replace: '',
    test: T,
    why: '화면이 보낸(빈) 계좌로 신청이 저장되거나 막힌다 — 선택한 계좌와 실제 계좌가 갈린다.',
  },
  {
    name: '환급 가게 계좌 — 시트가 가게 계좌인데도 계좌 칸을 보낸다',
    file: 'src/pages/user-profile/RefundSheet.tsx',
    find: '        ? { amount: parsed, use_store_account: true }',
    replace: '        ? { amount: parsed, bank_name: bank, bank_account: account, account_holder: holder.trim() }',
    test: T,
    why: '가게 계좌를 골랐는데 빈 칸이 가서 신청이 실패한다.',
  },
]
