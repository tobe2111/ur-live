/**
 * 🛡️ 2026-05-18: 숙소 voucher 만료 임박 알림 cron.
 *
 * 매일 09:00 UTC 실행 (stay-reminder 와 동시):
 *   - voucher_expires_at 이 D-30 / D-7 / D-1 인 미사용 voucher
 *   - 사용자에게 카카오 알림톡 (또는 notifications INSERT) 발송
 *
 * 중복 발송 방지: notifications.type + booking_id UNIQUE 체크.
 */
import { sendTextNotice } from '../../lib/text-notice'
import { sensConfigured } from '../../lib/ncp-sens'
type Env = {
  DB: D1Database;
}

type Row = {
  id: number;
  user_id: number;
  user_phone: string | null;
  product_name: string | null;
  check_in_code: string | null;
  voucher_type: string | null;
  voucher_expires_at: string;
  days_left: number;
}

export async function runVoucherExpireCron(env: Env): Promise<{ d30: number; d7: number; d1: number; alimtalk_sent: number; alimtalk_failed: number }> {
  let d30 = 0, d7 = 0, d1 = 0
  let alimtalkSent = 0, alimtalkFailed = 0

  // D-30 / D-7 / D-1 임계 SQL — 단일 쿼리.
  const sql = `
    SELECT b.id, b.user_id, u.phone as user_phone,
           p.name as product_name, b.check_in_code, b.voucher_type,
           b.voucher_expires_at,
           CAST(julianday(b.voucher_expires_at) - julianday('now') AS INTEGER) as days_left
      FROM stay_bookings b
      LEFT JOIN products p ON p.id = b.product_id
      LEFT JOIN users u ON u.id = b.user_id
     WHERE b.sale_mode = 'voucher'
       AND b.status = 'confirmed'
       AND b.voucher_used_at IS NULL
       AND b.voucher_expires_at IS NOT NULL
       AND CAST(julianday(b.voucher_expires_at) - julianday('now') AS INTEGER) IN (30, 7, 1)
     ORDER BY b.voucher_expires_at ASC
     LIMIT 500
  `
  const rows = await env.DB.prepare(sql).all<Row>().catch(() => ({ results: [] as Row[] }))

  // 📨 2026-10-12 알림톡 = 네이버 클라우드 SENS(키 넷이 없으면 앱 알림만). 실패 기록은 sendTextNotice 가 남긴다.
  const alimtalkConfigured = sensConfigured(env as unknown as Record<string, unknown>)

  for (const r of (rows.results || [])) {
    const daysLeft = Number(r.days_left)
    const notifType = `stay_voucher_expire_${daysLeft}d`

    // 중복 발송 방지 — 이미 알림 INSERT 됐는지 확인.
    const dup = await env.DB.prepare(
      `SELECT id FROM notifications WHERE user_id = ? AND type = ? AND created_at > datetime('now', '-2 days') LIMIT 1`
    ).bind(r.user_id, notifType).first().catch(() => null)
    if (dup) continue

    try {
      // 1. notifications INSERT (앱 내 알림).
      const voucherTypeKr = r.voucher_type === 'weekend' ? '주말권' : '평일권'
      await env.DB.prepare(
        `INSERT INTO notifications (user_id, user_type, type, title, message, created_at)
         VALUES (?, 'user', ?, ?, ?, datetime('now'))`
      ).bind(
        r.user_id, notifType,
        `🎫 voucher 만료 ${daysLeft}일 남음 — ${r.product_name}`,
        `${voucherTypeKr} · 코드 ${r.check_in_code || '-'} · 매장 연락 권장`,
      ).run().catch(() => { /* table 없으면 silent */ })

      // 2. 카카오 알림톡 발송 (인프라 설정된 경우만).
      if (alimtalkConfigured && r.user_phone) {
        const phone = r.user_phone.replace(/\D/g, '')
        if (/^01\d{8,9}$/.test(phone)) {
          const templateCode = 'stay_voucher_expire_soon'
          const message =
            `[유어딜] 숙소 이용권 유효기간 안내\n\n` +
            `${r.product_name} ${voucherTypeKr}이 ${daysLeft}일 후 만료됩니다.\n\n` +
            `· voucher 코드: ${r.check_in_code || '-'}\n` +
            `· 만료일: ${r.voucher_expires_at.slice(0, 10)}\n\n` +
            `매장에 연락하여 사용 일정을 잡아주세요.`

          const sent = await sendTextNotice(env, phone, { tpl: templateCode, title: '유어딜 알림', text: message })

          if (sent.ok) alimtalkSent++
          else if ('error' in sent) alimtalkFailed++
        }
      }

      if (daysLeft === 30) d30++
      else if (daysLeft === 7) d7++
      else if (daysLeft === 1) d1++
    } catch { /* per-row fail-soft */ }
  }

  return { d30, d7, d1, alimtalk_sent: alimtalkSent, alimtalk_failed: alimtalkFailed }
}
