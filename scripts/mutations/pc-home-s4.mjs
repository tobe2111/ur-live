// 🧩 PC 홈 시안 4 (2026-10-14 대표 확정 — 큰 배너 1 + 작은 2 → 인기 순위 → 지역 → 필터 + 목록)
//   가드: src/tests/unit/pc-home-s4-2026-10-14.test.ts
const GUARD = 'src/tests/unit/pc-home-s4-2026-10-14.test.ts'
const PAGE = 'src/pages/pc-home/PcHomePage.tsx'
const FEED = 'src/pages/main-home/GroupBuyFeed.tsx'
const FILT = 'src/shared/home-feed-filters.ts'
const POP = 'src/pages/pc-home/usePopularDeals.ts'

export default [
  {
    name: '🧩 PC 홈 필터가 목록까지 안 간다',
    file: PAGE,
    find: '            filters={filters}\n',
    replace: '',
    test: GUARD,
    why: '왼쪽 필터를 눌러도 목록이 그대로면 버튼이 거짓말을 한다(에러는 없다).',
  },
  {
    name: '🧩 피드가 필터를 받고도 안 거른다',
    file: FEED,
    find: '.filter(p => passesFeedFilters(p, filters, userLoc))',
    replace: '',
    test: GUARD,
    why: '배선만 있고 판정이 빠진 경우 — 같은 증상.',
  },
  {
    name: '🧩 거리 필터가 좌표 없는 이용권을 "가깝다"로 통과시킨다',
    file: FILT,
    find: '    if (la == null || ln == null || !Number.isFinite(la) || !Number.isFinite(ln)) return false',
    replace: '    if (la == null || ln == null || !Number.isFinite(la) || !Number.isFinite(ln)) return true',
    test: GUARD,
    why: '위치를 모르는 매장을 "1km 안"에 넣으면 거짓 안내가 된다.',
  },
  {
    name: '🧩 순위 줄 주소가 예열 주소와 갈린다',
    file: POP,
    find: "category=all&sort=popular')",
    replace: "sort=popular&category=all')",
    test: GUARD,
    why: '같은 데이터라도 주소 글자가 다르면 cron 예열을 못 받아 PC 하드로드마다 콜드 D1 로 간다.',
  },
  {
    name: '🧩 PC 홈에 옛 히어로(색면 + 위치 칩)가 되살아난다',
    file: PAGE,
    find: '            {HOME_SHOWCASE_ENABLED && <PcHeroBanners />}',
    replace: '            {HOME_SHOWCASE_ENABLED && <PcHeroBanners />}<HomeHeroBanner />',
    test: GUARD,
    why: '위치 칩이 두 군데가 되어 어느 쪽이 진짜인지 갈린다 — 시안 4 가 대체한 것.',
  },
]
