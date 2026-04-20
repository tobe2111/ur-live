/**
 * Agency API Routes
 *
 * Agency = 에이전시 (여러 셀러를 관리하는 대행사)
 *
 * Auth:
 *   POST /api/agency/login
 *   POST /api/agency/register
 *
 * Protected (requires agency JWT):
 *   GET  /api/agency/profile
 *   GET  /api/agency/sellers            - 소속 셀러 목록
 *   GET  /api/agency/sellers/:id/stats  - 특정 셀러 통계
 *   GET  /api/agency/stats              - 전체 집계 통계
 *   GET  /api/agency/stats/batch        - 셀러별 일괄 통계
 *   GET  /api/agency/orders             - 소속 셀러 주문 목록
 *   GET  /api/agency/streams            - 소속 셀러 라이브 현황
 */

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { sign, verify } from 'hono/jwt'
import { rateLimit } from '@/worker/middleware/rate-limit'
import type { Context, Next } from 'hono'
import { verifyPassword, hashPassword } from '@/lib/password'
import type { Env } from '@/worker/types/env'
import { ALLOWED_ORIGINS } from '@/shared/constants'

type AgencyVars = { agency: { id: number; email: string } }
type AgencyCtx = Context<{ Bindings: Env; Variables: AgencyVars }>

const app = new Hono<{ Bindings: Env; Variables: AgencyVars }>()
app.use('*', cors({ origin: [...ALLOWED_ORIGINS], credentials: true }))

