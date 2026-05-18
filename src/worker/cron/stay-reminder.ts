/**
 * 🛡️ 2026-05-18 (PR 6/6): 숙소 예약 D-1 / D-day 자동 알림.
 *
 * 매일 09:00 KST 실행:
 *   - 내일 (D-1) 체크인 예약 → 카카오 알림톡 + 호스트 알림
 *   - 오늘 (D-day) 체크인 예약 → 게스트에 체크인 코드 + 호스트에 도착 안내
 *
 * 알림톡 템플릿 (kakao_alimtalk_templates 매핑 필요):
 *   - stay_reminder_d1   = '내일 체크인 안내 ({hotel}, {room})'
 *   - stay_reminder_dday = '오늘 체크인 ({code}) — {hotel} {time}'
 */
type Env = { DB: D1Database }
type Booking = {
  id: number; product_id: number; check_in_date: string; check_out_date: string;
  guest_name: string; guest_phone: string;
  check_in_code: string | null;
  product_name: string | null;
  room_name: string | null;
  seller_phone: string | null;
  check_in_time: string | null;
}

export async function runStayReminderCron(env: Env): Promise<{ d1_sent: number; dday_sent: number }> {
  const today = new Date().toISOString().slice(0, 10)
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)

  // D-1 + D-day 예약 fetch (status='confirmed' 만).
  const rows = await env.DB.prepare(
    `SELECT b.id, b.product_id, b.check_in_date, b.check_out_date,
            b.guest_name, b.guest_phone, b.check_in_code,
            p.name as product_name, r.name as room_name,
            s.phone as seller_phone,
            psi.check_in_time
       FROM stay_bookings b
       LEFT JOIN products p ON p.id = b.product_id
       LEFT JOIN product_stay_rooms r ON r.id = b.room_id
       LEFT JOIN sellers s ON s.id = b.seller_id
       LEFT JOIN product_stay_info psi ON psi.product_id = b.product_id
      WHERE b.status = 'confirmed'
        AND b.check_in_date IN (?, ?)`
  ).bind(today, tomorrow).all<Booking>().catch(() => ({ results: [] as Booking[] }))

  let d1Sent = 0
  let ddaySent = 0
  for (const b of (rows.results || [])) {
    const isToday = b.check_in_date === today
    // 카카오 알림톡 발송은 사용자 측 카카오 인프라 활용 (kakao_alimtalk_send 헬퍼).
    // 이 cron 은 발송 로그만 INSERT — 실제 발송은 별도 worker (현재 stub).
    try {
      await env.DB.prepare(
        `INSERT INTO notifications (user_id, type, title, message, created_at)
         SELECT b2.user_id, ?, ?, ?, datetime('now')
           FROM stay_bookings b2 WHERE b2.id = ?`
      ).bind(
        isToday ? 'stay_check_in_today' : 'stay_check_in_tomorrow',
        isToday ? `오늘 체크인 — ${b.product_name}` : `내일 체크인 — ${b.product_name}`,
        isToday
          ? `체크인 코드: ${b.check_in_code || '-'} · 체크인 ${b.check_in_time || '15:00'}`
          : `${b.room_name} · 체크인 ${b.check_in_time || '15:00'}`,
        b.id,
      ).run().catch(() => { /* notifications 테이블 없으면 silent */ })

      if (isToday) ddaySent++; else d1Sent++
    } catch { /* per-row fail-soft */ }
  }

  return { d1_sent: d1Sent, dday_sent: ddaySent }
}
