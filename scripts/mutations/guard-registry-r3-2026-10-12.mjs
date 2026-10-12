/**
 * 🧬 주입 — **러너가 부르는데 없는 가드** (2026-10-12, R3)
 *
 * 되돌리면 전부 **조용히** 종전으로 간다. `|| true` 로 감싸인 호출은 차단 없이 스택트레이스만
 * 찍으므로 커밋은 성공하고, 그 가드가 지키던 불변식만 없어진다. 실측 3건이 그 상태로 몇 달 있었다.
 */
const G = 'scripts/check-guard-registry.mjs'
const H = 'scripts/install-git-hooks.sh'
const T = 'src/tests/unit/guard-registry-r3-2026-10-12.test.ts'

export default [
  {
    name: 'R3 — 러너 텍스트에 블록 주석 제거기를 쓴다 (74% 증발 · 첫 판의 실제 결함)',
    file: G,
    find: `  const runnerCode = runners
    .split('\\n')
    .filter((l) => !/^\\s*(#|\\/\\/|\\*)/.test(l))
    .join('\\n')`,
    replace: '  const runnerCode = stripComments(runners)',
    test: T,
    why:
      '정확히 제가 처음 쓴 코드다. 셸·YAML·JS 를 **이어 붙인** 텍스트에서 한 파일의 `/*` 가 다른 ' +
      '파일의 `*/` 와 짝지어 206,871 → 54,215자로 줄고, 찾아야 할 호출이 그 안에 있어 **죽은 호출을 ' +
      '못 보고 초록**이 뜬다.',
  },
  {
    name: 'R3 — 존재 검사를 뒤집는다 (늘 통과)',
    file: G,
    find: '    if (!existsSync(ref)) missingCalls.push(ref)',
    replace: '    if (false) missingCalls.push(ref)',
    test: T,
    why: '가드가 헛도는 가장 흔한 모양. 문자열은 그대로 남아 소스 검사형 단언은 통과한다.',
  },
  {
    name: 'R3 — 보고만 하고 종료코드를 안 올린다',
    file: G,
    find: `if (missingCalls.length) {
  bad += missingCalls.length`,
    replace: `if (missingCalls.length) {
  bad += 0`,
    test: T,
    why:
      '화면엔 빨간 글자가 찍히는데 CI·훅은 통과한다 — 이 레포가 반복해 당한 "실패가 아니라 ' +
      '**부재**" 의 또 다른 판본이다.',
  },
  {
    name: 'R3 — 0건이면 고장이라는 선언을 지운다',
    file: G,
    find: `  if (seen.size === 0) {
    console.error('❌ [guard-registry] 러너 텍스트에서 가드 호출을 하나도 못 찾았다 — runnerText() 가 깨졌다.')
    process.exit(1)
  }`,
    replace: '  // (0건 검사 제거)',
    test: T,
    why:
      '`runnerText()` 가 깨져 빈 문자열을 돌려줘도 "죽은 호출 0건" 으로 초록이 된다. ' +
      '측정 대상 0건은 통과가 아니라 고장이다.',
  },
  {
    name: 'R3 — 죽은 가드 호출이 훅에 되살아난다 (종전 상태)',
    file: H,
    find: 'node scripts/check-consumer-product-supply-isolation.mjs || true',
    replace:
      'node scripts/check-consumer-product-supply-isolation.mjs || true\n' +
      'node scripts/check-wholesale-autologin-guarded.mjs || true',
    test: T,
    why:
      '2026-10-11 도매 철거 직후의 실제 상태다. 매 커밋 스택트레이스를 찍지만 `|| true` 라 ' +
      '아무것도 막지 않고, 표(CLAUDE.md)는 그 불변식이 지켜지는 것처럼 읽힌다.',
  },
]
