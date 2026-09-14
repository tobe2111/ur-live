/**
 * 🛡️ "CI 가 막는 것은 로컬도 막는다" (2026-09-14).
 *
 * 실측 91개 가드가 CI strict 인데 로컬은 무방비였다 — 위반 하나가 CI 57분을 태웠다.
 * 이 주입들은 그 사각지대를 되살려 보고, 가드가 **실제로 빨간불을 내는지** 확인한다.
 *
 * 가드: src/tests/unit/local-ci-parity.test.ts
 */
const TEST = 'src/tests/unit/local-ci-parity.test.ts'
const SSOT = 'scripts/local-ci-parity.mjs'
const GATE = 'scripts/pre-push-gate.mjs'
const INSTALLER = 'scripts/install-git-hooks.sh'

export default [
  {
    name: '🕳️ 제외 목록에 사유 없이 슬쩍 넣는다 (사각지대가 조용히 자란다)',
    file: SSOT,
    find: "export const EXCLUDE = {",
    replace: "export const EXCLUDE = {\n  'check-theme-consistency.mjs': '',",
    test: TEST,
    why:
      '사유 없이 제외할 수 있으면 "일단 빼고 나중에" 가 쌓여 원래 상태로 돌아간다. ' +
      '제외에 이유를 적게 하는 것이 이 체계의 유일한 방파제다.',
  },
  {
    name: '🕳️ 게이트가 가드 0개를 통과로 친다 (헛도는 가드의 전형)',
    file: GATE,
    find: 'if (guards.length === 0) {',
    replace: 'if (false) {',
    test: TEST,
    why:
      'verify.yml 파서가 낡아 0개를 뽑으면 게이트는 "전부 통과" 라고 말하고 끝난다. ' +
      '이 레포가 반복해 당한 클래스 — 검사가 실패할 수 없게 되는 것.',
  },
  {
    name: '🕳️ 설치 스크립트에서 pre-push 훅 등록을 뺀다 (다음 세션부터 조용히 무방비)',
    file: INSTALLER,
    find: 'PUSH_HOOK="$HOOK_DIR/pre-push"',
    replace: 'PUSH_HOOK="/dev/null"',
    test: TEST,
    why:
      '훅은 클론에 안 딸려 오므로 설치 스크립트가 유일한 배포 경로다. ' +
      '여기서 빠지면 새 컨테이너는 전부 무방비인데 아무 에러도 안 난다.',
  },
]
