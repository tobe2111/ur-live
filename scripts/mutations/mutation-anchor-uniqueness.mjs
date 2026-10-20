/**
 * 🧬 주입 — **주입 앵커 유일성 판정**(2026-10-07)
 *
 * 되돌리면 "두 곳에 맞는 앵커" 가 pre-push 를 통과하고 **main 에서야** 터진다. 그리고 그 앵커는
 * 그때까지 **의도한 결함을 심지 않은 채** 초록을 보고한다 — 가드가 지키는 척만 하는 상태다.
 */
const GUARD = 'scripts/check-stale-mutation-anchors.mjs'
const T = 'src/tests/unit/mutation-anchor-uniqueness-2026-10-07.test.ts'

export default [
  {
    name: '앵커유일성 — 두 곳에 맞아도 통과시킨다 (종전 동작)',
    file: GUARD,
    find: "  else if (hits > 1) stale.push({ ...m, why: '`find` 가 **두 곳 이상**에 맞는다 — 유일해야 한다' })",
    replace: '  // (여러 곳에 맞아도 둔다)',
    test: T,
    why:
      '정확히 종전 동작이다. 러너는 어차피 거부하지만 그 판정은 `--changed` 안에 있어서, 범위 밖이면 ' +
      'PR 을 통과하고 main 에서야 터진다 — 2026-10-07 에 그렇게 CI 한 바퀴를 태웠다.',
  },
  {
    name: '앵커유일성 — 첫 매치에서 멈춰 세지 않는다',
    file: GUARD,
    find: '  for (let i = src.indexOf(m.find); i !== -1; i = src.indexOf(m.find, i + 1)) {',
    replace: '  for (let i = src.indexOf(m.find); i !== -1; i = -1) {',
    test: T,
    why:
      '세는 척만 한다 — `hits` 가 1 을 넘을 수 없으니 중복 분기가 **도달 불가**가 된다. ' +
      '분기를 지우는 것보다 찾기 어려운 모양이고(코드는 그대로 있다) 결과는 같다.',
  },
  {
    name: '앵커유일성 — 앵커 부재 판정을 없앤다 (종전 기능 회귀)',
    file: GUARD,
    find: "  if (hits === 0) stale.push({ ...m, why: '`find` 가 소스에 없다' })",
    replace: '  if (false) { /* 없어도 둔다 */ }',
    test: T,
    why:
      '유일성을 더하면서 **원래 기능(낡은 지도 탐지)을 깨뜨리는** 모양이다. 새 기능이 옛 기능을 ' +
      '밀어내는 회귀는 되돌려-검증 없이는 거의 안 드러난다.',
  },
]
