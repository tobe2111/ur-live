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
    // 🔁 2026-11-02 재조준(통합 시안 v2) — 구역이 '내 가게' 매장을 알고 붙는다(ownSellerIds).
    // 🔁 2026-11-02 재조준(안 1 탭) — 폰 마이가 `나 | 에이전시` 탭으로 갈려 게이트(`showMe`/`showAgency`)가 끼었다. 불변식 그대로.
    // 🔁 2026-11-03 재조준(안 1 다듬기 — 에이전시 탭 머리·'매장/에이전시 정산' 이름). 불변식 그대로.
    find: '        <SellerSection state={sellerSeats} />\n        <MyAgencyZone ownSellerIds={ownSellerIds} inHead={tabbed} />\n',
    replace: '        <SellerSection state={sellerSeats} />\n        {null}\n',
    test: T,
    why: '카카오로 로그인한 에이전시 직원이 폰에서 에이전시 화면을 찾을 길이 없다.',
  },
  {
    name: '에이전시→마이 — 거울 토큰 이름이 갈린다',
    file: 'src/lib/agency-presence.ts',
    find: "export const AGENCY_TOKEN_KEY_MIRROR = 'agency_console_token'",
    replace: "export const AGENCY_TOKEN_KEY_MIRROR = 'agency_token'",
    test: T,
    why: '로그인돼 있어도 구역이 조용히 안 뜬다.',
  },
]
