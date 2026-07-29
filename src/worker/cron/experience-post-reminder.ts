/**
 * 📣 2026-07-19 체험단 게시 리마인드 (운영 자동화 백로그 ② 시퀀스 2 — 당첨자/인플루언서).
 *
 * 매일 KST 18:00 ('0 9 * * *' 슬롯) 실행:
 *   체험 캠페인 당첨(`experience_campaign_entries.status='selected'`) 후 **48시간 경과**했는데
 *   콘텐츠 게시 인증이 없는 당첨자에게 미션(방문·콘텐츠 게시) 리마인드 1회 발송.
 *
 * 🔒 게이트: env `OPS_SEQUENCES_ENABLED === 'true'` 일 때만 동작 — 기본 OFF(머지 = 라이브 무접촉).
 *
 * 게시 여부: 콘텐츠 인증 테이블(`experience_content_proofs`, WP-B 예정)이 존재하면 entry_id 매칭
 *   행 존재 시 skip — 테이블 미존재 환경은 fail-soft(인증 미구현 = 전원 리마인드 대상).
 * 멱등: notifications type `exp_post_reminder_{entryId}` 존재 시 skip → **평생 1회**.
 * 윈도우: selected_at 48시간~14일 — 오래된 과거 당첨자에게 소급 발송 방지.
 * 머니/정산/추첨 경로 무접촉 — notifications INSERT + 알림톡 발송만.
 */
type Env = {
  DB: D1Database
  OPS_SEQUENCES_ENABLED?: string
  ALIGO_API_KEY?: string
  ALIGO_USER_ID?: string
  ALIGO_SENDER_KEY?: string
  ALIGO_EXPERIENCE_POST_REMINDER?: string
}

// 콘텐츠 게시 인증 테이블 — WP-B(콘텐츠 인증) 선행 스캐폴드. 이 cron 은 read 만 하지만
// 테이블을 lazy-create 해 두면 인증 기능이 붙는 즉시 리마인드가 자동으로 인증자 skip.
const _ensuredProofs = new WeakSet<object>()
async function ensureProofTable(DB: D1Database) {
  if (_ensuredProofs.has(DB)) return
  _ensuredProofs.add(DB)
  try {
    await DB.prepare(`CREATE TABLE IF NOT EXISTS experience_content_proofs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entry_id INTEGER NOT NULL UNIQUE,
      url TEXT,
      status TEXT NOT NULL DEFAULT 'submitted',
      created_at DATETIME DEFAULT (datetime('now'))
    )`).run()
  } catch { /* exists */ }
}

type Row = {
  entry_id: number
  campaign_id: number
  user_id: string
  user_phone: string | null
  selected_at: string
  title: string | null
  mission: string | null
  product_name: string | null
  restaurant_name: string | null
}

export async function runExperiencePostReminder(env: Env): Promise<{ notified: number; alimtalk_sent: number; alimtalk_failed: number }> {
  const out = { notified: 0, alimtalk_sent: 0, alimtalk_failed: 0 }
  if (env.OPS_SEQUENCES_ENABLED !== 'true') return out
  const DB = env.DB
  await ensureProofTable(DB)

  const sql = `
    SELECT e.id AS entry_id, e.campaign_id, e.user_id, e.selected_at,
           u.phone AS user_phone,
           c.title, c.mission, p.name AS product_name, p.restaurant_name
      FROM experience_campaign_entries e
      JOIN experience_campaigns c ON c.id = e.campaign_id
      LEFT JOIN products p ON p.id = c.product_id
      LEFT JOIN users u ON CAST(u.id AS TEXT) = e.user_id
     WHERE e.status = 'selected'
       AND e.selected_at IS NOT NULL
       AND e.selected_at <= datetime('now', '-48 hours')
       AND e.selected_at > datetime('now', '-14 days')
     ORDER BY e.selected_at ASC
     LIMIT 300
  `
  const rows = await DB.prepare(sql).all<Row>().catch(() => ({ results: [] as Row[] }))
  if (!(rows.results || []).length) return out

  const alimtalkConfigured = !!(env.ALIGO_API_KEY && env.ALIGO_USER_ID && env.ALIGO_SENDER_KEY)
  let sendAlimtalk: ((api: { ALIGO_API_KEY: string; ALIGO_USER_ID: string }, params: { senderKey: string; templateCode: string; to: string; message: string }) => Promise<{ success: boolean; error?: string }>) | null = null
  if (alimtalkConfigured) {
    const mod = await import('../../lib/aligo').catch(() => null)
    sendAlimtalk = mod?.sendAlimtalk || null
  }

  for (const r of (rows.results || [])) {
    const notifType = `exp_post_reminder_${r.entry_id}`
    // 멱등 — 평생 1회 (윈도우 dedup 아님: 리마인드는 스팸 방지 위해 단발).
    const dup = await DB.prepare(
      `SELECT id FROM notifications WHERE user_id = ? AND type = ? LIMIT 1`
    ).bind(r.user_id, notifType).first().catch(() => null)
    if (dup) continue

    // 콘텐츠 인증 존재 시 skip — 테이블 미존재/오류는 fail-soft(리마인드 진행).
    const proved = await DB.prepare(
      `SELECT id FROM experience_content_proofs WHERE entry_id = ? LIMIT 1`
    ).bind(r.entry_id).first().catch(() => null)
    if (proved) continue

    try {
      const campaignName = r.title || r.product_name || '체험 캠페인'
      const where = r.restaurant_name ? ` · ${r.restaurant_name}` : ''
      const missionLine = (r.mission || '').trim().slice(0, 120)

      await DB.prepare(
        `INSERT INTO notifications (user_id, user_type, type, title, message, link, created_at)
         VALUES (?, 'user', ?, ?, ?, ?, datetime('now'))`
      ).bind(
        r.user_id, notifType,
        `📣 체험 미션 리마인드 — ${campaignName}`,
        `당첨 후 48시간이 지났어요${where}. ${missionLine ? `미션: ${missionLine}` : '방문 후 콘텐츠 게시를 잊지 마세요!'}`,
        '/my-vouchers',
      ).run().catch(() => { /* table/컬럼 없으면 silent */ })
      out.notified++

      if (alimtalkConfigured && sendAlimtalk && r.user_phone) {
        const phone = r.user_phone.replace(/\D/g, '')
        if (/^01\d{8,9}$/.test(phone)) {
          const templateCode = env.ALIGO_EXPERIENCE_POST_REMINDER || 'experience_post_reminder'
          const message =
            `[유어딜] 체험단 미션 안내\n\n` +
            `${campaignName}${where} 체험단에 당첨되신 지 48시간이 지났습니다.\n\n` +
            (missionLine ? `· 미션: ${missionLine}\n\n` : '') +
            `방문·이용 후 콘텐츠 게시를 부탁드려요. 이용권은 앱 '내 지갑'에서 확인하실 수 있습니다.`
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
