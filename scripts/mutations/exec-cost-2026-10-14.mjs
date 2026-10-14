/**
 * ⚙️ 대시보드 무게 · 첫 화면 실행 비용 · 실행 비용 처방 (2026-10-14) — 주입 매니페스트.
 * 가드: src/tests/unit/exec-cost-2026-10-14.test.ts
 */
const TEST = 'src/tests/unit/exec-cost-2026-10-14.test.ts'
const G = 'scripts/check-exec-cost.mjs'
const B = 'scripts/check-surface-budgets.mjs'
const H = 'scripts/visual-preview.mjs'

export default [
  {
    name: '[exec-cost] 늘어난 실행을 통과시킨다',
    file: G,
    find: '    if (m.execKB > b.execKB + tolerance) {',
    replace: '    if (false) {',
    test: TEST,
    why: '첫 화면에서 도는 코드가 늘어도 PR 이 초록이 된다 — 이 가드가 존재하는 이유가 사라진다.',
  },
  {
    name: '[exec-cost] 줄어든 실행을 잠그지 않는다',
    file: G,
    find: '    } else if (m.execKB < b.execKB - slack) {',
    replace: '    } else if (false) {',
    test: TEST,
    why: '줄인 여유가 다음 기능에 조용히 다시 먹힌다.',
  },
  {
    name: '[exec-cost] 기계용 줄을 못 읽어도 0 으로 넘어간다',
    file: G,
    find: '  if (!line) return null',
    replace: "  if (!line) return { execKB: 0, top: [] }",
    test: TEST,
    why: '하네스 형식이 바뀌면 영원히 0KB 를 재며 통과한다(헛도는 가드).',
  },
  {
    name: '[exec-cost] 대시보드 화면을 실행 비용에서 뺀다',
    file: G,
    find: "  { name: '어드민', args: ['--route=/admin', '--auth=admin'], dashboard: 'admin' },\n",
    replace: '',
    test: TEST,
    why: '어드민이 무게 예산엔 있는데 실행 비용 감시 밖에 남는다(목록이 갈린다).',
  },
  {
    name: '[exec-cost] 실행된 바이트 대신 받은 바이트를 센다',
    file: H,
    find: '    for (const f of e.functions) for (const r of f.ranges) mark.fill(r.count > 0 ? 1 : 0, r.startOffset, r.endOffset)',
    replace: '    mark.fill(1)',
    test: TEST,
    why: '실행 비용이 아니라 바이트 예산의 사본이 된다 — 안 쓰는 코드를 늘려도 같은 값.',
  },
  {
    name: '[exec-cost] 커버리지를 탐색 뒤에 켠다',
    file: H,
    find: '  await page.coverage.startJSCoverage({ resetOnNavigation: false })\n',
    replace: '',
    test: TEST,
    why: '부팅 중 실행된 코드를 통째로 놓친다.',
  },
  {
    name: '[dash-budget] 진입점을 못 찾아도 조용히 넘어간다',
    file: B,
    find: '    throw new Error(`대시보드 진입점을 매니페스트에서 못 찾았다',
    replace: '    return null; throw new Error(`대시보드 진입점을 매니페스트에서 못 찾았다',
    test: TEST,
    why: '파일이 옮겨지면 그 화면을 0 에 가깝게 재며 영원히 통과한다.',
  },
  {
    name: '[dash-budget] 전이 import 를 안 따라간다',
    file: B,
    find: '      for (const x of v.imports || []) stack.push(x)\n    }\n    out[`dash:${name}`]',
    replace: '    }\n    out[`dash:${name}`]',
    test: TEST,
    why: '대시보드가 지도 봉투를 통째로 끌고 와도(실제로 그랬다 — lz-map 24.9KB) 안 보인다.',
  },
  {
    name: '[exec-cost] cn()/tailwind-merge 를 묶음기 보호에서 뺀다',
    file: 'scripts/surface-chunks.mjs',
    find: "'codes', 'app-ui-utils'])",
    replace: "'codes'])",
    test: TEST,
    why: 'cn() 을 쓰는 화면 ~190개가 다시 지도 페이지 코드 전부를 받는다(대시보드 −24KB 가 되돌아간다).',
  },
  {
    name: '[exec-cost] 번역 JSON 을 다시 객체 리터럴로 낸다',
    file: 'vite.config.ts',
    find: '  json: { stringify: true },',
    replace: '  json: { stringify: false },',
    test: TEST,
    why: '모든 화면이 105KB 번역 파일을 JS 파서로 읽는다(JSON 파서보다 ~1.8배 느리다 — 실측).',
  },
]
