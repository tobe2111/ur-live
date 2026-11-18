/** 🧬 주입 — 머니 수리 4건 (2026-11-18) · 가드: src/tests/unit/money-fixes-2026-11-18.test.ts */
const T = 'src/tests/unit/money-fixes-2026-11-18.test.ts'
export default [
  { name: 'money1118: 결제가 안 적은 기본 요율을 믿는다', file: 'src/worker/utils/ledger.ts',
    find: '    if (!r || !(Number(r.sa) > 0) || !Number.isFinite(rate)', replace: '    if (!r || !Number.isFinite(rate)', test: T,
    why: '계산이 안 된 주문의 DB 기본값 10% 가 정산에 쓰인다.' },
  { name: 'money1118: 사용 때 채널을 다시 본다', file: 'src/worker/utils/ledger.ts',
    find: '    platformRate = await purchaseRateSnapshot(DB, params.voucher_id)\n', replace: '', test: T,
    why: '매장 채널을 바꾸면 이미 팔린 이용권 수수료가 소급해 바뀐다.' },
  { name: 'money1118: 승인된 주문도 자동취소', file: 'src/worker/cron/scheduled-cleanup.ts',
    find: "        AND LOWER(COALESCE(payment_status, '')) NOT IN ('approved', 'done', 'paid')\n", replace: '', test: T,
    why: '돈이 승인된 주문이 환불 없이 취소된다(머니 룰 #4).' },
  { name: 'money1118: 일부 환불도 주문 전체를 REFUNDED', file: 'src/worker/cron/mark-order-refunded.ts',
    find: "      WHERE id = ? AND status != 'REFUNDED' AND COALESCE(refunded_amount, 0) >= COALESCE(total_amount, 0) AND COALESCE(total_amount, 0) > 0`,", replace: "      WHERE id = ? AND status != 'REFUNDED'`,", test: T,
    why: '여러 장 주문에서 한 장만 만료 환불돼도 나머지가 환불된 것으로 보인다.' },
  { name: 'money1118: 무신고는 원천징수 0', file: 'src/shared/influencer-payout-math.ts',
    find: '  return WITHHOLDING_RATES.business_income\n}', replace: '  return 0\n}', test: T,
    why: '세금 종류를 안 적은 인플루언서에게 원천징수 없이 지급해 세금을 회사가 떠안는다.' },
  { name: 'money1118: 같은 지급을 두 번 적는다', file: 'src/worker/utils/influencer-withholding-log.ts',
    find: '`INSERT OR IGNORE INTO influencer_withholding_log', replace: '`INSERT INTO influencer_withholding_log', test: T,
    why: '지급명세서에 같은 지급이 두 번 잡힌다.' },
]
