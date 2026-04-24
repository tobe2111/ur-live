/**
 * Agency Sellers Management Routes (인증 필요)
 *
 *   GET  /api/agency/sellers                      - 소속 셀러 목록
 *   GET  /api/agency/sellers/compare              - 셀러 성과 비교
 *   GET  /api/agency/sellers/:id/stats            - 특정 셀러 통계
 *   GET  /api/agency/sellers/:id/products         - 셀러 상품 조회
 *   POST /api/agency/sellers/:id/products         - 셀러 대신 상품 등록
 *   PUT  /api/agency/sellers/:id/products/:pid    - 셀러 대신 상품 수정
 *   GET  /api/agency/sellers/:id/inventory        - 셀러 재고 현황
 *   POST /api/agency/sellers/:id/streams          - 셀러 대신 방송 예약
 *   POST /api/agency/invite-seller                - 셀러 초대/생성
 *   GET  /api/agency/ranking                      - 셀러 성과 랭킹
 */

import { rateLimit } from '@/worker/middleware/rate-limit'
import { hashPassword, validatePasswordComplexity } from '@/lib/password'
import { createAgencyApp, ensureAgencyTables, requireAgency } from './agency-shared'

const app = createAgencyApp()
app.use('*', requireAgency as any)

// ── GET /sellers ──────────────────────────────────────────────
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

// ── GET /sellers/compare — 셀러 성과 비교 ──
// NOTE: must be registered BEFORE /sellers/:id to avoid path collision
app.get('/sellers/compare', async (c) => {
  const agencyId = (c.get('agency') as { id: number }).id
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

// ── POST /sellers/:id/products — 셀러 대신 상품 등록 ──────────────
// 🛡️ 2026-04-22 배치 147: 입력 검증 강화 (음수/상한 체크 누락 버그 fix)
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

  if (!body.name || body.price === undefined) return c.json({ success: false, error: '상품명과 가격은 필수입니다.' }, 400)
  // 🛡️ 입력 검증 — 길이/범위 (타 엔드포인트와 일관된 정책)
  if (typeof body.name !== 'string' || body.name.length < 1 || body.name.length > 200) {
    return c.json({ success: false, error: '상품명은 1~200자여야 합니다.' }, 400)
  }
  const priceNum = Number(body.price)
  if (!Number.isFinite(priceNum) || priceNum < 0 || priceNum > 100_000_000) {
    return c.json({ success: false, error: '가격은 0~1억원 사이여야 합니다.' }, 400)
  }
  const originalPrice = body.original_price === undefined ? priceNum : Number(body.original_price)
  if (!Number.isFinite(originalPrice) || originalPrice < 0 || originalPrice > 100_000_000) {
    return c.json({ success: false, error: '정가는 0~1억원 사이여야 합니다.' }, 400)
  }
  const stockNum = body.stock === undefined ? 100 : Number(body.stock)
  if (!Number.isFinite(stockNum) || stockNum < 0 || stockNum > 1_000_000) {
    return c.json({ success: false, error: '재고는 0~100만 사이여야 합니다.' }, 400)
  }

  const result = await c.env.DB.prepare(`
    INSERT INTO products (seller_id, name, description, price, original_price, stock, image_url, category, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'), datetime('now'))
  `).bind(sellerId, body.name, body.description || null, priceNum, originalPrice,
    stockNum, body.image_url || null, body.category || 'general').run()

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

  // 🛡️ 2026-04-22 배치 147: 입력 검증 추가
  if (body.name !== undefined && (typeof body.name !== 'string' || body.name.length < 1 || body.name.length > 200)) {
    return c.json({ success: false, error: '상품명은 1~200자여야 합니다.' }, 400)
  }
  if (body.price !== undefined) {
    const n = Number(body.price)
    if (!Number.isFinite(n) || n < 0 || n > 100_000_000) return c.json({ success: false, error: '가격은 0~1억원 사이여야 합니다.' }, 400)
  }
  if (body.original_price !== undefined) {
    const n = Number(body.original_price)
    if (!Number.isFinite(n) || n < 0 || n > 100_000_000) return c.json({ success: false, error: '정가는 0~1억원 사이여야 합니다.' }, 400)
  }
  if (body.stock !== undefined) {
    const n = Number(body.stock)
    if (!Number.isFinite(n) || n < 0 || n > 1_000_000) return c.json({ success: false, error: '재고는 0~100만 사이여야 합니다.' }, 400)
  }

  const updates: string[] = ["updated_at = datetime('now')"]
  const params: unknown[] = []
  if (body.name) { updates.push('name = ?'); params.push(body.name) }
  if (body.description !== undefined) { updates.push('description = ?'); params.push(body.description) }
  if (body.price !== undefined) { updates.push('price = ?'); params.push(Number(body.price)) }
  if (body.original_price !== undefined) { updates.push('original_price = ?'); params.push(Number(body.original_price)) }
  if (body.stock !== undefined) { updates.push('stock = ?'); params.push(Number(body.stock)) }
  if (body.image_url !== undefined) { updates.push('image_url = ?'); params.push(body.image_url) }
  if (body.is_active !== undefined) { updates.push('is_active = ?'); params.push(body.is_active ? 1 : 0) }

  params.push(productId)
  await c.env.DB.prepare(`UPDATE products SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run()

  return c.json({ success: true })
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
// 🛡️ 2026-04-22 배치 147: rate limit + 비밀번호 복잡도 검증 추가
app.post('/invite-seller', rateLimit({ action: 'agency_invite_seller', max: 20, windowSec: 3600 }), async (c) => {
  await ensureAgencyTables(c.env.DB)
  const { id: agencyId } = c.get('agency') as { id: number }

  const { name, email, password, business_name, phone } = await c.req.json<{
    name: string; email: string; password: string; business_name?: string; phone?: string;
  }>()

  if (!name || !email || !password) return c.json({ success: false, error: '이름, 이메일, 비밀번호는 필수입니다.' }, 400)
  // 🛡️ 입력 검증
  if (typeof name !== 'string' || name.length < 1 || name.length > 50) {
    return c.json({ success: false, error: '셀러명은 1~50자여야 합니다.' }, 400)
  }
  if (typeof email !== 'string' || email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return c.json({ success: false, error: '유효한 이메일을 입력해주세요.' }, 400)
  }
  const pwCheck = validatePasswordComplexity(password)
  if (!pwCheck.ok) {
    return c.json({ success: false, error: pwCheck.error }, 400)
  }

  // 이미 존재하는 이메일 확인
  const existing = await c.env.DB.prepare('SELECT id FROM sellers WHERE email = ?').bind(email).first()
  if (existing) return c.json({ success: false, error: '이미 사용 중인 이메일입니다.' }, 409)

  const hash = await hashPassword(password)

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

export { app as agencySellersRoutes }
