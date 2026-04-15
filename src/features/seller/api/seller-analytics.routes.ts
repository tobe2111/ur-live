/**
 * Seller Analytics & Tools API
 * - 매출 차트 데이터
 * - 고객 분석
 * - 상품 성과
 * - 리뷰 관리
 * - 배송 일괄 처리
 * - 쿠폰 관리
 */
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { requireAuth, getCurrentUser } from '@/worker/middleware/auth'
import type { Env } from '@/worker/types/env'
import { ALLOWED_ORIGINS } from '@/shared/constants'

export const sellerAnalyticsRoutes = new Hono<{ Bindings: Env }>()
sellerAnalyticsRoutes.use('*', cors({ origin: [...ALLOWED_ORIGINS], credentials: true }))

async function getSellerId(c: any): Promise<number | null> {
  const user = getCurrentUser(c)
  if (!user) return null
  const seller = await c.env.DB.prepare('SELECT id FROM sellers WHERE user_id = ?').bind(String(user.id)).first() as { id: number } | null
  return seller?.id ?? null
}

// ── 매출 차트: 일별 매출 데이터 ──
sellerAnalyticsRoutes.get('/chart/revenue', requireAuth(), async (c) => {
  const sellerId = await getSellerId(c)
  if (!sellerId) return c.json({ success: false, error: '셀러 정보 없음' }, 403)
  const days = Number(c.req.query('days') || 30)

  const { results } = await c.env.DB.prepare(`
    SELECT date(created_at) AS date,
      COUNT(*) AS orders,
      COALESCE(SUM(CASE WHEN status NOT IN ('CANCELLED','FAILED','REFUNDED') THEN total_amount END), 0) AS revenue
    FROM orders WHERE seller_id = ? AND created_at > datetime('now', '-' || ? || ' days')
    GROUP BY date(created_at) ORDER BY date
  `).bind(sellerId, days).all()

  return c.json({ success: true, data: results || [] })
})

// ── 고객 분석 ──
sellerAnalyticsRoutes.get('/customers', requireAuth(), async (c) => {
  const sellerId = await getSellerId(c)
  if (!sellerId) return c.json({ success: false, error: '셀러 정보 없음' }, 403)

  const total = await c.env.DB.prepare(`
    SELECT COUNT(DISTINCT user_id) AS total_customers,
      COUNT(DISTINCT CASE WHEN cnt > 1 THEN user_id END) AS repeat_customers
    FROM (SELECT user_id, COUNT(*) AS cnt FROM orders WHERE seller_id = ? AND status NOT IN ('CANCELLED','FAILED') GROUP BY user_id)
  `).bind(sellerId).first<{ total_customers: number; repeat_customers: number }>()

  const recent = await c.env.DB.prepare(`
    SELECT user_id, MAX(shipping_name) AS name, COUNT(*) AS order_count,
      SUM(CASE WHEN status NOT IN ('CANCELLED','FAILED','REFUNDED') THEN total_amount ELSE 0 END) AS total_spent,
      MAX(created_at) AS last_order
    FROM orders WHERE seller_id = ? AND status NOT IN ('CANCELLED','FAILED')
    GROUP BY user_id ORDER BY total_spent DESC LIMIT 20
  `).bind(sellerId).all()

  return c.json({ success: true, data: { total_customers: total?.total_customers || 0, repeat_customers: total?.repeat_customers || 0, top_customers: recent?.results || [] } })
})

// ── 상품 성과 분석 ──
sellerAnalyticsRoutes.get('/products/performance', requireAuth(), async (c) => {
  const sellerId = await getSellerId(c)
  if (!sellerId) return c.json({ success: false, error: '셀러 정보 없음' }, 403)

  const { results } = await c.env.DB.prepare(`
    SELECT p.id, p.name, p.price, COALESCE(p.stock, 0) AS stock,
      COUNT(DISTINCT oi.order_id) AS order_count,
      COALESCE(SUM(oi.quantity), 0) AS sold_count,
      COALESCE(SUM(oi.quantity * oi.unit_price), 0) AS revenue,
      COALESCE(AVG(r.rating), 0) AS avg_rating,
      COUNT(DISTINCT r.id) AS review_count
    FROM products p
    LEFT JOIN order_items oi ON oi.product_id = p.id
    LEFT JOIN orders o ON o.id = oi.order_id AND o.status NOT IN ('CANCELLED','FAILED','REFUNDED')
    LEFT JOIN reviews r ON r.product_id = p.id
    WHERE p.seller_id = ? AND COALESCE(p.status, 'ACTIVE') != 'DELETED'
    GROUP BY p.id ORDER BY revenue DESC
  `).bind(sellerId).all()

  return c.json({ success: true, data: results || [] })
})

// ── 리뷰 관리 (받은 리뷰 + 답글) ──
sellerAnalyticsRoutes.get('/reviews', requireAuth(), async (c) => {
  const sellerId = await getSellerId(c)
  if (!sellerId) return c.json({ success: false, error: '셀러 정보 없음' }, 403)

  const { results } = await c.env.DB.prepare(`
    SELECT r.id, r.product_id, r.rating, r.content, r.image_urls, r.created_at,
      r.seller_reply, r.seller_reply_at,
      p.name AS product_name, u.display_name AS user_name
    FROM reviews r
    JOIN products p ON r.product_id = p.id
    LEFT JOIN users u ON r.user_id = u.id
    WHERE p.seller_id = ?
    ORDER BY r.created_at DESC LIMIT 50
  `).bind(sellerId).all()

  return c.json({ success: true, data: results || [] })
})

