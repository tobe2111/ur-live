/**
 * 🛡️ 2026-05-15 (PRISM 따라잡기): 라이브 예고 + 단골 알림 endpoints.
 *
 * - GET  /api/seller-public/:sellerId/upcoming     예정된 라이브 (scheduled_at 미래)
 * - POST /api/seller-public/:sellerId/follow      단골 등록 (interest_list + notification opt-in)
 * - DELETE /api/seller-public/:sellerId/follow    단골 해제
 * - GET  /api/seller-public/:sellerId/is-following 본인이 단골 인지
 * - POST /api/seller-public/notify-followers      셀러 본인 → 단골에게 push (신상품/라이브 시작)
 *
 * 의도: mallpro 의 "단골맺기 / 라이브예고" 기능 따라잡기.
 */

import { Hono } from 'hono'
import { requireAuth, getCurrentUser } from '@/worker/middleware/auth'
import { rateLimit } from '@/worker/middleware/rate-limit'
import type { Env } from '@/worker/types/env'

const sellerPublicRoutes = new Hono<{ Bindings: Env }>()

// ── GET /:sellerId/upcoming — 예정된 라이브 ──
sellerPublicRoutes.get('/:sellerId/upcoming', async (c) => {
  const sellerIdRaw = c.req.param('sellerId')
  const sellerId = Number(sellerIdRaw)
  if (!Number.isFinite(sellerId) || sellerId <= 0) {
    return c.json({ success: false, error: '잘못된 sellerId' }, 400)
  }

  const { DB } = c.env
  try {
    const { results } = await DB.prepare(`
      SELECT id, title, thumbnail_url, scheduled_at, status,
             youtube_video_id, description
      FROM live_streams
      WHERE seller_id = ?
        AND status IN ('scheduled', 'live')
        AND (scheduled_at IS NULL OR scheduled_at > datetime('now', '-1 hour'))
      ORDER BY
        CASE status WHEN 'live' THEN 0 ELSE 1 END,
        scheduled_at ASC
      LIMIT 10
    `).bind(sellerId).all().catch(() => ({ results: [] }))
    return c.json({ success: true, data: results ?? [] })
  } catch (err) {
    console.error('[seller-public upcoming]', err)
    return c.json({ success: true, data: [] })
  }
})

async function ensureFollowsTable(DB: D1Database): Promise<void> {
  try {
    await DB.prepare(`
      CREATE TABLE IF NOT EXISTS seller_follows (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        seller_id INTEGER NOT NULL,
        user_id TEXT NOT NULL,
        notify_new_product INTEGER DEFAULT 1,
        notify_live_start INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(seller_id, user_id)
      )
    `).run()
    await DB.prepare(`CREATE INDEX IF NOT EXISTS idx_seller_follows_seller ON seller_follows(seller_id, created_at DESC)`).run()
    await DB.prepare(`CREATE INDEX IF NOT EXISTS idx_seller_follows_user ON seller_follows(user_id)`).run()
  } catch { /* exists */ }
}

// ── POST /:sellerId/follow — 단골 등록 ──
sellerPublicRoutes.post('/:sellerId/follow', rateLimit({ action: 'seller_follow', max: 30, windowSec: 60 }), requireAuth(), async (c) => {
  const user = getCurrentUser(c)
  if (!user) return c.json({ success: false, error: 'Unauthorized' }, 401)
  const sellerId = Number(c.req.param('sellerId'))
  if (!Number.isFinite(sellerId) || sellerId <= 0) {
    return c.json({ success: false, error: '잘못된 sellerId' }, 400)
  }

  const { DB } = c.env
  await ensureFollowsTable(DB)

  try {
    await DB.prepare(`
      INSERT INTO seller_follows (seller_id, user_id)
      VALUES (?, ?)
      ON CONFLICT(seller_id, user_id) DO NOTHING
    `).bind(sellerId, String(user.id)).run()
    return c.json({ success: true, message: '단골 등록 완료! 신상품/라이브 시작 시 알림드릴게요.' })
  } catch (err) {
    console.error('[seller-public follow]', err)
    return c.json({ success: false, error: '등록 실패' }, 500)
  }
})

