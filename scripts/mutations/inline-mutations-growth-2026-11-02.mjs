/**
 * 🧬 주입 — 옛 인라인 주입 배열을 늘리지 못하게 (2026-11-02, 차이 기준으로 재조준)
 *    가드: src/tests/unit/inline-mutations-growth-2026-11-02.test.ts · scripts/check-inline-mutations-growth.mjs
 *
 * 막는 사고: 세션들이 러너의 10,000줄 배열에 계속 덧붙여 머지마다 같은 자리를 다툰다.
 */
const T = 'src/tests/unit/inline-mutations-growth-2026-11-02.test.ts'
const G = 'scripts/check-inline-mutations-growth.mjs'
export default [
  {
    name: '인라인 증가 — 늘려도 통과하게 판정을 헐겁게 만든다',
    file: G,
    find: '  if (head > base) {',
    replace: '  if (head > base + 1000) {',
    test: T,
    why: '판정이 헐거우면 세션들이 다시 그 배열에 덧붙여 같은 자리를 다툰다.',
  },
  {
    name: '인라인 증가 — Verify 배선을 뺀다',
    file: '.github/workflows/verify.yml',
    find: '      - name: Inline mutations growth guard (strict)\n        run: node scripts/check-inline-mutations-growth.mjs\n',
    replace: '      - name: Inline mutations growth guard (strict)\n        run: echo skipped\n',
    test: T,
    why: '판정이 있어도 안 돌면 지키는 척만 한다(이 레포의 "가드가 있는데 안 돎" 클래스).',
  },
]
