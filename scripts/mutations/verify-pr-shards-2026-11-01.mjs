/**
 * 🧬 주입 — PR 전수를 16대에 나눠 돈다 · 우회 구멍 없음 (2026-11-01 대표 *"끝까지 다 이상적으로"*)
 *    가드: src/tests/unit/verify-pr-shards-2026-11-01.test.ts
 *
 * 전부 **"실패한 PR 이 머지된다"** 방향을 겨눈다 — 이 변경에서 느린 것보다 나쁜 유일한 결과다.
 */
const T = 'src/tests/unit/verify-pr-shards-2026-11-01.test.ts'
const W = '.github/workflows/verify.yml'
export default [
  {
    name: 'PR분할 — Verify 의 if: always() 를 지운다(건너뛴 필수 검사 = 통과)',
    file: W,
    find: '    needs: [mutation-plan, mutation-shards]\n    if: always()\n',
    replace: '    needs: [mutation-plan, mutation-shards]\n',
    test: T,
    why: '조각이 실패하면 Verify 가 건너뛰어지고, GitHub 은 건너뛴 필수 검사를 통과로 친다 — 실패한 PR 이 머지된다.',
  },
  {
    name: 'PR분할 — 조각 실패를 대조 단계가 그냥 넘긴다',
    file: W,
    find: '            echo "❌ 주입 전수 조각이 성공하지 않았다(${{ needs.mutation-shards.result }}) — 위 \'주입 전수 N/M\' 잡을 볼 것."; exit 1',
    replace: '            echo "❌ 주입 전수 조각이 성공하지 않았다(${{ needs.mutation-shards.result }}) — 위 \'주입 전수 N/M\' 잡을 볼 것."',
    test: T,
    why: '조각이 빨간불이어도 Verify 가 초록이다 — 분할의 목적이 통째로 사라진다.',
  },
  {
    name: 'PR분할 — 좁은 PR 의 변경분 검사 조건을 뒤집는다(주입 0건으로 통과)',
    file: W,
    find: "        if: needs.mutation-plan.outputs.full != 'true'\n",
    replace: "        if: needs.mutation-plan.outputs.full == 'true'\n",
    test: T,
    why: '좁은 PR(대부분)에서 --changed 가 안 돌고, 전수일 땐 분할 잡이 돌아 — 대부분의 PR 이 주입 검증 0건으로 초록이 된다.',
  },
  {
    name: 'PR분할 — 분할 잡에서 strict 를 뗀다',
    file: W,
    find: '        run: node scripts/check-guard-mutations.mjs -s --shard ${{ matrix.shard }}/${{ needs.mutation-plan.outputs.total }}',
    replace: '        run: node scripts/check-guard-mutations.mjs --shard ${{ matrix.shard }}/${{ needs.mutation-plan.outputs.total }}',
    test: T,
    why: '-s 가 없으면 주입이 살아남아도 exit 0 이라 조각이 초록이다.',
  },
  {
    name: 'PR분할 — 판정을 러너가 아니라 워크플로가 상수로 정한다',
    file: W,
    find: '          SCOPE=$(node scripts/check-guard-mutations.mjs --changed --scope-json)',
    replace: '          SCOPE=\'{"full":false}\'',
    test: T,
    why: '전수여야 하는 PR(판정 모듈·package.json 변경)이 좁혀 돈다 — 러너 환경이 바뀐 채 주입 대부분이 검증 안 된다.',
  },
]