// ── DELETE /:sellerId/follow — 단골 해제 ──
sellerPublicRoutes.delete('/:sellerId/follow', requireAuth(), async (c) => {
  const user = getCurrentUser(c)
  if (!user) return c.json({ success: false, error: 'Unauthorized' }, 401)
  const sellerId = Number(c.req.param('sellerId'))

  const { DB } = c.env
  await ensureFollowsTable(DB)
  try {
    await DB.prepare(`DELETE FROM seller_follows WHERE seller_id = ? AND user_id = ?`)
      .bind(sellerId, String(user.id)).run()
    return c.json({ success: true })
  } catch (err) {
    console.error('[seller-public unfollow]', err)
    return c.json({ success: false, error: '해제 실패' }, 500)
  }
})

// ── GET /:sellerId/is-following — 본인 단골 여부 + 단골 수 ──
sellerPublicRoutes.get('/:sellerId/is-following', async (c) => {
  const sellerId = Number(c.req.param('sellerId'))
  const { DB } = c.env
  await ensureFollowsTable(DB)

  const user = getCurrentUser(c)
  let isFollowing = false
  if (user) {
    try {
      const row = await DB.prepare(`SELECT 1 FROM seller_follows WHERE seller_id = ? AND user_id = ?`)
        .bind(sellerId, String(user.id)).first()
      isFollowing = !!row
    } catch { /* table may not exist */ }
  }

  let count = 0
  try {
    const row = await DB.prepare(`SELECT COUNT(*) as c FROM seller_follows WHERE seller_id = ?`)
      .bind(sellerId).first<{ c: number }>()
    count = row?.c ?? 0
  } catch { /* ignore */ }

  return c.json({ success: true, data: { isFollowing, count } })
})

// ── POST /notify-followers — 셀러 본인 단골들에게 push ──
// 🛡️ 신상품 / 라이브 시작 / 공구 시작 알림 직접 발송 (mallpro 의 핵심 마케팅 도구)
sellerPublicRoutes.post('/notify-followers',
  rateLimit({ action: 'seller_notify_followers', max: 5, windowSec: 600 }),
  requireAuth(),
  async (c) => {
  const user = getCurrentUser(c)
  const userAsAny = user as unknown as { id?: number | string; type?: string }
  if (!user || userAsAny.type !== 'seller') {
    return c.json({ success: false, error: '셀러만 가능' }, 403)
  }
  const sellerId = Number(userAsAny.id)
  if (!Number.isFinite(sellerId)) {
    return c.json({ success: false, error: '잘못된 seller id' }, 400)
  }

  let body: { title?: string; message?: string; url?: string; reason?: 'new_product' | 'live_start' | 'group_buy' | 'custom' }
  try { body = await c.req.json() } catch { return c.json({ success: false, error: 'JSON 형식 오류' }, 400) }

  const title = (body.title || '').slice(0, 100)
  const message = (body.message || '').slice(0, 500)
  const url = (body.url || '/').slice(0, 200)
  if (!title || !message || title.length < 2 || message.length < 5) {
    return c.json({ success: false, error: 'title (2자+) + message (5자+) 필수' }, 400)
  }

  const { DB } = c.env
  await ensureFollowsTable(DB)

  try {
    const { results: followers } = await DB.prepare(`
      SELECT user_id FROM seller_follows WHERE seller_id = ?
    `).bind(sellerId).all<{ user_id: string }>()

    if (!followers || followers.length === 0) {
      return c.json({ success: true, data: { sent: 0, message: '단골 0명 — 알림 발송 안 함' } })
    }

    const { sendSystemPush } = await import('../../../lib/system-push')
    let sent = 0
    for (const f of followers) {
      try {
        // dashboard notification
        await DB.prepare(
          `INSERT INTO user_notifications (user_id, type, title, message, link)
           VALUES (?, ?, ?, ?, ?)`
        ).bind(f.user_id, `seller_${body.reason || 'custom'}`, title, message, url).run().catch(() => {})

        // web push
        await sendSystemPush(c.env, 'user', f.user_id, {
          title, body: message, url, tag: `seller-${sellerId}-${body.reason || 'custom'}`,
        }).catch(() => {})
        sent++
      } catch { /* skip individual failures */ }
    }

    return c.json({ success: true, data: { sent, total_followers: followers.length } })
  } catch (err) {
    console.error('[seller-public notify-followers]', err)
    return c.json({ success: false, error: '알림 발송 실패' }, 500)
  }
})

export { sellerPublicRoutes }
