/**
 * 🧬 주입 — main 배포 단위 시험 병렬 (2026-11-03) · 가드: src/tests/unit/main-deploy-parallel-2026-11-03.test.ts
 */
const T = 'src/tests/unit/main-deploy-parallel-2026-11-03.test.ts'
const W = '.github/workflows/main.yml'
export default [
  {
    name: '⏱️ 배포가 단위 시험을 안 기다린다 (합친 결과가 깨져도 라이브에 올라간다)',
    file: W,
    find: '  deploy:\n    needs: unit-tests\n',
    replace: '  deploy:\n',
    test: T,
    why: '2026-07-25 사고 — PR 은 초록인데 합친 결과가 시험에서 깨졌고, 시험이 배포를 막는 유일한 자리였다.',
  },
  {
    name: '⏱️ 시험 실패 기록이 사라진다 (배포가 조용히 안 된다)',
    file: W,
    find: "    if: failure() && needs.unit-tests.result == 'failure'\n",
    replace: '    if: false\n',
    test: T,
    why: '시험이 깨지면 deploy 잡이 건너뛰어져 그 안의 기록 단계도 안 돈다 — 라이브가 머지만큼 뒤처지는데 아무도 모른다(2026-08-03 사고).',
  },
]
