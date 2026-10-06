/**
 * 되돌려-검증 주입 — 이미 환불된 이용권의 **소급 기록** (2026-10-06)
 * 가드: src/tests/unit/voucher-refund-backfill-2026-10-06.test.ts
 *
 * #1625 는 앞으로의 환불을 적게 했고, 이건 **이미 나간 1건**(라이브 주문 85)을 메운다.
 * 둘은 다른 일이라 주입도 따로다.
 */
const SQL = 'src/worker/routes/repair-schema/backfill-voucher-refund-booking.ts'
const TEST = 'src/tests/unit/voucher-refund-backfill-2026-10-06.test.ts'

export default [
  {
    name: '소급기록 — 총액 clamp 제거(장부가 총액을 넘어 상한이 거짓이 된다)',
    file: SQL,
    find: 'SET refunded_amount = MIN(total_amount, (${REFUNDED_VOUCHER_SUM}))',
    replace: 'SET refunded_amount = (${REFUNDED_VOUCHER_SUM})',
    test: TEST,
    why: '합이 총액을 넘는 행에서 refunded_amount 가 2,700 이 된다 — 상한이 음수가 되고 장부가 거짓이 된다.',
  },
  {
    name: '소급기록 — 멱등 조건 제거(매 실행 누적돼 상한이 조용히 무너진다)',
    file: SQL,
    find: `           WHERE COALESCE(refunded_amount, 0) = 0
             AND COALESCE(total_amount, 0) > 0`,
    replace: `           WHERE COALESCE(total_amount, 0) > 0`,
    test: TEST,
    why: 'repair-schema 는 main 푸시마다 돈다 — 조건이 없으면 같은 행을 계속 다시 적고 남의 부분환불 기록을 덮는다.',
  },
  {
    name: '소급기록 — 환불 안 된 이용권까지 긁는다(안 쓴 사람의 환불 상한을 깎는다)',
    file: SQL,
    find: `WHERE v.order_id = orders.id AND COALESCE(v.refund_status, '') = 'refunded'`,
    replace: `WHERE v.order_id = orders.id`,
    test: TEST,
    why: '아직 환불 안 된 장까지 합산해 적으면, 정상 환불을 요청한 손님이 돈을 못 받는다(반대 방향 사고).',
  },
  {
    name: '소급기록 — 다른 주문의 이용권까지 합산(상관 조건 소실)',
    file: SQL,
    find: 'WHERE v.order_id = orders.id AND',
    replace: 'WHERE 1=1 AND',
    test: TEST,
    why: '상관 서브쿼리가 풀리면 전체 환불 합이 모든 주문에 적힌다 — 멀쩡한 주문의 환불이 전부 막힌다.',
  },
  {
    name: '소급기록 — 이미 적힌 주문을 덮어쓴다(남의 부분환불 기록이 사라진다)',
    file: SQL,
    find: 'WHERE COALESCE(orders.refunded_amount, 0) > 0',
    replace: 'WHERE COALESCE(orders.refunded_amount, 0) >= 0',
    test: TEST,
    why: '수동확인 목록이 정상 주문까지 포함해 소음이 되고, 실제로 봐야 할 행이 묻힌다.',
  },
  {
    name: '소급기록 — 배선 제거(코드는 있는데 아무도 안 부른다)',
    file: 'src/worker/routes/repair-schema.routes.ts',
    find: 'const bf = await backfillVoucherRefundBooking(DB);',
    replace: 'const bf = { booked: 0, ambiguous: [] as never[] };',
    test: TEST,
    why: '이 레포가 반복해 당한 "조용한 부재" — 모듈·시험 다 초록인데 라이브 구멍은 그대로 남는다.',
  },
  {
    name: '소급기록 — 수동확인 행을 조용히 넘긴다',
    file: 'src/worker/routes/repair-schema.routes.ts',
    find: `        status: 'error',
        error: \`장부 \${r.refunded_amount} < 환불된 이용권 합`,
    replace: `        status: 'ok',
        error: \`장부 \${r.refunded_amount} < 환불된 이용권 합`,
    test: TEST,
    why: '상한이 아직 높은 주문이 ok 로 올라가면 초록불 뒤에 구멍이 남는다 — 그게 이 결함의 원래 수명이다.',
  },
  // 🩸 2026-10-06 — 머지 후 라이브 로그로 알게 된 것: `d1-migrate.yml` 의 repair-schema 호출은
  //   토큰 미설정으로 skip 되고 워크플로는 success 로 찍힌다. 실제 보증은 일간 cron 이므로
  //   그 두 자리(호출·등록)를 주입으로 고정한다 — 둘 중 하나만 빠져도 조용히 아무 일도 안 일어난다.
  {
    name: '소급기록 — 일간 cron 의 runSchemaRepair 호출 제거',
    file: 'src/worker/cron/daily-lane.ts',
    find: 'const result = await runSchemaRepair(env.DB)',
    replace: 'const result = { columns: [] as never[], tables: [] as never[] }',
    test: TEST,
    why: '유일한 실제 보증 경로다 — 여기가 끊기면 소급 기록이 영원히 안 돌고 에러도 안 난다.',
  },
  {
    name: '소급기록 — maintenance 레인 등록 제거',
    file: 'src/worker/scheduled.ts',
    find: "runDailyLane('maintenance'",
    replace: "runDailyLaneDISABLED('maintenance'",
    test: TEST,
    why: 'cron 이 등록되지 않으면 schema-repair-daily 가 한 번도 발화하지 않는다(조용한 부재).',
  },
]
