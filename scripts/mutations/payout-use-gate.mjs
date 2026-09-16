/**
 * 🔒 사용 확인 게이트 주입 — `payout-use-gate-2026-09-16.test.ts` 가 실제로 실패할 수 있는지.
 *
 * 이 게이트의 실패 모드 둘 다 조용하다(너무 조이면 정상 소개비가 영영 안 익고, 너무 풀면
 * 가짜 매장 돈이 그대로 나간다) — 그래서 "가드가 헛돌지 않는가"를 기계가 매번 확인한다.
 */
const TEST = 'src/tests/unit/payout-use-gate-2026-09-16.test.ts'

export default [
  {
    name: 'payout-use-gate: 게이트 SQL 을 통째로 비운다',
    file: 'src/worker/utils/payout-use-gate.ts',
    find: "  if (!enabled) return { sql: '', enabled: false, maxWaitDays: days }",
    replace: "  if (true) return { sql: '', enabled: false, maxWaitDays: days }",
    test: TEST,
    why: '게이트가 꺼지면 사용 확인 없이 소개비가 나간다 — 가짜 매장이 돈을 가져가는 그 경로다.',
  },
  {
    name: 'payout-use-gate: 사용 여부를 안 보고 무조건 통과시킨다',
    file: 'src/worker/utils/payout-use-gate.ts',
    find: "                 AND v.status = 'unused'\n                 AND (v.expires_at IS NOT NULL",
    replace: "                 AND v.status = 'NEVER'\n                 AND (v.expires_at IS NOT NULL",
    test: TEST,
    why: '조건 하나만 어긋나도 전량 통과한다. 에러가 안 나서 아무도 모른다.',
  },
  {
    name: 'payout-use-gate: 상관 서브쿼리의 order_id 결합을 끊는다',
    file: 'src/worker/utils/payout-use-gate.ts',
    find: "               WHERE v.order_id = ${table}.order_id\n                 AND v.status = 'used')",
    replace: "               WHERE v.order_id = v.order_id\n                 AND v.status = 'used')",
    test: TEST,
    why: '결합이 끊기면 **남의 사용**이 내 소개비를 익힌다 — 한 건만 써도 전부 나간다.',
  },
  {
    name: 'payout-use-gate: 무기한 천장을 없애 pending 에 영구히 가둔다',
    file: 'src/worker/utils/payout-use-gate.ts',
    find: "                      OR datetime(v.created_at, '+${days} days') > datetime('now')))",
    replace: "                      OR 1 = 1))",
    test: TEST,
    why: '반대 방향의 조용한 실패 — 정직한 소개자의 돈이 pending 에 영구히 갇힌다.',
  },
  {
    name: 'payout-use-gate: 천장 값의 정수 클램프를 없앤다 (SQL 에 박히는 값)',
    file: 'src/worker/utils/payout-use-gate.ts',
    find: "    ? Math.max(1, Math.min(3650, Math.floor(raw)))",
    replace: "    ? raw",
    test: TEST,
    why: '이 값은 바인딩이 아니라 SQL 문자열에 박힌다. 클램프가 유일한 방어다.',
  },
  {
    name: 'payout-use-gate: platform_settings 읽기를 무시하고 항상 켠다',
    file: 'src/worker/utils/payout-use-gate.ts',
    find: "      if (r.key === 'payout_requires_voucher_use') enabled = String(r.value) === 'true'",
    replace: "      if (r.key === 'payout_requires_voucher_use') enabled = true",
    test: TEST,
    why: '기본 OFF 가 깨지면 승인 없이 머니 게이트가 켜진다(등급 C 우회).',
  },
  {
    name: 'payout-use-gate: cron 이 게이트를 만들되 UPDATE 에 안 쓴다 (조용한 무력화)',
    file: 'src/worker/cron/influencer-payout.ts',
    find: "         ${useGate.sql}\n    `).run()",
    replace: "         \n    `).run()",
    test: TEST,
    why: '변수만 만들고 안 쓰면 게이트는 켜도 안 먹는다 — 이 레포가 반복해 당한 "조용한 부재".',
  },
]
