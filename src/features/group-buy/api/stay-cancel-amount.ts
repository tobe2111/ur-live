/**
 * 🏨🔐 2026-11-18 (대표 승인) — 숙소 예약 취소 때 토스에 보낼 취소 금액.
 *
 * 금액을 **안 실으면** 토스는 그 결제를 통째로 취소한다. 그래서 "100% 환불 = 금액 생략" 은 그 결제에 예약이
 * **하나뿐일 때만** 맞다. 다객실(한 결제 · 방 여러 개)에서 그렇게 하면 방 하나를 취소했는데 전액이 돌아가고
 * 나머지 방은 예약된 채 남는다.
 *
 * ## 못 막는 것
 * - 예약 수를 못 셌을 때(조회 실패)는 **단독이 아니라고 본다** — 이 방 값만 돌려준다. 덜 돌려준 것은 고객센터가
 *   채울 수 있지만, 더 돌려준 것은 되돌릴 수 없다.
 */
import type { D1Database } from '@cloudflare/workers-types'

export function stayIsSoleBooking(siblingCount: number | null | undefined): boolean {
  return Number(siblingCount) === 1
}

/** 토스 `cancelAmount` — undefined 면 전체 취소. */
export function stayCancelAmount(refundRate: number, refundAmount: number, soleBooking: boolean): number | undefined {
  return refundRate >= 1.0 && soleBooking ? undefined : refundAmount
}

/** 그 결제(order)에 묶인 예약 수를 세어 취소 금액을 정한다. */
export async function stayCancelAmountFor(
  DB: D1Database, orderId: number, refundRate: number, refundAmount: number,
): Promise<number | undefined> {
  const row = await DB.prepare('SELECT COUNT(*) AS n FROM stay_bookings WHERE order_id = ?')
    .bind(orderId).first<{ n: number }>().catch(() => null)
  return stayCancelAmount(refundRate, refundAmount, stayIsSoleBooking(row?.n))
}
