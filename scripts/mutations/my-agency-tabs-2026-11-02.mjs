/** 🧬 주입 — 마이 `나 | 에이전시` 탭(2026-11-02 안 1 + 에이전시 기본). 가드: src/tests/unit/my-agency-tabs-2026-11-02.test.tsx */
const TEST = 'src/tests/unit/my-agency-tabs-2026-11-02.test.tsx'
const PAGE = 'src/pages/UserProfilePage.tsx'
export default [
  {
    name: '🗂️ 탭 — 기본이 에이전시가 아니다',
    file: 'src/pages/user-profile/MyRoleTabs.tsx',
    find: "export const MY_TAB_DEFAULT: MyTab = 'agency'",
    replace: "export const MY_TAB_DEFAULT: MyTab = 'me'",
    test: TEST,
    why: '대표 확정 "에이전시 화면을 기본으로" 가 깨진다.',
  },
  {
    name: '🗂️ 탭 — PC·비에이전시에서도 탭이 선다(손님 화면이 반쪽이 된다)',
    file: PAGE,
    find: 'const tabbed = !isPc && agencyPresence.on',
    replace: 'const tabbed = !isPc',
    test: TEST,
    why: '에이전시가 아닌 손님도 기본 "에이전시" 탭에 갇혀 자기 이용권·설정이 안 보인다.',
  },
  {
    name: '🗂️ 탭 — 손님 목록이 에이전시 탭에도 선다(다시 섞인다)',
    file: PAGE,
    find: '      {showMe && <ShoppingGroup counts={counts} />}',
    replace: '      <ShoppingGroup counts={counts} />',
    test: TEST,
    why: '대표가 "어지러워" 라고 한 손님/에이전시 섞임이 되살아난다.',
  },
  {
    name: '🗂️ 탭 — 에이전시 것이 나 탭에도 선다',
    file: PAGE,
    find: '      {showAgency && <>\n',
    replace: '      {true && <>\n',
    test: TEST,
    why: '나 탭에 매장 판·에이전시 구역이 그대로 남아 분리가 무의미해진다.',
  },
]
