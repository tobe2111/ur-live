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
    // 🔁 2026-10-18 재조준: 손님 화면도 같은 폐쇄 함수를 쓰게 되면서 메시지에서 '대시보드' 를 뺐다 — 결함은 그대로.
    find: '    throw new Error(`진입점을 매니페스트에서 못 찾았다',
    replace: '    return null; throw new Error(`진입점을 매니페스트에서 못 찾았다',
    test: TEST,
    why: '파일이 옮겨지면 그 화면을 0 에 가깝게 재며 영원히 통과한다.',
  },
  {
    name: '[dash-budget] 전이 import 를 안 따라간다',
    file: B,
    // 🔁 2026-10-18 재조준: 폐쇄 함수가 손님·대시보드 공용이 되며 키가 `${prefix}${name}` 이 됐다 — 결함은 그대로.
    find: '      for (const x of v.imports || []) stack.push(x)\n    }\n    out[`${prefix}${name}`]',
    replace: '    }\n    out[`${prefix}${name}`]',
    test: TEST,
    why: '대시보드가 지도 봉투를 통째로 끌고 와도(실제로 그랬다 — lz-map 24.9KB) 안 보인다.',
  },
  {
    name: '[exec-cost] cn()/tailwind-merge 를 묶음기 보호에서 뺀다',
    file: 'scripts/surface-chunks.mjs',
    // 🔁 2026-10-18 재조준: 뒤에 'app-cross' 가 붙어 끝 괄호 앵커가 낡았다 — 결함은 그대로.
    find: "'codes', 'app-ui-utils', ",
    replace: "'codes', ",
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
  {
    name: '[exec-cost] 한 번만 재서 판정한다(흔들림이 그대로 빨간불)',
    file: 'scripts/check-exec-cost.mjs',
    find: 'export const RUNS = Math.max(1, Number(process.env.EXEC_COST_RUNS) || 3)',
    replace: 'export const RUNS = Math.max(1, Number(process.env.EXEC_COST_RUNS) || 1)',
    test: TEST,
    why: '같은 빌드가 실행마다 ~9KB 흔들려(허용 4KB) 아무 변화 없는 PR 이 빨간불을 받는다.',
  },
  {
    name: '[exec-cost] 못 읽은 측정을 추정기 뒤에 숨긴다',
    file: 'scripts/check-exec-cost.mjs',
    find: '    if (runs.some((x) => !x)) {',
    replace: '    if (false) {',
    test: TEST,
    why: '세 번 중 한 번 하네스가 깨져도 나머지로 통과해 측정 고장이 안 보인다. 바닥값은 낮은 표본을 채택하므로 더 위험하다.',
  },
  {
    name: '[exec-cost] 추정기를 중앙값으로 되돌린다(10-15 빨간불 재발)',
    file: 'scripts/check-exec-cost.mjs',
    find: '  return [...ok].sort((a, b) => a.execKB - b.execKB)[0]',
    replace: '  const sorted = [...ok].sort((a, b) => a.execKB - b.execKB); return sorted[Math.floor((sorted.length - 1) / 2)]',
    test: TEST,
    why: '중앙값은 셋 중 **둘**이 높은 갈래에 떨어지면 그대로 채택한다 — 라이브 30점에서 어드민 +9.6 · 에이전시 +8.8 · 홈 +8.1 세 건이 아무 코드 변화 없이 빨간불이었다.',
  },
  {
    name: '[exec-cost] 판정을 바닥값이 아닌 자리에서 한다',
    file: 'scripts/check-exec-cost.mjs',
    find: '    const res = pickFloor(runs)',
    replace: '    const res = runs[0]',
    test: TEST,
    why: '첫 표본을 그대로 쓰면 흔들림이 판정에 그대로 들어온다(RUNS 를 3 으로 둔 의미가 사라진다).',
  },
  {
    name: '[exec-cost] 렌더가 깨진 화면을 통과시킨다',
    file: 'scripts/check-exec-cost.mjs',
    find: '    if (!(res.execKB > 100)) {',
    replace: '    if (false) {',
    test: TEST,
    why: '바닥값은 가장 낮은 표본을 고르므로 이 하한이 없으면 깨진 렌더(실행 0KB)가 "개선"으로 읽힌다.',
  },
  {
    name: '[exec-cost] 잠금여유를 현장 아래 잡음보다 낮춘다',
    why: '📡 2026-10-18 현장: 교환권 302.2/305.4/305.6 처럼 **아래로** 3.2KB 튀는 표본이 실재하고 바닥값은 그걸 채택한다. 잠금여유를 그 아래로 내리면 **코드가 안 바뀌어도** "개선 미잠금" 빨간불이 난다.',
    file: 'scripts/check-exec-cost.mjs',
    find: 'export const LOCK_SLACK_KB = 8',
    replace: 'export const LOCK_SLACK_KB = 3',
    test: 'src/tests/unit/exec-cost-2026-10-14.test.ts',
  },
]
