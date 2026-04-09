import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { requireAuth, getCurrentUser } from '@/worker/middleware/auth'
import type { Env } from '@/worker/types/env'
import { ALLOWED_ORIGINS } from '@/shared/constants'

const socialRoutes = new Hono<{ Bindings: Env }>()
socialRoutes.use('*', cors({ origin: [...ALLOWED_ORIGINS], credentials: true }))

async function ensureTables(DB: D1Database) {
  try { await DB.prepare(`CREATE TABLE IF NOT EXISTS seller_follows (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, seller_id INTEGER NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE(user_id, seller_id))`).run() } catch {}
  try { await DB.prepare(`CREATE TABLE IF NOT EXISTS user_notifications (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, type TEXT NOT NULL, title TEXT NOT NULL, message TEXT, link TEXT, is_read INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`).run() } catch {}
}

// 팔로우 토글
socialRoutes.post('/follow/:sellerId', requireAuth(), async (c) => {
  const user = getCurrentUser(c)
  if (!user) return c.json({ success: false, error: '로그인 필요' }, 401)
  const { DB } = c.env
  await ensureTables(DB)
  const sellerId = c.req.param('sellerId')
  const userId = String(user.id)

  const existing = await DB.prepare("SELECT id FROM seller_follows WHERE user_id = ? AND seller_id = ?").bind(userId, sellerId).first()
  if (existing) {
    await DB.prepare("DELETE FROM seller_follows WHERE user_id = ? AND seller_id = ?").bind(userId, sellerId).run()
    return c.json({ success: true, data: { following: false } })
  }
  await DB.prepare("INSERT INTO seller_follows (user_id, seller_id) VALUES (?, ?)").bind(userId, sellerId).run()
  return c.json({ success: true, data: { following: true } })
})

// 팔로우 상태 확인
socialRoutes.get('/follow/:sellerId', requireAuth(), async (c) => {
  const user = getCurrentUser(c)
  if (!user) return c.json({ success: false, error: '로그인 필요' }, 401)
  const { DB } = c.env
  await ensureTables(DB)
  const existing = await DB.prepare("SELECT id FROM seller_follows WHERE user_id = ? AND seller_id = ?").bind(String(user.id), c.req.param('sellerId')).first()
  return c.json({ success: true, data: { following: !!existing } })
})

// 팔로잉 셀러 목록
socialRoutes.get('/following', requireAuth(), async (c) => {
  const user = getCurrentUser(c)
  if (!user) return c.json({ success: false, error: '로그인 필요' }, 401)
  const { DB } = c.env
  await ensureTables(DB)
  const { results } = await DB.prepare(`
    SELECT s.id, s.name, s.profile_image, s.bio FROM seller_follows f
    LEFT JOIN sellers s ON f.seller_id = s.id WHERE f.user_id = ? ORDER BY f.created_at DESC
  `).bind(String(user.id)).all()
  return c.json({ success: true, data: results ?? [] })
})

// 알림 목록
socialRoutes.get('/notifications', requireAuth(), async (c) => {
  const user = getCurrentUser(c)
  if (!user) return c.json({ success: false, error: '로그인 필요' }, 401)
  const { DB } = c.env
  await ensureTables(DB)
  const { results } = await DB.prepare("SELECT * FROM user_notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50").bind(String(user.id)).all()
  return c.json({ success: true, data: results ?? [] })
})

// 알림 읽음 처리
socialRoutes.put('/notifications/:id/read', requireAuth(), async (c) => {
  const { DB } = c.env
  await DB.prepare("UPDATE user_notifications SET is_read = 1 WHERE id = ?").bind(c.req.param('id')).run()
  return c.json({ success: true })
})

// 알림 전체 읽음
socialRoutes.put('/notifications/read-all', requireAuth(), async (c) => {
  const user = getCurrentUser(c)
  if (!user) return c.json({ success: false, error: '로그인 필요' }, 401)
  const { DB } = c.env
  await DB.prepare("UPDATE user_notifications SET is_read = 1 WHERE user_id = ?").bind(String(user.id)).run()
  return c.json({ success: true })
})

export { socialRoutes }
