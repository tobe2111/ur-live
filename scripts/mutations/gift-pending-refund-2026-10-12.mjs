/**
 * 🧬 주입 — 선물 중 보낸 사람 셀프 환불 차단 · 지갑 지도 같은 카드 재탭 (2026-10-12 대표 "둘 다 해줘")
 */
const T = 'src/tests/unit/gift-pending-refund-2026-10-12.test.ts'
export default [
  {
    name: '선물 중 환불 — 주문 단위 판정이 pending 을 안 본다',
    file: 'src/worker/utils/voucher-gift.ts',
    find: "WHERE v.order_id = ? AND g.status = 'pending' LIMIT 1",
    replace: "WHERE v.order_id = ? AND g.status = 'none' LIMIT 1",
    test: T,
    why: '선물 링크를 보낸 채 주문을 무르면 친구 쪽 선물이 갑자기 사라진다.',
  },
  {
    name: '선물 중 환불 — 이용권 취소 CAS 에서 선물 중 술어를 뺀다',
    file: 'src/features/group-buy/api/group-buy-voucher.routes.ts',
    find: "AND gift_from_user_id IS NULL AND ${noPendingGiftSql('vouchers.id')}`",
    replace: "AND gift_from_user_id IS NULL`",
    test: T,
    why: '조회와 CAS 사이 경쟁에서 선물 중 이용권이 환불된다.',
  },
  {
    name: '선물 중 환불 — 환불 요청 차단을 뺀다',
    file: 'src/features/returns/api/returns.routes.ts',
    find: " if (voucher && await orderHasPendingGift(DB, order.id)) return c.json({ success: false, error: GIFT_PENDING_REFUND_BLOCKED, code: 'GIFT_PENDING' }, 409);",
    replace: '',
    test: T,
    why: '환불 요청 경로로 선물 중 주문을 무를 수 있다.',
  },
  {
    name: '지갑지도 재탭 — 지도가 누름 횟수를 안 본다',
    file: 'src/pages/my-vouchers/VoucherMap.tsx',
    find: '}, [focus?.lat, focus?.lng, focusKey])',
    replace: '}, [focus?.lat, focus?.lng])',
    test: T,
    why: '지도를 옮긴 뒤 같은 이용권을 다시 눌러도 핀으로 안 돌아간다.',
  },
]
