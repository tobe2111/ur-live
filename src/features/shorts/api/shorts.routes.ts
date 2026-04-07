/**
 * 쇼츠 API
 *
 * GET  /api/shorts/feed          - 랜덤 쇼츠 피드 (무한 스크롤)
 * GET  /api/shorts/:id           - 단일 쇼츠 상세
 * POST /api/shorts/:id/view      - 조회수 증가
 * POST /api/shorts/:id/like      - 좋아요 토글
 * POST /api/shorts               - 셀러: 쇼츠 등록
 * GET  /api/shorts/seller/list   - 셀러: 내 쇼츠 목록
 * DELETE /api/shorts/:id         - 셀러: 쇼츠 삭제
 */

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { requireAuth, getCurrentUser } from '@/worker/middleware/auth'
import type { Env } from '@/worker/types/env'
import { ALLOWED_ORIGINS } from '@/shared/constants'

const shortsRoutes = new Hono<{ Bindings: Env }>()

shortsRoutes.use('*', cors({
  origin: [...ALLOWED_ORIGINS],
  credentials: true,
}))

// 테이블 자동 생성
async function ensureTables(DB: D1Database) {
  try {
    await DB.prepare(`
      CREATE TABLE IF NOT EXISTS shorts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        seller_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        video_url TEXT NOT NULL,
        youtube_video_id TEXT,
        thumbnail_url TEXT,
        duration INTEGER DEFAULT 0,
        view_count INTEGER DEFAULT 0,
        like_count INTEGER DEFAULT 0,
        status TEXT DEFAULT 'active',
        product_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run()
  } catch { /* exists */ }
  try {
    await DB.prepare(`
      CREATE TABLE IF NOT EXISTS shorts_likes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        shorts_id INTEGER NOT NULL,
        user_id TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(shorts_id, user_id)
      )
    `).run()
  } catch { /* exists */ }
}

// ── GET /api/shorts/feed — 랜덤 피드 ──────────────────────────────
shortsRoutes.get('/feed', async (c) => {
  const { DB } = c.env
  await ensureTables(DB)

  const limit = Number(c.req.query('limit')) || 10
  const exclude = c.req.query('exclude') || '' // 이미 본 ID들 (콤마 구분)

  let query = `
    SELECT s.*, sel.name as seller_name, sel.profile_image as seller_avatar,
           p.name as product_name, p.price as product_price, p.image_url as product_image
    FROM shorts s
    LEFT JOIN sellers sel ON s.seller_id = sel.id
    LEFT JOIN products p ON s.product_id = p.id
    WHERE s.status = 'active'
  `

  const binds: unknown[] = []
  if (exclude) {
    const excludeIds = exclude.split(',').filter(Boolean).map(Number)
    if (excludeIds.length > 0) {
      query += ` AND s.id NOT IN (${excludeIds.map(() => '?').join(',')})`
      binds.push(...excludeIds)
    }
  }

  // 랜덤 + 최신 가중치: 최근 것이 더 자주 나오도록
  query += ` ORDER BY RANDOM() LIMIT ?`
  binds.push(limit)

  const { results } = await DB.prepare(query).bind(...binds).all()

  // 쇼츠가 부족하면 라이브 다시보기도 포함
  let feed = results ?? []
  if (feed.length < limit) {
    const remaining = limit - feed.length
    const liveShorts = await DB.prepare(`
      SELECT ls.id, ls.title, ls.youtube_video_id, ls.seller_id,
             s.name as seller_name, s.profile_image as seller_avatar,
             'live_replay' as source_type
      FROM live_streams ls
      LEFT JOIN sellers s ON ls.seller_id = s.id
      WHERE ls.status = 'ended' AND ls.youtube_video_id IS NOT NULL
      ORDER BY RANDOM() LIMIT ?
    `).bind(remaining).all()

    if (liveShorts.results) {
      feed = [...feed, ...liveShorts.results.map(ls => ({
        id: `live_${ls.id}`,
        title: ls.title,
        youtube_video_id: ls.youtube_video_id,
        seller_name: ls.seller_name,
        seller_avatar: ls.seller_avatar,
        seller_id: ls.seller_id,
        view_count: 0,
        like_count: 0,
        source_type: 'live_replay',
        live_stream_id: ls.id,
      }))]
    }
  }

  return c.json({ success: true, data: feed })
})

// ── GET /api/shorts/:id ────────────────────────────────────────────
shortsRoutes.get('/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')

  const row = await DB.prepare(`
    SELECT s.*, sel.name as seller_name, sel.profile_image as seller_avatar,
           p.name as product_name, p.price as product_price, p.image_url as product_image
    FROM shorts s
    LEFT JOIN sellers sel ON s.seller_id = sel.id
    LEFT JOIN products p ON s.product_id = p.id
    WHERE s.id = ?
  `).bind(id).first()

  if (!row) return c.json({ success: false, error: '쇼츠를 찾을 수 없습니다' }, 404)

  return c.json({ success: true, data: row })
})

// ── POST /api/shorts/:id/view — 조회수 증가 ────────────────────────
shortsRoutes.post('/:id/view', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')
  await DB.prepare('UPDATE shorts SET view_count = view_count + 1 WHERE id = ?').bind(id).run()
  return c.json({ success: true })
})

// ── POST /api/shorts/:id/like — 좋아요 토글 ────────────────────────
shortsRoutes.post('/:id/like', requireAuth(), async (c) => {
  const user = getCurrentUser(c)
  if (!user) return c.json({ success: false, error: '로그인 필요' }, 401)

  const { DB } = c.env
  const shortsId = c.req.param('id')
  const userId = String(user.id)

  await ensureTables(DB)

  const existing = await DB.prepare(
    'SELECT id FROM shorts_likes WHERE shorts_id = ? AND user_id = ?'
  ).bind(shortsId, userId).first()

  if (existing) {
    await DB.prepare('DELETE FROM shorts_likes WHERE shorts_id = ? AND user_id = ?').bind(shortsId, userId).run()
    await DB.prepare('UPDATE shorts SET like_count = MAX(0, like_count - 1) WHERE id = ?').bind(shortsId).run()
    return c.json({ success: true, data: { liked: false } })
  } else {
    await DB.prepare('INSERT INTO shorts_likes (shorts_id, user_id) VALUES (?, ?)').bind(shortsId, userId).run()
    await DB.prepare('UPDATE shorts SET like_count = like_count + 1 WHERE id = ?').bind(shortsId).run()
    return c.json({ success: true, data: { liked: true } })
  }
})

// ── POST /api/shorts — 셀러: 쇼츠 등록 ─────────────────────────────
shortsRoutes.post('/', requireAuth(), async (c) => {
  const user = getCurrentUser(c)
  if (!user || user.type !== 'seller') return c.json({ success: false, error: '셀러만 등록 가능' }, 403)

  const { DB } = c.env
  await ensureTables(DB)

  const { title, description, video_url, youtube_video_id, thumbnail_url, duration, product_id } = await c.req.json()

  if (!title || !video_url) {
    return c.json({ success: false, error: '제목과 영상 URL은 필수입니다' }, 400)
  }

  // seller_id 조회
  const seller = await DB.prepare('SELECT id FROM sellers WHERE user_id = ?').bind(String(user.id)).first<{ id: number }>()
  if (!seller) return c.json({ success: false, error: '셀러 정보를 찾을 수 없습니다' }, 404)

  const result = await DB.prepare(`
    INSERT INTO shorts (seller_id, title, description, video_url, youtube_video_id, thumbnail_url, duration, product_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(seller.id, title, description || null, video_url, youtube_video_id || null, thumbnail_url || null, duration || 0, product_id || null).run()

  return c.json({ success: true, data: { id: result.meta.last_row_id }, message: '쇼츠가 등록되었습니다' })
})

// ── GET /api/shorts/seller/list — 셀러: 내 쇼츠 ────────────────────
shortsRoutes.get('/seller/list', requireAuth(), async (c) => {
  const user = getCurrentUser(c)
  if (!user || user.type !== 'seller') return c.json({ success: false, error: '셀러만 조회 가능' }, 403)

  const { DB } = c.env
  await ensureTables(DB)

  const seller = await DB.prepare('SELECT id FROM sellers WHERE user_id = ?').bind(String(user.id)).first<{ id: number }>()
  if (!seller) return c.json({ success: true, data: [] })

  const { results } = await DB.prepare(
    'SELECT * FROM shorts WHERE seller_id = ? AND status != ? ORDER BY created_at DESC'
  ).bind(seller.id, 'deleted').all()

  return c.json({ success: true, data: results ?? [] })
})

// ── DELETE /api/shorts/:id — 셀러: 쇼츠 삭제 ───────────────────────
shortsRoutes.delete('/:id', requireAuth(), async (c) => {
  const user = getCurrentUser(c)
  if (!user || user.type !== 'seller') return c.json({ success: false, error: '셀러만 삭제 가능' }, 403)

  const { DB } = c.env
  const id = c.req.param('id')

  await DB.prepare("UPDATE shorts SET status = 'deleted', updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(id).run()

  return c.json({ success: true, message: '삭제되었습니다' })
})

export { shortsRoutes }
