/**
 * 🧬 주입 — 숙소 = 이용권 통일(2026-10-25). 가드: src/tests/unit/stay-voucher-unify-2026-10-25.test.ts
 */
const T = 'src/tests/unit/stay-voucher-unify-2026-10-25.test.ts'
const M = 'src/features/group-buy/api/stay-voucher-unify.ts'
export default [
  {
    name: '숙소이용권 — 게이트를 무시하고 발급한다',
    file: M, find: "  if (!(await stayVoucherUnifyEnabled(DB))) return 0\n", replace: '\n', test: T,
    why: '기본 OFF 가 깨지면 staging 실결제 전에 라이브 숙소 결제가 이용권을 만든다.',
  },
  {
    name: '숙소이용권 — 미확정 예약에도 발급한다',
    file: M, find: "WHERE id IN (${marks}) AND status = 'confirmed'`", replace: 'WHERE id IN (${marks})`', test: T,
    why: '결제 안 된 예약에 쓸 수 있는 이용권이 생긴다.',
  },
  {
    name: '숙소이용권 — 체크인 전날에도 연다',
    file: M, find: "  if (link.check_in_date && today < link.check_in_date) return", replace: "  if (false && link.check_in_date && today < link.check_in_date) return", test: T,
    why: '체크인 전에 스캔되면 예약이 사용 처리되고 환불이 막힌다.',
  },
  {
    name: '숙소이용권 — 한국 날짜 대신 UTC 날짜',
    file: M, find: 'return new Date(now + 9 * 3600000).toISOString().slice(0, 10)', replace: 'return new Date(now).toISOString().slice(0, 10)', test: T,
    why: '한국 0~9시에 체크인 당일 스캔이 "체크인 날짜부터" 로 거절된다.',
  },
  {
    name: '숙소이용권 — 앞선 취소가 잡은 이용권을 held 로 돌려 되살린다',
    file: M, find: "return now?.status === 'used' ? 'used' : 'gone'", replace: "return now?.status === 'used' ? 'used' : 'held'", test: T,
    why: '중복 취소 요청이 이미 환불된 예약의 이용권을 unused 로 되살린다(환불받고 또 쓴다).',
  },
  {
    name: '숙소이용권 — 이미 쓴 이용권도 취소를 허용',
    file: 'src/features/group-buy/api/stays-public.routes.ts', find: "    if (voucherHold === 'used') return", replace: "    if (false) return", test: T,
    why: '체크인한 예약이 환불된다.',
  },
  {
    name: '숙소이용권 — 사장님 스캔이 숙소 판정을 건너뛴다',
    file: 'src/worker/utils/voucher-seller-redeem.ts', find: '    const block = stayRedeemBlock(stay, { afterManual: opts.stayAfterManual })', replace: '    const block = null', test: T,
    why: '취소된 예약의 이용권·체크인 전 이용권이 스캔으로 쓰인다.',
  },
  {
    name: '숙소이용권 — 셀프 취소가 숙소 규칙을 우회한다',
    file: 'src/features/group-buy/api/group-buy-voucher.routes.ts', find: "          if (stay) return c.json({ success: false, error: STAY_VOUCHER_CANCEL_ELSEWHERE, code: 'STAY_CANCEL', booking_id: stay.booking_id }, 409)", replace: '', test: T,
    why: '날짜별 환불율 없이 100% 환불되고 달력도 안 풀린다.',
  },
  {
    name: '숙소이용권 — 수동 체크인이 이용권을 안 정리한다',
    file: 'src/features/seller/api/seller-stays.routes.ts', find: "    await (await import('../../group-buy/api/stay-voucher-unify')).settleStayVoucherAfterManual(c.env.DB, { bookingId, sellerId, waitUntil: (p) => c.executionCtx.waitUntil(p) })", replace: '', test: T,
    why: '지갑에 사용 가능으로 남아 재스캔되고 정산 원장이 빠진다.',
  },
]
