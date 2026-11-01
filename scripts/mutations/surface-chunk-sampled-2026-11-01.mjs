/**
 * 🧬 주입 — 첫 화면 청크 수 래칫의 1% 표본 처리 (2026-11-01)
 *    가드: src/tests/unit/surface-chunk-sampled-2026-11-01.test.ts
 */
const T = 'src/tests/unit/surface-chunk-sampled-2026-11-01.test.ts'
const F = 'scripts/check-surface-chunk-runtime.mjs'
export default [
  {
    name: '표본청크 — validation 을 늘 뺀다(zod eager 회귀를 못 본다)',
    file: F,
    find: "  if (!list.includes('env-validator')) return list",
    replace: "  if (false) return list",
    test: T,
    why: 'zod 가 혼자 첫 화면에 실려도 세지 않는다 — 잠금표가 막는 그 회귀(validateEnvForRuntime eager)가 통과한다.',
  },
  {
    name: '표본청크 — 세기 전에 표본을 안 뺀다(무작위 빨간불)',
    file: F,
    find: '    const chunks = dropSampled([...new Set(res.chunks.map(stem))])',
    replace: '    const chunks = [...new Set(res.chunks.map(stem))]',
    test: T,
    why: '측정이 1% 표본에 걸리면 청크 수 래칫이 무작위로 빨간불이 된다 — PR #2080 에서 실제로 그랬다.',
  },
]
