/**
 * 🛡️ 2026-05-18: stay 관련 status / role 화이트리스트 검증.
 *
 *   SQLite ALTER ADD CHECK 미지원 → application 측에서 강제.
 *   호출처: stay_bookings 상태 전이 / voucher_orders status / status_log INSERT.
 *   잘못된 값 INSERT 시 즉시 에러 (silent corruption 방지).
 */

export const STAY_BOOKING_STATUS = [
  'pending', 'confirmed', 'checked_in', 'checked_out',
  'cancelled', 'no_show', 'refunded', 'dispute',
] as const
export type StayBookingStatus = typeof STAY_BOOKING_STATUS[number]

export const VOUCHER_ORDER_STATUS = [
  'pending', 'processing', 'sent', 'failed', 'cancelled', 'used',
] as const
export type VoucherOrderStatus = typeof VOUCHER_ORDER_STATUS[number]

export const STAY_STATUS_LOG_ROLE = ['user', 'seller', 'admin', 'system'] as const
export type StayStatusLogRole = typeof STAY_STATUS_LOG_ROLE[number]

/** 'PAID' 같은 잘못된 status 입력 시 throw. CHECK 제약 대체. */
export function assertStayBookingStatus(s: string): asserts s is StayBookingStatus {
  if (!(STAY_BOOKING_STATUS as readonly string[]).includes(s)) {
    throw new Error(`invalid stay_bookings.status: ${s}`)
  }
}

export function assertVoucherOrderStatus(s: string): asserts s is VoucherOrderStatus {
  if (!(VOUCHER_ORDER_STATUS as readonly string[]).includes(s)) {
    throw new Error(`invalid voucher_orders.status: ${s}`)
  }
}

export function assertStatusLogRole(r: string): asserts r is StayStatusLogRole {
  if (!(STAY_STATUS_LOG_ROLE as readonly string[]).includes(r)) {
    throw new Error(`invalid stay_booking_status_log.changed_by_role: ${r}`)
  }
}

/** 평점 1-5 검증. null 허용 (선택 카테고리). */
export function assertRating(v: number | null | undefined, required = false): number | null {
  if (v == null) {
    if (required) throw new Error('rating required')
    return null
  }
  const n = Number(v)
  if (!Number.isFinite(n) || n < 1 || n > 5) {
    throw new Error(`invalid rating: ${v} (must be 1-5)`)
  }
  return n
}
