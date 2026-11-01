/**
 * 🧬 주입 — 주입 지문이 **정상 테스트를 차단**하던 것 (2026-10-24, CI 실패 1건 실측)
 *    가드: src/tests/unit/branch-scope-mk-signature-2026-10-24.test.ts
 *
 *    ⚠️ 이 지문은 **양방향**이라 주입도 양방향이다 — 넓히면 오탐이 돌아오고, 지우면 주입을 못 잡는다.
 */
const T = 'src/tests/unit/branch-scope-mk-signature-2026-10-24.test.ts'
const F = 'scripts/check-branch-scope.mjs'
export default [
  {
    name: '주입지문 — mk 지문을 옛 넓은 모양으로 되돌린다(정상 가짜 D1 테스트가 차단된다)',
    file: F,
    find: String.raw`/^\+\s*const mk = \([A-Za-z_$][\w$]*\)\s*=>\s*\(\{/m`,
    replace: String.raw`/^\+\s*const mk = \(/m`,
    test: T,
    why:
      '이 레포의 가짜 D1 스텁은 `const mk = (sql: string) => {` 로 시작한다(main 의 ' +
      '`company-save-count.test.ts` 가 그 모양). 지문이 `const mk = (` 전부를 잡으면 **가짜 D1 테스트를 ' +
      '새로 쓸 때마다 CI 가 "주입본이 섞였다"로 차단**한다 — 2026-10-24 에 실제로 그랬고, 가드가 내놓은 ' +
      '처방(`git checkout origin/main -- <파일>`)은 그 파일이 신규라 **테스트를 삭제하는** 지시였다.',
  },
  {
    name: '주입지문 — mk 지문을 통째로 제거한다',
    file: F,
    find: String.raw`  { re: /^\+\s*const mk = \([A-Za-z_$][\w$]*\)\s*=>\s*\(\{/m, what: '가짜 헬퍼(mk) 주입' },`,
    replace: '',
    test: T,
    why:
      '오탐을 "고치는" 가장 쉬운 길은 지문을 지우는 것이다. 그러면 `column-repairs.ts` 에 ' +
      '`const mk = (t) => ({ ... })` 가 커밋돼도 조용히 통과한다(그 파일은 "순수 데이터"라는 이유로 ' +
      '600줄 캡을 면제받은 파일이라 로직 유입이 특히 위험하다).',
  },
]
