/**
 * 🗑️ 셀러 대시보드 삭제 (2026-10-12 대표 *"대시보드는 완전히 지워줘"*) — 주입 매니페스트.
 * 가드: seller-dashboard-gone · seller-deep-link-to-my · agency-deep-link · danggeun-approval-gates · biz-reg-resubmit
 *
 * 전부 **에러가 안 나는 결함**이다 — 보내기가 빠지면 틀 없는 화면이 덩그러니 뜨고, 시트가 안 닫히면 빈 시트가 남는다.
 */
const GONE = 'src/tests/unit/seller-dashboard-gone-2026-10-12.test.tsx'
const MY = 'src/tests/unit/seller-deep-link-to-my-2026-10-12.test.tsx'
const AGENCY = 'src/tests/unit/agency-deep-link-2026-10-12.test.tsx'
const LIB = 'src/lib/seller-deep-link.ts'
const LAYOUT = 'src/components/SellerLayout.tsx'
const ROUTES = 'src/routes/seller.routes.tsx'

export default [
  {
    name: '[대시보드삭제] 틀이 주소창으로 온 사람을 안 보낸다 (틀 없는 화면이 덩그러니 뜬다)',
    file: LAYOUT,
    find: '    if (to) return <Navigate to={to} replace />\n',
    replace: '\n',
    test: MY,
    why: '알림톡·메일의 /seller/* 링크가 마이 시트로 가는 유일한 길이다 — 빠지면 머리줄도 메뉴도 없는 맨 화면이 뜬다.',
  },
  {
    name: '[대시보드삭제] 시트 안에서도 보낸다 (시트가 마이를 통째로 떠난다)',
    file: LAYOUT,
    find: '  if (!bare && !embedded) {',
    replace: '  if (!bare) {',
    test: MY,
    why: '시트 안 화면이 자기 자신을 마이로 보내면 시트가 닫히는 게 아니라 페이지가 바뀐다.',
  },
  {
    name: '[대시보드삭제] 쿼리를 버린다 (알림톡 링크의 필터가 사라진다)',
    file: LIB,
    find: '  return `${base}?${TOOL_PARAM}=${encodeURIComponent(pathname + q)}`',
    replace: '  return `${base}?${TOOL_PARAM}=${encodeURIComponent(pathname)}`',
    test: MY,
    why: '?status=PAID 같은 필터가 빠지면 엉뚱한 목록이 열린다 — 에러는 없다.',
  },
  {
    name: '[대시보드삭제] 에이전시 직원도 마이로 보낸다 (마이가 없어 카카오 로그인 벽에 막힌다)',
    file: LIB,
    find: '  return toolRedirect(isAgencyWorker() ? AGENCY_CONSOLE_PATH : MY_PATH, pathname, search)',
    replace: '  return toolRedirect(MY_PATH, pathname, search)',
    test: AGENCY,
    why: '직원은 이메일로 콘솔에 들어온다 — 마이로 보내면 일할 곳이 없다.',
  },
  {
    name: '[대시보드삭제] 좌석 만료 직원을 소비자로 본다 (콘솔 로그인만 남은 직원이 마이로 간다)',
    file: LIB,
    find: "    return consoleLogin && !localStorage.getItem('user_id')",
    replace: '    return false',
    test: AGENCY,
    why: '좌석 토큰은 만료돼도 콘솔 로그인은 남는다 — 그 직원을 마이로 보내면 카카오 로그인을 요구받는다.',
  },
  {
    name: '[대시보드삭제] OAuth 복귀 주소까지 보낸다 (code·state 를 그 화면이 못 읽는다)',
    file: LIB,
    find: '  if (RENDER_BARE.has(pathname)) return null\n',
    replace: '\n',
    test: MY,
    why: '외부 OAuth 는 이 주소로 돌아와 쿼리를 그 자리에서 읽는다 — 마이로 보내면 연동이 조용히 실패한다.',
  },
  {
    name: '[대시보드삭제] 마이가 좌석이 안 맞아도 시트를 연다 (다른 가게 화면을 보게 된다)',
    file: 'src/pages/user-profile/seller-section/useToolDeepLink.ts',
    find: "    if (!seated) { toast.error('알림 속 화면을 열 가게가 선택돼 있지 않아요. 가게를 고른 뒤 다시 열어 주세요.'); return }\n",
    replace: '',
    test: MY,
    why: '시트의 화면은 좌석 토큰으로 스코프된다 — 안 맞는 채로 열면 다른 가게 것을 보게 된다.',
  },
  {
    name: '[대시보드삭제] 콘솔이 남의 좌석으로도 시트를 연다',
    file: 'src/pages/agency-console/AgencyStoresPanel.tsx',
    find: '    if (!target || !isMyAgencySeat(target.sellerId, staffId)) {',
    replace: '    if (false) {',
    test: AGENCY,
    why: '다른 직원이 앉은 좌석으로 화면을 열면 그 직원 이름으로 일하게 된다.',
  },
  {
    name: '[대시보드삭제] 콘솔 로그인이 ?tool= 을 잃는다 (직원이 알림 링크를 다시 눌러야 한다)',
    file: 'src/pages/agency-console/AgencyHomePage.tsx',
    find: "    const back = tool ? `/agency?tool=${encodeURIComponent(tool)}` : '/agency'",
    replace: "    const back = '/agency'",
    test: AGENCY,
    why: '좌석 판정이 콘솔 로그인 유무와 무관해졌다 — 로그인 화면을 거쳐도 링크가 살아 있어야 한다.',
  },
  {
    name: '[대시보드삭제] 시트 안 옛 홈 주소가 시트를 안 닫는다 (빈 시트가 남는다)',
    file: 'src/pages/user-profile/seller-section/ToolPageSheet.tsx',
    find: '  useEffect(() => { onClose() }, [onClose])',
    replace: '  useEffect(() => {}, [onClose])',
    test: GONE,
    why: '저장 후 navigate(\'/seller\') 하는 화면이 여럿이다 — 그 끝이 "시트 닫기" 가 아니면 빈 화면이 남는다.',
  },
  {
    name: '[대시보드삭제] /seller/login 이 돌아올 곳을 버린다 (로그인 뒤 홈으로 떨어진다)',
    file: ROUTES,
    find: "  const back = (from && sellerEntryRedirect(from, '')) || MY_PATH",
    replace: '  const back = MY_PATH',
    test: GONE,
    why: '보호 라우트가 넘긴 원래 화면을 잃으면 사장님이 같은 링크를 다시 찾아야 한다.',
  },
  {
    name: '[대시보드삭제] 옛 홈 주소가 아무 데도 안 보낸다',
    file: ROUTES,
    find: '  return <Navigate to={sellerEntryRedirect(location.pathname, location.search) ?? MY_PATH} replace />',
    replace: '  return null',
    test: GONE,
    why: '북마크·옛 알림의 /seller 가 빈 화면이 된다 — 에러는 없다.',
  },
  {
    name: '[대시보드삭제] 심사 상태를 아무도 안 적는다 (승인 전 매장에 유어애즈 문이 열려 보인다)',
    file: 'src/pages/user-profile/SellerSection.tsx',
    find: '    try { localStorage.setItem(SELLER_STATUS_KEY, store.status) } catch { /* quota */ }',
    replace: '    try { /* 쓰지 않는다 */ } catch { /* quota */ }',
    test: 'src/tests/unit/danggeun-approval-gates-2026-09-16.test.ts',
    why: '대시보드 승인 배너가 하던 일을 마이가 넘겨받았다 — 빠지면 그 메뉴 게이트가 영원히 fail-open 이다.',
  },
  {
    name: '[대시보드삭제] 등록증만 반려된 매장을 "승인 대기" 라고 말한다',
    file: 'src/pages/user-profile/SellerSection.tsx',
    find: "  if (status === 'pending' && certStatus === 'rejected') return CERT_REJECTED_NOTE",
    replace: '',
    test: 'src/tests/unit/biz-reg-resubmit-2026-10-10.test.ts',
    why: '기다리라고만 하면 사장님은 아무것도 안 한다 — 다시 올려야 심사가 다시 시작된다.',
  },
]
