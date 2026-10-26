/** 🧬 주입 — 지도 선택 카드 넘김 모션(2026-10-27). 가드: src/tests/unit/map-card-slide-2026-10-27.test.tsx */
const T = 'src/tests/unit/map-card-slide-2026-10-27.test.tsx'
export default [
  {
    name: 'map-card-slide — 버튼이 빼내기 없이 즉시 바꾼다',
    file: 'src/pages/restaurant-map/SelectedDealCard.tsx',
    find: "    window.setTimeout(() => { pendingIn.current = dir; go() }, 180)\n",
    replace: "    pendingIn.current = dir; go()\n",
    test: T,
    why: '카드가 빠지기 전에 내용이 갈려 고무줄처럼 보인다.',
  },
  {
    name: 'map-card-slide — 다시 ×0.35 고무줄',
    file: 'src/pages/restaurant-map/SelectedDealCard.tsx',
    find: 'edge ? cur.dx * 0.25 : cur.dx',
    replace: 'cur.dx * 0.35',
    test: T,
    why: '카드가 손가락을 1/3 만 따라온다(대표 신고).',
  },
]
