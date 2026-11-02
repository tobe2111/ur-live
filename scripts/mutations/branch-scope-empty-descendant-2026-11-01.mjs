/**
 * 🧬 주입 — 0건의 원인 둘(낡은 base ↔ 내용 없는 자손)을 구분하는 판정 (2026-11-01)
 *    가드: src/tests/unit/branch-scope-empty-descendant-2026-11-01.test.ts
 *
 *    ⚠️ 이 판정은 **양방향**이라 주입도 양방향이다 — 조건을 되돌리면 정상 푸시가 막히고(거짓 빨간불),
 *       늘 통과시키면 낡은 base 가 눈먼 초록으로 돌아온다.
 */
const T = 'src/tests/unit/branch-scope-empty-descendant-2026-11-01.test.ts'
const F = 'scripts/check-branch-scope.mjs'
export default [
  {
    name: 'branch-scope — 조상이어도 무조건 실패(수리 전 동작으로 되돌린다)',
    file: F,
    find: '    if (!baseIsAncestor) {',
    replace: '    if (true) {',
    test: T,
    why:
      '수리 전에는 0건 + HEAD≠base 면 **무조건** 실패였다. 그러면 내용 변화가 0인 머지 커밋·빈 커밋이 ' +
      '영구히 막히고, 가드가 내놓는 처방(`git fetch origin main`)은 그 원인을 해결하지 못한다 — ' +
      '2026-11-01 에 fetch 후에도 같은 빨간불이었다(실측). 해결되지 않는 명령을 안내하는 거짓 빨간불은 ' +
      '다음 세션을 `SKIP_PREPUSH_GATE=1` 로 밀어 **게이트 자체를 무력화**시킨다.',
  },
  {
    name: 'branch-scope — 조상 판정을 늘 참으로(낡은 base 가 눈먼 초록으로 돌아온다)',
    file: F,
    find: '    let baseIsAncestor = false\n',
    replace: '    let baseIsAncestor = true\n',
    test: T,
    why:
      '거짓 빨간불을 "고치는" 가장 쉬운 길은 조건을 늘 통과시키는 것이다. 그러면 이력이 **갈라졌는데** ' +
      '3점 diff 가 비어 보이는 경우(= 비교 대상이 틀렸다)까지 통과해 이 가드의 "측정 0 = 통과 아님" ' +
      'doctrine 이 통째로 사라진다.',
  },
  {
    name: 'branch-scope — 조상 판정 호출을 다른 수단으로 바꿔치기',
    file: F,
    find: 'sh(`git merge-base --is-ancestor ${baseSha} ${headSha}`)',
    replace: 'sh(`git rev-parse --verify ${baseSha}`)',
    test: T,
    why:
      '`rev-parse --verify` 는 base 가 존재하기만 하면 성공하므로 **갈라진 이력도 "자손" 으로** 읽는다. ' +
      '위 두 주입과 결과가 같아 보이지만 경로가 다르다 — 판정 수단 자체가 바뀌는 방향을 따로 막는다.',
  },
]
