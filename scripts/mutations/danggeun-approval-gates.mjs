/**
 * 🧬 주입 — 당근 모델의 세 문 (2026-09-16).
 * 각 항목은 "되돌리면 승인 전 매장이 조용히 새어 나간다" 형태다.
 */
const TEST = 'src/tests/unit/danggeun-approval-gates-2026-09-16.test.ts'

export default [
  {
    name: 'danggeun: 승인된 매장만 보는 조건을 뒤집는다',
    file: 'src/shared/db/consumer-visible-product.ts',
    find: "       AND COALESCE(s_appr.status, '') NOT IN ('approved', 'active')",
    replace: "       AND 0",
    test: TEST,
    why: '술어가 무력화되면 대기·반려 매장의 이용권이 그대로 메인에 뜬다 — 에러가 안 난다.',
  },
  {
    name: 'danggeun: 플랫폼 상품(seller_id NULL)까지 가린다',
    file: 'src/shared/db/consumer-visible-product.ts',
    find: '     WHERE s_appr.id = ${alias}.seller_id',
    replace: '     WHERE COALESCE(${alias}.seller_id, -1) = COALESCE(s_appr.id, -1) OR ${alias}.seller_id IS NULL',
    test: TEST,
    why: '반대 방향 사고 — 조이면 교환권·KT·데모가 통째로 사라지고 홈이 빈다.',
  },
  {
    name: 'danggeun: 캐시 cron 만 필터를 빠뜨린다',
    file: 'src/worker/cron/group-buy-feed-cache.ts',
    find: "            AND ${approvedSellerProductSql('p')}",
    replace: '',
    test: TEST,
    why: '라이브 라우트는 막는데 캐시가 안 막으면 캐시가 서빙하는 동안만 샌다 — 재현이 안 돼 못 잡는다.',
  },
  {
    name: 'danggeun: 홈 섹션만 필터를 빠뜨린다',
    file: 'src/features/sections/api/section-rules.ts',
    find: "        AND ${approvedSellerProductSql(a)}",
    replace: '',
    test: TEST,
    why: '피드엔 없는데 "인기 이용권" 줄에는 뜬다. 한 곳만 빠지는 것이 이 레포의 반복 사고다.',
  },
  {
    name: 'danggeun: 유어애즈 DB 를 승인 전에도 연다',
    file: 'src/worker/utils/ads-db-access.ts',
    find: "  if (!st || !['approved', 'active'].includes(String(st.status || ''))) {",
    replace: '  if (false) {',
    test: TEST,
    why: '대시보드를 열어 준 뒤라, 이 조건이 없으면 가입만 하면 누구나 44,000행을 본다.',
  },
  {
    name: 'danggeun: 승인 판정을 DB 대신 토큰으로 한다 (셀러 행 없으면 통과)',
    file: 'src/worker/utils/ads-db-access.ts',
    find: "  if (!st || !['approved', 'active'].includes(String(st.status || ''))) {",
    replace: "  if (st && !['approved', 'active'].includes(String(st.status || ''))) {",
    test: TEST,
    why: '셀러 행이 없는 토큰(삭제된 계정·위조 id)이 통과한다 — 여기서는 fail-closed 가 맞다.',
  },
  {
    name: 'danggeun: 정지 계정까지 대시보드에 들여보낸다',
    file: 'src/features/seller/api/seller-registration/session-routes.ts',
    find: "    if (seller.status === 'suspended') {",
    replace: '    if (false) {',
    test: TEST,
    why: '반려는 "서류가 아직"이고 정지는 "내보냈다" — 같이 취급하면 징계가 무의미해진다.',
  },
  {
    name: 'danggeun: 대기 화면이 다시 승인만 통과시킨다',
    file: 'src/pages/SellerWaitingPage.tsx',
    find: "        if (s !== 'suspended') {",
    replace: "        if (s === 'active' || (s as string) === 'approved') {",
    test: TEST,
    why: '되돌아가면 반려된 사장님이 서류를 고칠 화면에 들어갈 수 없다 — 대표 지시의 정반대.',
  },
  {
    name: 'danggeun: 토큰을 못 받아도 대시보드로 보낸다',
    file: 'src/pages/SellerWaitingPage.tsx',
    find: '          if (entered) {',
    replace: '          if (true) {',
    test: TEST,
    why: '토큰 없이 /seller 로 가면 로그인 화면으로 튕긴다 — 대기 안내보다 나쁘다.',
  },
  {
    name: 'danggeun: 값이 없을 때 메뉴를 숨긴다 (fail-open 을 뒤집는다)',
    file: 'src/shared/seller-approval.ts',
    find: "  return s !== '' && !APPROVED.includes(s)",
    replace: '  return !APPROVED.includes(s)',
    test: TEST,
    why: '옛 로그인 세션엔 키가 없다 — 없다고 숨기면 승인된 매장의 메뉴가 사라진다.',
  },
  {
    name: 'danggeun: 그룹 탭만 메뉴를 안 숨긴다',
    file: 'src/components/seller/SellerGroupTabs.tsx',
    find: "    if (tab.path === '/seller/influencers' && shouldHideAdsDbNav(sellerStatus)) return false",
    replace: '',
    test: TEST,
    why: '사이드바에선 사라졌는데 탭 줄로는 들어간다 — 한쪽만 숨기는 것이 가장 흔한 누락이다.',
  },
  {
    name: 'danggeun: 배너가 등록증 URL 까지 내려받게 한다',
    file: 'src/features/auth/api/seller.routes.ts',
    find: '      has_business_cert: !!row?.business_registration_image_url,',
    replace: '      business_registration_image_url: row?.business_registration_image_url ?? null,',
    test: TEST,
    why: '도착 여부만 있으면 되는데 주소를 실어 보내면 남의 서류 링크가 응답에 남는다.',
  },
]
