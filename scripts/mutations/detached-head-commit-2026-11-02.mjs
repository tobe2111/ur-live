/**
 * 🧬 주입 — 브랜치 밖 커밋 금지 (2026-11-02)
 *    가드: src/tests/unit/detached-head-commit-2026-11-02.test.ts
 */
const T = 'src/tests/unit/detached-head-commit-2026-11-02.test.ts'
export default [
  {
    name: '🧭 브랜치 밖 커밋을 다시 통과시킨다 (push 가 up-to-date 를 내고 고침이 사라짐)',
    file: 'scripts/check-detached-head.mjs',
    find: '  if (allow || branch || inProgress.length) return []',
    replace: '  return []',
    test: T,
    why: '2026-11-02 실측 — 브랜치 밖 커밋이 아무 데도 안 올라갔는데 모든 단계가 성공 메시지였다.',
  },
  {
    name: '🧭 pre-commit 에서 브랜치 밖 검사를 뺀다',
    file: 'scripts/install-git-hooks.sh',
    find: 'node scripts/check-detached-head.mjs || {',
    replace: 'node scripts/check-detached-head.mjs || true; true || {',
    test: T,
    why: '판정이 있어도 훅에서 안 막으면 지키는 척만 한다.',
  },
]
