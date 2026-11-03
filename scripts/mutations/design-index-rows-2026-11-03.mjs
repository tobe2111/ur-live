/**
 * 🧬 주입 — 디자인 시안 표 한 줄 = 파일 하나 (2026-11-03)
 *    가드: src/tests/unit/design-index-rows-2026-11-03.test.ts
 */
const T = 'src/tests/unit/design-index-rows-2026-11-03.test.ts'
export default [
  {
    name: '🗂️ 디자인 README 표에 줄을 다시 끼워 넣는다 (세션들이 같은 줄을 다툼)',
    file: 'docs/design/README.md',
    find: '## 미구현 시안\n',
    replace: '## 미구현 시안\n\n| 새 시안 | 2026-11-03 | 🟡 | [x](./x.md) |\n',
    test: T,
    why: '3일 머지 109건 중 13건이 그 표를 다퉜다.',
  },
  {
    name: '🗂️ 목차가 옛것부터 나온다',
    file: 'scripts/generate-design-index.mjs',
    find: '    .sort((a, b) => (a.name < b.name ? 1 : a.name > b.name ? -1 : 0))',
    replace: '    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))',
    test: T,
    why: '최신 시안이 맨 아래로 가면 대표 확정 대기 시안을 못 보고 지나간다.',
  },
]
