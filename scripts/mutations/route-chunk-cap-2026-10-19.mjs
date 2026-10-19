/**
 * 🧬 주입 — 라우트 청크 미리받기 캡 (2026-10-19 지도 실측)
 */
export default [
  {
    name: '라우트캡 — 미리받기 캡을 10 으로 되돌린다',
    file: 'scripts/generate-route-chunk-map.mjs',
    find: 'const MAX_LINKS = 16',
    replace: 'const MAX_LINKS = 10',
    test: 'src/tests/unit/route-chunk-surfaces.test.ts',
    why: '지도·이용권 상세·유어샵·검색·지역의 정적 의존이 잘려 페이지 실행 뒤 직렬로 받는다.',
  },
]
