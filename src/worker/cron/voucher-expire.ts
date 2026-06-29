/**
 * 🎫 2026-06-21: 이용권(교환권) 만료 임박 알림 cron.
 *
 * 매일 09:00 UTC 실행 (stay-voucher-expire 와 동시, KST 18:00):
 *   - vouchers.expires_at 이 D-7 / D-3 / D-1 인 미사용(unused) 이용권
 *   - 사용자에게 앱 내 알림(notifications) + 카카오 알림톡(인프라 설정 시) 발송
 *
 * 배경: 선결제 이용권은 유효기간(기본 90일)이 있어, 잊고 안 쓰면 낸 돈이 소멸.
 *   숙소(stay)는 이미 stay-voucher-expire.ts 로 알림 중이나 이용권은 없었음 → 동일 패턴 복제.
 *
 * 범위: KT 기프티쇼 교환권(p.kt_alpha_gift_code 보유)은 제외 — 쿠폰 유효기간은
 *   기프티쇼가 외부 관리(MMS 발송분)라 내부 expires_at 으로 안내하면 오정보 위험.
 *
 * 중복 발송 방지: notifications.type(`voucher_expire_{n}d`) + 최근 2일 내 존재 체크.
 * 전부 fail-soft (행별 try-catch, 알림톡 실패는 alimtalk_failures 적재 → retry-notifications 재시도).
 */
type Env = {
  DB: D1Database
  ALIGO_API_KEY?: string
  ALIGO_USER_ID?: string
  ALIGO_SENDER_KEY?: string
  ALIGO_VOUCHER_EXPIRE_SOON?: string
}

type Row = {
  id: number
  user_id: string
  user_phone: string | null
  product_name: string | null
  restaurant_name: string | null
  code: string
  expires_at: string
  days_left: number
}

export async function runMealVoucherExpireCron(env: Env): Promise<{ d7: number; d3: number; d1: number; alimtalk_sent: number; alimtalk_failed: number }> {
  let d7 = 0, d3 = 0, d1 = 0
  let alimtalkSent = 0, alimtalkFailed = 0

  // D-7 / D-3 / D-1 임계 — 미사용 이용권(KT 교환권 제외).
  const sql = `
    SELECT v.id, v.user_id, u.phone AS user_phone,
           p.name AS product_name, p.restaurant_name,
           v.code, v.expires_at,
           CAST(julianday(v.expires_at) - julianday('now') AS INTEGER) AS days_left
      FROM vouchers v
      LEFT JOIN products p ON p.id = v.product_id
      LEFT JOIN users u ON CAST(u.id AS TEXT) = v.user_id
     WHERE v.status = 'unused'
       AND v.expires_at IS NOT NULL
       AND (p.kt_alpha_gift_code IS NULL OR p.kt_alpha_gift_code = '')
       AND CAST(julianday(v.expires_at) - julianday('now') AS INTEGER) IN (7, 3, 1)
     ORDER BY v.expires_at ASC
     LIMIT 500
  `
  const rows = await env.DB.prepare(sql).all<Row>().catch(() => ({ results: [] as Row[] }))

  const alimtalkConfigured = !!(env.ALIGO_API_KEY && env.ALIGO_USER_ID && env.ALIGO_SENDER_KEY)
  let sendAlimtalk: ((api: { ALIGO_API_KEY: string; ALIGO_USER_ID: string }, params: { senderKey: string; templateCode: string; to: string; message: string }) => Promise<{ success: boolean; error?: string }>) | null = null
  if (alimtalkConfigured) {
    const mod = await import('../../lib/aligo').catch(() => null)
    sendAlimtalk = mod?.sendAlimtalk || null
  }

  for (const r of (rows.results || [])) {
    const daysLeft = Number(r.days_left)
    if (![7, 3, 1].includes(daysLeft)) continue
    // 멱등 키는 voucher 별(코드 포함) — 한 유저가 같은 날 여러 이용권 만료 시 각각 알림(돈이라 누락 금지).
    //   stay 버전은 (user,임계) 1회라 동일-일자 다건이 누락될 수 있음 → 이용권은 코드 스코프로 강화.
    const notifType = `voucher_expire_${daysLeft}d_${r.code}`

    // 중복 발송 방지 — 같은 voucher·임계로 최근 2일 내 이미 보냈으면 skip.
    const dup = await env.DB.prepare(
      `SELECT id FROM notifications WHERE user_id = ? AND type = ? AND created_at > datetime('now', '-2 days') LIMIT 1`
    ).bind(r.user_id, notifType).first().catch(() => null)
    if (dup) continue

    try {
      const productName = r.product_name || '이용권'
      const where = r.restaurant_name ? ` · ${r.restaurant_name}` : ''

      // 1. 앱 내 알림 INSERT — 탭하면 /my-vouchers 로 (link 컬럼 존재: youtube-broadcast-end-detect 등에서 사용).
      await env.DB.prepare(
        `INSERT INTO notifications (user_id, type, title, message, link, created_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'))`
      ).bind(
        r.user_id, notifType,
        `🎫 이용권 만료 D-${daysLeft} — ${productName}`,
        `${daysLeft}일 후 만료돼요${where}. 코드 ${r.code} · 지금 사용하세요`,
        '/my-vouchers',
      ).run().catch(() => { /* table/컬럼 없으면 silent */ })

      // 2. 카카오 알림톡 (인프라 설정된 경우만).
      if (alimtalkConfigured && sendAlimtalk && r.user_phone) {
        const phone = r.user_phone.replace(/\D/g, '')
        if (/^01\d{8,9}$/.test(phone)) {
          const templateCode = env.ALIGO_VOUCHER_EXPIRE_SOON || 'voucher_expire_soon'
          const message =
            `[유어딜] 이용권 유효기간 안내\n\n` +
            `${productName}${where} 이용권이 ${daysLeft}일 후 만료됩니다.\n\n` +
            `· 코드: ${r.code}\n` +
            `· 만료일: ${r.expires_at.slice(0, 10)}\n\n` +
            `앱 '내 지갑'에서 QR 을 제시하고 사용해 주세요.`

          const result = await sendAlimtalk(
            { ALIGO_API_KEY: env.ALIGO_API_KEY!, ALIGO_USER_ID: env.ALIGO_USER_ID! },
            { senderKey: env.ALIGO_SENDER_KEY!, templateCode, to: phone, message },
          ).catch((e: Error) => ({ success: false, error: e.message }))

          if (result.success) {
            alimtalkSent++
          } else {
            alimtalkFailed++
            await env.DB.prepare(
              `INSERT INTO alimtalk_failures (template_code, phone, message, error, retry_count, max_retries, next_retry_at, created_at)
               VALUES (?, ?, ?, ?, 0, 3, datetime('now', '+5 minutes'), datetime('now'))`
            ).bind(templateCode, phone, message.slice(0, 1000), (result.error || 'unknown').slice(0, 500))
              .run().catch(() => { /* noop */ })
          }
        }
      }

      if (daysLeft === 7) d7++
      else if (daysLeft === 3) d3++
      else if (daysLeft === 1) d1++
    } catch { /* per-row fail-soft */ }
  }

  return { d7, d3, d1, alimtalk_sent: alimtalkSent, alimtalk_failed: alimtalkFailed }
}
