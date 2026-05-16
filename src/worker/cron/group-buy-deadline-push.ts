/**
 * 🛡️ 2026-05-16: 공구 마감 임박 push 알림 cron (5분마다).
 *
 * 마감 3시간 전 / 1시간 전 시점에 doc 단 한 번 dashboard notification
 * + (옵션) web push 발송. dedup: products.deadline_pushed_3h / _1h 컬럼.
 *
 * 대상: group_buy_status='active' + group_buy_deadline 이 윈도우 안.
 */

import type { Env } from '../types/env'
import { logInfo, logError } from '../utils/logger'

export async function handleGroupBuyDeadlinePush(env: Env): Promise<void> {
  const DB = env.DB
  if (!DB) return

  try {
    // dedup 컬럼 ALTER (idempotent)
    try { await DB.prepare("ALTER TABLE products ADD COLUMN deadline_pushed_3h INTEGER DEFAULT 0").run() } catch {}
    try { await DB.prepare("ALTER TABLE products ADD COLUMN deadline_pushed_1h INTEGER DEFAULT 0").run() } catch {}

    let pushCount3h = 0
    let pushCount1h = 0

    for (const window of [
      { hours: 3, flag: 'deadline_pushed_3h', label: '⏰ 공구 마감 3시간 전' },
      { hours: 1, flag: 'deadline_pushed_1h', label: '🔥 공구 마감 1시간 전!' },
    ]) {
      // hours 시간 후 마감 + flag = 0 (아직 push 안 보냄) + 10분 윈도우 (cron 간격 보정)
      const { results: products } = await DB.prepare(
        `SELECT id, name, restaurant_name, group_buy_current, group_buy_target
         FROM products
         WHERE group_buy_status = 'active'
           AND group_buy_deadline IS NOT NULL
           AND ${window.flag} = 0
           AND datetime(group_buy_deadline) BETWEEN datetime('now', '+${window.hours - 0.1} hours') AND datetime('now', '+${window.hours + 0.1} hours')
         LIMIT 50`
      ).all<{ id: number; name: string; restaurant_name: string | null; group_buy_current: number; group_buy_target: number }>()
        .catch(() => ({ results: [] as any[] }))

      for (const p of (products || [])) {
        // 참여자에게 알림 (그들이 다른 사람 초대하도록)
        try {
          const { results: subs } = await DB.prepare(
            `SELECT DISTINCT user_id FROM vouchers WHERE product_id = ? LIMIT 100`
          ).bind(p.id).all<{ user_id: string }>().catch(() => ({ results: [] as any[] }))

          for (const s of (subs || [])) {
            const progress = p.group_buy_target > 0 ? Math.round((p.group_buy_current / p.group_buy_target) * 100) : 0
            const msg = `${p.restaurant_name ? p.restaurant_name + ' · ' : ''}${p.name} (${p.group_buy_current}/${p.group_buy_target}명, ${progress}%)`
            await DB.prepare(
              `INSERT INTO user_notifications (user_id, type, title, message, link)
               VALUES (?, 'group_buy_deadline', ?, ?, ?)`
            ).bind(s.user_id, window.label, msg, `/group-buy/${p.id}`).run().catch(() => {})
          }

          await DB.prepare(`UPDATE products SET ${window.flag} = 1 WHERE id = ?`).bind(p.id).run()
          if (window.hours === 3) pushCount3h++
          else pushCount1h++
        } catch (e) {
          if (env.ENVIRONMENT !== 'production') console.warn('[deadline-push]', e)
        }
      }
    }

    logInfo(`[cron:group-buy-deadline] 3h=${pushCount3h} 1h=${pushCount1h}`)
  } catch (e) {
    logError('[cron:group-buy-deadline] failed', { error: String(e) })
  }
}
