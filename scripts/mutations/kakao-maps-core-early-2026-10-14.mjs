export default [
  {
    name: '[kakao-core] 지도 생성이 다시 services.js 까지 기다린다',
    file: 'src/pages/restaurant-map/useKakaoMap.ts',
    find: '    ensureKakaoMapsCore()\n      .then(() => setSdkLoaded(true))',
    replace: '    ensureKakaoMaps()\n      .then(() => setSdkLoaded(true))',
    test: 'src/tests/unit/kakao-maps-core-early-2026-10-14.test.ts',
    why: '/map 첫 지도 그림이 services.js(느린 4G·CPU×4 재생 2.2초)만큼 다시 늦어진다.',
  },
  {
    name: '[kakao-core] core 가 본체 실행을 안 보고 full 만 기다린다',
    file: 'src/lib/kakao-sdk.ts',
    find: "        n.addEventListener('load', () => { if (w.kakao?.maps?.Map) ok() }, { once: true })",
    replace: "        n.addEventListener('load', () => { void 0 }, { once: true })",
    test: 'src/tests/unit/kakao-maps-core-early-2026-10-14.test.ts',
    why: '이름만 core 이고 실제로는 종전과 같이 전체 준비까지 기다린다(헛도는 개선).',
  },
  {
    name: '[kakao-core] 지역명이 services 를 안 기다려 첫 진입에 영영 빠진다',
    file: 'src/pages/restaurant-map/useViewportRegion.ts',
    find: '    if (!enabled || !servicesReady) return',
    replace: '    if (!enabled) return',
    test: 'src/tests/unit/kakao-maps-core-early-2026-10-14.test.ts',
    why: '지도가 먼저 그려지면 Geocoder 가 아직 없어 지역명이 "이 지역" 으로 굳는다.',
  },
]
