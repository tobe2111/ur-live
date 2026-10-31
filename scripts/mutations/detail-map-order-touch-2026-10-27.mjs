/** 🧬 주입 — 이용권 상세 지도 위치·모바일 스크롤(2026-10-27). 가드: src/tests/unit/detail-map-order-touch-2026-10-27.test.ts */
const T = 'src/tests/unit/detail-map-order-touch-2026-10-27.test.ts'
export default [
  {
    name: 'detail-map-order-touch — 터치 기기에서도 확대가 켜진다',
    file: 'src/components/RestaurantMiniMap.tsx',
    find: 'mapInstance.current.setZoomable(!coarsePointer)',
    replace: 'mapInstance.current.setZoomable(true)',
    test: T,
    why: '카카오가 핀치 처리로 터치를 붙잡아 지도 위에서 페이지가 안 내려간다.',
  },
  {
    name: 'detail-map-order-touch — 덮개가 사라진다',
    file: 'src/components/RestaurantMiniMap.tsx',
    find: ' data-map-scroll-guard />',
    replace: ' />',
    test: T,
    why: '손가락이 지도에 직접 닿아 스크롤이 막힌다.',
  },
]
