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
const WORKFLOW = '.github/workflows/dark-contrast.yml'

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
  {
    name: '🕳️ 워크플로 들여쓰기를 깨뜨린다 (CI 가 빨간불이 아니라 아예 안 돈다)',
    file: WORKFLOW,
    find: '    steps:',
    replace: '    steps:\n  - name: 들여쓰기가 깨진 스텝',
    test: TEST,
    why:
      '2026-09-14 에 실제로 밟았다 — verify.yml 한 스텝의 들여쓰기가 어긋나자 잡 0개로 즉시 ' +
      '종료됐고, PR 에는 Verify 가 뜨지도 않은 채 Pages 초록 하나만 남아 통과처럼 보였다. ' +
      '실패가 아니라 부재라서 아무도 못 본다.',
  },
  {
    name: '🕳️ 경고 전용 가드를 차단으로 오해한다 (반대로면 가드가 조용히 샌다)',
    file: SSOT,
    find: "      const bucket = step?.['continue-on-error'] === true ? warn : strict",
    replace: '      const bucket = strict',
    test: TEST,
    why:
      'continue-on-error 를 못 보면 경고/차단 구분이 무너진다. 이쪽 방향(경고를 차단으로)은 ' +
      '헛수고로 끝나지만 반대 방향은 CI 가 막는 가드를 게이트가 건너뛴다 — 처음 정규식판이 ' +
      'check-bundle-size 에서 실제로 틀렸던 자리다.',
  },
  {
    name: '🕳️ 대조군 정규식이 아무것도 안 줍는다 (파서 눈먼 자리를 못 본다)',
    file: SSOT,
    find: "    for (const m of line.matchAll(/scripts\\/(check-[a-z0-9-]+\\.(?:mjs|sh))/g)) found.add(m[1])",
    replace: '    if (line) continue',
    test: TEST,
    why:
      '대조군이 0 을 뱉으면 R5 의 filter 가 빈 배열이 되어 **저절로 통과**한다. ' +
      '검사가 실패할 수 없게 되는 바로 그 클래스 — 하한을 둔 이유다.',
  },
]
