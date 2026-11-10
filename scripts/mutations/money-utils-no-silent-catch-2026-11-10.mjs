/** 🔇 2026-11-10 — 돈 관련 파일의 빈 catch 금지. 가드: src/tests/unit/money-utils-no-silent-catch-2026-11-10.test.ts */
const TEST = 'src/tests/unit/money-utils-no-silent-catch-2026-11-10.test.ts'
export default [
  {
    name: '[silent] 커미션 적립 실패를 다시 소리 없이 삼킨다',
    file: 'src/worker/utils/order-commissions.ts',
    find: "await creditAffiliateFromIntent(DB, opts?.env, Number(o.id)).catch(swallow('order-commissions'))",
    replace: 'await creditAffiliateFromIntent(DB, opts?.env, Number(o.id)).catch(() => {})',
    test: TEST,
    why: '커미션이 안 들어가도 로그가 없다.',
  },
  {
    name: '[silent] 환급 센터의 표 생성 실패를 다시 삼킨다',
    file: 'src/features/admin/api/admin-payout-center.routes.ts',
    find: "  `).run().catch(swallow('admin-payout-center'))\n}",
    replace: '  `).run().catch(() => {})\n}',
    test: TEST,
    why: '표가 안 만들어져도 모른다.',
  },
  {
    name: '[silent] 결제 승인의 셀러 원장 기입 실패를 다시 삼킨다',
    file: 'src/worker/routes/payment.routes.ts',
    find: "await creditSellerOrderToLedger(c.env.DB, Number(order.id)).catch(swallow('payment'))",
    replace: 'await creditSellerOrderToLedger(c.env.DB, Number(order.id)).catch(() => {})',
    test: TEST,
    why: '원장에 매출이 안 들어가도 로그가 없다.',
  },
  {
    name: '[silent] 웹훅의 셀러 원장 기입 실패를 다시 삼킨다',
    file: 'src/worker/routes/webhook.routes.ts',
    find: "await creditSellerOrderToLedger(DB, Number(o.id)).catch(swallow('webhook'))",
    replace: 'await creditSellerOrderToLedger(DB, Number(o.id)).catch(() => {})',
    test: TEST,
    why: '같음 — 웹훅 경로.',
  },
]
