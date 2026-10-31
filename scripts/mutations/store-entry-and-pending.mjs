/**
 * 🏪 매장 추가 문 · 승인 전 이용권 등록 — 되돌려-검증 주입 (2026-10-06).
 */
export default [
  {
    name: '🏪 가게가 1곳이면 시트가 안 열린다 (매장 추가 문이 사라짐)',
    file: 'src/pages/user-profile/SellerSection.tsx',
    // 🔁 2026-10-31 재조준(9번 B안): 가게 머리줄 전체가 시트를 여는 버튼이다.
    find: '          disabled={awaiting}\n          onClick={() => setSheetOpen(true)}',
    replace: '          disabled={awaiting || stores.length < 2}\n          onClick={() => setSheetOpen(true)}',
    test: 'src/tests/unit/store-entry-and-pending-2026-10-06.test.ts',
    why: '가게가 하나뿐인 사장님(대다수)이 마이에서 새 매장을 더할 문이 다시 없어진다.',
  },
]
