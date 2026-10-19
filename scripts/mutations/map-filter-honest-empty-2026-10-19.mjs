// 📍 2026-10-19 대표 "응 둘 다 해줘" — 지도 필터 0건 "없어요"가 다 받기 전에 뜨던 것.
const T = 'src/tests/unit/map-filter-honest-empty-2026-10-19.test.ts'
export default [
  {
    name: '📍[지도] 1페이지 전에 켠 필터가 전체를 영영 안 받는다',
    file: 'src/pages/restaurant-map/useFeedWindow.ts',
    find: '[needsAll, loadAll, isLoading]',
    replace: '[needsAll, loadAll]',
    test: T,
    why: 'loadAll 은 page 0 에서 no-op 이고 그 함수 정체성은 안 바뀐다 — 1페이지만 거른 채 "없어요".',
  },
  {
    name: '📍[지도] 전체를 받는 중에도 0건이면 "없어요"',
    file: 'src/pages/RestaurantMapPage.tsx',
    find: 'loading={loading || (stillHunting && displayList.length === 0)}',
    replace: 'loading={loading}',
    test: T,
    why: '맞는 이용권이 뒤 페이지에 있는데 유달이 "없어요" 가 먼저 뜬다 — 에러는 안 난다.',
  },
  {
    name: '📍[지도] 찾는 중 판정에 로딩 중을 안 센다',
    file: 'src/pages/restaurant-map/useFeedWindow.ts',
    find: '!reachedEnd && (isLoading || loadingMore)',
    replace: '!reachedEnd && false',
    test: T,
    why: '찾는 중 신호가 꺼지면 위 두 곳이 전부 무력화된다.',
  },
]
