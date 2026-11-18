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
