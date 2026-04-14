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
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run().catch(() => {})

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
app.post('/login', cors(), async (c) => {
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
    SELECT ls.id, ls.title, ls.status, ls.viewer_count, ls.started_at, ls.seller_id,
           s.business_name AS seller_business_name, s.name AS seller_name
    FROM live_streams ls
    INNER JOIN agency_sellers ag ON ag.seller_id = ls.seller_id
    LEFT JOIN sellers s ON s.id = ls.seller_id
    WHERE ag.agency_id = ?
    ORDER BY ls.started_at DESC LIMIT 50
  `).bind(agencyId).all()

  return c.json({ success: true, data: streams.results })
})

// ── GET /settlements — 소속 셀러 정산 통합 ──────────────────────
app.get('/settlements', async (c) => {
  await ensureAgencyTables(c.env.DB)
  const { id: agencyId } = c.get('agency') as { id: number }

  try {
    const { results } = await c.env.DB.prepare(`
      SELECT o.id, o.order_number, o.total_amount, o.seller_id,
             s.name AS seller_name, s.business_name,
             COALESCE(s.commission_rate, 5) AS commission_rate,
             COALESCE(o.settlement_status, 'pending') AS settlement_status,
             o.created_at
      FROM orders o
      INNER JOIN agency_sellers ag ON ag.seller_id = o.seller_id
      LEFT JOIN sellers s ON s.id = o.seller_id
      WHERE ag.agency_id = ? AND o.status IN ('delivered', 'DONE')
      ORDER BY o.created_at DESC LIMIT 100
    `).bind(agencyId).all()

    const summary = {
      total: results?.length || 0,
      pending: results?.filter((r: any) => r.settlement_status === 'pending').length || 0,
      confirmed: results?.filter((r: any) => r.settlement_status === 'confirmed').length || 0,
      completed: results?.filter((r: any) => r.settlement_status === 'completed').length || 0,
      total_amount: results?.reduce((s: number, r: any) => s + (r.total_amount || 0), 0) || 0,
    }

    return c.json({ success: true, data: results, summary })
  } catch (err: any) {
    return c.json({ success: true, data: [], summary: { total: 0, pending: 0, confirmed: 0, completed: 0, total_amount: 0 } })
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

export { app as agencyRoutes }
