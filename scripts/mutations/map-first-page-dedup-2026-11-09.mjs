/** 🧬 주입 — 지도 첫 목록 요청 묶기가 빠지면 빨간불인가. 가드: src/tests/unit/map-first-page-dedup-2026-11-09.test.ts */
export default [
  {
    name: '지도첫목록 — 진행 중 요청을 안 묶는다',
    file: 'src/hooks/queries/useMapProducts.ts',
    find: '  if (cur) return cur\n  const p = fetchPage(category, 1, near, sort)',
    replace: '  const p = fetchPage(category, 1, near, sort)',
    test: 'src/tests/unit/map-first-page-dedup-2026-11-09.test.ts',
    why: '홈 지도 버튼 → 지도 화면에서 같은 목록을 두 번 받는다(한국→LA 왕복 하나 중복).',
  },
]