// ── 테이블 자동 생성 ──────────────────────────────────────────
async function ensureAgencyTables(DB: D1Database) {
  await DB.prepare(`
    CREATE TABLE IF NOT EXISTS agencies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      contact_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      phone TEXT,
      commission_rate REAL DEFAULT 2.0,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run().catch(() => {})

  // commission_rate 컬럼 보장
  await DB.prepare("ALTER TABLE agencies ADD COLUMN commission_rate REAL DEFAULT 2.0").run().catch(() => {})

  await DB.prepare(`
    CREATE TABLE IF NOT EXISTS agency_sellers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agency_id INTEGER NOT NULL,
      seller_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(agency_id, seller_id)
    )
  `).run().catch(() => {})
}

// ── JWT 헬퍼 ─────────────────────────────────────────────────
async function signAgencyToken(secret: string, agencyId: number, email: string) {
  return sign(
    { sub: String(agencyId), email, type: 'agency', exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7 },
    secret
  )
}

async function verifyAgencyToken(secret: string, token: string): Promise<{ id: number; email: string } | null> {
  try {
    const payload = await verify(token, secret, 'HS256') as Record<string, unknown>
    if (payload.type !== 'agency' || !payload.sub) return null
    return { id: Number(payload.sub), email: String(payload.email) }
  } catch {
    return null
  }
}

function getToken(authHeader: string | undefined) {
  if (!authHeader?.startsWith('Bearer ')) return null
  return authHeader.slice(7)
}

// ── 미들웨어: agency 인증 ──────────────────────────────────────
const requireAgency = async (c: AgencyCtx, next: Next) => {
  const payload = await verifyAgencyToken(c.env.JWT_SECRET, getToken(c.req.header('Authorization')) ?? '')
  if (!payload) return c.json({ success: false, error: '인증이 필요합니다.' }, 401)
  c.set('agency', payload)
  return next()
}

// ── POST /register (공개) ─────────────────────────────────────
app.post('/register', cors(), async (c) => {
  await ensureAgencyTables(c.env.DB)
  const { name, contact_name, email, password, phone } = await c.req.json<{
    name: string; contact_name: string; email: string; password: string; phone?: string
  }>()

  if (!name || !contact_name || !email || !password) {
    return c.json({ success: false, error: '에이전시명, 담당자명, 이메일, 비밀번호는 필수입니다.' }, 400)
  }
  if (password.length < 8) {
    return c.json({ success: false, error: '비밀번호는 8자 이상이어야 합니다.' }, 400)
  }

  const existing = await c.env.DB.prepare('SELECT id FROM agencies WHERE email = ?').bind(email).first()
  if (existing) return c.json({ success: false, error: '이미 사용 중인 이메일입니다.' }, 409)

  const hash = await hashPassword(password)
  await c.env.DB.prepare(`
    INSERT INTO agencies (name, contact_name, email, password_hash, phone, status)
    VALUES (?, ?, ?, ?, ?, 'pending')
  `).bind(name, contact_name, email, hash, phone || null).run()

  return c.json({ success: true, message: '가입 신청이 완료되었습니다. 관리자 승인 후 이용 가능합니다.' }, 201)
})

// ── POST /login ───────────────────────────────────────────────
app.post('/login', cors(), rateLimit({ action: 'agency_login', max: 10, windowSec: 300 }), async (c) => {
  await ensureAgencyTables(c.env.DB)
  const { email, password } = await c.req.json<{ email: string; password: string }>()
  if (!email || !password) return c.json({ success: false, error: '이메일과 비밀번호를 입력해주세요.' }, 400)

  const agency = await c.env.DB.prepare(
    'SELECT id, name, contact_name, email, password_hash, status FROM agencies WHERE email = ?'
  ).bind(email).first<{ id: number; name: string; contact_name: string; email: string; password_hash: string; status: string }>()

  if (!agency) return c.json({ success: false, error: '이메일 또는 비밀번호가 올바르지 않습니다.' }, 401)
  if (agency.status === 'pending') return c.json({ success: false, error: '관리자 승인 대기 중입니다. 승인 후 로그인이 가능합니다.' }, 403)
  if (agency.status === 'rejected') return c.json({ success: false, error: '가입이 거절된 계정입니다. 관리자에게 문의해주세요.' }, 403)
  if (agency.status !== 'active') return c.json({ success: false, error: '비활성화된 계정입니다.' }, 403)

  const { valid } = await verifyPassword(password, agency.password_hash)
  if (!valid) return c.json({ success: false, error: '이메일 또는 비밀번호가 올바르지 않습니다.' }, 401)

  const token = await signAgencyToken(c.env.JWT_SECRET, agency.id, agency.email)
  return c.json({
    success: true,
    token,
    agency: { id: agency.id, name: agency.name, contact_name: agency.contact_name, email: agency.email },
  })
})

// ── 이하 인증 필요 ────────────────────────────────────────────
app.use('*', requireAgency as any)

// ── GET /profile ──────────────────────────────────────────────
app.get('/profile', async (c) => {
  await ensureAgencyTables(c.env.DB)
  const { id } = c.get('agency') as { id: number; email: string }
  const agency = await c.env.DB.prepare(
    'SELECT id, name, contact_name, email, phone, status, created_at FROM agencies WHERE id = ?'
  ).bind(id).first()
  if (!agency) return c.json({ success: false, error: 'Not found' }, 404)
  return c.json({ success: true, data: agency })
})

// ── GET /sellers ──────────────────────────────────────────────
app.get('/sellers', async (c) => {
  await ensureAgencyTables(c.env.DB)
  const { id: agencyId } = c.get('agency') as { id: number }

  const sellers = await c.env.DB.prepare(`
    SELECT
      s.id, s.name, s.email, s.business_name, s.phone,
      s.status, s.commission_rate, s.created_at,
      (SELECT COUNT(*) FROM orders o WHERE o.seller_id = s.id) AS total_orders,
      (SELECT COALESCE(SUM(o.total_amount), 0) FROM orders o WHERE o.seller_id = s.id AND o.payment_status = 'approved') AS total_revenue,
      (SELECT COUNT(*) FROM live_streams ls WHERE ls.seller_id = s.id AND ls.status = 'live') AS active_streams
    FROM sellers s
    INNER JOIN agency_sellers ag ON ag.seller_id = s.id
    WHERE ag.agency_id = ?
    ORDER BY s.created_at DESC
  `).bind(agencyId).all()

  return c.json({ success: true, data: sellers.results })
})

// ── GET /sellers/:id/stats ────────────────────────────────────
app.get('/sellers/:id/stats', async (c) => {
  await ensureAgencyTables(c.env.DB)
  const { id: agencyId } = c.get('agency') as { id: number }
  const sellerId = Number(c.req.param('id'))

  // 소속 확인
  const belongs = await c.env.DB.prepare(
    'SELECT id FROM agency_sellers WHERE agency_id = ? AND seller_id = ?'
  ).bind(agencyId, sellerId).first()
  if (!belongs) return c.json({ success: false, error: '접근 권한이 없습니다.' }, 403)

  const period = c.req.query('period') || '30d'
  const days = period === '7d' ? 7 : period === '90d' ? 90 : 30
  const since = new Date(Date.now() - days * 86400_000).toISOString()

  const [seller, orderStats, streamStats] = await Promise.all([
    c.env.DB.prepare('SELECT id, name, business_name, email, status, commission_rate FROM sellers WHERE id = ?')
      .bind(sellerId).first(),
    c.env.DB.prepare(`
      SELECT
        COUNT(*) AS order_count,
        COALESCE(SUM(total_amount), 0) AS revenue,
        COALESCE(SUM(seller_amount), 0) AS net_revenue
      FROM orders
      WHERE seller_id = ? AND payment_status = 'approved' AND created_at >= ?
    `).bind(sellerId, since).first<{ order_count: number; revenue: number; net_revenue: number }>(),
    c.env.DB.prepare(`
      SELECT COUNT(*) AS stream_count, COALESCE(SUM(viewer_count), 0) AS total_viewers
      FROM live_streams WHERE seller_id = ? AND created_at >= ?
    `).bind(sellerId, since).first<{ stream_count: number; total_viewers: number }>(),
  ])

  return c.json({
    success: true,
    data: {
      seller,
      period,
      orders: orderStats,
      streams: streamStats,
    },
  })
})

// ── GET /stats ────────────────────────────────────────────────
app.get('/stats', async (c) => {
  await ensureAgencyTables(c.env.DB)
  const { id: agencyId } = c.get('agency') as { id: number }

  const [sellerCount, orderStats, activeStreams] = await Promise.all([
    c.env.DB.prepare('SELECT COUNT(*) AS cnt FROM agency_sellers WHERE agency_id = ?')
      .bind(agencyId).first<{ cnt: number }>(),
    c.env.DB.prepare(`
      SELECT
        COUNT(*) AS order_count,
        COALESCE(SUM(o.total_amount), 0) AS total_revenue,
        COALESCE(SUM(o.seller_amount), 0) AS net_revenue
      FROM orders o
      INNER JOIN agency_sellers ag ON ag.seller_id = o.seller_id
      WHERE ag.agency_id = ? AND o.payment_status = 'approved'
        AND o.created_at >= date('now', '-30 days')
    `).bind(agencyId).first<{ order_count: number; total_revenue: number; net_revenue: number }>(),
    c.env.DB.prepare(`
      SELECT COUNT(*) AS cnt
      FROM live_streams ls
      INNER JOIN agency_sellers ag ON ag.seller_id = ls.seller_id
      WHERE ag.agency_id = ? AND ls.status = 'live'
    `).bind(agencyId).first<{ cnt: number }>(),
  ])

  return c.json({
    success: true,
    data: {
      sellers: sellerCount?.cnt ?? 0,
      orders_30d: orderStats?.order_count ?? 0,
      revenue_30d: orderStats?.total_revenue ?? 0,
      net_revenue_30d: orderStats?.net_revenue ?? 0,
      active_streams: activeStreams?.cnt ?? 0,
    },
  })
})

// ── GET /stats/batch — 셀러별 일괄 통계 (N+1 방지) ─────────────
app.get('/stats/batch', async (c) => {
  await ensureAgencyTables(c.env.DB)
  const { id: agencyId } = c.get('agency') as { id: number }

  const period = c.req.query('period') || '30d'
  const days = period === '7d' ? 7 : period === '90d' ? 90 : 30
  const since = new Date(Date.now() - days * 86400_000).toISOString()

  const [orderStats, streamStats] = await Promise.all([
    c.env.DB.prepare(`
      SELECT
        o.seller_id,
        COUNT(*) AS order_count,
        COALESCE(SUM(o.total_amount), 0) AS revenue,
        COALESCE(SUM(o.seller_amount), 0) AS net_revenue
      FROM orders o
      INNER JOIN agency_sellers ag ON ag.seller_id = o.seller_id
      WHERE ag.agency_id = ? AND o.payment_status = 'approved' AND o.created_at >= ?
      GROUP BY o.seller_id
    `).bind(agencyId, since).all<{ seller_id: number; order_count: number; revenue: number; net_revenue: number }>(),
    c.env.DB.prepare(`
      SELECT
        ls.seller_id,
        COUNT(*) AS stream_count,
        COALESCE(SUM(ls.viewer_count), 0) AS total_viewers
      FROM live_streams ls
      INNER JOIN agency_sellers ag ON ag.seller_id = ls.seller_id
      WHERE ag.agency_id = ? AND ls.created_at >= ?
      GROUP BY ls.seller_id
    `).bind(agencyId, since).all<{ seller_id: number; stream_count: number; total_viewers: number }>(),
  ])

  const orders: Record<number, { order_count: number; revenue: number; net_revenue: number }> = {}
  for (const r of orderStats.results) orders[r.seller_id] = r

  const streams: Record<number, { stream_count: number; total_viewers: number }> = {}
  for (const r of streamStats.results) streams[r.seller_id] = r

  return c.json({ success: true, data: { orders, streams, period } })
})

// ── GET /orders ───────────────────────────────────────────────
app.get('/orders', async (c) => {
  await ensureAgencyTables(c.env.DB)
  const { id: agencyId } = c.get('agency') as { id: number }
  const page = Number(c.req.query('page') || 1)
  const limit = Number(c.req.query('limit') || 20)
  const offset = (page - 1) * limit
  const sellerId = c.req.query('seller_id')

  const sellerFilter = sellerId ? 'AND o.seller_id = ?' : ''
  const params: unknown[] = sellerId ? [agencyId, Number(sellerId), limit, offset] : [agencyId, limit, offset]

  const [orders, total] = await Promise.all([
    c.env.DB.prepare(`
      SELECT o.id, o.order_number, o.total_amount, o.payment_status, o.status,
             o.created_at, o.shipping_name, o.seller_id,
             s.business_name AS seller_business_name
      FROM orders o
      INNER JOIN agency_sellers ag ON ag.seller_id = o.seller_id
      LEFT JOIN sellers s ON s.id = o.seller_id
      WHERE ag.agency_id = ? ${sellerFilter}
      ORDER BY o.created_at DESC LIMIT ? OFFSET ?
    `).bind(...params).all(),
    c.env.DB.prepare(`
      SELECT COUNT(*) AS cnt FROM orders o
      INNER JOIN agency_sellers ag ON ag.seller_id = o.seller_id
      WHERE ag.agency_id = ? ${sellerFilter}
    `).bind(...(sellerId ? [agencyId, Number(sellerId)] : [agencyId])).first<{ cnt: number }>(),
  ])

  return c.json({
    success: true,
    data: orders.results,
    meta: { total: total?.cnt ?? 0, page, limit },
  })
})

// ── GET /streams ──────────────────────────────────────────────
app.get('/streams', async (c) => {
  await ensureAgencyTables(c.env.DB)
  const { id: agencyId } = c.get('agency') as { id: number }

  const streams = await c.env.DB.prepare(`
    SELECT ls.id, ls.title, ls.status, ls.viewer_count, ls.scheduled_at, ls.created_at, ls.seller_id,
           s.business_name AS seller_business_name, s.name AS seller_name
    FROM live_streams ls
    INNER JOIN agency_sellers ag ON ag.seller_id = ls.seller_id
    LEFT JOIN sellers s ON s.id = ls.seller_id
    WHERE ag.agency_id = ?
    ORDER BY ls.created_at DESC LIMIT 50
  `).bind(agencyId).all()

  return c.json({ success: true, data: streams.results })
})

// ── GET /settlements — 소속 셀러 정산 통합 (에이전시 수수료 포함) ──
app.get('/settlements', async (c) => {
  await ensureAgencyTables(c.env.DB)
  const { id: agencyId } = c.get('agency') as { id: number }

  try {
    // 에이전시 수수료율 조회
    const agency = await c.env.DB.prepare('SELECT commission_rate FROM agencies WHERE id = ?')
      .bind(agencyId).first<{ commission_rate: number }>()
    const agencyRate = agency?.commission_rate ?? 2.0

    const { results } = await c.env.DB.prepare(`
      SELECT o.id, o.order_number, o.total_amount, o.seller_id,
             s.name AS seller_name, s.business_name,
             COALESCE(s.commission_rate, 5) AS seller_commission_rate,
             COALESCE(o.settlement_status, 'pending') AS settlement_status,
             o.created_at
      FROM orders o
      INNER JOIN agency_sellers ag ON ag.seller_id = o.seller_id
      LEFT JOIN sellers s ON s.id = o.seller_id
      WHERE ag.agency_id = ? AND o.status IN ('delivered', 'DONE')
      ORDER BY o.created_at DESC LIMIT 100
    `).bind(agencyId).all()

    // 에이전시 수수료 계산
    const enriched = (results || []).map((r: any) => ({
      ...r,
      agency_commission_rate: agencyRate,
      total_commission_rate: (r.seller_commission_rate || 5) + agencyRate,
      agency_commission: Math.round((r.total_amount || 0) * agencyRate / 100),
      seller_amount: Math.round((r.total_amount || 0) * (100 - (r.seller_commission_rate || 5) - agencyRate) / 100),
    }))

    const totalAgencyCommission = enriched.reduce((s: number, r: any) => s + (r.agency_commission || 0), 0)

    const summary = {
      total: enriched.length,
      pending: enriched.filter((r: any) => r.settlement_status === 'pending').length,
      confirmed: enriched.filter((r: any) => r.settlement_status === 'confirmed').length,
      completed: enriched.filter((r: any) => r.settlement_status === 'completed').length,
      total_amount: enriched.reduce((s: number, r: any) => s + (r.total_amount || 0), 0),
      agency_commission_rate: agencyRate,
      total_agency_commission: totalAgencyCommission,
    }

    return c.json({ success: true, data: enriched, summary })
  } catch {
    return c.json({ success: true, data: [], summary: { total: 0, pending: 0, confirmed: 0, completed: 0, total_amount: 0, agency_commission_rate: 2, total_agency_commission: 0 } })
  }
})

// ── GET /sellers/:id/products — 셀러 상품 조회 (대행 관리) ─────────
app.get('/sellers/:id/products', async (c) => {
  await ensureAgencyTables(c.env.DB)
  const { id: agencyId } = c.get('agency') as { id: number }
  const sellerId = Number(c.req.param('id'))

  const belongs = await c.env.DB.prepare(
    'SELECT id FROM agency_sellers WHERE agency_id = ? AND seller_id = ?'
  ).bind(agencyId, sellerId).first()
  if (!belongs) return c.json({ success: false, error: '접근 권한이 없습니다.' }, 403)

  const { results } = await c.env.DB.prepare(`
    SELECT id, name, price, original_price, stock, image_url, category, is_active, sold_count, created_at
    FROM products WHERE seller_id = ? ORDER BY created_at DESC
  `).bind(sellerId).all()

  return c.json({ success: true, data: results })
})

// ── GET /sellers/:id/inventory — 셀러 재고 현황 ──────────────────
app.get('/sellers/:id/inventory', async (c) => {
  await ensureAgencyTables(c.env.DB)
  const { id: agencyId } = c.get('agency') as { id: number }
  const sellerId = Number(c.req.param('id'))

  const belongs = await c.env.DB.prepare(
    'SELECT id FROM agency_sellers WHERE agency_id = ? AND seller_id = ?'
  ).bind(agencyId, sellerId).first()
  if (!belongs) return c.json({ success: false, error: '접근 권한이 없습니다.' }, 403)

  const { results } = await c.env.DB.prepare(`
    SELECT id, name, COALESCE(stock, stock_quantity, 0) AS stock, price, image_url, is_active
    FROM products WHERE seller_id = ? AND is_active = 1
    ORDER BY stock ASC
  `).bind(sellerId).all()

  return c.json({ success: true, data: results })
})

// ── GET /ranking — 셀러 성과 랭킹 ───────────────────────────────
app.get('/ranking', async (c) => {
  await ensureAgencyTables(c.env.DB)
  const { id: agencyId } = c.get('agency') as { id: number }
  const metric = c.req.query('metric') || 'revenue' // revenue, orders, reviews, followers

  try {
    let orderBy = 'total_revenue DESC'
    if (metric === 'orders') orderBy = 'total_orders DESC'

    const { results } = await c.env.DB.prepare(`
      SELECT s.id, s.name, s.business_name, s.profile_image,
        (SELECT COUNT(*) FROM orders o WHERE o.seller_id = s.id AND o.payment_status = 'approved') AS total_orders,
        (SELECT COALESCE(SUM(o.total_amount), 0) FROM orders o WHERE o.seller_id = s.id AND o.payment_status = 'approved') AS total_revenue,
        (SELECT COUNT(*) FROM product_reviews r JOIN products p ON r.product_id = p.id WHERE p.seller_id = s.id) AS total_reviews,
        (SELECT COUNT(*) FROM seller_follows f WHERE f.seller_id = s.id) AS total_followers,
        (SELECT COALESCE(AVG(r.rating), 0) FROM product_reviews r JOIN products p ON r.product_id = p.id WHERE p.seller_id = s.id) AS avg_rating
      FROM sellers s
      INNER JOIN agency_sellers ag ON ag.seller_id = s.id
      WHERE ag.agency_id = ?
      ORDER BY ${orderBy}
    `).bind(agencyId).all()

    return c.json({ success: true, data: results })
  } catch {
    return c.json({ success: true, data: [] })
  }
})

// ── GET /schedule — 소속 셀러 방송 스케줄 캘린더 ──────────────────
app.get('/schedule', async (c) => {
  await ensureAgencyTables(c.env.DB)
  const { id: agencyId } = c.get('agency') as { id: number }

  try {
    const { results } = await c.env.DB.prepare(`
      SELECT ls.id, ls.title, ls.status, ls.scheduled_at, ls.youtube_video_id,
             ls.seller_id, s.name AS seller_name
      FROM live_streams ls
      INNER JOIN agency_sellers ag ON ag.seller_id = ls.seller_id
      LEFT JOIN sellers s ON s.id = ls.seller_id
      WHERE ag.agency_id = ? AND ls.status IN ('scheduled', 'live')
      ORDER BY ls.scheduled_at ASC
    `).bind(agencyId).all()

    return c.json({ success: true, data: results })
  } catch {
    return c.json({ success: true, data: [] })
  }
})

// ── GET /returns — 소속 셀러 반품/CS 통합 ────────────────────────
app.get('/returns', async (c) => {
  await ensureAgencyTables(c.env.DB)
  const { id: agencyId } = c.get('agency') as { id: number }

  try {
    const { results } = await c.env.DB.prepare(`
      SELECT r.id, r.order_number, r.status, r.reason, r.refund_amount,
             r.seller_id, s.name AS seller_name, r.created_at
      FROM returns r
      INNER JOIN agency_sellers ag ON ag.seller_id = r.seller_id
      LEFT JOIN sellers s ON s.id = r.seller_id
      WHERE ag.agency_id = ?
      ORDER BY r.created_at DESC LIMIT 50
    `).bind(agencyId).all()

    return c.json({ success: true, data: results })
  } catch {
    return c.json({ success: true, data: [] })
  }
})

// ── PUT /profile — 에이전시 프로필 수정 ──────────────────────────
app.put('/profile', async (c) => {
  const { id } = c.get('agency') as { id: number }
  const body = await c.req.json<{ name?: string; contact_name?: string; phone?: string }>()

  const updates: string[] = []
  const params: unknown[] = []
  if (body.name) { updates.push('name = ?'); params.push(body.name) }
  if (body.contact_name) { updates.push('contact_name = ?'); params.push(body.contact_name) }
  if (body.phone) { updates.push('phone = ?'); params.push(body.phone) }

  if (updates.length > 0) {
    updates.push("updated_at = datetime('now')")
    params.push(id)
    await c.env.DB.prepare(`UPDATE agencies SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run()
  }

  return c.json({ success: true })
})

