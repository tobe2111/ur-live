/**
 * 🧬 주입 — 세션 시작 시 git 검사 자동 설치 (2026-11-01 대표 *"모두 다 해줘"*)
 *    가드: src/tests/unit/session-start-git-hooks-2026-11-01.test.ts
 *
 * 막는 사고: 원격 세션이 git 검사 없이 커밋해 오류를 CI 에서야(최소 26분 뒤) 처음 본다.
 */
const T = 'src/tests/unit/session-start-git-hooks-2026-11-01.test.ts'
const F = '.claude/hooks/session-start.sh'
export default [
  {
    name: '세션시작훅 — 설치 호출을 지운다(문서 규칙만 남는다)',
    file: F,
    find: '  if (cd "$CLAUDE_PROJECT_DIR" && bash scripts/install-git-hooks.sh >/dev/null 2>&1); then',
    replace: '  if (cd "$CLAUDE_PROJECT_DIR" && true); then',
    test: T,
    why: '설치가 사라지면 잊은 세션이 로컬 검사 없이 커밋한다 — 이 변경 전으로 돌아간다.',
  },
  {
    name: '세션시작훅 — 설치를 중간 종료 뒤로 옮긴다(조용히 안 깔린다)',
    file: F,
    find: 'if [ -f "$CLAUDE_PROJECT_DIR/scripts/install-git-hooks.sh" ]; then\n',
    replace: 'exit 0\nif [ -f "$CLAUDE_PROJECT_DIR/scripts/install-git-hooks.sh" ]; then\n',
    test: T,
    why: '스크래퍼가 이미 돌면 그 자리에서 끝나는데 설치가 그 뒤에 있으면 에러 없이 안 깔린다.',
  },
]
