/**
 * 📱 셀러 모바일 결함 4건 (2026-09-15, 대표 신고) — 주입 매니페스트.
 * 가드: src/tests/unit/seller-mobile-fixes-2026-09-15.test.ts
 */
const TEST = 'src/tests/unit/seller-mobile-fixes-2026-09-15.test.ts'

export default [
  {
    name: '📱 매장 목록이 좌석 판정을 다시 기다린다 (스피너 복귀)',
    file: 'src/pages/seller-page/MyStoresPanel.tsx',
    find: '  const loading = stores === null || (registered.length === 0 && seatReady === undefined)',
    replace: '  const loading = stores === null',
    test: TEST,
    why: '목록이 손에 있는데 좌석 프리필이 느리면 그동안 스피너다 — 대표가 신고한 바로 그 증상.',
  },
  {
    name: "📱 '판정 중'과 '판정 실패'를 다시 뭉갠다 (게이트 깜빡임)",
    file: 'src/pages/seller-page/MyStoresPanel.tsx',
    find: '  const [seatReady, setSeatReady] = useState<boolean | null | undefined>(undefined)',
    replace: '  const [seatReady, setSeatReady] = useState<boolean | null>(null)',
    test: TEST,
    why: '둘이 같은 값이면 "아직 모른다" 를 "실패했다" 로 읽어 STEP 1 게이트가 떴다 사라진다.',
  },
  {
    name: '📱 매장 목록 조회 실패가 스피너에 갇힌다',
    file: 'src/pages/seller-page/MyStoresPanel.tsx',
    find: '      .catch(() => setStores([]))',
    replace: '',
    test: TEST,
    why: 'catch 가 없으면 거절 시 stores 가 null 로 남아 영원히 로딩이다 — 15초 timeout 도 못 구한다.',
  },
  {
    name: '📱 폰 홈에서 매장 블록을 다시 숨긴다 (대표 신고 재현)',
    file: 'src/pages/SellerPage.tsx',
    find: '            <MyStoresPanel onGateChange={onGateChange} />',
    replace: '            <MyStoresPanel onGateChange={onGateChange} gateOnly={!isPc} />',
    test: TEST,
    why: '폰 홈에 매장을 보거나 추가할 길이 한 곳도 없어진다 — 더보기까지 들어가야 한다.',
  },
  {
    name: '📱 내 매장 카드에서 관리로 가는 길을 끊는다',
    file: 'src/pages/seller-page/MyStoresPanel.tsx',
    find: '          to="/seller/stores"',
    replace: '          to="/seller"',
    test: TEST,
    why: '위임·삭제·이관이 다시 더보기 뒤로 숨는다.',
  },
  {
    name: '📱 상담 FAB 을 다시 고정 96px 에 박는다 (하단 바와 충돌)',
    file: 'src/components/SellerLayout.tsx',
    find: 'className="seller-chat-fab fixed md:bottom-4 right-4',
    replace: 'className="seller-chat-fab fixed bottom-24 md:bottom-4 right-4',
    test: TEST,
    why: 'Tailwind 고정값이 CSS 를 이겨 60~124px 의 하단 바와 96~136px 의 FAB 이 다시 겹친다.',
  },
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
    find: '  body.seller-has-bottom-bar .seller-chat-fab { bottom: calc(60px + env(safe-area-inset-bottom) + 64px + 12px); }',
    replace: '  body.seller-has-bottom-bar .seller-chat-fab { bottom: calc(60px + env(safe-area-inset-bottom) + 40px + 12px); }',
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
