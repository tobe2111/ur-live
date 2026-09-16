/**
 * 🧬 주입 — 셀러 매출 분석 안 C (2026-09-15 대표 확정).
 * 각 항목은 "되돌리면 대표가 고른 이유가 사라진다" 는 형태로 쓴다.
 */
const TEST = 'src/tests/unit/seller-analytics-variant-c-2026-09-15.test.ts'

export default [
  {
    name: '📊 판매 0 인데 재는 도구를 그린다 (대표가 실제로 본 화면으로 회귀)',
    file: 'src/pages/SellerAnalyticsPage.tsx',
    find: '!everSold ? <NoSalesEver /> : (',
    replace: 'false ? <NoSalesEver /> : (',
    test: TEST,
    why: '0 다섯 개 + 컨트롤 12개가 안 C 를 고른 이유다 — 이 분기가 없으면 원래 화면이다.',
  },
  {
    name: '📊 "한 번도 안 팖" 을 기간 합계로 판정한다 (60일 전 판매자에게 거짓말)',
    file: 'src/pages/SellerAnalyticsPage.tsx',
    find: 'const everSold = !!detailedData && detailedData.total_buyers > 0',
    replace: 'const everSold = windowOrders > 0',
    test: TEST,
    why: '`/analytics/detailed` 만 전 기간 집계다. 기간 합계로 바꾸면 90일 전 판매자가 "아직 판매가 없어요" 를 본다.',
  },
  {
    name: '📊 기간이 비어도 큰 0 과 빈 차트를 그린다',
    file: 'src/pages/seller-analytics/AnalyticsOverview.tsx',
    find: 'const windowEmpty = p.revenue === 0 && p.orders === 0',
    replace: 'const windowEmpty = false',
    test: TEST,
    why: '안 C 의 핵심 주장 — 잴 것이 없으면 재는 도구를 안 그린다.',
  },
  {
    name: '📊 안쪽 화면으로 가는 줄이 사라진다 (기능 소실)',
    file: 'src/pages/seller-analytics/AnalyticsOverview.tsx',
    find: "{ key: 'funnel', icon: TrendingUp",
    replace: "{ key: 'monthly', icon: TrendingUp",
    test: TEST,
    why: '구조를 바꾼 것이지 기능을 지운 게 아니다 — 탭 6개는 전부 닿을 수 있어야 한다.',
  },
  {
    name: '📊 요약으로 돌아오는 길이 없어진다 (안쪽에 갇힘)',
    file: 'src/pages/SellerAnalyticsPage.tsx',
    find: "onClick={() => setTab('revenue')}",
    replace: "onClick={() => setTab('customers')}",
    test: TEST,
    why: '탭 버튼 줄을 없앴으므로 ← 하나가 유일한 귀로다.',
  },
  {
    name: '📊 빈 화면의 다음 행동이 사라진다',
    file: 'src/pages/seller-analytics/NoSalesYet.tsx',
    find: 'to="/seller/meal-voucher/new"',
    replace: 'to="/seller"',
    test: TEST,
    why: '"지금 할 수 있는 일 하나" 가 안 C 의 절반이다 — 홈으로 보내면 아무것도 안 알려 준 것이다.',
  },
  {
    name: '📊 기간이 비면 기간 선택까지 감춘다 (다른 기간으로 갈 길 없음)',
    file: 'src/pages/seller-analytics/AnalyticsOverview.tsx',
    find: 'role="group"',
    replace: 'role="group" hidden={windowEmpty}',
    test: TEST,
    why: '빈 기간에 세그먼트까지 사라지면 90일로 넓혀 볼 길이 없어진다. 순서만 보는 검사는 이걸 못 잡는다.',
  },
]
