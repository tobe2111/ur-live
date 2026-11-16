/**
 * 🧬 주입 — CLAUDE.md 에서 옮긴 두 절 (2026-11-16) · 가드: src/tests/unit/claude-md-moved-sections-2026-11-16.test.ts
 */
const T = 'src/tests/unit/claude-md-moved-sections-2026-11-16.test.ts'
export default [
  {
    name: '📦 예산 검사가 옮긴 문서 안의 참조를 다시 안 잰다 (큰 인계가 경고 없이 자란다)',
    file: 'scripts/check-context-budget.mjs',
    find: "  const src = [claude, ...moved.map((p) => read(p) || '')].join('\\n')",
    replace: '  const src = claude',
    test: T,
    why: '옮기기 전 CLAUDE.md 가 가리키던 문서 6건(16만 바이트 인계 포함)이 감시에서 빠진다.',
  },
  {
    name: '📦 디자인 절의 "먼저 읽을 것" 길잡이가 사라진다',
    file: 'CLAUDE.md',
    find: '`docs/design/design-system-rules.md` 를 먼저 읽을 것',
    replace: '`docs/design/design-system-rules.md` 참고',
    test: T,
    why: '길잡이가 없으면 디자인 작업 세션이 전문을 안 열고 요약만 보고 규칙을 놓친다 — 예산 검사도 그 문서를 상한 없는 등급으로 본다.',
  },
]