// ── GET /notifications — 에이전시 알림 ────────────────────────────
app.get('/notifications', async (c) => {
  const { id: agencyId } = c.get('agency') as { id: number }

  try {
    await c.env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS agency_notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agency_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT,
        link TEXT,
        is_read INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run().catch(() => {})

    const { results } = await c.env.DB.prepare(
      'SELECT * FROM agency_notifications WHERE agency_id = ? ORDER BY created_at DESC LIMIT 30'
    ).bind(agencyId).all()

    const unread = await c.env.DB.prepare(
      'SELECT COUNT(*) as cnt FROM agency_notifications WHERE agency_id = ? AND is_read = 0'
    ).bind(agencyId).first<{ cnt: number }>()

    return c.json({ success: true, data: results, unread_count: unread?.cnt || 0 })
  } catch {
    return c.json({ success: true, data: [], unread_count: 0 })
  }
})

// ── PUT /notifications/read-all ──────────────────────────────────
app.put('/notifications/read-all', async (c) => {
  const { id: agencyId } = c.get('agency') as { id: number }
  await c.env.DB.prepare('UPDATE agency_notifications SET is_read = 1 WHERE agency_id = ?').bind(agencyId).run().catch(() => {})
  return c.json({ success: true })
})

// ── POST /sellers/:id/products — 셀러 대신 상품 등록 ──────────────
app.post('/sellers/:id/products', async (c) => {
  await ensureAgencyTables(c.env.DB)
  const { id: agencyId } = c.get('agency') as { id: number }
  const sellerId = Number(c.req.param('id'))

  const belongs = await c.env.DB.prepare('SELECT id FROM agency_sellers WHERE agency_id = ? AND seller_id = ?')
    .bind(agencyId, sellerId).first()
  if (!belongs) return c.json({ success: false, error: '소속 셀러가 아닙니다.' }, 403)

  const body = await c.req.json<{
    name: string; description?: string; price: number; original_price?: number;
    stock?: number; image_url?: string; category?: string;
  }>()

  if (!body.name || !body.price) return c.json({ success: false, error: '상품명과 가격은 필수입니다.' }, 400)

  const result = await c.env.DB.prepare(`
    INSERT INTO products (seller_id, name, description, price, original_price, stock, image_url, category, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))
  `).bind(sellerId, body.name, body.description || null, body.price, body.original_price || body.price,
    body.stock || 100, body.image_url || null, body.category || 'general').run()

  return c.json({ success: true, data: { id: result.meta.last_row_id } }, 201)
})

