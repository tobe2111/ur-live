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
    find: '  if (bare || embedded) return <>{children}</>',
    replace: '  if (bare) return <>{children}</>',
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
    name: '🔁 lazy 를 렌더마다 새로 만든다 (입력하던 글자가 사라진다)',
    file: SHEET,
    find: '  const Page = useMemo(() => {\n    const load = TOOL_PAGES[path]\n    return load ? lazy(load) : null\n  }, [path])',
    replace: '  const load = TOOL_PAGES[path]\n  const Page = load ? lazy(load) : null',
    test: TEST,
    why: '매 렌더 새 컴포넌트 타입이 나오면 React 가 트리를 통째로 다시 마운트한다.',
  },
  {
    name: '🗺️ 지도에서 화면 하나가 빠진다 (눌러도 안 열림 · 조용히)',
    file: MAP,
    find: "  '/seller/reviews': () => import('@/pages/SellerReviewsPage'),\n",
    replace: '',
    test: TEST,
    why:
      '나브 색인엔 있는데 지도엔 없으면 "전체 도구에서 눌렀는데 시트가 안 열리는 화면" 이 된다. ' +
      '에러도 안 나므로 아무도 신고하지 않는다.',
  },
  {
    name: '🤫 제외 사유를 비운다 (다음 세션이 판단할 수 없다)',
    file: MAP,
    // 🩸 2026-09-26: 첫 판은 첫 문장만 잘라서 **뒤 문장이 남아** 20자를 넘겼다(주입이 헛돌았다).
    //   값 전체를 비워야 "이유 없는 제외" 를 재현한다.
    find: "  '/seller/scan':\n    '카메라를 쓴다. QR 을 손님 앞에서 찍는 화면이라 85dvh 시트 안에서 뷰파인더가 잘린다 — ' +\n    '마이는 이미 전용 전체화면(/store/scan)으로 보낸다.',",
    replace: "  '/seller/scan': '',",
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
      '지도를 정적으로 읽으면 그 지도가 참조하는 시트들이 **정적 의존**이 되어 lazy 가 무의미해진다. ' +
      '그리고 같은 판정이 두 곳에 있으면 반드시 갈린다.',
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
]
