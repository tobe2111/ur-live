/**
 * 🧬 주입 — 주입 전수가 기계를 독차지하지 않게 (2026-11-10) · 가드: src/tests/unit/guard-mutations-full-throttle-2026-11-10.test.ts
 */
const T = 'src/tests/unit/guard-mutations-full-throttle-2026-11-10.test.ts'
const F = '.github/workflows/guard-mutations-full.yml'
export default [
  {
    name: '🚦 main 머지마다 돌던 전수를 다시 버린다 (11/10 하루 1,186분)',
    file: F,
    find: '  group: guard-mutations-full-${{ github.ref_name }}\n  cancel-in-progress: false',
    replace: '  group: guard-mutations-full-${{ github.ref_name }}\n  cancel-in-progress: true',
    test: T,
    why: '머지가 전수 한 바퀴(15~25분)보다 촘촘히 들어오면 거의 끝난 전수를 계속 죽여 기계 시간만 쓰고 결과가 안 나온다.',
  },
  {
    name: '🚦 전수가 다시 16대를 한꺼번에 잡는다 (PR 검사·배포가 20~30분 줄 선다)',
    file: F,
    find: '      max-parallel: 8\n',
    replace: '',
    test: T,
    why: '무료 계정은 저장소 전체가 동시에 20대뿐 — 전수가 16대를 잡으면 나머지 모든 검사와 배포가 기다린다.',
  },
]
