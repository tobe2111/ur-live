/**
 * 💸🔐 2026-11-18 (대표 *"다 해결해줘"*) — 환불이 **주문 전체**를 건드리기 전에 보는 두 가지.
 *
 * ① 이용권 여러 장을 한 주문으로 샀을 때, 한 장만 카드 취소해도 주문이 통째로 `REFUNDED` 로 찍혔다.
 *    남은 이용권은 그대로 쓰이는데 정산은 환불된 주문을 건너뛴다 ⇒ **매장이 그 몫을 못 받는다.**
 *    지금은 그 주문의 이용권이 **전부** 환불됐을 때만 주문을 `REFUNDED` 로 바꾼다.
 * ② 주문 환불(`POST /api/orders/refund`)은 결제 완료 주문을 전액 돌려준다. 숙소 예약이 묶인 주문이면
 *    날짜별 환불율(48시간 전 100% · 24시간 전 50% …)과 달력 풀기를 건너뛰고 **전액 환불 + 예약은 확정인 채** 남았다.
 *    지금은 살아 있는 숙소 예약이 있으면 거절하고 숙소 취소로 보낸다.
 *
 * ## 못 막는 것
 * - ①: 부분 환불된 주문의 금액 표시(주문은 PAID 인데 일부 이용권이 환불됨) — 화면은 이용권 상태로 보여 준다.
 * - ②: 조회가 실패하면 **살아 있다고 본다**(거절). 손님은 다시 시도하거나 숙소 취소를 쓰면 된다 — 반대는 돈이 나간다.
 */
import type { D1Database } from '@cloudflare/workers-types'
import { ktCouponDelivered, KT_DELIVERED_REFUND_BLOCKED } from './kt-delivered'

/** 바인딩 2개(order_id, order_id). 남은(환불 안 된) 이용권이 하나라도 있으면 아무 행도 안 바뀐다. */
export const ORDER_REFUNDED_WHEN_ALL_VOUCHERS_GONE_SQL =
  "UPDATE orders SET status = 'REFUNDED', payment_status = 'refunded' WHERE id = ? AND NOT EXISTS (SELECT 1 FROM vouchers v WHERE v.order_id = ? AND v.status != 'refunded')"

export const STAY_REFUND_ELSEWHERE = '숙소 예약은 예약 내역에서 취소해 주세요(취소 규정에 따라 환불됩니다).'

/** 이 주문에 취소·환불되지 않은 숙소 예약이 묶여 있는가. 모르면 true. */
export async function orderHasLiveStay(DB: D1Database, orderId: number | string): Promise<boolean> {
  try {
    const row = await DB.prepare(
      "SELECT 1 AS x FROM stay_bookings WHERE order_id = ? AND status NOT IN ('cancelled', 'refunded') LIMIT 1",
    ).bind(orderId).first<{ x: number }>()
    return !!row
  } catch (err) {
    if (/no such table/i.test(String((err as Error)?.message || ''))) return false
    return true
  }
}

/**
 * 🏨 2026-11-25 — 이 주문에 숙소 예약이 **하나라도**(취소·환불된 것 포함) 묶여 있는가. 모르면 true.
 *   `orderHasLiveStay` 는 살아 있는 예약만 보고 `POST /api/orders/refund` 한 곳에만 걸려 있었다. 시험 환경에서 돌려 보니
 *   `POST /api/orders/:id/cancel` 로는 ① 확정된 날짜 예약을 취소 규정 없이 전액 환불(예약은 확정인 채 남는다)
 *   ② 50% 환불받은 예약의 나머지 50% 도 받을 수 있었다. 숙소 주문의 돈은 **숙소 취소·어드민 숙소 환불로만** 나간다.
 */
export async function orderHasAnyStay(DB: D1Database, orderId: number | string): Promise<boolean> {
  try {
    return !!(await DB.prepare('SELECT 1 AS x FROM stay_bookings WHERE order_id = ? LIMIT 1').bind(orderId).first<{ x: number }>())
  } catch (err) {
    return !/no such table/i.test(String((err as Error)?.message || ''))
  }
}

