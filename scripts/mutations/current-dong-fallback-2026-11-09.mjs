/** 🧬 주입 — 동네 이름 임시값이 빠지면 빨간불인가. 가드: src/tests/unit/current-dong-fallback-2026-11-09.test.tsx */
export default [
  {
    name: '동네임시 — 캐시가 빗나가면 이름을 비운다',
    file: 'src/hooks/useCurrentDong.ts',
    find: '(loc ? readCache(gridKey(loc.lat, loc.lng)) ?? lastKnownDong() : null)',
    replace: '(loc ? readCache(gridKey(loc.lat, loc.lng)) : null)',
    test: 'src/tests/unit/current-dong-fallback-2026-11-09.test.tsx',
    why: '앱이 화면을 넘겨받는 순간 맨 위 이름이 "내 주변" 으로 깜빡이고, 그 값이 쿠키에도 저장된다.',
  },
]
