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
  if (_done_ensureFollowsTable.has(DB)) return
  _done_ensureFollowsTable.add(DB)
  try {
    await DB.prepare(`
      CREATE TABLE IF NOT EXISTS seller_follows (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        seller_id INTEGER NOT NULL,
        user_id TEXT NOT NULL,
        notify_new_product INTEGER DEFAULT 1,
        notify_live_start INTEGER DEFAULT 1,
        notify_group_buy INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(seller_id, user_id)
      )
    `).run()
    await DB.prepare(`CREATE INDEX IF NOT EXISTS idx_seller_follows_seller ON seller_follows(seller_id, created_at DESC)`).run()
    await DB.prepare(`CREATE INDEX IF NOT EXISTS idx_seller_follows_user ON seller_follows(user_id)`).run()
    // 🛡️ 기존 테이블 마이그레이션 (notify_group_buy 추가)
    try { await DB.prepare(`ALTER TABLE seller_follows ADD COLUMN notify_group_buy INTEGER DEFAULT 1`).run() } catch { /* exists */ }
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
    // 🛡️ 2026-05-15: reason 별 단골 preferences 필터
    //   new_product → notify_new_product=1
    //   live_start  → notify_live_start=1
    //   group_buy   → notify_group_buy=1
    //   custom      → 단골 전원 (커스텀은 셀러 본인 책임)
    const reasonToColumn: Record<string, string> = {
      new_product: 'notify_new_product',
      live_start: 'notify_live_start',
      group_buy: 'notify_group_buy',
    }
    const filterColumn = reasonToColumn[body.reason || 'custom']
    const sql = filterColumn
      ? `SELECT user_id FROM seller_follows WHERE seller_id = ? AND ${filterColumn} = 1`
      : `SELECT user_id FROM seller_follows WHERE seller_id = ?`
    const { results: followers } = await DB.prepare(sql).bind(sellerId).all<{ user_id: string }>()

    if (!followers || followers.length === 0) {
      return c.json({ success: true, data: { sent: 0, total_followers: 0, message: '알림 받기로 한 단골 없음 — 발송 안 함' } })
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

// ── PATCH /:sellerId/follow/preferences — 단골 알림 옵션 토글 ──
// 🛡️ 2026-05-15: notify_new_product / notify_live_start / notify_group_buy 별도 ON/OFF
//   사용자가 셀러별로 알림 종류 세분화 → 셀러 push 부담 ↓, 사용자 retention ↑
sellerPublicRoutes.patch('/:sellerId/follow/preferences', requireAuth(), async (c) => {
  const user = getCurrentUser(c)
  if (!user) return c.json({ success: false, error: 'Unauthorized' }, 401)
  const sellerId = Number(c.req.param('sellerId'))
  if (!Number.isFinite(sellerId) || sellerId <= 0) {
    return c.json({ success: false, error: '잘못된 sellerId' }, 400)
  }

  let body: { notify_new_product?: boolean; notify_live_start?: boolean; notify_group_buy?: boolean }
  try { body = await c.req.json() } catch { return c.json({ success: false, error: 'JSON 형식 오류' }, 400) }

  const { DB } = c.env
  await ensureFollowsTable(DB)

  // 🛡️ notify_group_buy 컬럼 자동 ALTER (기존 테이블 마이그레이션)
  try { await DB.prepare(`ALTER TABLE seller_follows ADD COLUMN notify_group_buy INTEGER DEFAULT 1`).run() } catch { /* exists */ }

  const updates: string[] = []
  const values: unknown[] = []
  if (typeof body.notify_new_product === 'boolean') { updates.push('notify_new_product = ?'); values.push(body.notify_new_product ? 1 : 0) }
  if (typeof body.notify_live_start === 'boolean') { updates.push('notify_live_start = ?'); values.push(body.notify_live_start ? 1 : 0) }
  if (typeof body.notify_group_buy === 'boolean') { updates.push('notify_group_buy = ?'); values.push(body.notify_group_buy ? 1 : 0) }
  if (updates.length === 0) return c.json({ success: false, error: '변경할 항목 없음' }, 400)

  values.push(sellerId, String(user.id))
  try {
    const result = await DB.prepare(
      `UPDATE seller_follows SET ${updates.join(', ')} WHERE seller_id = ? AND user_id = ?`
    ).bind(...values).run()
    if (!result.meta?.changes) return c.json({ success: false, error: '단골 등록 안 됨' }, 404)
    return c.json({ success: true, message: '알림 설정 변경됨' })
  } catch (err) {
    console.error('[seller-public preferences]', err)
    return c.json({ success: false, error: '변경 실패' }, 500)
  }
})

// ── GET /:sellerId/follow/preferences — 본인 알림 설정 조회 ──
sellerPublicRoutes.get('/:sellerId/follow/preferences', requireAuth(), async (c) => {
  const user = getCurrentUser(c)
  if (!user) return c.json({ success: false, error: 'Unauthorized' }, 401)
  const sellerId = Number(c.req.param('sellerId'))
  const { DB } = c.env
  await ensureFollowsTable(DB)
  try { await DB.prepare(`ALTER TABLE seller_follows ADD COLUMN notify_group_buy INTEGER DEFAULT 1`).run() } catch { /* exists */ }

  try {
    const row = await DB.prepare(
      `SELECT notify_new_product, notify_live_start, notify_group_buy
       FROM seller_follows WHERE seller_id = ? AND user_id = ?`
    ).bind(sellerId, String(user.id)).first<{ notify_new_product: number; notify_live_start: number; notify_group_buy: number }>()

    if (!row) return c.json({ success: true, data: null, message: '단골 미등록' })
    return c.json({
      success: true,
      data: {
        notify_new_product: !!row.notify_new_product,
        notify_live_start: !!row.notify_live_start,
        notify_group_buy: row.notify_group_buy === null ? true : !!row.notify_group_buy,
      },
    })
  } catch (err) {
    console.error('[seller-public get preferences]', err)
    return c.json({ success: true, data: null })
  }
})

// ── GET /seller/analytics — 셀러: 본인 단골 분석 ──
// 🛡️ 2026-05-15: 단골 수 추이 + 알림 종류별 ON 비율 + 신규 단골 30일
sellerPublicRoutes.get('/seller/analytics', requireAuth(), async (c) => {
  const user = getCurrentUser(c)
  const userAsAny = user as unknown as { id?: number | string; type?: string }
  if (!user || userAsAny.type !== 'seller') {
    return c.json({ success: false, error: '셀러만 가능' }, 403)
  }
  const sellerId = Number(userAsAny.id)
  if (!Number.isFinite(sellerId)) return c.json({ success: false, error: '잘못된 sellerId' }, 400)

  const { DB } = c.env
  await ensureFollowsTable(DB)

  try {
    // 총 단골 수 + 알림 종류별 ON 수
    const total = await DB.prepare(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN notify_live_start = 1 THEN 1 ELSE 0 END) AS live_on,
        SUM(CASE WHEN notify_group_buy = 1 THEN 1 ELSE 0 END) AS group_buy_on,
        SUM(CASE WHEN notify_new_product = 1 THEN 1 ELSE 0 END) AS new_product_on
      FROM seller_follows WHERE seller_id = ?
    `).bind(sellerId).first<{ total: number; live_on: number; group_buy_on: number; new_product_on: number }>()

    // 일별 신규 단골 (최근 30일)
    const { results: daily } = await DB.prepare(`
      SELECT DATE(created_at, '+9 hours') AS day, COUNT(*) AS new_count
      FROM seller_follows
      WHERE seller_id = ? AND created_at >= datetime('now', '-30 days')
      GROUP BY day
      ORDER BY day DESC
    `).bind(sellerId).all<{ day: string; new_count: number }>()

    // 최근 단골 10명
    const { results: recent } = await DB.prepare(`
      SELECT sf.user_id, sf.created_at,
             u.display_name, u.profile_image
      FROM seller_follows sf
      LEFT JOIN users u ON u.id = sf.user_id
      WHERE sf.seller_id = ?
      ORDER BY sf.created_at DESC
      LIMIT 10
    `).bind(sellerId).all<{
      user_id: string; created_at: string;
      display_name: string | null; profile_image: string | null
    }>().catch(() => ({ results: [] as { user_id: string; created_at: string; display_name: string | null; profile_image: string | null }[] }))

    return c.json({
      success: true,
      data: {
        total: Number(total?.total ?? 0),
        notify_on: {
          live_start: Number(total?.live_on ?? 0),
          group_buy: Number(total?.group_buy_on ?? 0),
          new_product: Number(total?.new_product_on ?? 0),
        },
        daily: daily ?? [],
        recent_followers: (recent ?? []).map(r => ({
          user_id: r.user_id,
          masked_name: r.display_name ? r.display_name.charAt(0) + '**' : '익명',
          avatar: r.profile_image,
          created_at: r.created_at,
        })),
      },
    })
  } catch (err) {
    console.error('[seller-public seller analytics]', err)
    return c.json({ success: true, data: { total: 0, notify_on: { live_start: 0, group_buy: 0, new_product: 0 }, daily: [], recent_followers: [] } })
  }
})

// ── GET /my/follows — 내가 단골 등록한 셀러 전체 + 알림 설정 ──
sellerPublicRoutes.get('/my/follows', requireAuth(), async (c) => {
  const user = getCurrentUser(c)
  if (!user) return c.json({ success: false, error: 'Unauthorized' }, 401)
  const { DB } = c.env
  await ensureFollowsTable(DB)
  try { await DB.prepare(`ALTER TABLE seller_follows ADD COLUMN notify_group_buy INTEGER DEFAULT 1`).run() } catch { /* exists */ }

  try {
    const { results } = await DB.prepare(`
      SELECT sf.seller_id, sf.notify_new_product, sf.notify_live_start, sf.notify_group_buy, sf.created_at,
             s.name AS seller_name, s.username AS seller_username, s.profile_image AS seller_avatar
      FROM seller_follows sf
      LEFT JOIN sellers s ON s.id = sf.seller_id
      WHERE sf.user_id = ?
      ORDER BY sf.created_at DESC
    `).bind(String(user.id)).all<{
      seller_id: number; notify_new_product: number; notify_live_start: number; notify_group_buy: number;
      created_at: string; seller_name: string; seller_username: string | null; seller_avatar: string | null
    }>()

    return c.json({
      success: true,
      data: (results ?? []).map(r => ({
        seller_id: r.seller_id,
        seller_name: r.seller_name,
        seller_username: r.seller_username,
        seller_avatar: r.seller_avatar,
        notify_new_product: !!r.notify_new_product,
        notify_live_start: !!r.notify_live_start,
        notify_group_buy: r.notify_group_buy === null ? true : !!r.notify_group_buy,
        created_at: r.created_at,
      })),
    })
  } catch (err) {
    console.error('[seller-public my follows]', err)
    return c.json({ success: true, data: [] })
  }
})

export { sellerPublicRoutes }


// 🛡️ 2026-05-19: ensure* per-worker 메모이제이션 (파일 끝).
const _done_ensureFollowsTable = new WeakSet<object>()
