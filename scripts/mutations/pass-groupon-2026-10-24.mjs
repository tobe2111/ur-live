// 🛍️ 2026-10-24 이용권 상세 그루폰식 → 2026-10-25 E안 — 구매하기는 하나
const T = 'src/tests/unit/pass-groupon-2026-10-24.test.ts'
export default [
  {
    name: '🛍️ 본문에 두 번째 구매 버튼이 돌아온다',
    file: 'src/pages/GroupBuyDetailPage.tsx',
    find: "        {/* 🛍️ 2026-10-25 대표 확정 **E안**",
    replace: "        <button type=\"button\" onClick={() => handleJoin()}>구매하기</button>\n        {/* 🛍️ 2026-10-25 대표 확정 **E안**",
    test: T,
    why: '대표 지적 "구매하기 버튼이 2개가 동시에 있어" — 본문 버튼과 하단 바가 같이 서면 어느 것이 주 행동인지 안 읽힌다.',
  },
  {
    name: '🛍️ 하단 바가 구매 창을 안 연다',
    file: 'src/pages/group-buy/DealBottomBar.tsx',
    find: 'setOpen(true)',
    replace: 'setOpen(false)',
    test: T,
    why: '모바일에서 수량을 고를 자리가 사라진다(옵션 카드를 걷었으므로 창이 유일한 자리다).',
  },
]
