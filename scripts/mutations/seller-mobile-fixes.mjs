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
    name: '📱 상담 FAB 이 되살아난다 (바 높이만큼 올리는 규칙 없이)',
    file: 'src/index.css',
    // 2026-10-14 재조준: FAB 은 2026-10-12 대시보드 삭제로 요소째 사라졌고 죽은 CSS 도 지웠다.
    //   지키려던 것(바와 FAB 이 겹치지 않는다)은 이제 "FAB 이 없다" 로 성립한다.
    find: '@tailwind base;',
    replace: '@tailwind base;\n.seller-chat-fab { position: fixed; bottom: 12px; }',
    test: TEST,
    why: '바 높이만큼 올리는 규칙 없이 FAB 이 되살아나면 하단 고정 바와 다시 겹친다.',
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
