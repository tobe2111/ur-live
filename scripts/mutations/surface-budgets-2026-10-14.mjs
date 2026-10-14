/**
 * 📏 화면별 첫 화면 무게 래칫 (2026-10-14) — 주입 매니페스트.
 * 가드: src/tests/unit/surface-budgets-2026-10-14.test.ts
 * 예산 가드는 "늘 통과" 로 무너지기 쉽다(이 레포의 gzip 예산이 몇 달간 0 을 재며 초록이었다).
 */
const TEST = 'src/tests/unit/surface-budgets-2026-10-14.test.ts'
const G = 'scripts/check-surface-budgets.mjs'

export default [
  {
    name: '[surface-budgets] 늘어난 화면을 통과시킨다',
    file: G,
    find: '    if (m.totalKB > b.totalKB + tolerance) {',
    replace: '    if (false) {',
    test: TEST,
    why: '상세에 30KB 를 붙여도 PR 이 초록이 된다 — 이 가드가 존재하는 이유가 사라진다.',
  },
  {
    name: '[surface-budgets] 줄어든 값을 잠그지 않는다',
    file: G,
    find: '    } else if (m.totalKB < b.totalKB - slack) {',
    replace: '    } else if (false) {',
    test: TEST,
    why: '줄인 여유가 다음 기능에 조용히 다시 먹힌다 — 래칫이 아니라 헐거운 선이 된다.',
  },
  {
    name: '[surface-budgets] 기준에 없는 새 화면을 그냥 통과시킨다',
    file: G,
    find: "    if (!b) { errors.push({ s, kind: 'new',",
    replace: "    if (!b) { continue; errors.push({ s, kind: 'new',",
    test: TEST,
    why: '새 하드로드 화면이 예산 없이 들어온다.',
  },
  {
    name: '[surface-budgets] CSS 를 무게에서 뺀다',
    file: G,
    find: "  const out = { __boot__: [...boot, ...css] }",
    replace: "  const out = { __boot__: [...boot] }",
    test: TEST,
    why: '렌더를 막는 CSS(29KB br) 가 아무리 커져도 안 잡힌다.',
  },
  {
    name: '[surface-budgets] verify 에서 경고로만 돈다',
    file: '.github/workflows/verify.yml',
    find: '      - name: Per-surface first-screen weight budget (strict)\n        run: node scripts/check-surface-budgets.mjs\n',
    replace: '      - name: Per-surface first-screen weight budget (strict)\n        continue-on-error: true\n        run: node scripts/check-surface-budgets.mjs\n',
    test: TEST,
    why: '빨간불이 떠도 PR 이 머지된다.',
  },
]
