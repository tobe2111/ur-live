// 🏪 2026-10-31 9번 B안 가게 머리줄 + 폰 마이 판·구분선 제거 — 가드가 실제로 실패할 수 있는지.
const TEST = 'src/tests/unit/my-store-head-flat-2026-10-31.test.tsx'
export default [
  {
    name: 'store-head — 매장 고르기 창에 요약을 안 넘긴다(매출·새 주문 표시가 사라짐)',
    file: 'src/pages/user-profile/SellerSection.tsx',
    find: 'summaries={stores}',
    replace: 'summaries={[]}',
    test: TEST,
    why: '다른 매장에 들어온 주문을 지금 매장만 보다가 놓친다 — 대표 질문 "매장이 여러개라면?" 의 답이 그 표시다.',
  },
  {
    name: 'store-head — 서버가 가게 사진을 안 싣는다',
    file: 'src/features/seller/api/seller-operators.routes.ts',
    find: '        image: iMap.get(s.seller_id) ?? null,',
    replace: '        image: null,',
    test: TEST,
    why: '머리줄이 늘 이니셜이 되어 누구 가게인지 사진으로 못 알아본다.',
  },
  {
    name: 'store-head — 판 걷기가 PC 까지 번진다',
    file: 'src/index.css',
    find: '@media (max-width: 1023.98px) {\n  .ur-my-flat',
    replace: '@media (min-width: 0px) {\n  .ur-my-flat',
    test: TEST,
    why: 'PC 마이는 2026-10-14 대표 확정 카드(B)다 — 폰 결정이 PC 를 덮으면 안 된다.',
  },
  {
    name: 'store-head — 사진이 없을 때 빈 칸',
    file: 'src/pages/user-profile/seller-section/StoreThumb.tsx',
    find: "{(name.trim()[0] || '가').toUpperCase()}",
    replace: "{''}",
    test: TEST,
    why: '빈 회색 칸은 어느 가게인지 말해 주지 않는다.',
  },
]
