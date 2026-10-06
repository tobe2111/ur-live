/**
 * 🏪 매장 추가 문 · 승인 전 이용권 등록 — 되돌려-검증 주입 (2026-10-06).
 */
export default [
  {
    name: '🏪 승인 전 매장의 이용권 등록을 다시 막는다',
    file: 'src/pages/seller-page/MyStoresPanel.tsx',
    find: "const canRegisterVoucher = (s: OperableStore) => s.status !== 'suspended'",
    replace: 'const canRegisterVoucher = (s: OperableStore) => isApproved(s)',
    test: 'src/tests/unit/store-entry-and-pending-2026-10-06.test.ts',
    why: '등록 화면은 "건너뛰어도 등록돼요" 라고 약속하는데 여기서 막으면 그 약속이 거짓이 된다(2026-09-16 당근 모델 위반).',
  },
  {
    name: '🏪 가게가 1곳이면 시트가 안 열린다 (매장 추가 문이 사라짐)',
    file: 'src/pages/user-profile/SellerSection.tsx',
    find: '        {!awaiting && stores.length >= 1 ? (',
    replace: '        {!awaiting && stores.length >= 2 ? (',
    test: 'src/tests/unit/store-entry-and-pending-2026-10-06.test.ts',
    why: '가게가 하나뿐인 사장님(대다수)이 마이에서 새 매장을 더할 문이 다시 없어진다.',
  },
]
