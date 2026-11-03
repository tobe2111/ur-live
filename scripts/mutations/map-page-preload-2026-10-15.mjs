// 🗺️ 홈이 지도 화면 코드를 미리 받는다(2026-10-15) — 되돌려-검증 주입.
const TEST = 'src/tests/unit/map-page-preload-2026-10-15.test.ts'

export default [
  {
    name: '🗺️ 홈이 SDK 만 받고 지도 화면 코드는 안 받는다',
    file: 'src/pages/mobile-home/map-warmup.ts',
    // 🐢 2026-11-02 첫 목록 미리받기를 붙이면서 `loadRoute`(모듈을 돌려준다)로 바뀌었다 — 하는 일은 같다.
    find: "      .then(() => loadRoute('map'))",
    replace: '      .then(() => undefined)',
    test: TEST,
    why: '알약을 누른 뒤 ~1초가 지도 화면 청크였다.',
  },
  {
    name: '🗺️ 지도 화면 코드를 SDK 와 동시에 받는다(회선을 나눠 쓴다)',
    file: 'src/pages/mobile-home/map-warmup.ts',
    find: "    import('@/lib/kakao-sdk').then((m) => m.ensureKakaoMaps())",
    replace: "    preloadRoute('map'); import('@/lib/kakao-sdk').then((m) => m.ensureKakaoMaps())",
    test: TEST,
    why: '느린 회선에서 SDK 와 화면 코드가 같은 회선을 다툰다 — 지도 생성에 필요한 SDK 가 먼저다.',
  },
  {
    name: '🗺️ 미리받기가 매번 다시 받는다(한 번만 아님)',
    file: 'src/lib/route-preload.ts',
    find: '  if (hit) return hit\n',
    replace: '',
    test: TEST,
    why: '누르는 순간 + 한가할 때 두 번 부른다 — 두 번째는 아무것도 안 해야 한다.',
  },
  {
    name: '🗺️ 실패한 미리받기를 다시 시도하지 않는다',
    file: 'src/lib/route-preload.ts',
    find: 'started.delete(name); inflight.delete(name); throw e',
    replace: 'started.delete(name); throw e',
    test: TEST,
    why: '일시 실패 한 번으로 그 탭 수명 동안 미리받기가 꺼진다.',
  },
  {
    name: '🗺️ 홈이 지도 페이지를 직접 import(묶음기 봉투가 다시 짜인다)',
    file: 'src/pages/mobile-home/map-warmup.ts',
    // 🐢 2026-11-03 재조준 — 그 뒤에 '누르는 순간 첫 목록 미리받기' 줄이 들어와 앵커를 함수 첫 줄로 옮겼다.
    find: "export function preconnectMapTiles(): void {\n  preloadRoute('map')\n",
    replace: "export function preconnectMapTiles(): void {\n  void import('@/pages/RestaurantMapPage')\n",
    test: TEST,
    why: '홈 lazy 라벨이 지도 모듈에 붙어 화면별 묶음이 바뀐다.',
  },
]
