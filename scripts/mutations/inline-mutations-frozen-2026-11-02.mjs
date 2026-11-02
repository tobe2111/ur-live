/**
 * 🧬 주입 — 옛 인라인 주입 목록 동결 (2026-11-02)
 *    가드: src/tests/unit/inline-mutations-frozen-2026-11-02.test.ts
 *
 * 막는 사고: 세션들이 러너의 10,000줄 배열에 계속 덧붙여 머지마다 같은 자리를 다툰다.
 */
const T = 'src/tests/unit/inline-mutations-frozen-2026-11-02.test.ts'
export default [
  {
    name: '인라인 동결 — 러너 배열 맨 앞에 주입 하나를 더 끼운다',
    file: 'scripts/check-guard-mutations.mjs',
    find: 'const MUTATIONS = [\n',
    replace:
      "const MUTATIONS = [\n  {\n    name: 'x-inline-added',\n    file: 'x',\n    find: 'x',\n    replace: 'y',\n    test: 'x',\n    why: 'x',\n  },\n",
    test: T,
    why: '동결이 안 먹으면 세션들이 다시 그 배열에 덧붙여 같은 자리를 다툰다.',
  },
  {
    name: '인라인 동결 — 동결값을 올려 상한을 헐겁게 만든다',
    file: T,
    find: 'const FROZEN_INLINE = 979',
    replace: 'const FROZEN_INLINE = 1200',
    test: T,
    why: '헐거운 상한은 다시 자라도 초록이다(②가 잡아야 한다).',
  },
]
