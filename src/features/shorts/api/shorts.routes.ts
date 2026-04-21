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

// ── GET /api/shorts/feed — 쇼츠 + 실시간 라이브 + 다시보기 혼합 피드 ──
shortsRoutes.get('/feed', async (c) => {
  const { DB } = c.env
  await ensureTables(DB)

  const limit = Number(c.req.query('limit')) || 10
  const exclude = c.req.query('exclude') || ''

  const excludeShorts: number[] = []
  const excludeLive: number[] = []
  if (exclude) {
    exclude.split(',').filter(Boolean).forEach(id => {
      if (id.startsWith('live_')) excludeLive.push(Number(id.replace('live_', '')))
      else excludeShorts.push(Number(id))
    })
  }

  const feed: Record<string, unknown>[] = []

  // 1) 실시간 라이브 스트림 (최우선)
  try {
    let liveQuery = `
      SELECT ls.id, ls.title, ls.youtube_video_id, ls.seller_id,
             s.name as seller_name, s.profile_image as seller_avatar,
             ls.viewer_count, 'live' as source_type
      FROM live_streams ls
      LEFT JOIN sellers s ON ls.seller_id = s.id
      WHERE ls.status = 'live' AND ls.youtube_video_id IS NOT NULL
    `
    const liveBinds: unknown[] = []
    if (excludeLive.length > 0) {
      liveQuery += ` AND ls.id NOT IN (${excludeLive.map(() => '?').join(',')})`
      liveBinds.push(...excludeLive)
    }
    liveQuery += ` ORDER BY ls.viewer_count DESC LIMIT ?`
    liveBinds.push(Math.min(3, limit))

    const liveRes = await DB.prepare(liveQuery).bind(...liveBinds).all()
    if (liveRes.results) {
      feed.push(...liveRes.results.map(ls => ({
        ...ls,
        id: `live_${ls.id}`,
        live_stream_id: ls.id,
      })))
    }
  } catch { /* ignore */ }

  // 2) 쇼츠
  const shortsLimit = Math.max(1, limit - feed.length)
  try {
    let shortsQuery = `
      SELECT s.*, sel.name as seller_name, sel.profile_image as seller_avatar,
             p.name as product_name, p.price as product_price, p.image_url as product_image,
             'shorts' as source_type
      FROM shorts s
      LEFT JOIN sellers sel ON s.seller_id = sel.id
      LEFT JOIN products p ON s.product_id = p.id
      WHERE s.status = 'active'
    `
    const shortsBinds: unknown[] = []
    if (excludeShorts.length > 0) {
      shortsQuery += ` AND s.id NOT IN (${excludeShorts.map(() => '?').join(',')})`
      shortsBinds.push(...excludeShorts)
    }
    shortsQuery += ` ORDER BY RANDOM() LIMIT ?`
    shortsBinds.push(shortsLimit)

    const shortsRes = await DB.prepare(shortsQuery).bind(...shortsBinds).all()
    if (shortsRes.results) feed.push(...shortsRes.results)
  } catch { /* ignore */ }

  // 3) 라이브 다시보기 (나머지 슬롯 채우기)
  if (feed.length < limit) {
    const remaining = limit - feed.length
    try {
      let replayQuery = `
        SELECT ls.id, ls.title, ls.youtube_video_id, ls.seller_id,
               s.name as seller_name, s.profile_image as seller_avatar,
               'live_replay' as source_type
        FROM live_streams ls
        LEFT JOIN sellers s ON ls.seller_id = s.id
        WHERE ls.status = 'ended' AND ls.youtube_video_id IS NOT NULL
      `
      const replayBinds: unknown[] = []
      if (excludeLive.length > 0) {
        replayQuery += ` AND ls.id NOT IN (${excludeLive.map(() => '?').join(',')})`
        replayBinds.push(...excludeLive)
      }
      replayQuery += ` ORDER BY RANDOM() LIMIT ?`
      replayBinds.push(remaining)

      const replayRes = await DB.prepare(replayQuery).bind(...replayBinds).all()
      if (replayRes.results) {
        feed.push(...replayRes.results.map(ls => ({
          ...ls,
          id: `live_${ls.id}`,
          live_stream_id: ls.id,
        })))
      }
    } catch { /* ignore */ }
  }

  // 4) 실시간 라이브를 첫 번째에, 나머지는 랜덤 셔플
  const liveItems = feed.filter(f => f.source_type === 'live')
  const otherItems = feed.filter(f => f.source_type !== 'live')
  // Fisher-Yates shuffle
  for (let i = otherItems.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [otherItems[i], otherItems[j]] = [otherItems[j], otherItems[i]]
  }
  const shuffled = [...liveItems, ...otherItems]

  return c.json({ success: true, data: shuffled })
})

// ── GET /api/shorts/seller/list — 셀러: 내 쇼츠 (/:id 보다 먼저 정의) ──
shortsRoutes.get('/seller/list', requireAuth(), async (c) => {
  const user = getCurrentUser(c)
  if (!user || user.type !== 'seller') return c.json({ success: false, error: '셀러만 조회 가능' }, 403)

  const { DB } = c.env
  await ensureTables(DB)

  const seller = await DB.prepare('SELECT id FROM sellers WHERE id = ?').bind(String(user.id)).first<{ id: number }>()
  if (!seller) return c.json({ success: true, data: [] })

  const { results } = await DB.prepare(
    "SELECT * FROM shorts WHERE seller_id = ? AND status != 'deleted' ORDER BY created_at DESC"
  ).bind(seller.id).all()

  return c.json({ success: true, data: results ?? [] })
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
  const seller = await DB.prepare('SELECT id FROM sellers WHERE id = ?').bind(String(user.id)).first<{ id: number }>()
  if (!seller) return c.json({ success: false, error: '셀러 정보를 찾을 수 없습니다' }, 404)

  const result = await DB.prepare(`
    INSERT INTO shorts (seller_id, title, description, video_url, youtube_video_id, thumbnail_url, duration, product_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(seller.id, title, description || null, video_url, youtube_video_id || null, thumbnail_url || null, duration || 0, product_id || null).run()

  return c.json({ success: true, data: { id: result.meta.last_row_id }, message: '쇼츠가 등록되었습니다' })
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
