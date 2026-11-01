// 🧩 PC 홈 시안 6 (2026-10-14 대표 확정 — 큰 배너 1 + 작은 2 → 어드민 섹션 + 유어쇼츠 → 지역 → 필터 + 목록)
//   가드: src/tests/unit/pc-home-s6-2026-10-14.test.ts
const GUARD = 'src/tests/unit/pc-home-s6-2026-10-14.test.ts'
const PAGE = 'src/pages/pc-home/PcHomePage.tsx'
const FEED = 'src/pages/main-home/GroupBuyFeed.tsx'
const FILT = 'src/shared/home-feed-filters.ts'
const POP = 'src/pages/pc-home/usePopularDeals.ts'

const TILES = 'src/pages/pc-home/region-tiles.ts'

export default [
  {
    name: '🧱 왼쪽 필터 열의 층이 빠져 지역 드롭다운이 카드 밑으로 들어간다',
    file: 'src/pages/pc-home/PcFeedSidebar.tsx',
    find: 'className="sticky top-24 z-20 self-start',
    replace: 'className="sticky top-24 self-start',
    test: GUARD,
    why: '대표 신고 "이렇게 잘려서 보이네" — sticky 쌓임 맥락 안에 갇힌 드롭다운을 오른쪽 카드가 덮는다.',
  },
  {
    name: '🖼️ 사진 없는 지역 타일이 다시 들어온다',
    file: TILES,
    find: '    if (!photo) continue\n',
    replace: '',
    test: GUARD,
    why: '대표 "사진 없는건 빼주면 돼" — 빠지면 파란 면에 글자만 있는 칸이 다시 생긴다.',
  },
  {
    name: '🖼️ 배너 링크 비교가 인코딩된 경로와 다시 어긋난다',
    file: TILES,
    find: '    const path = decodeURIComponent(regionPath({ sido: r.sido }))',
    replace: '    const path = regionPath({ sido: r.sido })',
    test: GUARD,
    why: '한쪽만 디코딩하면 한 번도 안 맞아 대표가 올린 지역 배너 사진이 타일에 안 쓰인다(에러 0).',
  },
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
    find: '.filter(p => passesFeedFilters(p, filters, userLoc) && life.keep(p))',
    replace: '.filter(p => life.keep(p))',
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
    name: '🧩 지역 사진용 인기 목록 주소가 예열 주소와 갈린다',
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
  {
    name: '🧩 PC 섹션이 모바일과 다른 고정 순위 줄로 되돌아간다',
    file: PAGE,
    find: '<HomeSections rail near={near} shortsRail={<UrShortsRail />}',
    replace: '<HomeSections rail shortsRail={<UrShortsRail />}',
    test: GUARD,
    why: '위치를 넘기지 않으면 PC 섹션만 전국 인기순이 된다 — 2026-10-13 "위치를 정하면 맨 위가 그 동네" 규칙이 PC 에서만 깨진다.',
  },
]
