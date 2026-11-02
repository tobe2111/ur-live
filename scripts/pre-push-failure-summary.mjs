/**
 * 🧾 pre-push 시험 실패 요약 — **진짜 실패 줄을 먼저** (2026-11-01).
 *
 * 🩸 시험이 찍는 같은 로그 한 줄(`Error: no such table: rate_limit_attempts`)이 요약 30줄을 다 채워
 * 진짜 실패(`FAIL`·`×`)를 가렸다. 요약만 보고는 *무엇이* 빨간지 알 수 없어 시험 목록을 따로 뽑아 다시
 * 돌려야 했다. 원인을 가리는 메시지는 그 자체가 결함이다(CLAUDE.md 개발 룰 3-1).
 *
 * 순수 함수라 시험이 출력 문자열을 넣고 결과를 본다: `src/tests/unit/pre-push-failure-summary-2026-11-01.test.ts`
 */
export function summarizeFailure(out, max = 30) {
  const all = String(out ?? '').split('\n')
  const primary = all.filter((l) => /\bFAIL\b|×|AssertionError/.test(l))
  const secondary = [...new Set(all.filter((l) => /Error:|expected/.test(l) && !primary.includes(l)))]
  const lines = [...primary, ...secondary]
  return (lines.length ? lines : all).slice(0, max)
}