// ── PUT /sellers/:id/products/:productId — 셀러 대신 상품 수정 ────
app.put('/sellers/:id/products/:productId', async (c) => {
  await ensureAgencyTables(c.env.DB)
  const { id: agencyId } = c.get('agency') as { id: number }
  const sellerId = Number(c.req.param('id'))
  const productId = Number(c.req.param('productId'))

  const belongs = await c.env.DB.prepare('SELECT id FROM agency_sellers WHERE agency_id = ? AND seller_id = ?')
    .bind(agencyId, sellerId).first()
  if (!belongs) return c.json({ success: false, error: '소속 셀러가 아닙니다.' }, 403)

  const product = await c.env.DB.prepare('SELECT id FROM products WHERE id = ? AND seller_id = ?')
    .bind(productId, sellerId).first()
  if (!product) return c.json({ success: false, error: '상품을 찾을 수 없습니다.' }, 404)

  const body = await c.req.json<{
    name?: string; description?: string; price?: number; original_price?: number;
    stock?: number; image_url?: string; is_active?: boolean;
  }>()

  const updates: string[] = ["updated_at = datetime('now')"]
  const params: unknown[] = []
  if (body.name) { updates.push('name = ?'); params.push(body.name) }
  if (body.description !== undefined) { updates.push('description = ?'); params.push(body.description) }
  if (body.price) { updates.push('price = ?'); params.push(body.price) }
  if (body.original_price) { updates.push('original_price = ?'); params.push(body.original_price) }
  if (body.stock !== undefined) { updates.push('stock = ?'); params.push(body.stock) }
  if (body.image_url !== undefined) { updates.push('image_url = ?'); params.push(body.image_url) }
  if (body.is_active !== undefined) { updates.push('is_active = ?'); params.push(body.is_active ? 1 : 0) }

  params.push(productId)
  await c.env.DB.prepare(`UPDATE products SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run()

  return c.json({ success: true })
})

// ── POST /sellers/:id/streams — 셀러 대신 방송 예약 ───────────────
app.post('/sellers/:id/streams', async (c) => {
  await ensureAgencyTables(c.env.DB)
  const { id: agencyId } = c.get('agency') as { id: number }
  const sellerId = Number(c.req.param('id'))

  const belongs = await c.env.DB.prepare('SELECT id FROM agency_sellers WHERE agency_id = ? AND seller_id = ?')
    .bind(agencyId, sellerId).first()
  if (!belongs) return c.json({ success: false, error: '소속 셀러가 아닙니다.' }, 403)

  const { title, description, scheduled_at } = await c.req.json<{
    title: string; description?: string; scheduled_at?: string;
  }>()

  if (!title) return c.json({ success: false, error: '방송 제목은 필수입니다.' }, 400)

  const result = await c.env.DB.prepare(`
    INSERT INTO live_streams (seller_id, title, description, status, scheduled_at, created_at, updated_at)
    VALUES (?, ?, ?, 'scheduled', ?, datetime('now'), datetime('now'))
  `).bind(sellerId, title, description || null, scheduled_at || null).run()

  return c.json({ success: true, data: { id: result.meta.last_row_id } }, 201)
})

// ── POST /invite-seller — 셀러 초대 (에이전시가 셀러 계정 생성) ─────
app.post('/invite-seller', async (c) => {
  await ensureAgencyTables(c.env.DB)
  const { id: agencyId } = c.get('agency') as { id: number }

  const { name, email, password, business_name, phone } = await c.req.json<{
    name: string; email: string; password: string; business_name?: string; phone?: string;
  }>()

  if (!name || !email || !password) return c.json({ success: false, error: '이름, 이메일, 비밀번호는 필수입니다.' }, 400)

  // 이미 존재하는 이메일 확인
  const existing = await c.env.DB.prepare('SELECT id FROM sellers WHERE email = ?').bind(email).first()
  if (existing) return c.json({ success: false, error: '이미 사용 중인 이메일입니다.' }, 409)

  const { hashPassword: hashPw } = await import('@/lib/password')
  const hash = await hashPw(password)

  // 셀러 계정 생성 (승인 상태)
  const result = await c.env.DB.prepare(`
    INSERT INTO sellers (username, name, email, password_hash, business_name, phone, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 'approved', datetime('now'), datetime('now'))
  `).bind(email.split('@')[0], name, email, hash, business_name || null, phone || null).run()

  const sellerId = result.meta.last_row_id

  // 에이전시에 소속
  await c.env.DB.prepare('INSERT OR IGNORE INTO agency_sellers (agency_id, seller_id) VALUES (?, ?)')
    .bind(agencyId, sellerId).run()

  return c.json({ success: true, data: { seller_id: sellerId }, message: `${name} 셀러가 생성되어 에이전시에 소속되었습니다.` }, 201)
})

// ── GET /api/agency/report/csv — 매출 리포트 CSV 다운로드 ──
app.get('/report/csv', async (c: AgencyCtx) => {
  const agencyId = c.get('agency').id
  const period = c.req.query('period') || '30'
  const days = parseInt(period)

  const { results } = await c.env.DB.prepare(`
    SELECT s.name AS seller_name, s.email,
      COUNT(DISTINCT o.id) AS order_count,
      COALESCE(SUM(CASE WHEN o.status NOT IN ('CANCELLED','FAILED','REFUNDED') THEN o.total_amount END), 0) AS revenue,
      COALESCE(SUM(CASE WHEN o.status NOT IN ('CANCELLED','FAILED','REFUNDED') THEN o.total_amount END) * 0.07, 0) AS commission
    FROM agency_sellers ag
    JOIN sellers s ON ag.seller_id = s.id
    LEFT JOIN orders o ON o.seller_id = s.id AND o.created_at > datetime('now', '-' || ? || ' days')
    WHERE ag.agency_id = ?
    GROUP BY s.id, s.name, s.email
    ORDER BY revenue DESC
  `).bind(days, agencyId).all()

  const rows = results || []
  const csv = [
    '셀러명,이메일,주문수,매출(원),수수료(원)',
    ...rows.map((r: any) => `${r.seller_name},${r.email},${r.order_count},${r.revenue},${Math.round(r.commission)}`)
  ].join('\n')

  return new Response('\uFEFF' + csv, {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="agency-report-${days}d.csv"` },
  })
})

