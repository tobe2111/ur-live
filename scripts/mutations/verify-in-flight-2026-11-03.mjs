/**
 * 🧬 주입 — 검사 진행 중 푸시 안내 (2026-11-03) · 가드: src/tests/unit/verify-in-flight-2026-11-03.test.ts
 */
const T = 'src/tests/unit/verify-in-flight-2026-11-03.test.ts'
export default [
  {
    name: '⏳ 돌고 있는 검사를 보고도 통과시킨다 (모르고 올려 42분을 버림)',
    file: 'scripts/check-verify-in-flight.mjs',
    find: '  return { block: best.minutes >= MIN_MINUTES, minutes: Math.round(best.minutes), url: best.url }',
    replace: '  return { block: false, minutes: Math.round(best.minutes), url: best.url }',
    test: T,
    why: '최근 3일 PR 검사의 42% 가 새 푸시로 취소됐다(평균 42분 진행 후).',
  },
  {
    name: '⏳ 푸시 게이트가 시간 초과에도 멈춘다 (조회가 느리면 아무도 못 올린다)',
    file: 'scripts/pre-push-gate.mjs',
    find: '  if (err?.status === 1) process.exit(1)',
    replace: '  process.exit(1)',
    test: T,
    why: '안내가 가드처럼 굴면 네트워크가 느린 날 모든 푸시가 막힌다.',
  },
]
