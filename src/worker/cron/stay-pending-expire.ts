/**
 * 🛡️ 2026-05-31: 미결제 pending 숙소 예약 자동 만료 cron.
 *
 * 배경: stay_bookings 는 결제 전 status='pending' 으로 생성되고(stays-public.routes.ts),
 *   재고(product_stay_calendar.available_count)는 결제 confirm 시에만 차감된다.
 *   pending 은 재고를 잡지 않으므로 무한 누적 가능 → DB 오염 + 통계 왜곡.
 *
 * 이중예약 자체는 confirm 의 오버부킹 가드(`available_count > 0` + meta.changes)가
 *   차단하므로, 여기서는 재고 조작 없이 오래된 미결제 pending 만 'expired' 로 정리한다.
 *
 * 안전:
 *   - 결제된(orders.status PAID/DONE) 예약은 제외 → 결제-confirm race 보호 (30분 여유).
 *   - 재고 미조작 (pending 은 차감된 적 없음 → 복원 불필요).
 *   - CAS(status='pending' 조건)로 멱등 — 이중 만료 방지.
 */
type Env = { DB: D1Database }

export async function handleStayPendingExpire(env: Env): Promise<{ expired: number }> {
  const DB = env.DB
  let expired = 0
  try {
    const { results } = await DB.prepare(`
      SELECT b.id
        FROM stay_bookings b
        LEFT JOIN orders o ON o.id = b.order_id
       WHERE b.status = 'pending'
         AND b.created_at < datetime('now', '-30 minutes')
         AND (o.status IS NULL OR o.status NOT IN ('PAID', 'DONE', 'REFUNDED'))
       LIMIT 1000
    `).all<{ id: number }>()

    for (const b of (results || [])) {
      const cas = await DB.prepare(
        "UPDATE stay_bookings SET status = 'expired', updated_at = datetime('now') WHERE id = ? AND status = 'pending'"
      ).bind(b.id).run()
      if ((cas.meta?.changes ?? 0) === 0) continue
      expired++
      await DB.prepare(
        `INSERT INTO stay_booking_status_log (booking_id, prev_status, new_status, changed_by_role, reason)
         VALUES (?, 'pending', 'expired', 'system', '미결제 자동 만료 (30분 경과)')`
      ).bind(b.id).run().catch(() => { /* noop */ })
    }
  } catch { /* graceful — 다음 주기 재시도 */ }
  return { expired }
}
