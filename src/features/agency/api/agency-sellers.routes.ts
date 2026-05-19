/**
 * 🛡️ 2026-04-28 TD-006 (split): Agency Sellers/Orders/Streams Read API (9 endpoints)
 *
 * 원본: agency.routes.ts (558-794).
 *
 * - GET /sellers                     — 소속 셀러 목록
 * - GET /sellers/:id/stats           — 특정 셀러 통계
 * - GET /orders                      — 소속 셀러 주문 목록
 * - GET /streams                     — 소속 셀러 라이브
 * - GET /sellers/:id/products        — 셀러 상품
 * - GET /sellers/:id/inventory       — 셀러 재고
 * - GET /ranking                     — 셀러 랭킹
 * - GET /schedule                    — 라이브 스케줄
 * - GET /returns                     — 반품 통계
 */
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { verify } from 'hono/jwt'
import type { Context, Next } from 'hono'
import type { Env } from '@/worker/types/env'
import { requireAgency, type AgencyVars, type AgencyCtx } from '@/lib/agency-shared'
import { swallow } from '@/worker/utils/swallow'
const app = new Hono<{ Bindings: Env; Variables: AgencyVars }>()
// 🛡️ 2026-05-13: redundant cors() 제거 — worker/index.ts:243 글로벌 cors 가 처리.

app.use('*', requireAgency)

let _agencyTablesEnsured = false
async function ensureAgencyTables(DB: D1Database) {
  if (_done_ensureAgencyTables.has(DB)) return
  _done_ensureAgencyTables.add(DB)
  if (_agencyTablesEnsured) return
  await DB.prepare(`CREATE TABLE IF NOT EXISTS agencies (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, email TEXT)`).run().catch(swallow('agency-sellers'))
  await DB.prepare(`CREATE TABLE IF NOT EXISTS agency_sellers (id INTEGER PRIMARY KEY AUTOINCREMENT, agency_id INTEGER NOT NULL, seller_id INTEGER NOT NULL, UNIQUE(agency_id, seller_id))`).run().catch(swallow('agency-sellers'))
  _agencyTablesEnsured = true
}

app.get('/sellers', async (c) => {
  await ensureAgencyTables(c.env.DB)
  const { id: agencyId } = c.get('agency') as { id: number }

  const sellers = await c.env.DB.prepare(`
    SELECT
      s.id, s.name, s.email, s.business_name, s.phone,
      s.status, s.commission_rate, s.created_at,
      (SELECT COUNT(*) FROM orders o WHERE o.seller_id = s.id) AS total_orders,
      (SELECT COALESCE(SUM(o.total_amount), 0) FROM orders o WHERE o.seller_id = s.id AND o.status IN ('PAID','DONE')) AS total_revenue,
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
      WHERE seller_id = ? AND status IN ('PAID','DONE') AND created_at >= ?
    `).bind(sellerId, since).first<{ order_count: number; revenue: number; net_revenue: number }>(),
    c.env.DB.prepare(`
      SELECT COUNT(*) AS stream_count, COALESCE(SUM(current_viewers), 0) AS total_viewers
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

// 🛡️ 2026-04-28 TD-006 (split): /stats* 5개 엔드포인트 →
//   src/features/agency/api/agency-stats.routes.ts (worker/index.ts 에서 별도 mount)

// ── GET /orders ───────────────────────────────────────────────
app.get('/orders', async (c) => {
  await ensureAgencyTables(c.env.DB)
  const { id: agencyId } = c.get('agency') as { id: number }
  const page = Math.max(1, Number(c.req.query('page') || 1))
  const limit = Math.min(Math.max(1, Number(c.req.query('limit') || 20)), 100)
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
    SELECT ls.id, ls.title, ls.status, ls.current_viewers, ls.scheduled_at, ls.created_at, ls.seller_id,
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
// 🛡️ 2026-04-28 TD-006 (split): /settlements*, /settlement-invoices* →
//   src/features/agency/api/agency-settlements.routes.ts

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
        (SELECT COUNT(*) FROM orders o WHERE o.seller_id = s.id AND o.status IN ('PAID','DONE')) AS total_orders,
        (SELECT COALESCE(SUM(o.total_amount), 0) FROM orders o WHERE o.seller_id = s.id AND o.status IN ('PAID','DONE')) AS total_revenue,
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

export { app as agencySellersRoutes }


// 🛡️ 2026-05-19: ensure* per-worker 메모이제이션 (파일 끝).
const _done_ensureAgencyTables = new WeakSet<object>()
