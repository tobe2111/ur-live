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
    find: '    for (const i of idxs) out[i] = pick',
    replace: '    for (const i of idxs) out[i] = 0',
    test: TEST,
    why: '분배가 깨지면 조각 N−1 개가 0건을 돌고도 초록이 된다 — 전수가 꺼진 것을 아무도 모른다.',
  },
  {
    name: '🧩 같은 테스트의 주입이 조각마다 흩어진다 (baseline 이 조각 수만큼 중복)',
    file: 'scripts/guard-mutations-shard.mjs',
    find: '    for (const i of idxs) out[i] = pick',
    replace: '    idxs.forEach((i, j) => { out[i] = (pick + j) % total })',
    test: TEST,
    why: '흩뿌리면 테스트별 baseline 이 조각마다 다시 돌아 최대 조각 호출이 38% 부풀어 오른다 — 벽시계가 그만큼 안 줄고, 조각을 늘려도 수익이 체감한다.',
  },
  {
    name: '🧩 배분이 실행마다 달라져 "합치면 전수" 가 거짓이 된다',
    file: 'scripts/guard-mutations-shard.mjs',
    find: '  const ordered = [...groups.entries()].sort((a, b) => b[1].length - a[1].length || (a[0] < b[0] ? -1 : 1))',
    replace: '  const ordered = [...groups.entries()].sort(() => Math.random() - 0.5)',
    test: TEST,
    why: '조각들은 서로를 못 본다. 배분이 실행마다 바뀌면 어떤 주입은 두 조각이 돌고 어떤 주입은 아무도 안 돈다 — 전부 초록인데 전수가 아니다.',
  },
  {
    name: '🧩 비용을 주입 수로만 세어 baseline 을 안 센다',
    file: 'scripts/guard-mutations-shard.mjs',
    find: '    cost[pick] += idxs.length + 1   // 주입 N건 + baseline 1건 = vitest 호출 수',
    replace: '    cost[pick] += idxs.length   // 주입 N건',
    test: TEST,
    why: '조각의 실제 비용은 주입 수가 아니라 vitest 호출 수다 — baseline 을 빼고 세면 그룹이 많은 조각이 조용히 더 무거워진다.',
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
