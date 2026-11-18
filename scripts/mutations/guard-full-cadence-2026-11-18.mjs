/** 🔁 2026-11-18 주입 전수 주기(머지마다 → 하루 네 번) — 가드: src/tests/unit/guard-mutations-scope.test.ts */
const TEST = 'src/tests/unit/guard-mutations-scope.test.ts'
const FILE = '.github/workflows/guard-mutations-full.yml'
export default [
  {
    name: '[guard-cadence] 전수가 다시 머지마다 돈다',
    file: FILE,
    find: "on:\n  schedule:\n    # 18:40 UTC",
    replace: "on:\n  push:\n    branches: [main]\n  schedule:\n    # 18:40 UTC",
    test: TEST,
    why: '하루 2,877분 — 비공개 저장소에서는 전부 과금된다.',
  },
  {
    name: '[guard-cadence] 낮 회차가 사라진다(야간만)',
    file: FILE,
    find: "    - cron: '40 0,6,12 * * *'\n",
    replace: '',
    test: TEST,
    why: '머지된 조합이 하루 동안 전수 없이 산다.',
  },
  {
    name: '[guard-cadence] 야간 회차까지 건너뛴다',
    file: FILE,
    find: ' && [ "${{ github.event.schedule }}" != "40 18 * * *" ]',
    replace: '',
    test: TEST,
    why: 'main 이 조용하면 전수가 며칠씩 안 돈다 — 야간이 보증이다.',
  },
  {
    name: '[guard-cadence] 건너뛰기 판정이 전수 잡에 안 걸린다',
    file: FILE,
    find: "    if: needs.plan.outputs.skip != 'true'\n",
    replace: '',
    test: TEST,
    why: '건너뛴다고 해 놓고 그대로 돈다(절감 0).',
  },
]
