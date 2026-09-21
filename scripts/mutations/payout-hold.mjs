/**
 * 🕙 정산 유보 10일 (2026-09-21 대표 확정 "Q2는 10일로 하자") — 주입 매니페스트.
 * 가드: src/tests/unit/payout-hold-2026-09-21.test.ts
 */
const TEST = 'src/tests/unit/payout-hold-2026-09-21.test.ts'

export default [
  {
    name: '🕙 cron 집계에서 유보 조각이 빠져 적립 즉시 정산 대상이 된다',
    file: 'src/worker/cron/payouts-generate.ts',
    find: "LIKE 'user:%')\n           ${hold.sql}",
    replace: "LIKE 'user:%')",
    test: TEST,
    why: '유보가 사라지면 토스가 우리에게 입금하기 전에 우리 돈이 먼저 나간다. 에러가 안 나서 아무도 모른다.',
  },
  {
    name: "🕙 cron 의 credit WHERE 괄호가 풀려 유보가 마지막 LIKE 에만 걸린다",
    file: 'src/worker/cron/payouts-generate.ts',
    find: "WHERE (credit_account LIKE 'merchant:%' OR credit_account LIKE 'seller:%' OR credit_account LIKE 'agency:%' OR credit_account LIKE 'user:%')",
    replace: "WHERE credit_account LIKE 'merchant:%' OR credit_account LIKE 'seller:%' OR credit_account LIKE 'agency:%' OR credit_account LIKE 'user:%'",
    test: TEST,
    why: 'OR 우선순위 — 괄호가 없으면 merchant·seller·agency 는 유보를 통째로 건너뛴다. SQL 은 멀쩡히 돌고 금액만 틀린다.',
  },
  {
    name: '🕙 어드민 정산대기 화면이 유보를 무시해 cron 과 값이 갈린다',
    file: 'src/features/admin/api/admin-payouts.routes.ts',
    find: "OR credit_account LIKE 'agency:%' OR credit_account LIKE 'user:%')\n           ${hold.sql}",
    replace: "OR credit_account LIKE 'agency:%' OR credit_account LIKE 'user:%')",
    test: TEST,
    why: '화면이 유보 전 금액을 보여 주면 운영자가 아직 못 주는 돈을 승인한다.',
  },
  {
    name: '🕙 유보 해석이 fail-open 으로 바뀌어 설정 조회 실패 시 유보가 풀린다',
    file: 'src/worker/utils/payout-hold.ts',
    find: '  } catch {\n    // 설정을 못 읽었다고 유보를 푸는 것은 "먼저 주는" 쪽 실패다 → 기본값을 유지한다.\n  }',
    replace: '  } catch {\n    days = 0\n  }',
    test: TEST,
    why: 'D1 이 한 번 흔들린 날 유보가 통째로 풀린다 — 늦게 주는 실패는 회복되지만 먼저 준 돈은 못 돌려받는다.',
  },
  {
    name: '🕙 유보일 0 이 falsy 로 취급돼 "유보 없음" 이 조용히 기본값 10 으로 바뀐다',
    file: 'src/worker/utils/payout-hold.ts',
    find: '      if (Number.isFinite(v) && v >= 0) days = v',
    replace: '      if (Number.isFinite(v) && v > 0) days = v',
    test: TEST,
    why: '어드민이 0(유보 해제)을 넣어도 10 으로 되돌아간다. 끄는 스위치가 안 듣는 것이 곧 롤백 불가다.',
  },
]
