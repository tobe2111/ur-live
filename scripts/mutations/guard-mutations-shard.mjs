/**
 * 🧩 전수 주입 검증의 **조각 분할** (2026-10-01, 대표 "타임아웃 문제도 영구적으로 해결해줘") — 주입 매니페스트.
 * 가드: src/tests/unit/guard-mutations-shard.test.ts
 *
 * ⚠️ 이 주입들은 **검사기 자신**을 겨눈다. 분할이 조용히 깨지면 "조각 전부 초록" 이
 * 실제로는 전수를 안 돈 것일 수 있다 — 이 레포가 반복해 당한 **조용한 부재**의 가장 비싼 판본이다
 * (전수는 PR 이 `--changed` 로 좁혀 도는 것의 유일한 보증이다).
 */
const TEST = 'src/tests/unit/guard-mutations-shard.test.ts'

export default [
  {
    name: '🧩 조각 분배가 한 조각으로 몰려 전수를 안 덮는다',
    file: 'scripts/guard-mutations-shard.mjs',
    find: 'export function shardOf(i, total) {\n  return i % total\n}',
    replace: 'export function shardOf(i, total) {\n  return 0\n}',
    test: TEST,
    why: '분배가 깨지면 조각 N−1 개가 0건을 돌고도 초록이 된다 — 전수가 꺼진 것을 아무도 모른다.',
  },
  {
    name: '🧩 러너 루프가 조각 필터를 안 걸어 조각마다 전수를 돈다',
    file: 'scripts/check-guard-mutations.mjs',
    find: '  if (!inShard(m)) continue\n',
    replace: '',
    test: TEST,
    why: '필터가 빠지면 조각 7개가 각자 전수를 돌아 벽시계가 줄지 않는다 — 타임아웃이 그대로 돌아온다.',
  },
  {
    name: '🧩 0건을 고른 조각이 실패 대신 초록으로 끝난다',
    file: 'scripts/check-guard-mutations.mjs',
    find: '  if (planned === 0) {',
    replace: '  if (false) {',
    test: TEST,
    why: '0건 조각이 초록이면 "조각 전부 초록 = 전수 초록" 이라는 전제가 통째로 거짓이 된다.',
  },
  {
    name: '🧩 `--shard` 가 `--changed`·`--only` 와 겹쳐도 통과한다',
    file: 'scripts/check-guard-mutations.mjs',
    find: 'if (SHARD && (CHANGED || ONLY)) {',
    replace: 'if (false) {',
    test: TEST,
    why: '겹치면 돈 것이 두 선택의 교집합이라 초록이 무엇을 보증하는지 말할 수 없다.',
  },
  {
    name: '🧩 야간 워크플로가 행렬을 손으로 적은 숫자로 되돌아간다',
    file: '.github/workflows/guard-mutations-full.yml',
    find: 'shard: ${{ fromJSON(needs.plan.outputs.matrix) }}',
    replace: 'shard: [0, 1, 2, 3]',
    test: TEST,
    why: '손으로 적은 조각 수는 낡는다 — 이 워크플로의 주석이 실제로 `950건 × 40분` 으로 2.5배 낡아 여유를 과대평가했다.',
  },
  {
    name: '🧩 야간 워크플로가 조각을 세지 않고 계획기를 건너뛴다',
    file: '.github/workflows/guard-mutations-full.yml',
    find: 'node scripts/guard-mutations-shard.mjs --plan "$COUNT" >> "$GITHUB_OUTPUT"',
    replace: 'echo "matrix=[0]" >> "$GITHUB_OUTPUT"; echo "total=1" >> "$GITHUB_OUTPUT"',
    test: TEST,
    why: '계획기를 건너뛰면 조각이 1개로 떨어져 분할 이전과 같아진다 — 초록인데 타임아웃이 돌아온다.',
  },
  {
    name: '🧩 한 조각이 깨지면 나머지 조각이 통째로 안 돈다(fail-fast)',
    file: '.github/workflows/guard-mutations-full.yml',
    find: '      fail-fast: false\n',
    replace: '',
    test: TEST,
    why: '첫 빨간불에서 끊기면 "어디가 깨졌나" 를 한 번에 못 봐 전수를 여러 번 돌려야 한다.',
  },
]
