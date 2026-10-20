/**
 * 🛡️ 2026-05-21 Phase E-4: 분쟁 자동 escalation cron.
 *
 * 룰:
 *   - 분쟁 action='pending' + 24시간 경과 → 어드민 알림 (Discord + 알림톡)
 *   - 한 매장 분쟁 30일 5건+ → 어드민 경고 (재발 매장)
 *   - 한 사용자 분쟁 30일 3건+ → 어뷰징 의심 플래그
 *
 * 매일 18 UTC 실행 (auto-settlement 와 같은 슬롯).
 * 멱등: escalation_alerted_at 컬럼으로 중복 알림 차단.
 */
import type { Env } from '../types/env'
import { logInfo, logError } from '../utils/logger'

export async function handleDisputesEscalation(env: Env): Promise<void> {
  const DB = env.DB
  if (!DB) return
  try {
    // escalation_alerted_at 컬럼 없으면 ALTER
    await DB.prepare(`ALTER TABLE disputes ADD COLUMN escalation_alerted_at TEXT`).run().catch(() => null)

    // 1) 24시간 경과 + pending + 미알림 = 어드민 escalation
    const stale = await DB.prepare(
      `SELECT id, voucher_code, user_id, reason_text, created_at
         FROM disputes
        WHERE action = 'pending'
          AND created_at < datetime('now', '-24 hours')
          AND escalation_alerted_at IS NULL
        LIMIT 50`,
    ).all<{ id: number; voucher_code: string; user_id: string; reason_text: string; created_at: string }>().catch(() => ({ results: [] as Array<{ id: number; voucher_code: string; user_id: string; reason_text: string; created_at: string }> }))

    const staleList = stale.results || []
    if (staleList.length > 0) {
      const webhook = (env as Env & { DISCORD_WEBHOOK_URL?: string }).DISCORD_WEBHOOK_URL
      if (webhook) {
        try {
          const { sendDiscordAlert } = await import('../utils/discord-alert')
          const summary = staleList.slice(0, 10).map(d => `#${d.id} [${d.voucher_code}] ${d.reason_text.slice(0, 60)}`).join('\n')
          await sendDiscordAlert(
            webhook,
            `🚨 분쟁 ${staleList.length}건 24시간 미처리`,
            summary + (staleList.length > 10 ? `\n... 외 ${staleList.length - 10}건` : '') + '\n\n/admin/disputes',
            'warn',
          )
        } catch { /* discord 실패 무시 */ }
      }
      for (const d of staleList) {
        await DB.prepare("UPDATE disputes SET escalation_alerted_at = datetime('now') WHERE id = ?").bind(d.id).run().catch(() => null)
      }
      logInfo(`[disputes-escalation] alerted ${staleList.length} stale disputes`)
    }

    // 2) 재발 매장 — 한 매장 30일 5건+
    const repeatStores = await DB.prepare(
      `SELECT p.seller_id, COUNT(*) as cnt
         FROM disputes d
         INNER JOIN vouchers v ON v.code = d.voucher_code
         INNER JOIN products p ON p.id = v.product_id
        WHERE d.created_at > datetime('now', '-30 days')
        GROUP BY p.seller_id
       HAVING cnt >= 5
        ORDER BY cnt DESC LIMIT 20`,
    ).all<{ seller_id: number; cnt: number }>().catch(() => ({ results: [] as Array<{ seller_id: number; cnt: number }> }))

    if ((repeatStores.results?.length ?? 0) > 0) {
      const webhook = (env as Env & { DISCORD_WEBHOOK_URL?: string }).DISCORD_WEBHOOK_URL
      if (webhook) {
        try {
          const { sendDiscordAlert } = await import('../utils/discord-alert')
          const summary = (repeatStores.results || []).map(r => `seller:${r.seller_id} → ${r.cnt}건`).join('\n')
          await sendDiscordAlert(
            webhook,
            `⚠️ 재발 매장 (30일 5건+)`,
            summary + '\n\n/admin/disputes?seller_id=...',
            'warn',
          )
        } catch { /* graceful */ }
      }
    }

    // 3) 어뷰징 의심 사용자 — 30일 3건+
    const repeatUsers = await DB.prepare(
      `SELECT user_id, COUNT(*) as cnt
         FROM disputes
        WHERE created_at > datetime('now', '-30 days')
        GROUP BY user_id
       HAVING cnt >= 3
        ORDER BY cnt DESC LIMIT 20`,
    ).all<{ user_id: string; cnt: number }>().catch(() => ({ results: [] as Array<{ user_id: string; cnt: number }> }))

    if ((repeatUsers.results?.length ?? 0) > 0) {
      const webhook = (env as Env & { DISCORD_WEBHOOK_URL?: string }).DISCORD_WEBHOOK_URL
      if (webhook) {
        try {
          const { sendDiscordAlert } = await import('../utils/discord-alert')
          const summary = (repeatUsers.results || []).map(r => `user:${r.user_id} → ${r.cnt}건`).join('\n')
          await sendDiscordAlert(
            webhook,
            `🚨 어뷰징 의심 사용자 (30일 3건+)`,
            summary + '\n\n/admin/abuse?user_id=...',
            'error',
          )
        } catch { /* graceful */ }
      }
    }
  } catch (e) {
    logError('[disputes-escalation] failed', { error: (e as Error).message })
  }
}