// ── POST /api/agency/notices — 셀러 공지사항 발송 ──
app.post('/notices', async (c: AgencyCtx) => {
  const agencyId = c.get('agency').id
  const { title, message } = await c.req.json<{ title: string; message: string }>()
  if (!title || !message) return c.json({ success: false, error: '제목과 내용을 입력해주세요' }, 400)

  const { results: sellers } = await c.env.DB.prepare(
    'SELECT seller_id FROM agency_sellers WHERE agency_id = ?'
  ).bind(agencyId).all<{ seller_id: number }>()

  if (!sellers?.length) return c.json({ success: false, error: '소속 셀러가 없습니다' })

  const stmts = sellers.map(s =>
    c.env.DB.prepare(`
      INSERT INTO dashboard_notifications (recipient_type, recipient_id, type, title, message, created_at)
      VALUES ('seller', ?, 'agency_notice', ?, ?, datetime('now'))
    `).bind(String(s.seller_id), title, message)
  )
  for (let i = 0; i < stmts.length; i += 50) {
    await c.env.DB.batch(stmts.slice(i, i + 50))
  }

  return c.json({ success: true, message: `${sellers.length}명의 셀러에게 공지를 발송했습니다.` })
})

// ── GET /api/agency/notices — 공지 이력 ──
app.get('/notices', async (c: AgencyCtx) => {
  const agencyId = c.get('agency').id
  const { results } = await c.env.DB.prepare(`
    SELECT DISTINCT dn.title, dn.message, dn.created_at
    FROM dashboard_notifications dn
    JOIN agency_sellers ag ON dn.recipient_id = CAST(ag.seller_id AS TEXT)
    WHERE ag.agency_id = ? AND dn.type = 'agency_notice'
    GROUP BY dn.title, dn.message, dn.created_at
    ORDER BY dn.created_at DESC
    LIMIT 50
  `).bind(agencyId).all()

  return c.json({ success: true, data: results || [] })
})

