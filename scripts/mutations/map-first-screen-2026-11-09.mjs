/** 🧬 주입 — 지도 껍데기 첫 화면의 두 벌이 갈리거나 배선이 빠지면 가드가 잡는가. 가드: src/tests/unit/map-first-screen-2026-11-09.test.tsx */
const T = 'src/tests/unit/map-first-screen-2026-11-09.test.tsx'
export default [
  {
    name: '🗺️ 지도 첫 화면 배선을 뺀다(첫 글자 2.9초·번역 키 원문으로 회귀)',
    file: 'src/worker/index.ts',
    find: "else if (url.pathname === '/map' && !url.search && shouldRenderMobileFirstScreen(c.req.header('user-agent'))) {",
    replace: "else if (false && url.pathname === '/map') {",
    test: T,
    why: '라이브 실측(2026-11-09) first-paint 1.96s · 첫 글자 2.93s — 소비자 화면 중 가장 늦었다.',
  },
  {
    name: '🗺️ 시트 peek 자리를 손으로 적는다(useSheetDrag 와 갈려 마운트 때 시트가 튄다)',
    file: 'src/worker/utils/map-first-screen.ts',
    find: 'style="top:${SHEET_BASE_TOP};transform:${SHEET_SNAP_TRANSLATE.peek};will-change:transform"',
    replace: 'style="top:104px;transform:translateY(calc(100dvh - 240px - 104px));will-change:transform"',
    test: T,
    why: 'safe-area 를 빼면 노치 폰에서 시트가 마운트 때 위아래로 움직인다(에러 0).',
  },
  {
    name: '🗺️ 칩 클래스가 MapTopBar 와 갈린다',
    file: 'src/worker/utils/map-first-screen.ts',
    find: "  chipBase: 'flex items-center gap-1 h-[30px] px-2 rounded-full text-[12px] font-medium shrink-0 transition-colors',",
    replace: "  chipBase: 'flex items-center gap-1 h-8 px-2 rounded-full text-[12px] font-medium shrink-0 transition-colors',",
    test: T,
    why: '칩 높이가 2px 만 달라도 아래 시트 머리까지 전부 민다.',
  },
  {
    name: '🗺️ 지도 대기 문구의 defaultValue 를 뺀다(사전 청크 전엔 번역 키 원문이 보인다)',
    file: 'src/pages/RestaurantMapPage.tsx',
    find: "{t('restaurantMap.mapLoading', { defaultValue: '지도를 불러오는 중...' })}",
    replace: "{t('restaurantMap.mapLoading')}",
    test: T,
    why: '2026-11-09 라이브 첫 글자가 `restaurantMap.mapLoading` 그대로였다(사전이 2.56s 에 왔다).',
  },
]
