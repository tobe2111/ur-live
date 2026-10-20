/**
 * 되돌려-검증 주입 — GitHub 쪽 머지 사전검사 (2026-10-06)
 *
 * 지키는 것: "로컬 git 은 clean 이라고 하는데 GitHub 은 충돌" 이라는 상태를 푸시 전에 잡는다.
 *   그 상태가 되면 GitHub 이 머지 커밋을 못 만들어 `pull_request` 워크플로가 아예 안 돌고,
 *   PR 에 `Verify` 가 **실패도 아니고 부재**로 남는다(auto-merge 조용히 멎음).
 */
export default [
  {
    name: 'github-side-merge: attr-source 를 merge-tree 하위로 옮긴다 (exit 129 → "충돌" 오독)',
    why: '2026-10-06 에 제가 실제로 저지른 오류. 명령이 실패하는데 충돌로 읽히면 근거가 가짜가 된다.',
    file: 'scripts/check-github-side-merge.mjs',
    find: "const noDrivers = tryGit([`--attr-source=${EMPTY_TREE}`, 'merge-tree', '--write-tree', BASE, HEAD])",
    replace: "const noDrivers = tryGit(['merge-tree', '--write-tree', `--attr-source=${EMPTY_TREE}`, BASE, HEAD])",
    test: 'src/tests/unit/github-side-merge-check-2026-10-06.test.ts',
  },
  {
    name: 'github-side-merge: 명령 실패와 충돌을 구분하지 않는다',
    why: '구분을 지우면 usage 오류가 조용히 "충돌 없음" 또는 "충돌" 로 둔갑한다.',
    file: 'scripts/check-github-side-merge.mjs',
    find: "if (!noDrivers.ok && /unknown option|usage: git/.test(noDrivers.out)) {",
    replace: "if (!noDrivers.ok && /zzz-never-matches/.test(noDrivers.out)) {",
    test: 'src/tests/unit/github-side-merge-check-2026-10-06.test.ts',
  },
  {
    name: 'github-side-merge: 함정을 찾아도 통과시킨다',
    why: '검사가 exit 0 이면 "보호받고 있다" 는 착각만 남는다 — 이 레포가 반복해 당한 클래스.',
    file: 'scripts/check-github-side-merge.mjs',
    find: "if (withDrivers.ok && maskedByDriver.length > 0) {",
    replace: "if (false && withDrivers.ok && maskedByDriver.length > 0) {",
    test: 'src/tests/unit/github-side-merge-check-2026-10-06.test.ts',
  },
  {
    name: 'github-side-merge: pre-push 게이트 배선 제거',
    why: '배선이 끊기면 검사는 파일로만 남는다(= 안 돈다).',
    file: 'scripts/pre-push-gate.mjs',
    find: "const out = execFileSync('node', ['scripts/check-github-side-merge.mjs'], {",
    replace: "const out = execFileSync('node', ['scripts/pre-push-tests.mjs'], {",
    test: 'src/tests/unit/github-side-merge-check-2026-10-06.test.ts',
  },
  {
    name: 'guard-registry: pre-push 게이트를 러너로 안 본다',
    why: '그러면 pre-push 전용 검사가 전부 "어디서도 안 돈다" 로 걸려, 결국 가드를 지우게 된다.',
    file: 'scripts/check-guard-registry.mjs',
    find: "  add('scripts/pre-push-gate.mjs')",
    replace: "  // add('scripts/pre-push-gate.mjs')",
    test: 'src/tests/unit/github-side-merge-check-2026-10-06.test.ts',
  },
  {
    name: 'guard-registry: local-ci-parity 까지 러너로 본다 (제외 목록이 등록됨으로 둔갑)',
    why: 'EXCLUDE 에 적힌 "CI 담당" 가드 이름들이 등록됨으로 세어져, 로컬·CI 양쪽에서 안 도는 가드가 통과한다.',
    file: 'scripts/check-guard-registry.mjs',
    find: "  add('scripts/pre-push-gate.mjs')",
    replace: "  add('scripts/pre-push-gate.mjs')\n  add('scripts/local-ci-parity.mjs')",
    test: 'src/tests/unit/github-side-merge-check-2026-10-06.test.ts',
  },
]
