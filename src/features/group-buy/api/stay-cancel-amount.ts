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

export const STAY_VOUCHER_EXPIRED_CANCEL = '유효기간이 지난 숙박권이에요. 결제 수단으로 자동 환불돼요(보통 다음 날 새벽).'

interface CancelBooking { sale_mode?: string | null; voucher_used_at?: string | null; voucher_expires_at?: string | null }

/** DB 시각(`Z` 없는 UTC 문자열)을 ms 로. 그대로 `new Date` 하면 런타임 시간대에 따라 9시간 어긋난다. */
function dbUtcMs(v: string): number {
  return Date.parse(/[zZ]|[+-]\d{2}:?\d{2}$/.test(v) ? v : `${v.replace(' ', 'T')}Z`)
}

/**
 * 먼저 판매 숙박권이 **안 쓴 채 유효기간이 지났나.** 그 숙박권은 만료 환불 cron 이 전액 돌려준다.
 * 그 사이(최대 하루)에 손님이 취소를 누르면 종전엔 환불 0원으로 닫히고 이용권이 `refunded` 로 바뀌어
 * **cron 도 더는 못 잡았다** — 받을 환불이 사라진다. 그래서 취소를 받지 않고 자동 환불을 안내한다.
 */
export function stayVoucherExpiredUnused(b: CancelBooking, now: number = Date.now()): boolean {
  if (b.sale_mode !== 'voucher' || b.voucher_used_at || !b.voucher_expires_at) return false
  const t = dbUtcMs(b.voucher_expires_at)
  return Number.isFinite(t) && t <= now
}

/**
 * 취소 환불율(0~1). 2026-11-25 에 `stays-public.routes.ts` 취소 분기에서 **계산 그대로** 옮겼다(그 파일이 크기 동결값에 붙어 있다).
 *   숙박권(날짜 없음): 미사용 · 미만료면 100%, 아니면 0 — 날짜가 없어 임박 취소 손실 개념이 없고 달력도 안 쓴다.
 *   날짜 예약: flexible 24시간 전 100% · standard 48시간 전 100% / 24시간 전 50% · strict 72시간 전 50% · non_refundable 0.
 */
export function stayCancelRefundRate(b: CancelBooking, policy: string, hoursUntilCheckIn: number, now: number = Date.now()): number {
  if (b.sale_mode === 'voucher') {
    const notExpired = !b.voucher_expires_at || dbUtcMs(b.voucher_expires_at) > now
    return !b.voucher_used_at && notExpired ? 1.0 : 0
  }
  if (policy === 'flexible') return hoursUntilCheckIn >= 24 ? 1.0 : 0
  if (policy === 'standard') return hoursUntilCheckIn >= 48 ? 1.0 : (hoursUntilCheckIn >= 24 ? 0.5 : 0)
  if (policy === 'strict') return hoursUntilCheckIn >= 72 ? 0.5 : 0
  return 0
}
