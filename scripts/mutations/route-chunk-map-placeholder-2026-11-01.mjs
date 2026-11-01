/**
 * 🧬 주입 — 라우트 청크 맵 자리표시자 + 번들 시 교체 (2026-11-01 대표 *"모두 다 해줘"*)
 *    가드: src/tests/unit/route-chunk-map-placeholder-2026-11-01.test.ts
 *
 * 막는 사고 둘: ① 빌드가 추적 파일을 덮어써 빈 맵이 커밋되고 PR 끼리 충돌한다
 *              ② 플러그인이 헛돌아 배포 HTML 의 첫 화면 미리받기가 **조용히** 사라진다
 */
const T = 'src/tests/unit/route-chunk-map-placeholder-2026-11-01.test.ts'
const P = 'scripts/route-chunk-map-plugin.cjs'
export default [
  {
    name: '라우트맵 — 플러그인이 언제나 자리표시자를 고른다(번들에 빈 맵)',
    file: P,
    find: '      return { path: fs.existsSync(ROUTE_MAP_BUILD) ? ROUTE_MAP_BUILD : ROUTE_MAP_PLACEHOLDER };',
    replace: '      return { path: ROUTE_MAP_PLACEHOLDER };',
    test: T,
    why: '배포 HTML 의 첫 화면 미리받기가 0 이 되는데 에러가 없다 — 이 변경의 가장 나쁜 실패 모드다.',
  },
  {
    name: '라우트맵 — 번들 대조를 끈다(빠진 청크를 못 본다)',
    file: P,
    find: '  if (missing.length > 0) {',
    replace: '  if (false) {',
    test: T,
    why: '플러그인이 헛돌아도 빌드가 초록이다 — 대조가 이 변경의 유일한 안전망이다.',
  },
  {
    name: '라우트맵 — 생성기가 다시 추적 파일을 덮어쓴다',
    file: 'scripts/generate-route-chunk-map.mjs',
    find: "export const ROUTE_CHUNK_MAP_BUILD = join(ROOT, 'src/worker/generated/route-chunk-map.build.ts')",
    replace: "export const ROUTE_CHUNK_MAP_BUILD = join(ROOT, 'src/worker/generated/route-chunk-map.ts')",
    test: T,
    why: '빈 맵이 추적 파일을 덮어쓰고(로컬 워커 빌드) 그게 커밋된다 — main 150커밋 중 5회 일어난 일이다.',
  },
  {
    name: '라우트맵 — 워커 빌드가 플러그인을 안 쓴다',
    file: 'scripts/build-worker.js',
    find: '      plugins: [routeChunkMapPlugin()],',
    replace: '      plugins: [],',
    test: T,
    why: '번들이 자리표시자(빈 맵)를 집는다 — 배포 HTML 미리받기 0.',
  },
  {
    name: '라우트맵 — 추적 파일에 진짜 값을 다시 적는다',
    file: 'src/worker/generated/route-chunk-map.ts',
    find: 'export const ROUTE_CHUNK_MAP: Record<string, { js: string[]; css: string[] }> = {}',
    replace: 'export const ROUTE_CHUNK_MAP: Record<string, { js: string[]; css: string[] }> = { home: { js: ["/assets/X-12345678.js"], css: [] } }',
    test: T,
    why: '빌드마다 해시가 바뀌는 값이 추적되면 무관한 PR 끼리 이 파일에서 충돌한다.',
  },
  {
    name: '라우트맵 — 무게 검사가 자리표시자를 잰다(늘 0)',
    file: 'scripts/check-surface-budgets.mjs',
    find: "'src/worker/generated/route-chunk-map.build.ts'",
    replace: "'src/worker/generated/route-chunk-map.ts'",
    test: T,
    why: '자리표시자는 비어 있어서 그 검사가 언제나 0 을 재고 초록이 된다(헛도는 가드).',
  },
]
