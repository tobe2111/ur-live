/**
 * 🛡️ 2026-05-31: 숙소 재고(available_count) 복원 — 취소/환불 시 객실 야간 재고 반환.
 *
 * 배경: 결제 confirm 은 박마다 `product_stay_calendar.available_count - 1` 차감
 *   (payment.routes.ts / stays-public.routes.ts confirm). 그런데 취소/환불 경로는
 *   차감을 되돌리지 않아 **취소된 객실이 영구 unavailable** → 재고/매출 손실.
 *
 * 규칙:
 *   - confirm 이 실제 차감한 건(=취소 직전 status==='confirmed')에만 호출할 것.
 *     'pending'(미결제) 예약은 차감된 적 없으므로 복원하면 과다 증가.
 *   - 박마다 +1 (confirm 차감과 1:1 대칭). 상한 clamp 없음 — 차감 rollback(payment.routes:331)과 동일.
 *     이중 호출 방지는 호출부의 status CAS('confirmed'→'cancelled'/'refunded')가 담당.
 */
export async function releaseStayInventory(
  DB: D1Database,
  roomId: number | null | undefined,
  checkIn: string | null | undefined,
  checkOut: string | null | undefined,
): Promise<number> {
  if (!roomId || !checkIn || !checkOut) return 0
  const start = new Date(checkIn).getTime()
  const end = new Date(checkOut).getTime()
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0
  const nights = Math.round((end - start) / 86400000)
  if (nights <= 0 || nights > 365) return 0

  let released = 0
  for (let i = 0; i < nights; i++) {
    const ds = new Date(start + i * 86400000).toISOString().slice(0, 10)
    const r = await DB.prepare(
      `UPDATE product_stay_calendar
          SET available_count = available_count + 1, updated_at = datetime('now')
        WHERE room_id = ? AND stay_date = ?`
    ).bind(roomId, ds).run().catch(() => null)
    if (r && (r.meta?.changes ?? 0) > 0) released++
  }
  return released
}
