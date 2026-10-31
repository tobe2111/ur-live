/**
 * 🧬 주입 — 무상 체험 제공 · 신청권(노쇼 방지 보증금) (2026-10-31). 가드: src/tests/unit/seeding-2026-10-31.test.ts
 */
const T = 'src/tests/unit/seeding-2026-10-31.test.ts'
export default [
  {
    name: 'seeding — 설정이 비면 무료 신청권이 0회가 된다',
    file: 'src/features/seeding/api/seeding-db.ts',
    find: "  const raw = v === null || v.trim() === '' ? NaN : Number(v)",
    replace: '  const raw = Number(v)',
    test: T,
    why: 'Number(null)=0 이라 가입 혜택 3회가 조용히 0회가 된다(실제로 처음 판이 그랬다).',
  },
  {
    name: 'seeding — 보증금이 유료 칸부터 빠진다',
    file: 'src/features/seeding/api/seeding-db.ts',
    find: "  for (const bucket of ['free', 'paid'] as const) {",
    replace: "  for (const bucket of ['paid', 'free'] as const) {",
    test: T,
    why: '돈 내고 산 신청권이 무료보다 먼저 빠지면 무료가 남은 채 유료가 소진된다.',
  },
  {
    name: 'seeding — 반환이 원장 확인 없이 잔액을 올린다',
    file: 'src/features/seeding/api/seeding-db.ts',
    find: '  if (!spent) return false\n',
    replace: '',
    test: T,
    why: '쓰지 않은 신청에도 반환이 들어가 신청권이 공짜로 생긴다.',
  },
  {
    name: 'seeding — 팔로워 미달도 통과시킨다',
    file: 'src/shared/seeding.ts',
    find: '  if ((best.follower_count ?? 0) < offer.min_followers) {',
    replace: '  if (false) {',
    test: T,
    why: '사장님 조건(최소 팔로워)이 무력화된다.',
  },
  {
    name: 'seeding — 패널티 제한이 사라진다',
    file: 'src/shared/seeding.ts',
    find: '  if (strikes === 2) return 30',
    replace: '  if (strikes === 2) return 0',
    test: T,
    why: '노쇼 2회에도 신청이 막히지 않는다.',
  },
  {
    name: 'seeding — 구매 취소가 이미 쓴 신청권도 환불한다',
    file: 'src/features/seeding/api/seeding-db.ts',
    find: "WHERE user_id = ? AND paid_left >= ?`,\n  ).bind(buy.amount, userId, buy.amount).run()",
    replace: "WHERE user_id = ?`,\n  ).bind(buy.amount, userId).run()",
    test: T,
    why: '쓴 신청권까지 돈으로 돌려주게 되고 잔액이 음수가 된다.',
  },
  {
    name: 'seeding — 구매 취소에 7일 제한이 없다',
    file: 'src/features/seeding/api/seeding-db.ts',
    find: "  if (!buy.in_window) return { status: 'expired' }\n",
    replace: '',
    test: T,
    why: '청약철회 기간이 지나도 환불된다.',
  },
]
