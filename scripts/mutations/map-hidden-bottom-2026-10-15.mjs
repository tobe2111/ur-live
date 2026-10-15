// 🗺️ 시트에 가려진 지도 타일은 받지 않는다(2026-10-15) — 되돌려-검증 주입.
const TEST = 'src/tests/unit/map-hidden-bottom-2026-10-15.test.ts'

export default [
  {
    name: '🗺️ 지도를 화면 끝까지 만든다(시트 밑 타일을 다시 받는다)',
    file: 'src/pages/restaurant-map/useKakaoMap.ts',
    find: '        mapRef.current.style.bottom = `${hb}px`\n',
    replace: '',
    test: TEST,
    why: '시트가 덮는 아래 240px 타일 — 느린 회선에서 보이는 타일과 회선을 나눈다.',
  },
  {
    name: '🗺️ 페이지가 가려진 높이를 0 으로 넘긴다',
    file: 'src/pages/RestaurantMapPage.tsx',
    find: 'hiddenBottomPx: isLgNow() ? 0 : SHEET_PEEK_VISIBLE_PX - SHEET_CORNER_PX,',
    replace: 'hiddenBottomPx: 0,',
    test: TEST,
    why: '배선이 끊기면 처방이 조용히 사라진다.',
  },
  {
    name: '🗺️ 카드 pan 이 칸을 펴지 않고 오프셋을 계산한다',
    file: 'src/pages/restaurant-map/useKakaoMap.ts',
    find: "    if (snap === 'card') releaseHiddenBottom()\n",
    replace: '',
    test: TEST,
    why: '줄어든 칸 기준으로 pan 한 뒤 layout effect 가 relayout 하면 진행 중인 pan 이 끊긴다.',
  },
  {
    name: '🗺️ 펼 때 중심 보정을 빼먹는다(지도가 아래로 튄다)',
    file: 'src/pages/restaurant-map/useKakaoMap.ts',
    find: 'pt.y + delta / 2',
    replace: 'pt.y',
    test: TEST,
    why: '칸이 d 자라면 화면 중심이 d/2 내려간다 — 보정이 없으면 위쪽 내용이 d/2 밀린다.',
  },
  {
    name: '🗺️ ResizeObserver 가 이미 맞춘 높이에도 다시 relayout',
    file: 'src/pages/RestaurantMapPage.tsx',
    find: '        if (el.clientHeight === layoutHeightRef.current && el.clientWidth === lastW) return\n',
    replace: '',
    test: TEST,
    why: '150ms 뒤 setCenter(getCenter) 가 카드 선택 pan 애니메이션을 끊는다.',
  },
]
