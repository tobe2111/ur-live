/**
 * 🔁 청크 순환 0 (2026-10-13 — /checkout 전체 오류 화면 사고) — 주입 매니페스트.
 * 가드: src/tests/unit/chunk-cycles-2026-10-13.test.ts
 */
const TEST = 'src/tests/unit/chunk-cycles-2026-10-13.test.ts'

export default [
  {
    name: '🔁 묶음기가 라이브러리 내부 의존(prop-types)을 다시 페이지 봉투로 옮긴다',
    file: 'scripts/surface-chunks.mjs',
    find: "    if (name === undefined && !norm(id).includes('/src/') && libraryOnly(id, meta)) return name\n",
    replace: '',
    test: TEST,
    why: 'stripe 봉투가 lz 를, lz 가 stripe 를 import 하는 순환 — 결제 화면 전체가 초기화 오류로 죽는다(빌드 초록).',
  },
  {
    name: '🔁 청크 순환 가드가 순환을 못 센다',
    file: 'scripts/check-chunk-cycles.mjs',
    find: '      if (c.length > 1) out.push(c.sort())',
    replace: '      if (false) out.push(c.sort())',
    test: TEST,
    why: '가드가 늘 0 을 내면 다음 순환이 또 라이브로 나간다 — 이번에도 PR 게이트 밖 검사가 우연히 잡았다.',
  },
  {
    name: '🔁 청크 순환 가드가 부수효과 import 를 놓친다',
    file: 'scripts/check-chunk-cycles.mjs',
    find: `(?:[^'"()]*?from\\s*)?`,
    replace: `(?:[^'"()]*?from\\s*)`,
    test: TEST,
    why: '`import"./x.js"` 꼴의 순환은 그래프에 안 보인다 — 평가 순서는 똑같이 묶인다.',
  },
]
