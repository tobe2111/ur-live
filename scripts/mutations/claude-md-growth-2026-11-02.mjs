/**
 * 🧬 주입 — CLAUDE.md 증가 상한 + 판정 기록 차단 (2026-11-02)
 *    가드: src/tests/unit/claude-md-growth-2026-11-02.test.ts
 *
 * 막는 사고: 세션들이 CLAUDE.md 에 판정 결과·긴 기록을 계속 쌓아 머지마다 충돌하고 모든 세션의 캐시가 깨진다.
 */
const T = 'src/tests/unit/claude-md-growth-2026-11-02.test.ts'
const F = 'scripts/check-claude-md-growth.mjs'
export default [
  {
    name: 'CLAUDE.md 상한 — 증가 상한을 헐겁게(2만 자)',
    file: F,
    find: 'export const GROWTH_LIMIT_CHARS = 4000',
    replace: 'export const GROWTH_LIMIT_CHARS = 20000',
    test: T,
    why: '상한이 헐거우면 다시 한 줄씩 쌓여 30만 토큰이 된다(2026-11-01 사고).',
  },
  {
    name: 'CLAUDE.md 상한 — 판정 기록 검사를 끈다',
    file: F,
    find: '  const records = addedLines.filter((l) => RECORD_PATTERNS.some((re) => re.test(l)))',
    replace: '  const records = []',
    test: T,
    why: '판정 결과가 다시 CLAUDE.md 에 쌓인다(#2067 이 그랬다).',
  },
  {
    name: 'CLAUDE.md 상한 — verify 에서 단계를 뺀다',
    file: '.github/workflows/verify.yml',
    find: '        run: node scripts/check-claude-md-growth.mjs\n',
    replace: '        run: "true"\n',
    test: T,
    why: '가드가 있어도 안 돌면 없는 것과 같다.',
  },
]