// ── GET/PUT /api/agency/targets — 셀러 매출 목표 ──
app.get('/targets', async (c: AgencyCtx) => {
  const agencyId = c.get('agency').id
  try {
    await c.env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS agency_seller_targets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agency_id INTEGER NOT NULL,
        seller_id INTEGER NOT NULL,
        month TEXT NOT NULL,
        target_amount INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(agency_id, seller_id, month)
      )
    `).run()
  } catch {}

  const month = c.req.query('month') || new Date().toISOString().slice(0, 7)

  const { results } = await c.env.DB.prepare(`
    SELECT s.id AS seller_id, s.name AS seller_name,
      COALESCE(t.target_amount, 0) AS target_amount,
      COALESCE(SUM(CASE WHEN o.status NOT IN ('CANCELLED','FAILED','REFUNDED')
        AND strftime('%Y-%m', o.created_at) = ? THEN o.total_amount END), 0) AS current_amount
    FROM agency_sellers ag
    JOIN sellers s ON ag.seller_id = s.id
    LEFT JOIN agency_seller_targets t ON t.seller_id = s.id AND t.agency_id = ? AND t.month = ?
    LEFT JOIN orders o ON o.seller_id = s.id
    WHERE ag.agency_id = ?
    GROUP BY s.id, s.name, t.target_amount
    ORDER BY s.name
  `).bind(month, agencyId, month, agencyId).all()

  return c.json({ success: true, data: results || [], month })
})

app.put('/targets', async (c: AgencyCtx) => {
  const agencyId = c.get('agency').id
  const { seller_id, month, target_amount } = await c.req.json<{ seller_id: number; month: string; target_amount: number }>()
  if (!seller_id || !month) return c.json({ success: false, error: '셀러와 월을 선택해주세요' }, 400)

  try {
    await c.env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS agency_seller_targets (
        id INTEGER PRIMARY KEY AUTOINCREMENT, agency_id INTEGER NOT NULL, seller_id INTEGER NOT NULL,
        month TEXT NOT NULL, target_amount INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(agency_id, seller_id, month)
      )
    `).run()
  } catch {}

  await c.env.DB.prepare(`
    INSERT INTO agency_seller_targets (agency_id, seller_id, month, target_amount)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(agency_id, seller_id, month) DO UPDATE SET target_amount = excluded.target_amount
  `).bind(agencyId, seller_id, month, target_amount || 0).run()

  return c.json({ success: true })
})

