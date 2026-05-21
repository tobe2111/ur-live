/**
 * 🛡️ 2026-05-21 Phase B-2: 예약 D-1 reminder cron.
 *
 * 흐름:
 *   - 매일 1회 (UTC 09 = KST 18시) 실행
 *   - 내일 (KST) 예약된 confirmed appointments 조회
 *   - 매장 + 유저 양쪽 알림톡 발송
 *   - reminder_sent_at 기록 (중복 발송 방지)
 *
 * 영구성:
 *   - reminder_sent_at IS NULL 조건 — 중복 0
 *   - sendSystemAlimtalk dedup (phone + template + 1시간) 이중 방어
 *   - env 미설정 시 silent skip
 *   - batch 50 단위 처리 (cron 30초 wallclock 안 초과)
 */
import type { Env } from '../types/env'
import { logInfo, logError } from '../utils/logger'

interface PendingReminder {
  id: number
  product_id: number
  product_name: string | null
  seller_id: number
  seller_phone: string | null
  user_id: string
  user_phone: string | null
  user_name: string | null
  booking_date: string
  start_time: string
  end_time: string
  restaurant_name: string | null
  restaurant_address: string | null
}

export async function handleAppointmentReminder(env: Env): Promise<void> {
  const DB = env.DB
  if (!DB) return

  try {
    // KST 내일 날짜 (UTC + 9h)
    const tomorrow = new Date(Date.now() + (24 + 9) * 3600 * 1000).toISOString().slice(0, 10)

    // 내일 예약 + reminder 미발송
    const rows = await DB.prepare(
      `SELECT a.id, a.product_id, a.seller_id, a.user_id, a.user_phone, a.user_name,
              a.booking_date, a.start_time, a.end_time,
              p.name as product_name, p.restaurant_name, p.restaurant_address,
              s.phone as seller_phone
         FROM appointment_bookings a
         LEFT JOIN products p ON p.id = a.product_id
         LEFT JOIN sellers s ON s.id = a.seller_id
        WHERE a.booking_date = ?
          AND a.status = 'confirmed'
          AND a.reminder_sent_at IS NULL
        LIMIT 100`,
    ).bind(tomorrow).all<PendingReminder>().catch(() => ({ results: [] as PendingReminder[] }))

    const list = rows.results || []
    if (list.length === 0) return

    const { sendSystemAlimtalk } = await import('../../lib/system-alimtalk')
    const envRecord = env as unknown as Record<string, unknown>
    let sent = 0

    for (const apt of list) {
      try {
        // 유저 phone 조회 (apt.user_phone 우선, fallback to users.phone)
        let userPhone = apt.user_phone
        if (!userPhone) {
          const userRow = await DB.prepare('SELECT phone FROM users WHERE id = ?').bind(apt.user_id).first<{ phone: string }>().catch(() => null)
          userPhone = userRow?.phone || null
        }
        // 유저 알림
        if (userPhone) {
          const loc = apt.restaurant_address ? `\n📍 ${apt.restaurant_address}` : ''
          const msg = `[유어딜] 내일 예약 알림 — ${apt.product_name}\n📅 ${apt.booking_date} ${apt.start_time}~${apt.end_time}${loc}\n예약 확인 / 변경: live.ur-team.com/my-appointments`
          await sendSystemAlimtalk(envRecord, userPhone, 'appointment_reminder_user', msg)
        }
        // 매장 알림 (예약 1건이라도 있으면)
        if (apt.seller_phone) {
          const msg = `[유어딜] 내일 예약 — ${apt.product_name}\n📅 ${apt.booking_date} ${apt.start_time}~${apt.end_time}\n고객: ${apt.user_name || ''} ${userPhone || ''}`
          await sendSystemAlimtalk(envRecord, apt.seller_phone, 'appointment_reminder_seller', msg)
        }
        // reminder_sent_at 기록 (중복 발송 영구 차단)
        await DB.prepare('UPDATE appointment_bookings SET reminder_sent_at = datetime(\'now\') WHERE id = ?').bind(apt.id).run()
        sent++
      } catch (e) {
        logError('[appointment-reminder] one failed', { id: apt.id, error: (e as Error).message })
      }
    }

    if (sent > 0) logInfo(`[appointment-reminder] sent ${sent}/${list.length} for ${tomorrow}`)
  } catch (e) {
    logError('[appointment-reminder] failed', { error: (e as Error).message })
  }
}
