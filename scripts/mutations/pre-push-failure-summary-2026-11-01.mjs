/**
 * 🧬 주입 — pre-push 실패 요약이 진짜 실패를 먼저 (2026-11-01)
 *    가드: src/tests/unit/pre-push-failure-summary-2026-11-01.test.ts
 */
const T = 'src/tests/unit/pre-push-failure-summary-2026-11-01.test.ts'
const F = 'scripts/pre-push-failure-summary.mjs'
export default [
  {
    name: '실패요약 — 실패 줄을 앞세우지 않는다(잡음이 FAIL 을 가린다)',
    file: F,
    find: '  const lines = [...primary, ...secondary]',
    replace: '  const lines = all.filter((l) => /FAIL|×|AssertionError|Error:|expected/.test(l))',
    test: T,
    why: '같은 로그 한 줄 30개가 요약을 채워 무엇이 빨간지 안 보인다 — 2026-11-01 에 실제로 그랬다.',
  },
  {
    name: '실패요약 — 같은 잡음 줄의 중복을 안 지운다',
    file: F,
    find: "  const secondary = [...new Set(all.filter((l) => /Error:|expected/.test(l) && !primary.includes(l)))]",
    replace: "  const secondary = all.filter((l) => /Error:|expected/.test(l) && !primary.includes(l))",
    test: T,
    why: '실패 줄 뒤에 같은 잡음이 수십 줄 붙어 다른 오류 줄이 잘려 나간다.',
  },
]