// ── GET /api/agency/settlements/csv — 정산 CSV 다운로드 ──
app.get('/settlements/csv', async (c: AgencyCtx) => {
  const agencyId = c.get('agency').id
  const { results } = await c.env.DB.prepare(`
    SELECT s.name AS seller_name, s.email,
      COUNT(DISTINCT o.id) AS settled_orders,
      COALESCE(SUM(o.total_amount), 0) AS total_amount,
      COALESCE(SUM(o.total_amount * 0.05), 0) AS seller_commission,
      COALESCE(SUM(o.total_amount * 0.02), 0) AS agency_commission
    FROM agency_sellers ag
    JOIN sellers s ON ag.seller_id = s.id
    LEFT JOIN orders o ON o.seller_id = s.id AND COALESCE(o.settlement_status, '') = 'settled'
    WHERE ag.agency_id = ?
    GROUP BY s.id ORDER BY total_amount DESC
  `).bind(agencyId).all()

  const rows = results || []
  const csv = [
    '셀러명,이메일,정산건수,총매출(원),셀러수수료5%(원),에이전시수수료2%(원)',
    ...rows.map((r: any) => `${r.seller_name},${r.email},${r.settled_orders},${r.total_amount},${Math.round(r.seller_commission)},${Math.round(r.agency_commission)}`)
  ].join('\n')

  return new Response('\uFEFF' + csv, {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="agency-settlements.csv"' },
  })
})

