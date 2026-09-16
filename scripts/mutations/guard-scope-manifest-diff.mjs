/**
 * 🧬 주입 — **CI 좁힘이 조용히 무력화되는** 경우 (2026-09-15)
 *
 * 이 좁힘은 Verify 를 55.9분 → 12분대로 낮추는 물건이라, 무력화돼도 **에러가 안 나고 느려질 뿐**이다.
 * 느려지는 것은 아무도 신고하지 않는다 — 실제로 `'scripts/'` 한 줄이 두 달 가까이 92% 의 PR 을
 * 느린 길로 보냈고 그동안 CI 는 계속 초록이었다. 반대 방향(너무 좁혀 검사가 새는 것)도 같이 막는다.
 */
const TEST = 'src/tests/unit/guard-mutations-manifest-diff.test.ts'
const SCOPE_TEST = 'src/tests/unit/guard-mutations-scope.test.ts'

export default [
  {
    name: '⏱️`scripts/` 통째 전수가 되살아난다 (92% 를 느린 길로)',
    file: 'scripts/guard-mutations-scope.mjs',
    find: `  'scripts/guard-mutations-scope.mjs',\n  'scripts/guard-mutations-manifest-diff.mjs',`,
    replace: `  'scripts/',`,
    test: TEST,
    why:
      '되돌아가도 **아무 에러가 안 난다** — CI 가 초록인 채로 40분씩 더 쓸 뿐이다. ' +
      '그게 이 줄이 두 달 가까이 살아남은 이유다.',
  },
  {
    name: '⏱️설명만 바꿔도 주입이 바뀐 것으로 잡힌다 (좁힘 무의미)',
    file: 'scripts/guard-mutations-manifest-diff.mjs',
    find: `const IDENTITY = ['file', 'find', 'replace', 'test']`,
    replace: `const IDENTITY = ['file', 'find', 'replace', 'test', 'why']`,
    test: TEST,
    why:
      '`why` 는 설명 문구다. 여기 넣으면 주석 한 줄만 고쳐도 그 주입이 "바뀐 것" 이 되고, ' +
      '매니페스트를 손대는 PR 은 사실상 전부 다시 느려진다 — 고친 것이 원위치된다.',
  },
  {
    name: '⏱️앵커가 사라져도 "로직 안 바뀜" 으로 떨어진다 (조용히 새는 쪽)',
    file: 'scripts/guard-mutations-manifest-diff.mjs',
    find: `  if (a === null || b === null) return true`,
    replace: `  if (a === null || b === null) return false`,
    test: TEST,
    why:
      '러너가 재구성돼 앵커를 못 찾는데 "로직은 안 바뀌었다" 로 읽으면, 판정 로직이 통째로 ' +
      '바뀐 PR 이 좁혀 돈다. 판정 불가는 **넓은 쪽**으로 떨어져야 한다.',
  },
  {
    name: '⏱️옛 base 러너를 그냥 부른다 (40분 전수 + 소스 주입)',
    file: 'scripts/check-guard-mutations.mjs',
    find: `    if (!baseRunnerSrc.includes('--dump-manifest')) {`,
    replace: `    if (false) {`,
    test: TEST,
    why:
      '모르는 플래그를 받은 옛 러너는 그것을 무시하고 **전수를 돈다** — 하위 프로세스가 40분을 ' +
      '태우고 소스에 결함까지 심는다. 만들면서 실제로 한 번 밟았다.',
  },
  {
    name: '⏱️바뀐 주입을 루프가 안 고른다 (새 주입이 그 PR 에서 안 돈다)',
    file: 'scripts/check-guard-mutations.mjs',
    find: `  if (!inScope(m, SCOPE) && !CHANGED_NAMES.has(m.name)) continue`,
    replace: `  if (!inScope(m, SCOPE)) continue`,
    test: SCOPE_TEST,
    why:
      '좁힘의 대가로 얻어야 할 것이 바로 이것이다 — 새로 넣은 주입이 **그 PR 에서** 검증되는 것. ' +
      '이 조건이 빠지면 새 주입은 다음 날 전수에서야 돌고, 그때는 이미 머지돼 있다.',
  },
]
