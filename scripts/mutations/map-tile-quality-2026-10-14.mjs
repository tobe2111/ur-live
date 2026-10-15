// 🗺️ 지도 타일 화질 — 언제나 고화질(2026-10-15 반전) — 되돌려-검증 주입.
const TEST = 'src/tests/unit/map-tile-quality-2026-10-14.test.ts'

export default [
  {
    name: '🗺️ 이른 SDK 경로에서 화질을 다시 내린다(disableHD)',
    file: 'src/lib/kakao-sdk.ts',
    find: 'kakaoMapsPromise = early.then(() => {}, () => {',
    replace: 'kakaoMapsPromise = early.then(() => { (window as any).kakao?.maps?.disableHD?.() }, () => {',
    test: TEST,
    why: '대표 "화질은 줄일 수 없어" — /map 하드로드는 거의 다 이른 경로를 탄다.',
  },
  {
    name: '🗺️ 정상 SDK 경로에서 화질을 다시 내린다(disableHD)',
    file: 'src/lib/kakao-sdk.ts',
    find: "        w.kakao.maps.load(() => resolve())",
    replace: "        w.kakao.maps.load(() => { w.kakao.maps.disableHD?.(); resolve() })",
    test: TEST,
    why: '홈 → 지도 알약 경로는 정상 경로를 탄다.',
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
