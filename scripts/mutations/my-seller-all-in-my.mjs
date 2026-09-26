/**
 * 🏪 마이에서 전부 + 청크 다이어트 (2026-09-26) — 주입 매니페스트.
 * 가드: src/tests/unit/my-seller-all-in-my-2026-09-26.test.ts
 */
const TEST = 'src/tests/unit/my-seller-all-in-my-2026-09-26.test.ts'
const GATE = 'src/pages/user-profile/SellerSectionLazy.tsx'
const SECTION = 'src/pages/user-profile/SellerSection.tsx'
const LAYOUT = 'src/components/SellerLayout.tsx'
const EMBED = 'src/shared/seller-embed.tsx'
const SHEET = 'src/pages/user-profile/seller-section/ToolPageSheet.tsx'
const MAP = 'src/pages/user-profile/seller-section/tool-pages.ts'
const ALL = 'src/pages/user-profile/seller-section/AllToolsSheet.tsx'
const VITE = 'vite.config.ts'

export default [
  {
    name: '💸 비셀러가 판매 코드를 다시 받는다 (게이트가 lazy 안으로)',
    file: GATE,
    find: '  if (state.loading || state.failed || state.stores.length === 0) return null',
    replace: '  void state',
    test: TEST,
    why:
      'React.lazy 는 **렌더될 때** 받는다. 게이트가 없으면 판매를 안 하는 사람도 셀러 청크를 ' +
      '받는다 — 안에서 null 을 돌려줘도 이미 받은 뒤다. 실측으로 129KB + 83.8KB 가 걸려 있던 자리.',
  },
  {
    name: '🧳 시트 하나가 정적 import 로 돌아온다',
    file: SECTION,
    find: "const OrdersSheet = lazy(() => import('./seller-section/OrdersSheet'))",
    replace: "import OrdersSheet from './seller-section/OrdersSheet'",
    test: TEST,
    why: '한 줄만 정적으로 돌아와도 그 시트와 그 폐쇄가 마이 청크로 되돌아온다(조용히).',
  },
  {
    name: '🪟 시트 안에 대시보드 껍데기가 통째로 들어간다',
    file: LAYOUT,
    // 🔁 2026-09-26: 조기 반환이 fragment → 스코프 있는 div 로 바뀌었다. 불변식은 그대로다 —
    //   **컨텍스트를 읽어 껍데기를 건너뛴다**.
    find: '  if (bare || embedded) {',
    replace: '  if (bare) {',
    test: TEST,
    why:
      '컨텍스트를 안 읽으면 페이지마다 prop 을 뚫어야 하고, 41개 중 몇은 반드시 빠진다. ' +
      '빠진 화면이 시트에서 열리면 85dvh 안에 사이드바와 하단 탭이 통째로 들어간다.',
  },
  {
    name: '🔓 임베드 신호가 토큰을 읽는다 ("시트로 열면 통과되는 문")',
    file: EMBED,
    find: 'export function useSellerEmbedded(): boolean {\n  return useContext(SellerEmbedContext)',
    replace: 'export function useSellerEmbedded(): boolean {\n  if (localStorage.getItem("seller_token")) return true\n  return useContext(SellerEmbedContext)',
    test: TEST,
    why:
      '이 값은 **껍데기를 그릴까**만 정한다. 여기에 권한 판단이 들어오면 시트로 여는 것만으로 ' +
      '할 수 있는 일이 늘어난다 — 서버가 못 보는 신호라 더 위험하다.',
  },
  {
    name: '🌓 다크에서 흰 폼 위에 흰 글자 (라이트 섬 제거)',
    file: SHEET,
    find: '<div className="light-island bg-white min-h-full">',
    replace: '<div className="bg-white min-h-full">',
    test: TEST,
    why:
      '대시보드 화면은 규칙상 `dark:` 가 금지돼 있다. 전역 `.dark input`(특이도 0,5,1)이 ' +
      '이기므로 마이 다크에서 입력 글자가 안 보인다 — 2026-09-03 지도 검색창과 같은 사고다.',
  },
  {
    // 🔁 2026-09-26 재조준: 로딩을 라우트 표가 맡아 `lazy` 함정이 사라졌고, **같은 클래스의**
    //   새 함정이 그 자리에 생겼다(렌더 중 부모 setState).
    name: '🔁 안쪽 위치 보고가 렌더마다 부모를 흔든다 (무한 렌더)',
    file: SHEET,
    find: '  if (last.current !== deeper) { last.current = deeper; onDepth(deeper) }',
    replace: '  onDepth(deeper)',
    test: TEST,
    why: '렌더마다 부모 setState → 재렌더 → 또 호출. 화면이 멈추고 배터리를 태운다.',
  },
  {
    // 🔁 2026-09-26 재조준: 손으로 적은 지도를 버렸다. 지키는 것은 **더 커졌다** —
    //   라우트 표를 안 펼치면 화면 하나가 아니라 **전부** 안 열린다.
    name: '🗺️ 시트가 라우트 표를 안 펼친다 (모든 도구가 빈 화면)',
    file: SHEET,
    find: '                {SellerRoutes()}',
    replace: '                {null}',
    test: TEST,
    why:
      'import 만 보는 검사는 렌더를 지워도 초록이다 — 이 레포가 반복해 당한 클래스라 호출 형태로 앵커한다. ' +
      '전체 도구에서 무엇을 눌러도 빈 시트가 뜬다.',
  },
  {
    name: '🌐 안쪽 이동이 주소창을 바꾼다 (마이가 통째로 떠난다)',
    file: SHEET,
    find: '          <MemoryRouter initialEntries={[path]}>',
    replace: '          <BrowserRouter>',
    test: TEST,
    why:
      '시트 안 목록에서 수정 화면으로 갈 때 바깥 라우터가 움직이면 마이가 언마운트된다 — ' +
      '고치려고 연 시트가 사라진다. 그걸 막으려고 메모리 라우터를 쓴다.',
  },
  {
    name: '🚪 셀러 밖 주소가 빈 화면이 된다 (탈출구 제거)',
    file: SHEET,
    find: '                <Route path="*" element={<Escape onLeave={onLeave} />} />',
    replace: '',
    test: TEST,
    why:
      "메모리 라우터엔 `/` 나 `/u/me` 가 없다. 안쪽 화면이 거길 가리키면 아무것도 안 그려지고, " +
      '사장님은 시트가 고장 난 줄 안다(에러도 안 난다).',
  },
  {
    name: '↩️ 한 단계 들어가면 되돌아올 길이 없어진다',
    file: SHEET,
    find: '    <Sheet title={title} onClose={onClose} onBack={deeper ? back : undefined} tall>',
    replace: '    <Sheet title={title} onClose={onClose} tall>',
    test: TEST,
    why:
      '목록 → 수정 으로 들어간 뒤 되돌아올 길이 X(시트 통째로 닫기)뿐이면, 고치다 만 사람이 ' +
      '목록으로 못 돌아온다. 브라우저 뒤로가기는 일부러 시트를 닫게 해 뒀다(칸을 하나만 쌓는다).',
  },
  {
    name: '🤫 제외 사유를 비운다 (다음 세션이 판단할 수 없다)',
    file: MAP,
    // 🩸 2026-09-26: 첫 판은 첫 문장만 잘라서 **뒤 문장이 남아** 20자를 넘겼다(주입이 헛돌았다).
    //   값 전체를 비워야 "이유 없는 제외" 를 재현한다.
    find: "  '/seller/scan':\n    '카메라다.",
    replace: "  '/seller/scan':\n    '',//",
    test: TEST,
    why: '이유 없는 제외 목록은 곧 "왜 없지?" 가 되고, 그다음엔 근거 없이 늘어난다.',
  },
  {
    name: '🧲 판정을 SellerSection 이 다시 한다 (시트 봉투가 정적으로 붙는다)',
    file: SECTION,
    find: "import PendingOrders from './seller-section/PendingOrders'",
    replace: "import PendingOrders from './seller-section/PendingOrders'\nimport { canOpenInSheet } from './seller-section/tool-pages'",
    test: TEST,
    why:
      '같은 판정이 두 곳에 있으면 반드시 갈린다 — 시트는 "열 수 있다" 고 보고 호출부는 "없다" 고 보는 날이 온다. ' +
      '판정은 목록을 그리는 쪽(AllToolsSheet)이 해서 넘긴다.',
  },
  {
    name: '📦 나브 색인이 다시 셀러 껍데기 봉투로 (목록 한 장에 83.8KB)',
    file: VITE,
    find: "          if (id.includes('/src/components/seller/seller-nav')) return 'app-seller-nav'",
    replace: "          if (id.includes('/src/components/seller/seller-nav-XX')) return 'app-seller-nav'",
    test: TEST,
    why:
      '순수 색인이 역할 봉투 안에 있으면, 그걸 읽는 쪽이 StoreRegisterModal·SellerLayout·' +
      'BulkUploadModal 까지 통째로 끌고 온다(이 레포가 이미 네 번 밟은 함정).',
  },
  {
    name: '🚪 나가는 도구를 표시하지 않는다',
    file: ALL,
    find: '                    {leaves\n                      ? <ExternalLink',
    replace: '                    {false\n                      ? <ExternalLink',
    test: TEST,
    why: '무엇이 화면을 바꾸는지 누르기 전에 알려 주지 않으면 사장님은 앱이 튕겼다고 느낀다.',
  },
  {
    name: '🔗 UserProfilePage 가 게이트를 우회한다',
    file: 'src/pages/UserProfilePage.tsx',
    find: "import SellerSection from './user-profile/SellerSectionLazy'",
    replace: "import SellerSection from './user-profile/SellerSection'",
    test: TEST,
    why: '게이트를 건너뛰면 다이어트가 통째로 사라진다 — 화면은 똑같이 보여서 눈으로는 못 잡는다.',
  },
  {
    name: '🚪 같은 일에 문이 다시 둘이 된다 (전체 도구가 대시보드 화면을 연다)',
    file: SECTION,
    find: '            const covered = COVERED_BY_SHEET[path]\n            if (covered) { setTool(covered); return }',
    replace: '            void COVERED_BY_SHEET',
    test: TEST,
    why:
      '묶음 줄은 손수 만든 폰 시트를, 전체 도구는 같은 일의 대시보드 화면을 열게 된다 — 일곱 개 전부. ' +
      '어느 문으로 들어왔느냐에 따라 "주문" 이 다른 화면으로 뜨고, 버그가 오면 한쪽만 고친다.',
  },
  {
    name: '🚪 덮는 표에서 한 줄이 빠진다 (그 일만 조용히 두 화면)',
    file: SECTION,
    find: "  '/seller/analytics': 'analytics',\n",
    replace: '',
    test: TEST,
    why: '표가 통째로 사라지면 눈에 띄지만, 한 줄만 빠지면 그 화면에서만 갈린다 — 아무도 못 찾는다.',
  },
  {
    name: '📋 일곱 줄이 다시 한 덩어리가 된다 (무엇이 매일인지 안 보인다)',
    file: SECTION,
    find: '      <GroupLabel>가끔</GroupLabel>\n',
    replace: '',
    test: TEST,
    why:
      '대표 확정 구조 시안 A 의 요점이다 — 똑같은 줄 일곱은 무엇이 중요한지 한 마디도 안 하고, ' +
      '도구가 늘 때마다 그 덩어리가 길어진다.',
  },
]
