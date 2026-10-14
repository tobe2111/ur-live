// 🗺️ 지도 타일 화질 — 느린 회선에서만 일반 화질(2026-10-14) — 되돌려-검증 주입.
const TEST = 'src/tests/unit/map-tile-quality-2026-10-14.test.ts'

export default [
  {
    name: '🗺️ 지도 타일을 회선과 무관하게 늘 일반 화질로(레티나에서 흐려진다)',
    file: 'src/lib/kakao-sdk.ts',
    find: '  if (!c) return false\n',
    replace: '  if (!c) return true\n',
    test: TEST,
    why: 'iOS 사파리는 회선 정보를 안 준다 — 모르면 고화질이어야 한다.',
  },
  {
    name: '🗺️ 지도 화질 선택이 이른 SDK 경로에서 빠진다',
    file: 'src/lib/kakao-sdk.ts',
    find: 'kakaoMapsPromise = early.then(applyTileQuality, () => {',
    replace: 'kakaoMapsPromise = early.then(() => {}, () => {',
    test: TEST,
    why: '/map 하드로드는 거의 다 이른 경로를 탄다 — 여기서 빠지면 처방이 통째로 사라진다.',
  },
  {
    name: '🗺️ 지도 화면이 SDK 래퍼를 다시 동적 import 로(왕복 한 번 추가)',
    file: 'src/pages/restaurant-map/useKakaoMap.ts',
    find: "    ensureKakaoMaps()\n      .then(() => setSdkLoaded(true))",
    replace: "    import('@/lib/kakao-sdk').then(() => {}); ensureKakaoMaps()\n      .then(() => setSdkLoaded(true))",
    test: TEST,
    why: '라이브 실측 — 그 왕복이 지도 생성을 늦췄다.',
  },
]
