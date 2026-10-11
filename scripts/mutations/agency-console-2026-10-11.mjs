/**
 * 🏢 에이전시 콘솔 1단계 (2026-10-11, 대표 "안 A로 하자") — 주입 매니페스트.
 * 가드: src/tests/unit/agency-console-2026-10-11.test.ts · src/tests/unit/agency-sunset-final.test.ts
 */
const TEST = 'src/tests/unit/agency-console-2026-10-11.test.ts'
const SUNSET = 'src/tests/unit/agency-sunset-final.test.ts'

export default [
  {
    name: '🏢 에이전시 토큰이 공용 JWT_SECRET 으로 서명된다',
    file: 'src/features/agency-console/api/agency-session.ts',
    find: 'return `${jwtSecret}::agency-console:v1`',
    replace: 'return jwtSecret',
    test: TEST,
    why: '공용 requireAuth 는 같은 열쇠 토큰이면 종류를 안 가린다 — 직원 3번이 소비자 users.id=3 으로 통하는 구멍.',
  },
  {
    name: '🏢 비밀번호를 바꿔도 옛 로그인이 살아 있다',
    file: 'src/features/agency-console/api/agency-session.ts',
    find: " || claims.iat < Number(row.tokens_valid_after || 0)) {",
    replace: ') {',
    test: TEST,
    why: '토큰 서명만 보면 7일 산다 — 내보낸 직원·유출 비밀번호의 옛 로그인이 그대로 남는다.',
  },
  {
    name: '🏢 링크 토큰이 두 번 쓰인다 (소비 CAS 제거)',
    file: 'src/features/agency-console/api/agency-auth.routes.ts',
    find: "\"UPDATE agency_tokens SET used_at = datetime('now') WHERE id = ? AND used_at IS NULL\",",
    replace: "\"UPDATE agency_tokens SET used_at = datetime('now') WHERE id = ?\",",
    test: TEST,
    why: '같은 초대·재설정 링크를 동시에 두 번 열면 둘 다 통과한다 — 한 번 쓰는 링크가 아니게 된다.',
  },
  {
    name: '🏢 대표 관리자가 내보내질 수 있다',
    file: 'src/features/agency-console/api/agency-staff.routes.ts',
    find: 'WHERE id = ? AND agency_id = ? AND is_owner = 0 AND status',
    replace: 'WHERE id = ? AND agency_id = ? AND status',
    test: TEST,
    why: '관리자 둘이 서로를 내보내면 에이전시에 아무도 못 들어간다 — 대표 계정은 어떤 경로로도 안 빠져야 한다.',
  },
  {
    name: '🏢 일반 직원이 다른 직원을 내보낼 수 있다',
    file: 'src/features/agency-console/api/agency-staff.routes.ts',
    find: "agencyStaffRoutes.post('/staff/:id/remove', cors(), requireAgencyStaff({ adminOnly: true }),",
    replace: "agencyStaffRoutes.post('/staff/:id/remove', cors(), requireAgencyStaff(),",
    test: TEST,
    why: '직원 관리는 관리자만 — 결정 파일 규칙.',
  },
  {
    name: '🏢 손님 로그인 화면에서 에이전시 입구가 사라진다',
    file: 'src/pages/LoginPage.tsx',
    find: '<Link to="/agency/login"',
    replace: '<Link to="/login"',
    test: TEST,
    why: '안 A 의 유일한 변화가 그 한 줄이다 — 빠지면 에이전시는 로그인 화면을 찾을 길이 없다.',
  },
  {
    name: '🏢 콘솔 라우트에 옛 에이전시 페이지가 섞인다',
    file: 'src/routes/agency-console.routes.tsx',
    find: "const AgencyHomePage = lazy(() => import('@/pages/agency-console/AgencyHomePage'))",
    replace: "const AgencyHomePage = lazy(() => import('@/pages/AgencyDashboardPage'))",
    test: SUNSET,
    why: '2026-09-04 일몰된 옛 에이전시가 이름만 남아 되살아나는 경로 — 새 것은 pages/agency-console 뿐.',
  },
  {
    name: '🏢 옛 /api/agency 마운트가 되살아난다',
    file: 'src/worker/index.ts',
    find: "app.route('/api/agency-console', agencyStaffRoutes);",
    replace: "app.route('/api/agency-console', agencyStaffRoutes); app.route('/api/agency', agencyStaffRoutes);",
    test: SUNSET,
    why: '재고정한 정규식이 -console 만 허용하고 옛 경로는 계속 막는지 확인한다.',
  },
]
