/**
 * 🧬 주입 — rebaseline 은 위반한 화면만 바꾸고 기록은 파일 하나씩 (2026-11-02 대표 *"이러니까 계속 충돌이 되었지"*)
 *    가드: src/tests/unit/surface-budgets-2026-10-14.test.ts (④)
 *
 * 막는 사고: 화면 하나만 늘어도 27개 화면 줄을 전부 다시 써서, 다른 세션과 같은 줄을 다툰다.
 */
const T = 'src/tests/unit/surface-budgets-2026-10-14.test.ts'
const F = 'scripts/check-surface-budgets.mjs'
export default [
  {
    name: '예산 rebaseline — 위반 없는 화면까지 전부 새 값으로 쓴다(옛 동작)',
    file: F,
    find: '    surfaces[s] = all || touch.has(s) ? measured[s] : prev[s]',
    replace: '    surfaces[s] = measured[s]',
    test: T,
    why: '±0.02 흔들림이 27줄을 전부 바꿔 다른 세션과 머지마다 충돌한다.',
  },
  {
    name: '예산 rebaseline — 기록을 다시 JSON 끝에 덧붙인다',
    file: F,
    find: '    history: baseline.history || [],',
    replace: "    history: [...(baseline.history || []), { date, reason, changes: errs.map((e) => e.msg) }],",
    test: T,
    why: '모든 rebaseline 이 같은 자리(배열 끝)에 써서 충돌한다 — 잠금 기록과 같은 병.',
  },
]
