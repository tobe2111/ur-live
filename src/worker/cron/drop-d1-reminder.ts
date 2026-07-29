/**
 * ⏰ 2026-07-19 드랍 전날 예고 알림 (운영 자동화 백로그 ② 시퀀스 1 — 소비자).
 *
 * 매일 KST 18:00 ('0 9 * * *' 슬롯) 실행:
 *   선착순/오픈예정(fcfs) 응모 마감(`product_supply_meta.fcfs_deadline`)이 **내일(KST)** 인 상품의
 *   응모자(`fcfs_applications` status IN ('applied','selected'))에게
 *   앱 내 알림 + 카카오 알림톡(Aligo 설정 시) "내일 마감·추첨" 예고 발송.
 *
 * 🔒 게이트: env `OPS_SEQUENCES_ENABLED === 'true'` 일 때만 동작 — 기본 OFF(머지 = 라이브 무접촉).
 * 데모 상품(slug 'demo-deal-%')·비활성 상품 제외. 멱등: notifications type `drop_d1_{productId}`
 * per-user 2일 dedup. 알림톡 실패는 alimtalk_failures 적재 → retry-alimtalk cron 재시도.
 * 머니/정산 경로 무접촉 — notifications INSERT + 알림톡 발송만.
 */
type Env = {
  DB: D1Database
  OPS_SEQUENCES_ENABLED?: string
  ALIGO_API_KEY?: string
  ALIGO_USER_ID?: string
  ALIGO_SENDER_KEY?: string
  ALIGO_DROP_D1_REMINDER?: string
}

type Row = {
  product_id: number
  product_name: string | null
  restaurant_name: string | null
  deadline: string
  user_id: string
  user_phone: string | null
}

export async function runDropD1Reminder(env: Env): Promise<{ notified: number; alimtalk_sent: number; alimtalk_failed: number }> {
  const out = { notified: 0, alimtalk_sent: 0, alimtalk_failed: 0 }
  if (env.OPS_SEQUENCES_ENABLED !== 'true') return out
  const DB = env.DB

  // 내일(KST) 날짜 문자열 — fcfs_deadline 은 datetime/date 텍스트, KST 날짜 prefix 매칭.
  const kstTomorrow = new Date(Date.now() + 9 * 3600_000 + 86400_000).toISOString().slice(0, 10)

  // fcfs 활성 + 마감이 내일인 상품의 응모자 (활성·비데모 상품 한정).
  const sql = `
    SELECT m.product_id, p.name AS product_name, p.restaurant_name,
           m.value AS deadline, a.user_id, u.phone AS user_phone
      FROM product_supply_meta m
      JOIN products p ON p.id = m.product_id AND p.is_active = 1
           AND COALESCE(p.slug,'') NOT LIKE 'demo-deal-%'
      JOIN fcfs_applications a ON a.product_id = m.product_id
           AND a.status IN ('applied','selected')
      LEFT JOIN users u ON CAST(u.id AS TEXT) = a.user_id
     WHERE m.key = 'fcfs_deadline' AND m.value LIKE ?
       AND EXISTS (SELECT 1 FROM product_supply_meta e
                    WHERE e.product_id = m.product_id AND e.key = 'fcfs_enabled' AND e.value = '1')
     LIMIT 500
  `
  const rows = await DB.prepare(sql).bind(`${kstTomorrow}%`).all<Row>().catch(() => ({ results: [] as Row[] }))

  const alimtalkConfigured = !!(env.ALIGO_API_KEY && env.ALIGO_USER_ID && env.ALIGO_SENDER_KEY)
  let sendAlimtalk: ((api: { ALIGO_API_KEY: string; ALIGO_USER_ID: string }, params: { senderKey: string; templateCode: string; to: string; message: string }) => Promise<{ success: boolean; error?: string }>) | null = null
  if (alimtalkConfigured) {
    const mod = await import('../../lib/aligo').catch(() => null)
    sendAlimtalk = mod?.sendAlimtalk || null
  }

  for (const r of (rows.results || [])) {
    const notifType = `drop_d1_${r.product_id}`
    // 멱등 — 같은 상품 D-1 예고를 최근 2일 내 이미 받았으면 skip.
    const dup = await DB.prepare(
      `SELECT id FROM notifications WHERE user_id = ? AND type = ? AND created_at > datetime('now','-2 days') LIMIT 1`
    ).bind(r.user_id, notifType).first().catch(() => null)
    if (dup) continue

    try {
      const productName = r.product_name || '드랍 상품'
      const where = r.restaurant_name ? ` · ${r.restaurant_name}` : ''
      const deadlineDay = String(r.deadline || '').slice(0, 10)

      await DB.prepare(
        `INSERT INTO notifications (user_id, user_type, type, title, message, link, created_at)
         VALUES (?, 'user', ?, ?, ?, ?, datetime('now'))`
      ).bind(
        r.user_id, notifType,
        `⏰ 내일 마감 — ${productName}`,
        `응모하신 ${productName}${where} 이(가) 내일(${deadlineDay}) 마감·추첨돼요. 놓치지 마세요!`,
        `/group-buy/${r.product_id}`,
      ).run().catch(() => { /* table/컬럼 없으면 silent */ })
      out.notified++

      if (alimtalkConfigured && sendAlimtalk && r.user_phone) {
        const phone = r.user_phone.replace(/\D/g, '')
        if (/^01\d{8,9}$/.test(phone)) {
          const templateCode = env.ALIGO_DROP_D1_REMINDER || 'drop_d1_reminder'
          const message =
            `[유어딜] 드랍 마감 전날 안내\n\n` +
            `응모하신 ${productName}${where} 이(가) 내일 마감됩니다.\n\n` +
            `· 마감일: ${deadlineDay}\n\n` +
            `마감 후 추첨 결과를 알려드릴게요.`
          const result = await sendAlimtalk(
            { ALIGO_API_KEY: env.ALIGO_API_KEY!, ALIGO_USER_ID: env.ALIGO_USER_ID! },
            { senderKey: env.ALIGO_SENDER_KEY!, templateCode, to: phone, message },
          ).catch((e: Error) => ({ success: false, error: e.message }))
          if (result.success) out.alimtalk_sent++
          else {
            out.alimtalk_failed++
            await DB.prepare(
              `INSERT INTO alimtalk_failures (template_code, phone, message, error, retry_count, max_retries, next_retry_at, created_at)
               VALUES (?, ?, ?, ?, 0, 3, datetime('now', '+5 minutes'), datetime('now'))`
            ).bind(templateCode, phone, message.slice(0, 1000), (result.error || 'unknown').slice(0, 500))
              .run().catch(() => { /* noop */ })
          }
        }
      }
    } catch { /* per-row fail-soft */ }
  }

  return out
}
