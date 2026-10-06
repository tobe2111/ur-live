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
const ROUTES = 'src/routes/seller.routes.tsx'
const APP = 'src/App.tsx'
const CSS = 'src/index.css'
const APPT = 'src/pages/SellerAppointmentsPage.tsx'
const LEDGER = 'src/pages/MyLedgerPage.tsx'
const RT = 'src/pages/SellerRealtimeDashboardPage.tsx'
const COUP = 'src/pages/SellerCouponsPage.tsx'

export default [
  {
    name: '💸 비셀러가 판매 코드를 다시 받는다 (게이트가 lazy 안으로)',
    file: GATE,
    // 🔁 2026-09-30 재조준: 조기 반환이 둘로 갈렸다 — 로딩 중엔 **자리를 예약**하고(밀림 수리),
    //   확정되면 종전처럼 `null`. 다이어트를 지키는 줄은 아래쪽 하나다.
    find: '  if (state.failed || state.stores.length === 0) return null',
    replace: '  void state.failed',
    test: TEST,
    why:
      'React.lazy 는 **렌더될 때** 받는다. 게이트가 없으면 판매를 안 하는 사람도 셀러 청크를 ' +
      '받는다 — 안에서 null 을 돌려줘도 이미 받은 뒤다. 실측으로 129KB + 83.8KB 가 걸려 있던 자리.',
  },
  {
    name: '🧳 시트 하나가 정적 import 로 돌아온다',
    file: SECTION,
    // 🔁 2026-10-01 철거 재조준: `OrdersSheet` 가 내려갔다 → 남은 시트로 앵커 교체(불변식 동일).
    find: "const WithdrawSheet = lazy(() => import('./seller-section/WithdrawSheet'))",
    replace: "import WithdrawSheet from './seller-section/WithdrawSheet'",
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
    find: '<div className="light-island ur-embed-sheet bg-white min-h-full">',
    replace: '<div className="ur-embed-sheet bg-white min-h-full">',
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
    // 🔁 2026-10-01 철거 재조준: 표가 돈 하나만 남았다 → 그 한 줄을 뺀다(출금의 PIN 되돌아오기를 잃는다).
    find: "  '/seller/settlements': 'withdraw',\n",
    replace: '',
    test: TEST,
    why: '표가 통째로 사라지면 눈에 띄지만, 한 줄만 빠지면 그 화면에서만 갈린다 — 아무도 못 찾는다.',
  },
  {
    // 🔁 2026-09-29 재조준(안 C): `매일`/`가끔` 그룹을 걷었다(48px 행이면 여덟 줄이 한눈에 들어온다).
    //   이제 지킬 불변식은 **판매 도구가 판 하나**라는 것이다 — 판이 파는 쪽 표시자이므로 둘이 되면 안 된다.
    name: '📋 판매 도구가 다시 판 둘로 쪼개진다 (표시자가 둘이 된다)',
    file: SECTION,
    // 🎯 2026-09-30 재조준: 앵커가 `ChartIcon`(매출 분석 줄)이었는데 그 줄이 오늘 카드로 옮겨갔다
    //   (대표 확정 ⑥ — 바로가기 넷). **지키던 것은 그대로다**: 판매 도구는 판 하나다.
    find: '        <ToolRow\n          icon={<WonCoinIcon',
    replace: '        </div>\n        <div className={LIST_PLATE_CLS}>\n        <ToolRow\n          icon={<WonCoinIcon',
    test: TEST,
    why:
      '대표 확정 구조 시안 A 의 요점이다 — 똑같은 줄 일곱은 무엇이 중요한지 한 마디도 안 하고, ' +
      '도구가 늘 때마다 그 덩어리가 길어진다.',
  },
  {
    name: '🕳️ 셀러 라우트가 App.tsx 로 돌아간다 (시트가 못 열고 마이를 튕겨낸다)',
    file: APP,
    find: '            {/* 🕳️ 2026-09-27: 셀러 라우트 셋(prospects · proxy-products · plus-friend-guide)을 아래',
    replace: '            <Route path="/seller/prospects" element={<div />} />\n            {/* x',
    test: TEST,
    why:
      '시트는 `SellerRoutes()` 를 렌더한다 — 그 표 밖 주소는 `*`(Escape)로 떨어져 **시트가 닫히고 ' +
      '마이가 통째로 그 주소로 떠난다.** 실제로 `/seller/prospects` 가 두 달 넘게 그 상태였고, ' +
      "라우트가 실재하니 대시보드에선 멀쩡해서 아무도 몰랐다.",
  },
  {
    name: '🕳️ 색인이 내주는 주소 하나가 라우트 표에서 사라진다',
    file: ROUTES,
    find: '      <Route path="/seller/prospects" element={<SellerProspectsPage />} />\n',
    replace: '',
    test: TEST,
    why:
      '표가 통째로 비면 눈에 띄지만 한 줄이 빠지면 그 도구를 누른 사람만 마이에서 쫓겨난다. ' +
      '이 검사는 목록을 손으로 적지 않고 색인과 표를 **파싱해 비교**한다 — 그게 이 구멍의 처방이다.',
  },
  {
    name: '💥 시트 안 크래시가 마이를 통째로 지운다 (바운더리 제거)',
    file: SHEET,
    find: '              <ErrorBoundary>',
    replace: '              <>',
    test: TEST,
    why: '바운더리가 마이 위에만 있으면 한 화면의 throw 가 마이 전체를 하얗게 만든다. 41개 화면이 걸려 있다.',
  },
  {
    name: '📐 시트가 높이 스코프 클래스를 잃는다 (헛스크롤 복귀)',
    file: SHEET,
    find: 'className="light-island ur-embed-sheet bg-white min-h-full"',
    replace: 'className="light-island bg-white min-h-full"',
    test: TEST,
    why:
      '대시보드 화면 다수가 로딩·에러를 `min-h-screen` 으로 **SellerLayout 밖에서** 조기 반환한다. ' +
      '클래스가 없으면 86dvh 시트 안에 100vh 상자가 들어간다 — 실측 폰 800px·PC 900px 에 헛스크롤.',
  },
  {
    name: '📐 화면높이 유틸 하나만 빠진다 (그 유틸을 쓰는 화면만 조용히 깨진다)',
    file: CSS,
    find: '.ur-embed-sheet .h-screen,\n',
    replace: '',
    test: TEST,
    why: '네 유틸이 같은 일을 한다 — 하나만 빠뜨리면 그걸 쓰는 화면에서만 헛스크롤이 남고 나머지는 멀쩡하다.',
  },
  {
    name: '📐 되돌린 값이 100% 가 된다 (스크롤은 없어지지만 상자가 찌그러진다)',
    file: CSS,
    find: '.ur-embed-sheet .h-\\[100dvh\\] { min-height: 60dvh; height: auto; }',
    replace: '.ur-embed-sheet .h-\\[100dvh\\] { min-height: 100%; height: auto; }',
    test: TEST,
    why:
      '실측: 부모가 `min-h-full`(min-height 뿐)이라 퍼센트가 확정 높이에 기대지 못해 상자가 **24px 로 ' +
      '찌그러진다** — 헛스크롤은 사라지는데 스피너가 가운데를 잃는다. "스크롤 없음" 만 보면 통과처럼 보인다.',
  },
  {
    name: '📐 되돌린 값이 시트보다 커진다 (헛스크롤 그대로)',
    file: CSS,
    find: 'min-height: 60dvh; height: auto; }',
    replace: 'min-height: 95dvh; height: auto; }',
    test: TEST,
    why: '규칙은 있는데 값이 시트(86dvh − 머리 56px)보다 커서 아무것도 안 고친다 — 가장 찾기 어려운 모양이다.',
  },
  {
    name: '📱 예약 표가 폰에 그대로 돌아온다 (행 91px)',
    file: APPT,
    find: '<table className="hidden lg:table w-full text-sm">',
    replace: '<table className="w-full text-sm">',
    test: TEST,
    why:
      '실측(366px 시트 폭): 5열 표는 **잘리지는 않지만** 폭의 44%가 칸 패딩(5열×px-4=160px)이라 ' +
      '칸이 55~68px 로 눌리고 한 행이 91px 로 부푼다. 잘리지 않으니 아무도 신고하지 않는 종류다.',
  },
  {
    name: '📱 예약 폰 카드에서 처리 버튼이 사라진다 (표시만 되고 일을 못 한다)',
    file: APPT,
    find: '                        <button onClick={() => markComplete(a)} className="ur-btn ur-btn-sm ur-btn-primary flex-1 gap-1">',
    replace: '                        <button className="ur-btn ur-btn-sm ur-btn-primary flex-1 gap-1">',
    test: TEST,
    why: '카드가 표를 대신하는데 처리가 표에만 남으면, 폰 사용자는 예약을 보기만 하고 완료/노쇼를 못 한다.',
  },
  {
    name: '📱 원장 표가 폰에 그대로 돌아온다',
    file: LEDGER,
    find: '<table className="hidden lg:table w-full text-[12px]">',
    replace: '<table className="w-full text-xs">',
    test: TEST,
    why: "실측 행 81px + '정산 기간'·'TX ID' 가 여러 줄로 감긴다. 표=PC / 카드=폰 은 이 레포가 이미 쓰는 방식이다.",
  },
  {
    name: '📱 통계 타일이 폰에서도 3열로 돌아간다 (금액이 4줄로 감긴다)',
    file: RT,
    find: '<div className="grid grid-cols-1 sm:grid-cols-3 gap-3">',
    replace: '<div className="grid grid-cols-3 gap-3">',
    test: TEST,
    why:
      '실측: 3열이면 타일 114px · 내용 폭 82px 인데 `--dash-stat`(22px) 의 "1,284,000원" 은 약 145px 다 ' +
      '→ 숫자가 4줄로 감겨 타일 높이가 161px. 글자를 줄여도 안 된다(12px 이하여야 들어간다).',
  },
  {
    name: '📱 쿠폰 폼 한 줄만 3열로 돌아간다 (나머지가 조용히 잘린다)',
    file: COUP,
    find: '<div className="grid grid-cols-1 sm:grid-cols-3 gap-3">\n              <select value={form.type}',
    replace: '<div className="grid grid-cols-3 gap-3">\n              <select value={form.type}',
    test: TEST,
    why:
      '두 줄 중 한 줄만 되돌리는 모양 — 실측 114px 필드에서 placeholder("최소 주문 금액")가 잘린다. ' +
      '넘치지 않으므로 화면은 멀쩡해 보이고 사용자는 무슨 칸인지 모른다.',
  },
]
