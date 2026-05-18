/**
 * 🛡️ 2026-05-18: 숙소 예약 D-1 / D-day 자동 알림.
 *   2026-05-18 (refund-alimtalk-impl PR): 실제 알림톡 발송 연결.
 *
 * 매일 09:00 KST 실행:
 *   - D-1: 게스트에 내일 체크인 안내 + 체크인 코드 사전 안내
 *   - D-day: 게스트에 오늘 체크인 + 코드, 호스트에 도착 예정
 *
 * 알림톡: aligo via lib/aligo (ALIGO_API_KEY/USER_ID/SENDER_KEY env 필요).
 *   템플릿 코드는 default value 사용 — 추후 kakao_alimtalk_templates 매핑.
 */
type Env = {
  DB: D1Database;
  ALIGO_API_KEY?: string;
  ALIGO_USER_ID?: string;
  ALIGO_SENDER_KEY?: string;
  ALIGO_STAY_REMINDER_TEMPLATE_D1?: string;
  ALIGO_STAY_REMINDER_TEMPLATE_DDAY?: string;
}
type Booking = {
  id: number; product_id: number; check_in_date: string; check_out_date: string;
  guest_name: string; guest_phone: string;
  check_in_code: string | null;
  product_name: string | null;
  room_name: string | null;
  seller_phone: string | null;
  check_in_time: string | null;
}

export async function runStayReminderCron(env: Env): Promise<{ d1_sent: number; dday_sent: number; alimtalk_sent: number; alimtalk_failed: number }> {
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
  let alimtalkSent = 0
  let alimtalkFailed = 0

  // 알림톡 핸들러 lazy load (인프라 미설정 환경에서도 cron 동작 보장).
  const alimtalkConfigured = !!(env.ALIGO_API_KEY && env.ALIGO_USER_ID && env.ALIGO_SENDER_KEY)
  let sendAlimtalk: ((api: { ALIGO_API_KEY: string; ALIGO_USER_ID: string }, params: { senderKey: string; templateCode: string; to: string; message: string }) => Promise<{ success: boolean; error?: string }>) | null = null
  if (alimtalkConfigured) {
    const mod = await import('../../lib/aligo').catch(() => null)
    sendAlimtalk = mod?.sendAlimtalk || null
  }

  for (const b of (rows.results || [])) {
    const isToday = b.check_in_date === today
    try {
      // 1. notifications 테이블 INSERT (어플 내 알림).
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

      // 2. 카카오 알림톡 발송 (인프라 설정된 경우만).
      if (alimtalkConfigured && sendAlimtalk && b.guest_phone) {
        const phone = b.guest_phone.replace(/\D/g, '')
        const isValid = /^01\d{8,9}$/.test(phone)
        if (isValid) {
          const templateCode = isToday
            ? (env.ALIGO_STAY_REMINDER_TEMPLATE_DDAY || 'stay_dday')
            : (env.ALIGO_STAY_REMINDER_TEMPLATE_D1 || 'stay_d1')
          const message = isToday
            ? `[유어딜]\n오늘 체크인 안내드립니다.\n\n· 숙소: ${b.product_name}\n· 객실: ${b.room_name}\n· 체크인: ${b.check_in_time || '15:00'}\n· 체크인 코드: ${b.check_in_code || '-'}\n\n즐거운 여행 되세요.`
            : `[유어딜]\n내일 체크인 예정입니다.\n\n· 숙소: ${b.product_name}\n· 객실: ${b.room_name}\n· 체크인: ${b.check_in_time || '15:00'}\n\n사전 안내문 확인 부탁드립니다.`

          const result = await sendAlimtalk(
            { ALIGO_API_KEY: env.ALIGO_API_KEY!, ALIGO_USER_ID: env.ALIGO_USER_ID! },
            {
              senderKey: env.ALIGO_SENDER_KEY!,
              templateCode,
              to: phone,
              message,
            },
          ).catch((e: Error) => ({ success: false, error: e.message }))

          if (result.success) {
            alimtalkSent++
          } else {
            alimtalkFailed++
            // 실패 row 는 alimtalk_failures 큐로 (재시도 cron 이 처리).
            await env.DB.prepare(
              `INSERT INTO alimtalk_failures
                 (template_code, phone, message, error, retry_count, max_retries, next_retry_at, created_at)
               VALUES (?, ?, ?, ?, 0, 3, datetime('now', '+5 minutes'), datetime('now'))`
            ).bind(templateCode, phone, message.slice(0, 1000), (result.error || 'unknown').slice(0, 500))
              .run().catch(() => { /* 테이블 없으면 silent */ })
          }
        }
      }

      if (isToday) ddaySent++; else d1Sent++
    } catch { /* per-row fail-soft */ }
  }

  return { d1_sent: d1Sent, dday_sent: ddaySent, alimtalk_sent: alimtalkSent, alimtalk_failed: alimtalkFailed }
}