sellerAnalyticsRoutes.post('/reviews/:id/reply', requireAuth(), async (c) => {
  const sellerId = await getSellerId(c)
  if (!sellerId) return c.json({ success: false, error: '셀러 정보 없음' }, 403)
  const reviewId = c.req.param('id')
  const { reply } = await c.req.json<{ reply: string }>()
  if (!reply?.trim()) return c.json({ success: false, error: '답글 내용을 입력해주세요' }, 400)

  try { await c.env.DB.prepare("ALTER TABLE reviews ADD COLUMN seller_reply TEXT").run() } catch {}
  try { await c.env.DB.prepare("ALTER TABLE reviews ADD COLUMN seller_reply_at DATETIME").run() } catch {}

  await c.env.DB.prepare(`
    UPDATE reviews SET seller_reply = ?, seller_reply_at = datetime('now')
    WHERE id = ? AND product_id IN (SELECT id FROM products WHERE seller_id = ?)
  `).bind(reply.trim(), reviewId, sellerId).run()

  return c.json({ success: true })
})

// ── 배송 일괄 처리 ──
sellerAnalyticsRoutes.post('/orders/bulk-tracking', requireAuth(), async (c) => {
  const sellerId = await getSellerId(c)
  if (!sellerId) return c.json({ success: false, error: '셀러 정보 없음' }, 403)
  const { items } = await c.req.json<{ items: { order_id: number; courier: string; tracking_number: string }[] }>()
  if (!items?.length) return c.json({ success: false, error: '데이터가 없습니다' }, 400)

  let updated = 0
  for (const item of items) {
    if (!item.tracking_number) continue
    const { meta } = await c.env.DB.prepare(`
      UPDATE orders SET tracking_number = ?, courier = ?, status = 'SHIPPING', updated_at = datetime('now')
      WHERE id = ? AND seller_id = ? AND status IN ('PAID', 'DONE')
    `).bind(item.tracking_number, item.courier || null, item.order_id, sellerId).run()
    updated += meta.changes ?? 0
  }

  return c.json({ success: true, message: `${updated}건 송장 등록 완료` })
})

// ── 셀러 쿠폰 관리 ──
sellerAnalyticsRoutes.get('/coupons', requireAuth(), async (c) => {
  const sellerId = await getSellerId(c)
  if (!sellerId) return c.json({ success: false, error: '셀러 정보 없음' }, 403)

  try { await c.env.DB.prepare("ALTER TABLE coupons ADD COLUMN seller_id INTEGER").run() } catch {}

  const { results } = await c.env.DB.prepare(`
    SELECT * FROM coupons WHERE seller_id = ? ORDER BY created_at DESC
  `).bind(sellerId).all()

  return c.json({ success: true, data: results || [] })
})

sellerAnalyticsRoutes.post('/coupons', requireAuth(), async (c) => {
  const sellerId = await getSellerId(c)
  if (!sellerId) return c.json({ success: false, error: '셀러 정보 없음' }, 403)
  const { code, name, type, value, min_order, max_discount, total_count, expires_at } = await c.req.json<any>()
  if (!code || !name) return c.json({ success: false, error: '코드와 이름을 입력해주세요' }, 400)

  try { await c.env.DB.prepare("ALTER TABLE coupons ADD COLUMN seller_id INTEGER").run() } catch {}

  await c.env.DB.prepare(`
    INSERT INTO coupons (code, name, type, value, min_order_amount, max_discount, total_count, used_count, seller_id, is_active, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, 1, ?, datetime('now'))
  `).bind(code, name, type || 'fixed', value || 0, min_order || 0, max_discount || null, total_count || 100, sellerId, expires_at || null).run()

  return c.json({ success: true, message: '쿠폰이 생성되었습니다' })
})

sellerAnalyticsRoutes.delete('/coupons/:id', requireAuth(), async (c) => {
  const sellerId = await getSellerId(c)
  if (!sellerId) return c.json({ success: false, error: '셀러 정보 없음' }, 403)
  const id = c.req.param('id')
  await c.env.DB.prepare('UPDATE coupons SET is_active = 0 WHERE id = ? AND seller_id = ?').bind(id, sellerId).run()
  return c.json({ success: true })
})

// ── 상품 복제 ──
sellerAnalyticsRoutes.post('/products/:id/duplicate', requireAuth(), async (c) => {
  const sellerId = await getSellerId(c)
  if (!sellerId) return c.json({ success: false, error: '셀러 정보 없음' }, 403)
  const id = c.req.param('id')

  const product = await c.env.DB.prepare(
    'SELECT name, description, price, original_price, stock, image_url, category, product_type FROM products WHERE id = ? AND seller_id = ?'
  ).bind(id, sellerId).first<any>()

  if (!product) return c.json({ success: false, error: '상품을 찾을 수 없습니다' }, 404)

  const result = await c.env.DB.prepare(`
    INSERT INTO products (seller_id, name, description, price, original_price, stock, image_url, category, product_type, status, is_active, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', 1, datetime('now'), datetime('now'))
  `).bind(
    sellerId, `${product.name} (복사)`, product.description, product.price,
    product.original_price, product.stock || 0, product.image_url,
    product.category, product.product_type
  ).run()

  return c.json({ success: true, data: { id: result.meta.last_row_id }, message: '상품이 복제되었습니다' })
})
