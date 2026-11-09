/**
 * 🔐 2026-11-09 보안 전수조사 7차 — 주입 매니페스트.
 * 가드: src/tests/unit/security-hardening-7-2026-11-09.test.ts
 */
const TEST = 'src/tests/unit/security-hardening-7-2026-11-09.test.ts'

export default [
  {
    name: '[sec7] Stripe 가 손님이 넣은 주문번호를 그대로 싣는다',
    file: 'src/worker/routes/stripe.routes.ts',
    find: '      if (/^order_?number$/i.test(key)) continue;\n',
    replace: '',
    test: TEST,
    why: '싼 결제 하나로 미결제 주문이 결제 완료가 된다.',
  },
  {
    name: '[sec7] Stripe 실패 이벤트가 결제된 주문도 FAILED 로',
    file: 'src/worker/routes/stripe.routes.ts',
    find: "WHERE order_number = ? AND status = 'PENDING'\" // 🔐 2026-11-09 결제된 주문을 실패로 덮지 않는다",
    replace: "WHERE order_number = ?\" // 🔐 2026-11-09 결제된 주문을 실패로 덮지 않는다",
    test: TEST,
    why: '남의 주문번호로 실패 결제를 내면 결제된 주문이 실패로 바뀐다.',
  },
  {
    name: '[sec7] 이메일 발송 API 를 다시 누구나',
    file: 'src/features/notifications/api/email.routes.ts',
    find: "emailRoutes.use('*', requireAdmin())\n",
    replace: '',
    test: TEST,
    why: '우리 도메인으로 아무에게나 피싱 메일을 보낸다.',
  },
  {
    name: '[sec7] 추천 클릭 제한을 뺀다',
    file: 'src/features/ledger/api/ledger.routes.ts',
    find: " rateLimit({ action: 'referral_click', max: 30, windowSec: 60 }),",
    replace: '',
    test: TEST,
    why: '남의 추천 클릭 지표를 무한히 부풀린다.',
  },
  {
    name: '[sec7] CSP 보고 제한을 뺀다',
    file: 'src/worker/routes/public-utility.routes.ts',
    find: " rateLimit({ action: 'csp_report', max: 30, windowSec: 60 }),",
    replace: '',
    test: TEST,
    why: 'DB 에 행을 무한히 쌓는다.',
  },
  {
    name: '[sec7] Stripe 웹훅이 금액 대조 없이 PAID',
    file: 'src/worker/routes/stripe.routes.ts',
    find: 'if (order && isStripeAmountMatch(obj, order.total_amount)) {',
    replace: 'if (order) {',
    test: TEST,
    why: '50센트 결제로 20달러 주문이 결제 완료가 된다.',
  },
  {
    name: '[sec7] Stripe 금액 대조가 통화를 안 본다',
    file: 'src/worker/routes/stripe.routes.ts',
    find: "return String(pi.currency || '').toLowerCase() === 'usd' && ",
    replace: 'return ',
    test: TEST,
    why: '1999원(krw) 결제가 19.99달러 주문을 확정한다.',
  },
]
