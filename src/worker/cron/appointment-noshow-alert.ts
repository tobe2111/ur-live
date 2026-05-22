/**
 * 🛡️ 2026-05-21 Phase E-3: 예약 노쇼 자동 매장 알림 cron.
 *
 * 흐름:
 *   - 5분 cron 으로 실행
 *   - 예약 시작 시간 + 30분 지났는데 status='confirmed' 인 appointment 검색
 *   - 사장님 phone 으로 알림톡 발송 (template: appointment_noshow_alert)
 *   - noshow_alert_sent_at 기록 (중복 발송 영구 차단)
 *
 * 영구성:
 *   - noshow_alert_sent_at IS NULL 조건 — 중복 0
 *   - sendSystemAlimtalk dedup (phone + template + 1시간) 이중 방어
 *   - waitUntil 비동기 — 응답 지연 0
 *
 * 정책 (docs/AGENCY_POLICY.md):
 *   - 사장님이 직접 노쇼 처리하면 환불 X (12시간 정책)
 *   - 알림은 안내일 뿐, 자동 noshow 상태 전환 X (사람이 결정)
 */
import type { Env } from '../types/env'
import { logInfo, logError } from '../utils/logger'

interface PendingAlert {
  id: number
  product_id: number
  product_name: string | null
  seller_id: number
  seller_phone: string | null
  user_id: string
  user_name: string | null
  user_phone: string | null
  booking_date: string
  start_time: string
  end_time: string
}

export async function handleAppointmentNoshowAlert(env: Env): Promise<void> {
  const DB = env.DB
  if (!DB) return
  try {
    // 예약 시작 시간이 30분 이상 지났고 아직 confirmed (사용자 노쇼 의심)
    // KST 기준: booking_date + start_time + 30분 < now (KST)
    // 간단 SQL: datetime('now', '-30 minutes', '+9 hours') 와 booking_date||T||start_time 비교
    const rows = await DB.prepare(
      `SELECT a.id, a.product_id, a.seller_id, a.user_id, a.user_phone, a.user_name,
              a.booking_date, a.start_time, a.end_time,
              p.name as product_name,
              s.phone as seller_phone
         FROM appointment_bookings a
         LEFT JOIN products p ON p.id = a.product_id
         LEFT JOIN sellers s ON s.id = a.seller_id
        WHERE a.status = 'confirmed'
          AND a.noshow_alert_sent_at IS NULL
          AND datetime(a.booking_date || 'T' || a.start_time || ':00') < datetime('now', '+9 hours', '-30 minutes')
          AND datetime(a.booking_date || 'T' || a.start_time || ':00') > datetime('now', '+9 hours', '-1 day')
        LIMIT 50`,
    ).all<PendingAlert>().catch(() => ({ results: [] as PendingAlert[] }))

    const list = rows.results || []
    if (list.length === 0) return

    const { sendSystemAlimtalk } = await import('../../lib/system-alimtalk')
    const envRecord = env as unknown as Record<string, unknown>
    let sent = 0

    for (const apt of list) {
      try {
        if (!apt.seller_phone) {
          // 매장 phone 없으면 sent flag 만 마킹 (재시도 무한 루프 방지)
          await DB.prepare("UPDATE appointment_bookings SET noshow_alert_sent_at = datetime('now') WHERE id = ?").bind(apt.id).run()
          continue
        }
        const msg = `[유어딜] 노쇼 의심 — ${apt.product_name || '예약'}\n📅 ${apt.booking_date} ${apt.start_time}~${apt.end_time}\n👤 ${apt.user_name || apt.user_id} ${apt.user_phone || ''}\n\n실제 방문 안 했으면: live.ur-team.com/seller/appointments → 노쇼 처리\n방문 완료했으면: → 완료 처리`
        await sendSystemAlimtalk(envRecord, apt.seller_phone, 'appointment_noshow_alert', msg)
        await DB.prepare("UPDATE appointment_bookings SET noshow_alert_sent_at = datetime('now') WHERE id = ?").bind(apt.id).run()
        sent++
      } catch (e) {
        logError('[noshow-alert] one failed', { id: apt.id, error: (e as Error).message })
      }
    }
    if (sent > 0) logInfo(`[noshow-alert] sent ${sent}/${list.length} alerts`)
  } catch (e) {
    logError('[noshow-alert] failed', { error: (e as Error).message })
  }
}
