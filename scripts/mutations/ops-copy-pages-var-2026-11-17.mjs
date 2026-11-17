/**
 * 🧬 주입 — ops 워크플로(Pages 설정 → 워커) (2026-11-17) · 가드: src/tests/unit/ops-copy-pages-var-2026-11-17.test.ts
 */
const T = 'src/tests/unit/ops-copy-pages-var-2026-11-17.test.ts'
export default [
  {
    name: '🔧 secret_text 도 빈 값으로 옮긴다',
    file: 'scripts/ops/copy-pages-var-to-worker.mjs',
    find: "    if (v.type !== 'plain_text' || typeof v.value !== 'string' || v.value === '') {",
    replace: "    if (false) {",
    test: T,
    why: '값을 못 읽는 시크릿이 빈 문자열로 워커에 들어가 기존 값을 덮는다.',
  },
  {
    name: '🔧 이름 검증이 빠진다',
    file: 'scripts/ops/copy-pages-var-to-worker.mjs',
    find: "  for (const n of names) if (!/^[A-Z][A-Z0-9_]{1,63}$/.test(n)) throw new Error(`이름 형식이 아니다: ${JSON.stringify(n)}`)",
    replace: '',
    test: T,
    why: '임의 문자열이 wrangler 인자로 들어간다.',
  },
]
