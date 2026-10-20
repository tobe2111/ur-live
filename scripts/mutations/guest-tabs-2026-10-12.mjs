/**
 * 🧬 주입 — 로그인 전 탭 화면(2026-10-12 대표 확정 시안)
 */
const T = 'src/tests/unit/guest-tabs-2026-10-12.test.tsx'
export default [
  {
    name: '게스트탭 — 보호 라우트가 guest 를 무시하고 로그인으로 보낸다',
    file: 'src/components/auth/RouteGuards.tsx',
    find: 'if (guest !== undefined) return <>{guest}</>',
    replace: 'void guest',
    test: T,
    why: '탭을 누르면 다시 곧장 로그인 화면이 된다 — 대표가 신고한 바로 그 증상.',
  },
  {
    name: '게스트탭 — 로그인한 사람에게도 게스트 화면(판정 순서 뒤집기)',
    file: 'src/components/auth/RouteGuards.tsx',
    find: "  if (isKorea()) {\n    if (isUserLoggedIn()) {",
    replace: "  if (isKorea()) {\n    if (guest !== undefined) return <>{guest}</>\n    if (isUserLoggedIn()) {",
    test: T,
    why: '로그인했는데 내 지갑 대신 홍보 화면이 뜬다.',
  },
  {
    name: '게스트탭 — 이용권 탭에서 게스트 화면을 뺀다',
    file: 'src/App.tsx',
    find: '<ProtectedRoute requireUser guest={<GuestPassPage />}>',
    replace: '<ProtectedRoute requireUser>',
    test: T,
    why: '이용권 탭만 로그인 벽으로 돌아간다(세 탭 중 하나만 빠져도 에러가 없다).',
  },
  {
    name: '게스트탭 — 마이 카카오 버튼이 다른 탭으로 돌아간다',
    file: 'src/pages/guest/GuestMyPage.tsx',
    find: '<GuestKakaoButton returnPath="/user/profile"',
    replace: '<GuestKakaoButton returnPath="/"',
    test: T,
    why: '로그인했는데 홈으로 떨어져 마이를 다시 눌러야 한다.',
  },
  {
    name: '게스트탭 — 복귀 주소를 거르지 않고 그대로 싣는다',
    file: 'src/pages/guest/guest-login.ts',
    find: "const redirect = safeInternalPath(returnPath, '/')",
    replace: 'const redirect = returnPath',
    test: T,
    why: '오픈 리다이렉트 방어(safeInternalPath SSOT)를 우회한다.',
  },
  {
    name: '게스트탭 — 꺼진 혜택(소개비)을 약속한다',
    file: 'src/pages/guest/GuestUrShopPage.tsx',
    find: "defaultValue: '매장과 협업하면 판매 수익'",
    replace: "defaultValue: '팔리면 소개비'",
    test: T,
    why: '담기(소개) 커미션은 꺼져 있다 — 화면이 거짓말을 한다.',
  },
  {
    name: '게스트탭 — 카톡 준비가 첫 주소를 계속 돌려준다',
    file: 'src/lib/kakao-talk-login.ts',
    find: 'if (preparing && preparedFor === key) return preparing',
    replace: 'if (preparing) return preparing',
    test: T,
    why: '이용권 탭에서 준비한 표가 유어샵 탭 버튼에 쓰여 로그인 뒤 엉뚱한 탭으로 간다.',
  },
]
