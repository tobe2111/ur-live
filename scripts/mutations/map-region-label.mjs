/**
 * 📍 지도 시트 지역명 안 R1 (2026-09-09) — 주입 매니페스트.
 * 가드: src/tests/unit/map-region-label.test.ts
 */
const TEST = 'src/tests/unit/map-region-label.test.ts'

export default [
  {
    name: '📍 여러 동이 보이는데 동 이름을 말한다 (요약이 아니라 거짓말)',
    file: 'src/shared/map-region-label.ts',
    find: '  if (level <= 6) return r3 || r2 || r1\n  if (level <= 8) return r2 || r1',
    replace: '  if (level <= 8) return r3 || r2 || r1',
    test: TEST,
    why: '화면에 화성시 전체가 보이는데 "동탄6동"이라고 쓰면 사용자는 그 동네 딜만 세는 줄 안다.',
  },
  {
    name: '📍 전국 뷰에서도 한 점의 시도를 그린다',
    file: 'src/shared/map-region-label.ts',
    find: '  if (level > MAP_REGION_MAX_LEVEL) return null\n',
    replace: '',
    test: TEST,
    why: '전국이 보이는데 "경기 16곳"이면 나머지 시도의 딜이 없는 것처럼 읽힌다.',
  },
  {
    name: '📍 단계가 비어도 위로 안 올라간다 (시트가 "  16곳" 이 된다)',
    file: 'src/shared/map-region-label.ts',
    find: '  if (level <= 6) return r3 || r2 || r1',
    replace: '  if (level <= 6) return r3',
    test: TEST,
    why: '바다·비행장 위에는 행정동이 없다. 빈 문자열을 그리면 문구가 통째로 사라진다.',
  },
  {
    name: '📍 재조회 임계가 고정값이 된다 (시 단위 줌에서 1픽셀에도 다시 묻는다)',
    file: 'src/shared/map-region-label.ts',
    find: '  const thr = Math.max(Math.abs(spanLat) * 0.25, 0.0005)',
    replace: '  const thr = 0.002',
    test: TEST,
    why: '동네 줌에선 200m 가 화면 절반이고 시 단위 줌에선 1픽셀이다 — 화면 폭에 비례해야 한다.',
  },
  {
    name: '📍 idle 마다 곧장 지오코딩 (팬 한 번에 수십 번)',
    file: 'src/pages/restaurant-map/useViewportRegion.ts',
    find: '      if (timer) clearTimeout(timer)\n      timer = setTimeout(resolve, 450)',
    replace: '      resolve()',
    test: TEST,
    why: 'idle 은 손가락을 뗄 때마다 온다. 디바운스가 없으면 팬 한 번이 지오코딩 폭풍이 된다.',
  },
  {
    name: '📍 전국 줌에서도 지오코딩을 부른다 (물어봐야 버릴 답)',
    file: 'src/pages/restaurant-map/useViewportRegion.ts',
    find: '      if (regionDepth(level) === 0) {',
    replace: '      if (false) {',
    test: TEST,
    why: '규칙이 이미 "이름 없음"이라고 정한 구간이다 — 그런데도 부르면 순수 낭비다.',
  },
  {
    name: '📍 빈 결과에 이름을 지운다 (팬 도중 문구가 깜빡인다)',
    file: 'src/pages/restaurant-map/useViewportRegion.ts',
    find: '          if (next2) setLabel(next2)',
    replace: '          setLabel(next2)',
    test: TEST,
    why: '`동탄6동 ↔ 이 지역` 이 오가면 그냥 "이 지역"으로 두는 것보다 나쁘다.',
  },
  {
    name: '📍 언마운트 뒤 콜백이 상태를 만진다',
    file: 'src/pages/restaurant-map/useViewportRegion.ts',
    find: '          if (!alive) return\n',
    replace: '',
    test: TEST,
    why: '지오코딩 콜백은 비동기라 지도 모드를 빠져나간 뒤에도 온다.',
  },
  {
    name: '📍 시트가 지역명을 무시하고 "이 지역"으로 되돌아간다',
    file: 'src/pages/restaurant-map/SheetFilterBar.tsx',
    find: "{regionLabel || t('map.sheet.thisArea', { defaultValue: '이 지역' })}",
    replace: "{t('map.sheet.thisArea', { defaultValue: '이 지역' })}",
    test: TEST,
    why: '훅은 도는데 화면만 안 쓰는 상태 — 에러가 없어 아무도 모른다(이 레포가 반복해 당한 클래스).',
  },
  {
    name: '📍 페이지가 훅을 리스트 모드에서도 켠다',
    file: 'src/pages/RestaurantMapPage.tsx',
    find: "useViewportRegion({ mapInstance, enabled: mode === 'map' && sdkLoaded })",
    replace: 'useViewportRegion({ mapInstance, enabled: sdkLoaded })',
    test: TEST,
    why: '지도가 없는 화면에서 지도 중심을 묻는다 — 없는 지도의 이름을 시트가 말하게 된다.',
  },
]
