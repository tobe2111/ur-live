// 🏨 2026-10-15 — 색인 진입점 청크 미리받기(워커 chunkSurface)
export default [
  {
    name: '🈯 번역 청크를 미리 안 받는다',
    file: 'src/worker/index.ts',
    find: 'for (const f of [...routeChunks.js, ...BOOT_JS])',
    replace: 'for (const f of [...routeChunks.js])',
    test: 'src/tests/unit/preload-only-routes-2026-10-15.test.ts',
    why: '번역이 엔트리 실행 뒤에야 출발해 화면이 임시 문구로 그렸다가 다시 그린다(실측 2.5초 → 0.24초 차이)',
  },
  {
    name: '🏨 숙소 상세 하드로드가 화면 청크를 미리 안 받는다',
    file: 'src/shared/route-surface.ts',
    find: "  if (/^\\/stays\\/\\d+(?:[/?#]|$)/.test(p)) return 'stayDetail'\n",
    replace: '',
    test: 'src/tests/unit/preload-only-routes-2026-10-15.test.ts',
    why: '숙소 정본(sitemap 49건)의 화면 청크가 다시 엔트리가 다 돈 뒤에야 출발한다',
  },
  {
    name: '🏨 미리받기 전용 표면이 청크 묶음에 섞인다',
    file: 'scripts/generate-route-chunk-map.mjs',
    find: "  urshorts: ['src/pages/UrShortsBrowsePage.tsx'],\n}",
    replace: "  urshorts: ['src/pages/UrShortsBrowsePage.tsx'],\n  stays: ['src/pages/StaysSearchPage.tsx'],\n}",
    test: 'src/tests/unit/preload-only-routes-2026-10-15.test.ts',
    why: '묶음이 다시 짜이며 청크 순환이 생긴다(빌드 게이트)',
  },
]
