/**
 * 👻 "소스에 썼는데 CSS 에 없는 클래스" 판정이 실제로 작동하는가 (2026-09-16).
 *
 * 가드 본체는 `dist/` 가 있어야 돌아서 주입 대상이 될 수 없다(주입 러너는 build 앞에서 돈다 —
 * dist 가 없으면 무조건 빨간불이라 "잡았다"가 헛돈다). 그래서 판정의 핵심을
 * `scripts/ghost-classes-core.mjs` 로 빼 두었고, 아래 주입은 **그 핵심**을 망가뜨린다.
 *
 * 가드: src/tests/unit/ghost-classes-2026-09-16.test.ts
 */
const CORE = 'scripts/ghost-classes-core.mjs'
const TEST = 'src/tests/unit/ghost-classes-2026-09-16.test.ts'

export default [
  {
    name: '👻 유니코드 이스케이프를 나중에 푼다 (임의값이 영영 안 맞는다)',
    file: CORE,
    find: "      .replace(/\\\\([0-9a-fA-F]{1,6})\\s?/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))\n      .replace(/\\\\(.)/g, '$1')",
    replace: "      .replace(/\\\\(.)/g, '$1')\n      .replace(/\\\\([0-9a-fA-F]{1,6})\\s?/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))",
    test: TEST,
    why:
      '`\\2022` 의 `\\2` 가 문자 2 로 먼저 먹혀 `content-[\'2022\']` 가 된다 — 멀쩡한 임의값이 ' +
      '영원히 유령으로 잡힌다. 오탐 많은 가드는 결국 아무도 안 켠다.',
  },
  {
    name: '👻 커스텀 클래스 걸러내기를 없앤다 (오탐 폭발)',
    file: CORE,
    find: "    if (!roots.has(tok.replace(/^-/, '').split('-')[0])) continue",
    replace: '    if (false) continue',
    test: TEST,
    why:
      '지도 오버레이 훅(`ur-pin-*`)·index.css 커스텀 클래스가 전부 유령으로 잡힌다. ' +
      '가드가 소리만 커지고 쓸모가 없어진다.',
  },
  {
    name: '👻 런타임 조립 클래스를 판정에 넣는다',
    file: CORE,
    find: "      if (!tok || tok.includes('${') || tok.includes('{') || tok.includes('(')) continue",
    replace: '      if (!tok) continue',
    test: TEST,
    why: '`bg-${c}-500` 같은 조각을 클래스로 세면 판정이 통째로 거짓이 된다 — 값은 런타임에 정해진다.',
  },
  {
    name: '👻 allow 목록을 무시한다 (이유를 적어 둔 예외가 다시 빨간불)',
    file: CORE,
    find: '    if (generated.has(tok) || allow.has(tok)) continue',
    replace: '    if (generated.has(tok)) continue',
    test: TEST,
    why: '예외를 못 두면 정상 커스텀 클래스에서 영구히 빨간불이 나고, 결국 가드를 끄게 된다.',
  },
  {
    name: '👻 가드를 build **앞**으로 옮긴다 (dist 가 없어 항상 빨간불)',
    file: '.github/workflows/verify.yml',
    find: "        env:\n          STRICT_GHOST_CLASSES: '1'",
    replace: "        env:\n          STRICT_GHOST_CLASSES: '0'",
    test: TEST,
    why:
      'strict 가 아니면 유령이 있어도 CI 가 통과한다 — 경고만 흘리는 가드는 이 레포에서 ' +
      '몇 달씩 방치된 전례가 있다(check-input-text-color).',
  },
]
