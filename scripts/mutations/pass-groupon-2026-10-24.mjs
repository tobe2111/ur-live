// 🛍️ 2026-10-24 이용권 상세 그루폰식 — 옵션 카드가 같은 구매 창을 연다
export default [
  {
    name: '🛍️ 옵션 카드 구매하기가 결제를 직접 부른다(딜 칸 없는 두 번째 결제 경로)',
    file: 'src/pages/GroupBuyDetailPage.tsx',
    find: 'onOpen={() => setBuyOpen(n => n + 1)}',
    replace: 'onOpen={() => handleJoin()}',
    test: 'src/tests/unit/pass-groupon-2026-10-24.test.ts',
    why: '본문 구매 버튼과 하단 바가 다른 결제 경로를 타면 딜 사용 칸·수량 확인이 한쪽에서 빠진다.',
  },
  {
    name: '🛍️ 하단 바가 옵션 카드의 열기 요청을 무시한다',
    file: 'src/pages/group-buy/DealBottomBar.tsx',
    find: 'if (openRequest > 0 && isJoinable && !isPrelaunch && !isOwner) setOpen(true)',
    replace: 'if (false) setOpen(true)',
    test: 'src/tests/unit/pass-groupon-2026-10-24.test.ts',
    why: '본문 구매 버튼과 하단 바가 다른 결제 경로를 타면 딜 사용 칸·수량 확인이 한쪽에서 빠진다.',
  },
  {
    name: '🛍️ 주인에게도 옵션 카드가 뜬다',
    file: 'src/pages/GroupBuyDetailPage.tsx',
    find: '{!isOwnProduct && !isPrelaunch && <PassOptionCard ',
    replace: '{!isPrelaunch && <PassOptionCard ',
    test: 'src/tests/unit/pass-groupon-2026-10-24.test.ts',
    why: '본문 구매 버튼과 하단 바가 다른 결제 경로를 타면 딜 사용 칸·수량 확인이 한쪽에서 빠진다.',
  },
]
