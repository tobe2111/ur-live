/**
 * 🧬 주입 — 이용권 선물(넘기기) · 받은 뒤 환불 차단 (2026-10-11 대표 결정)
 */
const T = 'src/tests/unit/voucher-gift-2026-10-11.test.ts'
const R = 'src/features/group-buy/api/voucher-gift.routes.ts'
export default [
  {
    name: '선물 — 받을 때 보낸 사람이 아직 주인인지 안 본다',
    file: R,
    find: "WHERE id = ? AND status = 'unused' AND user_id = ? AND gift_from_user_id IS NULL",
    replace: "WHERE id = ? AND status = 'unused' AND ? IS NOT NULL AND gift_from_user_id IS NULL",
    test: T,
    why: '보낸 사람이 그 사이 다른 사람에게 넘긴 이용권을 또 가져갈 수 있다.',
  },
  {
    name: '선물 — 주인 이동 실패 때 선물을 닫지 않는다',
    file: R,
    find: "await DB.prepare(\"UPDATE voucher_gifts SET status = 'cancelled', cancelled_at = CURRENT_TIMESTAMP WHERE id = ?\").bind(g.id).run().catch(() => null)",
    replace: 'void 0',
    test: T,
    why: "선물은 '받음' 인데 이용권은 보낸 사람에게 남는 반쯤 넘어간 상태가 생긴다.",
  },
  {
    name: '선물 — 공개 조회가 이용권 코드를 내보낸다',
    file: R,
    find: '        message: g.message,\n        sender_name: g.sender_name,',
    replace: '        message: g.message,\n        code: (await DB.prepare(\'SELECT code FROM vouchers WHERE id = ?\').bind(g.voucher_id).first<{ code: string }>())?.code,\n        sender_name: g.sender_name,',
    test: T,
    why: '링크만 가진 사람이 받기 전에 QR 코드로 이용권을 써 버릴 수 있다.',
  },
  {
    name: '선물 — 셀프 취소 CAS 에서 선물 조건을 뺀다',
    file: 'src/features/group-buy/api/group-buy-voucher.routes.ts',
    find: "AND created_at > datetime('now', '-7 days') AND gift_from_user_id IS NULL AND ${noPendingGiftSql('vouchers.id')}`",
    replace: "AND created_at > datetime('now', '-7 days') AND ${noPendingGiftSql('vouchers.id')}`",
    test: T,
    why: '조회와 CAS 사이에 선물이 받아지면 받은 이용권이 환불된다(돈은 보낸 사람·이용권은 친구).',
  },
  {
    name: '선물 — 주문 취소 차단이 어드민까지 막는다',
    file: 'src/worker/routes/order.routes.ts',
    find: "if (c.get('user').type !== 'admin' && await orderHasGiftedVoucher(c.env.DB, orderId))",
    replace: 'if (await orderHasGiftedVoucher(c.env.DB, orderId))',
    test: T,
    why: '고객센터(어드민)조차 선물 주문을 무를 수 없게 된다.',
  },
  {
    name: '선물 — 환불 요청 차단을 뺀다',
    file: 'src/features/returns/api/returns.routes.ts',
    find: 'if (voucher && await orderHasGiftedVoucher(DB, order.id)) return',
    replace: 'if (false) return',
    test: T,
    why: '보낸 사람이 친구에게 준 이용권의 환불을 요청할 수 있다.',
  },
  {
    name: '선물 — 판정 조회 실패를 "없음" 으로',
    file: 'src/worker/utils/voucher-gift.ts',
    find: "gift_from_user_id IS NOT NULL LIMIT 1',\n    ).bind(orderId).first<{ x: number }>()\n    return !!row\n  } catch {\n    return true\n  }",
    replace: "gift_from_user_id IS NOT NULL LIMIT 1',\n    ).bind(orderId).first<{ x: number }>()\n    return !!row\n  } catch {\n    return false\n  }",
    test: T,
    why: '조회가 깨진 날 받은 이용권의 주문이 셀프로 환불된다.',
  },
  {
    name: '선물 — 받은 이용권 재선물을 허용한다',
    file: R,
    find: "if (v.gift_from_user_id) return c.json({ success: false, error: '선물 받은 이용권은 다시 선물할 수 없어요', code: 'ALREADY_GIFTED' }, 400)",
    replace: 'void 0',
    test: T,
    why: '받은 사람이 다시 넘기면 gift_from_user_id 가 덮이고 받은 뒤 환불 차단 근거가 흔들린다.',
  },
]
