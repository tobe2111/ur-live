/**
 * 🚪 셀러 대시보드 제거 3단계 — 에이전시 직원 깊은 링크 → 콘솔 시트 (2026-10-12) — 주입 매니페스트.
 * 가드: src/tests/unit/agency-deep-link-2026-10-12.test.tsx
 *
 * 전부 에러가 안 나는 결함이다 — 화면이 오가며 깜빡이거나, 남의 좌석으로 열리거나, 옛 대시보드가 그대로 뜬다.
 */
const TEST = 'src/tests/unit/agency-deep-link-2026-10-12.test.tsx'
const LIB = 'src/lib/seller-deep-link.ts'
const LAYOUT = 'src/components/SellerLayout.tsx'
const PANEL = 'src/pages/agency-console/AgencyStoresPanel.tsx'
const PLATE = 'src/pages/agency-console/AgencyStorePlate.tsx'

export default [
  {
    name: '[에이전시링크] dash=1 을 무시한다 (콘솔 ↔ 대시보드 무한 왕복)',
    file: LIB,
    find: "  if (new URLSearchParams(search).get(DASH_PARAM) === '1') return null\n",
    replace: '\n',
    test: TEST,
    why: '콘솔이 못 열어 되돌린 주소를 껍데기가 또 콘솔로 보내면 화면이 끝없이 오간다.',
  },
  {
    name: '[에이전시링크] 콘솔 로그인이 없어도 보낸다 (로그인 화면에서 링크를 잃는다)',
    file: LIB,
    find: '    return !!(localStorage.getItem(AGENCY_CONSOLE_TOKEN_KEY) || sessionStorage.getItem(AGENCY_CONSOLE_TOKEN_KEY))\n',
    replace: '    return true\n',
    test: TEST,
    why: '콘솔 로그인 뒤엔 ?tool= 이 사라진다 — 알림에서 누른 주문 화면 대신 콘솔 첫 화면이 뜬다.',
  },
  {
    name: '[에이전시링크] 껍데기가 콘솔로 안 보낸다 (옛 대시보드가 그대로 뜬다)',
    file: LAYOUT,
    find: '  if (toConsole) return <Navigate to={toConsole} replace />\n',
    replace: '\n',
    test: TEST,
    why: '에이전시 직원이 대시보드에 들어오는 주된 길이 알림 링크다 — 이 줄이 없으면 3단계 에이전시 몫이 없던 일이 된다.',
  },
  {
    name: '[에이전시링크] 콘솔이 남의 좌석으로도 시트를 연다',
    file: PANEL,
    find: '    if (!target || !isMyAgencySeat(target.sellerId, staffId)) { window.location.replace(dashboardFallback(deepPath)); return }',
    replace: '    if (!target) { window.location.replace(dashboardFallback(deepPath)); return }',
    test: TEST,
    why: '매장 컴퓨터를 같이 쓰면 다른 직원의 좌석이 남아 있다 — 그 좌석으로 열면 배정 밖 매장을 본다.',
  },
  {
    name: '[에이전시링크] 콘솔이 연 전체화면이 다시 콘솔로 튕긴다',
    file: PLATE,
    find: '    window.location.assign(dashboardFallback(path))',
    replace: '    window.location.assign(path)',
    test: TEST,
    why: '사용처리 같은 전체화면은 일부러 연 것이다 — dash=1 이 없으면 껍데기가 콘솔로 되돌려 카메라가 안 뜬다.',
  },
  {
    name: '[에이전시링크] 깊은 링크를 매번 다시 쓴다',
    file: PANEL,
    find: '    deepDone.current = true\n',
    replace: '\n',
    test: TEST,
    why: '다른 매장을 골랐다 돌아오거나 목록이 다시 불리면 닫은 시트가 또 열린다.',
  },
]