/**
 * 🎟️ 2026-11-18 (대표 승인 "주문 취소 구멍 3건 막기") — **이용권 주문의 셀프 취소**는 장 단위 규칙(미사용 · 구매 7일 안)을 지킨다.
 *   종전 `POST /api/orders/:id/cancel` 은 주문 상태(PAID)만 봤다:
 *   ① 이미 **사용한** 이용권 주문도 전체 취소로 전액 환불(매장이 손해) · ② 7일이 지나도 취소 ·
 *   ③ `cancel_amount` 만 적으면 이용권은 그대로 두고 딜만 돌려받았다.
 *   이용권 셀프 취소(`/api/group-buy/voucher/:code/cancel`)가 지키는 규칙을 여기서도 똑같이 건다. 관리자는 호출부가 건너뛴다.
 * 반환: 막을 이유(문구·코드) 또는 null(통과). 조회 실패는 **막는다** — 반대는 돈이 나간다.
 */
export async function voucherOrderSelfCancelBlock(
  DB: D1Database,
  orderId: number,
  p: { cancelAmount?: number; cancelQty?: number },
): Promise<{ error: string; code: string } | null> {
  if (await orderHasAnyStay(DB, orderId)) return { error: STAY_REFUND_ELSEWHERE, code: 'STAY_CANCEL' }
  if (await ktCouponDelivered(DB, orderId)) return { error: KT_DELIVERED_REFUND_BLOCKED, code: 'KT_DELIVERED' } // 🎁 2026-11-25 발송된 교환권
  const r = await DB.prepare(
    `SELECT status, CASE WHEN created_at > datetime('now', '-7 days') THEN 1 ELSE 0 END AS fresh FROM vouchers WHERE order_id = ?`,
  ).bind(orderId).all<{ status: string; fresh: number }>().catch(() => null)
  if (!r) return { error: '이용권 상태를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요', code: 'VOUCHER_CHECK_FAILED' }
  const vs = r.results ?? []
  if (vs.length === 0) return null
  if (p.cancelAmount !== undefined) return { error: '이용권은 금액이 아니라 장 단위로 취소해 주세요', code: 'VOUCHER_ORDER_BY_QTY' }
  const live = vs.filter((v) => String(v.status).toLowerCase() !== 'refunded')
  if (p.cancelQty === undefined && live.some((v) => String(v.status).toLowerCase() !== 'unused')) {
    return { error: '사용했거나 만료된 이용권이 있어 전체 취소할 수 없습니다. 남은 장만 골라 취소해 주세요', code: 'VOUCHER_USED' }
  }
  if (live.some((v) => String(v.status).toLowerCase() === 'unused' && Number(v.fresh) !== 1)) {
    return { error: '구매 후 7일이 지나 취소할 수 없습니다. 사용처에 직접 문의해주세요', code: 'WINDOW_EXPIRED' }
  }
  return null
}

/**
 * 💸 2026-11-18 — 이용권 한 장을 무른 금액을 **주문에도 적는다**(상한 CAS) + 다 무르면 주문을 REFUNDED.
 *   종전 딜 결제 셀프 취소는 딜만 돌려주고 주문은 PAID·`refunded_amount=0` 그대로라, 이어서 주문 전체 취소를 하면
 *   `total − 0` 이 한 번 더 나갔다(이중 환불). 적지 못하면(상한 초과) false — 호출부가 환불을 멈춘다.
 */
export async function bookVoucherRefundOnOrder(DB: D1Database, orderId: number, amount: number): Promise<boolean> {
  const a = Math.max(0, Math.round(Number(amount) || 0))
  if (!(a > 0)) return true
  const r = await DB.prepare(
    `UPDATE orders SET refunded_amount = COALESCE(refunded_amount, 0) + ?, updated_at = datetime('now')
      WHERE id = ? AND COALESCE(refunded_amount, 0) + ? <= total_amount`,
  ).bind(a, orderId, a).run()
  if ((r.meta?.changes ?? 0) !== 1) return false
  await DB.prepare(ORDER_REFUNDED_WHEN_ALL_VOUCHERS_GONE_SQL).bind(orderId, orderId).run()
  return true
}
