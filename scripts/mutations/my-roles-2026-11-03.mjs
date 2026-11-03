/** 🧬 주입 — 마이 역할 표시 (2026-11-03) */
const T = 'src/tests/unit/my-roles-2026-11-03.test.ts'
const P = 'src/pages/UserProfilePage.tsx'
export default [
  { name: '마이역할 — 에이전시 줄 선이 다시 생긴다', file: 'src/pages/agency-console/AgencyStoresPanel.tsx', find: "${last ? '' : 'border-b border-rule last:border-b-0'}", replace: "${last ? '' : 'border-b border-rule'}", test: T, why: '에이전시 운영 줄에만 선이 남아 한 화면에 두 모양(대표 지적).' },
  { name: '마이역할 — 에이전시 로그인 줄이 늘 뜬다', file: P, find: '{showMe && !agencyPresence.on && (', replace: '{showMe && (', test: T, why: '이미 에이전시로 로그인했는데 로그인하라는 줄이 보인다.' },
  { name: '마이역할 — 조회 중에도 사장님 칩', file: P, find: '{!sellerSeats.loading && sellerSeats.stores.length > 0 && (', replace: '{sellerSeats.stores.length >= 0 && (', test: T, why: '가게가 없는 사람에게도 사장님 · 매장 0곳이 뜬다.' },
  { name: '마이역할 — 사장님 입구 옛 이름', file: 'src/pages/user-profile/RoleCtaGrid.tsx', find: "defaultValue: '내 가게 이용권 팔기'", replace: "defaultValue: '내 가게 등록'", test: T, why: '사장님 입구가 무엇을 하는지 안 드러난다.' },
]
