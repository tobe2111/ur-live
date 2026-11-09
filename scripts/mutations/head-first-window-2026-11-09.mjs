/**
 * 🧬 주입 — 첫 화면 앞 바이트 다이어트가 되돌아오면 빨간불인가 (2026-11-09)
 *    가드: src/tests/unit/head-first-window-2026-11-09.test.ts
 */
const T = 'src/tests/unit/head-first-window-2026-11-09.test.ts'
export default [
  {
    name: '첫송신량 — head 의 JSON-LD 를 다시 head 에 남긴다',
    file: 'scripts/html-slim.mjs',
    find: "  let out = moveHeadJsonLdToBody(stripStyleComments(stripHtmlComments(html)))",
    replace: "  let out = stripStyleComments(stripHtmlComments(html))",
    test: T,
    why: '검색엔진 데이터가 첫 화면보다 먼저 와서 한국→LA 회선에 왕복이 한 번 더 든다.',
  },
  {
    name: '첫송신량 — 워커 JSON-LD 가 head 로 돌아간다',
    file: 'src/worker/utils/surface-ssr-meta.ts',
    find: "    withCanon = withCanon.on('body', {",
    replace: "    withCanon = withCanon.on('head', {",
    test: T,
    why: '표면마다 5KB 안팎의 JSON-LD 가 첫 화면 앞 바이트로 돌아온다.',
  },
]
