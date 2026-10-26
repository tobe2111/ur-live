/** 🧬 주입 — 에이전시 화면이 마이 안으로(2026-10-26 안 A). 가드: src/tests/unit/agency-in-my-2026-10-26.test.tsx */
const T = 'src/tests/unit/agency-in-my-2026-10-26.test.tsx'
export default [
  {
    name: '에이전시→마이 — /agency 가 깊은 링크를 버린다',
    file: 'src/pages/agency-console/AgencyHomePage.tsx',
    find: '  return <Navigate to={agencyMyPath(tool)} replace />',
    replace: '  return <Navigate to={agencyMyPath(null)} replace />',
    test: T,
    why: '알림·메일 링크를 눌러도 그 화면이 안 열린다 — 직원이 매장을 다시 찾아야 한다. 에러 0.',
  },
  {
    name: '에이전시→마이 — 판이 ?tool= 을 읽는다(사장님 판과 다툼)',
    file: 'src/pages/agency-console/AgencySection.tsx',
    find: '            toolParam={AGENCY_TOOL_PARAM}\n',
    replace: '',
    test: T,
    why: '사장님 겸 에이전시 직원의 마이에서 두 판이 같은 화면을 동시에 연다.',
  },
  {
    name: '에이전시→마이 — 폰 마이에서 구역이 빠진다',
    file: 'src/pages/UserProfilePage.tsx',
    find: '      <SellerSection state={sellerSeats} />\n      <MyAgencyZone />\n',
    replace: '      <SellerSection state={sellerSeats} />\n',
    test: T,
    why: '카카오로 로그인한 에이전시 직원이 폰에서 에이전시 화면을 찾을 길이 없다.',
  },
  {
    name: '에이전시→마이 — 거울 토큰 이름이 갈린다',
    file: 'src/pages/user-profile/MyAgencyZone.tsx',
    find: "const AGENCY_TOKEN_KEY_MIRROR = 'agency_console_token'",
    replace: "const AGENCY_TOKEN_KEY_MIRROR = 'agency_token'",
    test: T,
    why: '로그인돼 있어도 구역이 조용히 안 뜬다.',
  },
]
