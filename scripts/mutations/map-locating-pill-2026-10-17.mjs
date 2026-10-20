export default [
  {
    name: '📍 지도 측위 알약이 다시 칩 줄에 겹친다',
    file: 'src/pages/RestaurantMapPage.tsx',
    find: 'absolute top-[104px] lg:top-4 left-1/2',
    replace: 'absolute top-[62px] left-1/2',
    test: 'src/tests/unit/map-locating-pill-2026-10-17.test.ts',
    why: "알약이 '전체'·'식사' 칩 사이에 끼어 '위…' 만 보인다 — 에러는 안 난다.",
  },
]
