/**
 * 📱 셀러 모바일 결함 4건 (2026-09-15, 대표 신고) — 주입 매니페스트.
 * 가드: src/tests/unit/seller-mobile-fixes-2026-09-15.test.ts
 */
const TEST = 'src/tests/unit/seller-mobile-fixes-2026-09-15.test.ts'

export default [
  {
    name: '📱 하단 바가 사라져도 body 신호를 안 끈다 (다음 페이지 FAB 이 떠 있다)',
    file: 'src/components/seller-layout/SellerBottomBar.tsx',
    find: "    return () => { document.body.classList.remove('seller-has-bottom-bar') }",
    replace: '    return () => { /* noop */ }',
    test: TEST,
    why: '전역 클래스가 남아 바가 없는 페이지에서도 FAB 이 올라간 채 떠 있다.',
  },
  {
    name: '📱 CSS 숫자가 바 높이 상수와 갈린다 (다시 겹친다)',
    file: 'src/index.css',
    find: '  body.seller-has-bottom-bar .seller-chat-fab { bottom: calc(env(safe-area-inset-bottom) + 64px + 12px); }',
    replace: '  body.seller-has-bottom-bar .seller-chat-fab { bottom: calc(env(safe-area-inset-bottom) + 40px + 12px); }',
    test: TEST,
    why: '이 레포가 반복해 당한 "두 곳에 같은 숫자" — 한쪽만 바뀌면 에러 없이 조용히 겹친다.',
  },
  {
    name: '📱 이용권이 0건인데도 고정 바를 그린다 (등록 버튼 둘)',
    file: 'src/pages/SellerGroupBuyPage.tsx',
    find: '        {products.length > 0 && (\n          <SellerBottomBar>',
    replace: '        {true && (\n          <SellerBottomBar>',
    test: TEST,
    why: '빈 상태 카드가 이미 같은 버튼을 세우고 있어 한 화면에 [이용권 등록]이 둘이 된다.',
  },
]