// ── GET /api/agency/sellers/compare — 셀러 성과 비교 ──
app.get('/sellers/compare', async (c: AgencyCtx) => {
  const agencyId = c.get('agency').id
  const period = c.req.query('period') || '30'

  const { results } = await c.env.DB.prepare(`
    SELECT s.id, s.name, s.business_name,
      COUNT(DISTINCT o.id) AS order_count,
      COALESCE(SUM(CASE WHEN o.status NOT IN ('CANCELLED','FAILED','REFUNDED') THEN o.total_amount END), 0) AS revenue,
      COUNT(DISTINCT CASE WHEN ls.status = 'live' THEN ls.id END) AS live_count,
      COUNT(DISTINCT CASE WHEN ls.status = 'ended' THEN ls.id END) AS ended_streams
    FROM agency_sellers ag
    JOIN sellers s ON ag.seller_id = s.id
    LEFT JOIN orders o ON o.seller_id = s.id AND o.created_at > datetime('now', '-' || ? || ' days')
    LEFT JOIN live_streams ls ON ls.seller_id = s.id AND ls.created_at > datetime('now', '-' || ? || ' days')
    WHERE ag.agency_id = ?
    GROUP BY s.id, s.name ORDER BY revenue DESC
  `).bind(period, period, agencyId).all()

  // Fetch voucher usage stats per seller
  const { results: voucherStats } = await c.env.DB.prepare(`
    SELECT p.seller_id,
      COUNT(*) AS total_vouchers,
      SUM(CASE WHEN v.status = 'used' THEN 1 ELSE 0 END) AS used_vouchers
    FROM vouchers v
    JOIN products p ON v.product_id = p.id
    JOIN agency_sellers ag ON ag.seller_id = p.seller_id
    WHERE ag.agency_id = ?
    GROUP BY p.seller_id
  `).bind(agencyId).all<{ seller_id: number; total_vouchers: number; used_vouchers: number }>().catch(() => ({ results: [] as any[] }))

  // Fetch group buy participation per seller
  const { results: groupBuyStats } = await c.env.DB.prepare(`
    SELECT p.seller_id,
      COUNT(*) AS total_group_buys,
      SUM(CASE WHEN p.group_buy_status = 'achieved' THEN 1 ELSE 0 END) AS achieved_group_buys
    FROM products p
    JOIN agency_sellers ag ON ag.seller_id = p.seller_id
    WHERE ag.agency_id = ? AND p.category = 'meal_voucher' AND p.group_buy_status IS NOT NULL
    GROUP BY p.seller_id
  `).bind(agencyId).all<{ seller_id: number; total_group_buys: number; achieved_group_buys: number }>().catch(() => ({ results: [] as any[] }))

  const voucherMap: Record<number, { total_vouchers: number; used_vouchers: number }> = {}
  for (const v of (voucherStats || [])) voucherMap[v.seller_id] = v

  const groupBuyMap: Record<number, { total_group_buys: number; achieved_group_buys: number }> = {}
  for (const g of (groupBuyStats || [])) groupBuyMap[g.seller_id] = g

  const enriched = (results || []).map((r: any) => ({
    ...r,
    total_vouchers: voucherMap[r.id]?.total_vouchers ?? 0,
    used_vouchers: voucherMap[r.id]?.used_vouchers ?? 0,
    voucher_usage_rate: voucherMap[r.id]?.total_vouchers
      ? Math.round((voucherMap[r.id].used_vouchers / voucherMap[r.id].total_vouchers) * 100)
      : 0,
    total_group_buys: groupBuyMap[r.id]?.total_group_buys ?? 0,
    achieved_group_buys: groupBuyMap[r.id]?.achieved_group_buys ?? 0,
    group_buy_success_rate: groupBuyMap[r.id]?.total_group_buys
      ? Math.round((groupBuyMap[r.id].achieved_group_buys / groupBuyMap[r.id].total_group_buys) * 100)
      : 0,
  }))

  return c.json({ success: true, data: enriched })
})

// ── 셀러 계약 관리 ──
app.get('/contracts', async (c: AgencyCtx) => {
  const agencyId = c.get('agency').id
  try { await c.env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS agency_contracts (
      id INTEGER PRIMARY KEY AUTOINCREMENT, agency_id INTEGER NOT NULL, seller_id INTEGER NOT NULL,
      start_date TEXT NOT NULL, end_date TEXT NOT NULL, terms TEXT,
      status TEXT DEFAULT 'active', created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(agency_id, seller_id)
    )`).run() } catch {}

  const { results } = await c.env.DB.prepare(`
    SELECT ac.*, s.name AS seller_name, s.email AS seller_email
    FROM agency_contracts ac JOIN sellers s ON ac.seller_id = s.id
    WHERE ac.agency_id = ? ORDER BY ac.end_date ASC
  `).bind(agencyId).all()

  return c.json({ success: true, data: results || [] })
})

app.post('/contracts', async (c: AgencyCtx) => {
  const agencyId = c.get('agency').id
  const { seller_id, start_date, end_date, terms } = await c.req.json<any>()
  if (!seller_id || !start_date || !end_date) return c.json({ success: false, error: '필수 항목을 입력해주세요' }, 400)

  try { await c.env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS agency_contracts (
      id INTEGER PRIMARY KEY AUTOINCREMENT, agency_id INTEGER NOT NULL, seller_id INTEGER NOT NULL,
      start_date TEXT NOT NULL, end_date TEXT NOT NULL, terms TEXT,
      status TEXT DEFAULT 'active', created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(agency_id, seller_id)
    )`).run() } catch {}

  await c.env.DB.prepare(`
    INSERT INTO agency_contracts (agency_id, seller_id, start_date, end_date, terms)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(agency_id, seller_id) DO UPDATE SET start_date = excluded.start_date, end_date = excluded.end_date, terms = excluded.terms, status = 'active'
  `).bind(agencyId, seller_id, start_date, end_date, terms || null).run()

  return c.json({ success: true, message: '계약이 등록되었습니다' })
})

app.put('/contracts/:id', async (c: AgencyCtx) => {
  const agencyId = c.get('agency').id
  const id = c.req.param('id')
  const body = await c.req.json<any>()
  const sets: string[] = []; const vals: any[] = []
  if (body.end_date) { sets.push('end_date = ?'); vals.push(body.end_date) }
  if (body.terms !== undefined) { sets.push('terms = ?'); vals.push(body.terms) }
  if (body.status) { sets.push('status = ?'); vals.push(body.status) }
  if (!sets.length) return c.json({ success: false, error: '변경할 항목이 없습니다' }, 400)
  vals.push(id, agencyId)
  await c.env.DB.prepare(`UPDATE agency_contracts SET ${sets.join(', ')} WHERE id = ? AND agency_id = ?`).bind(...vals).run()
  return c.json({ success: true })
})

export { app as agencyRoutes }
