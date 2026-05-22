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
import { requireAuth, getCurrentUser } from '@/worker/middleware/auth'
import { safeError } from '@/worker/utils/safe-error';
import type { Env } from '@/worker/types/env'
export const sellerAnalyticsRoutes = new Hono<{ Bindings: Env }>()
// 🛡️ 2026-05-13: redundant cors() 제거 — worker/index.ts:243 글로벌 cors 가 처리.
//   서브라우터 wildcard 미들웨어가 같은 prefix 의 다른 라우터 경로 가로채는 버그 (Hono v4) 방지.

async function getSellerId(c: any): Promise<number | null> {
  const user = getCurrentUser(c)
  if (!user) return null
  // 🛡️ 2026-04-22: user.type === 'seller' (또는 admin) 확인 — 이전엔 user 타입도
  // id 가 sellers 테이블에 존재하면 통과 → 다른 셀러 매출/고객 데이터 열람 가능.
  if (user.type !== 'seller' && user.type !== 'admin') return null
  const seller = await c.env.DB.prepare('SELECT id FROM sellers WHERE id = ?').bind(String(user.id)).first() as { id: number } | null
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
    WHERE p.seller_id = ? AND COALESCE(p.is_active, 1) = 1
    GROUP BY p.id ORDER BY revenue DESC
  `).bind(sellerId).all()

  return c.json({ success: true, data: results || [] })
})

// ── 리뷰 관리 (받은 리뷰 + 답글) ──
// 🛡️ 2026-05-20: 테이블 = product_reviews (migration 0132), 컬럼 = images (image_urls 아님).
//   seller_reply / seller_reply_at 은 답글 POST 시 ALTER 로 동적 추가 → SELECT 시 IIF/COALESCE 로 안전 조회.
sellerAnalyticsRoutes.get('/reviews', requireAuth(), async (c) => {
  try {
    const sellerId = await getSellerId(c)
    if (!sellerId) return c.json({ success: false, error: '셀러 정보 없음' }, 403)

    // seller_reply 컬럼이 없는 환경 (답글 미시도) 도 대비 — 두 단계 fallback.
    let results: unknown[] = []
    try {
      const r = await c.env.DB.prepare(`
        SELECT r.id, r.product_id, r.rating, r.content, r.images, r.created_at,
          r.seller_reply, r.seller_reply_at,
          p.name AS product_name, u.name AS user_name
        FROM product_reviews r
        JOIN products p ON r.product_id = p.id
        LEFT JOIN users u ON r.user_id = u.id
        WHERE p.seller_id = ?
        ORDER BY r.created_at DESC LIMIT 50
      `).bind(sellerId).all()
      results = r.results || []
    } catch {
      const r = await c.env.DB.prepare(`
        SELECT r.id, r.product_id, r.rating, r.content, r.images, r.created_at,
          NULL AS seller_reply, NULL AS seller_reply_at,
          p.name AS product_name, u.name AS user_name
        FROM product_reviews r
        JOIN products p ON r.product_id = p.id
        LEFT JOIN users u ON r.user_id = u.id
        WHERE p.seller_id = ?
        ORDER BY r.created_at DESC LIMIT 50
      `).bind(sellerId).all()
      results = r.results || []
    }

    return c.json({ success: true, data: results })
  } catch (err) {
    if (import.meta.env.DEV) console.error('[seller-analytics] /reviews error:', err)
    return c.json({ success: false, error: '리뷰 조회 실패' }, 500)
  }
})

sellerAnalyticsRoutes.post('/reviews/:id/reply', requireAuth(), async (c) => {
  const sellerId = await getSellerId(c)
  if (!sellerId) return c.json({ success: false, error: '셀러 정보 없음' }, 403)
  const reviewId = c.req.param('id')
  const { reply } = await c.req.json<{ reply: string }>()
  if (!reply?.trim()) return c.json({ success: false, error: '답글 내용을 입력해주세요' }, 400)

  // 🛡️ 2026-05-20: 테이블명 product_reviews (migration 0132). 'reviews' 는 존재 안 함.
  try { await c.env.DB.prepare("ALTER TABLE product_reviews ADD COLUMN seller_reply TEXT").run() } catch { /* exists */ }
  try { await c.env.DB.prepare("ALTER TABLE product_reviews ADD COLUMN seller_reply_at DATETIME").run() } catch { /* exists */ }

  await c.env.DB.prepare(`
    UPDATE product_reviews SET seller_reply = ?, seller_reply_at = datetime('now')
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

  const stmts = items
    .filter(item => item.tracking_number)
    .map(item =>
      c.env.DB.prepare(`
        UPDATE orders SET tracking_number = ?, courier = ?, status = 'SHIPPING', updated_at = datetime('now')
        WHERE id = ? AND seller_id = ? AND status IN ('PAID', 'DONE')
      `).bind(item.tracking_number, item.courier || null, item.order_id, sellerId)
    )
  if (!stmts.length) return c.json({ success: true, message: '0건 송장 등록 완료' })
  const batchResults = await c.env.DB.batch(stmts)
  const updated = batchResults.reduce((acc, r) => acc + (r.meta?.changes ?? 0), 0)

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

// ── 재방문 분석 ──
sellerAnalyticsRoutes.get('/revisit', requireAuth(), async (c) => {
  const sellerId = await getSellerId(c)
  if (!sellerId) return c.json({ success: false, error: '셀러 정보 없음' }, 403)

  const totalRow = await c.env.DB.prepare(
    "SELECT COUNT(DISTINCT user_id) AS total_customers FROM orders WHERE seller_id = ? AND status NOT IN ('CANCELLED','FAILED')"
  ).bind(sellerId).first<{ total_customers: number }>()

  const repeatRow = await c.env.DB.prepare(`
    SELECT COUNT(*) AS repeat_customers FROM (
      SELECT user_id FROM orders WHERE seller_id = ? AND status NOT IN ('CANCELLED','FAILED')
      GROUP BY user_id HAVING COUNT(*) > 1
    )
  `).bind(sellerId).first<{ repeat_customers: number }>()

  const avgDaysRow = await c.env.DB.prepare(`
    SELECT AVG(day_gap) AS avg_revisit_days FROM (
      SELECT user_id,
        julianday(created_at) - julianday(LAG(created_at) OVER (PARTITION BY user_id ORDER BY created_at)) AS day_gap
      FROM orders WHERE seller_id = ? AND status NOT IN ('CANCELLED','FAILED')
    ) WHERE day_gap IS NOT NULL
  `).bind(sellerId).first<{ avg_revisit_days: number | null }>()

  const { results: topCustomers } = await c.env.DB.prepare(`
    SELECT user_id, MAX(shipping_name) AS name, COUNT(*) AS order_count,
      SUM(CASE WHEN status NOT IN ('CANCELLED','FAILED','REFUNDED') THEN total_amount ELSE 0 END) AS total_spent,
      MIN(created_at) AS first_order, MAX(created_at) AS last_order
    FROM orders WHERE seller_id = ? AND status NOT IN ('CANCELLED','FAILED')
    GROUP BY user_id HAVING COUNT(*) > 1
    ORDER BY order_count DESC LIMIT 10
  `).bind(sellerId).all()

  const total = totalRow?.total_customers ?? 0
  const repeat = repeatRow?.repeat_customers ?? 0

  return c.json({
    success: true,
    data: {
      total_customers: total,
      repeat_customers: repeat,
      revisit_rate_percent: total > 0 ? Math.round((repeat / total) * 10000) / 100 : 0,
      avg_revisit_days: avgDaysRow?.avg_revisit_days != null ? Math.round(avgDaysRow.avg_revisit_days * 10) / 10 : null,
      top_customers: topCustomers || [],
    },
  })
})

// ── 바우처 사용 통계 ──
sellerAnalyticsRoutes.get('/voucher-usage', requireAuth(), async (c) => {
  const sellerId = await getSellerId(c)
  if (!sellerId) return c.json({ success: false, error: '셀러 정보 없음' }, 403)

  const stats = await c.env.DB.prepare(`
    SELECT
      COUNT(*) AS total_vouchers,
      SUM(CASE WHEN v.status = 'used' THEN 1 ELSE 0 END) AS used_count,
      SUM(CASE WHEN v.status = 'expired' THEN 1 ELSE 0 END) AS expired_count,
      SUM(CASE WHEN v.status = 'unused' THEN 1 ELSE 0 END) AS unused_count,
      SUM(CASE WHEN v.status = 'refunded' THEN 1 ELSE 0 END) AS refunded_count
    FROM vouchers v
    JOIN products p ON v.product_id = p.id
    WHERE p.seller_id = ?
  `).bind(sellerId).first<{
    total_vouchers: number
    used_count: number
    expired_count: number
    unused_count: number
    refunded_count: number
  }>()

  const total = stats?.total_vouchers ?? 0
  const used = stats?.used_count ?? 0

  const { results: byProduct } = await c.env.DB.prepare(`
    SELECT p.id AS product_id, p.name AS product_name,
      COUNT(*) AS total_vouchers,
      SUM(CASE WHEN v.status = 'used' THEN 1 ELSE 0 END) AS used_count,
      SUM(CASE WHEN v.status = 'unused' THEN 1 ELSE 0 END) AS unused_count,
      SUM(CASE WHEN v.status = 'expired' THEN 1 ELSE 0 END) AS expired_count
    FROM vouchers v
    JOIN products p ON v.product_id = p.id
    WHERE p.seller_id = ?
    GROUP BY p.id, p.name
    ORDER BY total_vouchers DESC
  `).bind(sellerId).all()

  return c.json({
    success: true,
    data: {
      total_vouchers: total,
      used_count: used,
      expired_count: stats?.expired_count ?? 0,
      unused_count: stats?.unused_count ?? 0,
      refunded_count: stats?.refunded_count ?? 0,
      usage_rate_percent: total > 0 ? Math.round((used / total) * 10000) / 100 : 0,
      by_product: byProduct || [],
    },
  })
})

// ── 상세 분석 (전환율, 재구매율 등) ──
sellerAnalyticsRoutes.get('/detailed', requireAuth(), async (c) => {
  const sellerId = await getSellerId(c)
  if (!sellerId) return c.json({ success: false, error: '셀러 정보 없음' }, 403)

  try {
    // 재구매율: 2회 이상 주���한 고�� 비율
    const repeatStats = await c.env.DB.prepare(`
      SELECT
        COUNT(DISTINCT user_id) AS total_buyers,
        COUNT(DISTINCT CASE WHEN cnt > 1 THEN user_id END) AS repeat_buyers
      FROM (
        SELECT user_id, COUNT(*) AS cnt
        FROM orders
        WHERE seller_id = ? AND status NOT IN ('CANCELLED','FAILED')
        GROUP BY user_id
      )
    `).bind(sellerId).first<{ total_buyers: number; repeat_buyers: number }>()

    // 전환율: 주문 수 / 조회 수 (product_views 테이블이 있으면 사용)
    let conversionRate = 0
    try {
      const viewStats = await c.env.DB.prepare(`
        SELECT
          COALESCE(SUM(v.view_count), 0) AS total_views,
          (SELECT COUNT(*) FROM orders WHERE seller_id = ? AND status NOT IN ('CANCELLED','FAILED')) AS total_orders
        FROM product_views v
        JOIN products p ON v.product_id = p.id
        WHERE p.seller_id = ?
      `).bind(sellerId, sellerId).first<{ total_views: number; total_orders: number }>()
      if (viewStats && viewStats.total_views > 0) {
        conversionRate = Math.round((viewStats.total_orders / viewStats.total_views) * 10000) / 100
      }
    } catch {
      // product_views 테��블이 없는 경우: 고객 수 기반 추정
      const orderStats = await c.env.DB.prepare(`
        SELECT COUNT(*) AS total_orders, COUNT(DISTINCT user_id) AS unique_buyers
        FROM orders WHERE seller_id = ? AND status NOT IN ('CANCELLED','FAILED')
      `).bind(sellerId).first<{ total_orders: number; unique_buyers: number }>()
      if (orderStats && orderStats.unique_buyers > 0) {
        conversionRate = Math.round((orderStats.total_orders / orderStats.unique_buyers) * 100) / 100
      }
    }

    return c.json({
      success: true,
      data: {
        total_buyers: repeatStats?.total_buyers || 0,
        repeat_buyers: repeatStats?.repeat_buyers || 0,
        repeat_purchase_rate: repeatStats && repeatStats.total_buyers > 0
          ? Math.round((repeatStats.repeat_buyers / repeatStats.total_buyers) * 100)
          : 0,
        conversion_rate: conversionRate,
      }
    })
  } catch (err: any) {
    return c.json({ success: false, error: err?.message || 'Failed to load detailed analytics' }, 500)
  }
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

// 🛡️ 2026-05-21 Phase TD-8: 매장 사장님 종합 통계 — 본인 매장 전체 매출/voucher/정산.
sellerAnalyticsRoutes.get('/store-dashboard/stats', requireAuth(), async (c) => {
  const sellerId = await getSellerId(c)
  if (!sellerId) return c.json({ success: false, error: '셀러 정보 없음' }, 403)
  try {
    // 상품 수
    const products = await c.env.DB.prepare(
      `SELECT COUNT(*) as total, SUM(CASE WHEN COALESCE(is_active, 1) = 1 THEN 1 ELSE 0 END) as active FROM products WHERE seller_id = ?`,
    ).bind(sellerId).first<{ total: number; active: number }>().catch(() => ({ total: 0, active: 0 }))

    // Voucher 통계
    const vouchers = await c.env.DB.prepare(
      `SELECT
         COUNT(*) as total,
         SUM(CASE WHEN status = 'used' THEN 1 ELSE 0 END) as used,
         SUM(CASE WHEN status = 'unused' THEN 1 ELSE 0 END) as unused,
         SUM(CASE WHEN status = 'refunded' THEN 1 ELSE 0 END) as refunded
       FROM vouchers v
       INNER JOIN products p ON p.id = v.product_id
       WHERE p.seller_id = ?`,
    ).bind(sellerId).first<{ total: number; used: number; unused: number; refunded: number }>().catch(() => ({ total: 0, used: 0, unused: 0, refunded: 0 }))

    // 매출 합산 (ledger 기준 — merchant credit)
    const revenue = await c.env.DB.prepare(
      `SELECT
         COALESCE(SUM(amount), 0) as total,
         COALESCE(SUM(CASE WHEN created_at >= datetime('now', 'start of month') THEN amount ELSE 0 END), 0) as this_month
       FROM ledger_entries
       WHERE credit_account = ? AND event_type = 'voucher_used'`,
    ).bind(`merchant:${sellerId}`).first<{ total: number; this_month: number }>().catch(() => ({ total: 0, this_month: 0 }))

    // 미정산 잔액 (credit - paid)
    const paid = await c.env.DB.prepare(
      `SELECT COALESCE(SUM(amount), 0) as total FROM payouts
        WHERE payee_id = ? AND payee_type IN ('store_owner','seller') AND status IN ('approved','sent')`,
    ).bind(String(sellerId)).first<{ total: number }>().catch(() => ({ total: 0 }))

    return c.json({
      success: true,
      data: {
        total_products: Number(products?.total ?? 0),
        active_products: Number(products?.active ?? 0),
        total_vouchers_sold: Number(vouchers?.total ?? 0),
        vouchers_used: Number(vouchers?.used ?? 0),
        vouchers_unused: Number(vouchers?.unused ?? 0),
        vouchers_refunded: Number(vouchers?.refunded ?? 0),
        revenue_total: Number(revenue?.total ?? 0),
        revenue_this_month: Number(revenue?.this_month ?? 0),
        pending_payout: Math.max(0, Number(revenue?.total ?? 0) - Number(paid?.total ?? 0)),
      },
    })
  } catch (e) {
    return safeError(c, e, '요청 처리 중 오류가 발생했습니다', '[seller-analytics]')
  }
})

// 🛡️ 2026-05-21: 월별 상품 등록 추이 — 신규 입점 가게/상품 트렌드 (최근 12개월).
sellerAnalyticsRoutes.get('/products/monthly-trend', requireAuth(), async (c) => {
  const sellerId = await getSellerId(c)
  if (!sellerId) return c.json({ success: false, error: '셀러 정보 없음' }, 403)
  const { results } = await c.env.DB.prepare(`
    SELECT strftime('%Y-%m', created_at) AS month,
           COUNT(*) AS new_products,
           COUNT(CASE WHEN category IN ('meal_voucher','beauty_voucher','stay_voucher','etc_voucher','health_voucher','pet_voucher','activity_voucher') THEN 1 END) AS new_vouchers
      FROM products
     WHERE seller_id = ?
       AND created_at >= datetime('now', '-12 months')
     GROUP BY month
     ORDER BY month ASC
  `).bind(sellerId).all().catch(() => ({ results: [] }))
  return c.json({ success: true, data: results || [] })
})

// 🛡️ 2026-05-21: 내가 받은 추천 commission (셀러 본인이 referrer 인 경우 — 인플루언서 추천).
sellerAnalyticsRoutes.get('/referral-commissions/summary', requireAuth(), async (c) => {
  const sellerId = await getSellerId(c)
  if (!sellerId) return c.json({ success: false, error: '셀러 정보 없음' }, 403)
  try {
    const summary = await c.env.DB.prepare(`
      SELECT
        COALESCE(SUM(CASE WHEN status = 'granted' THEN commission_amount ELSE 0 END), 0) AS total_granted,
        COALESCE(SUM(CASE WHEN status = 'pending' THEN commission_amount ELSE 0 END), 0) AS total_pending,
        COALESCE(SUM(CASE WHEN status = 'paid_out' THEN commission_amount ELSE 0 END), 0) AS total_paid_out,
        COUNT(DISTINCT source_user_id) AS referred_users_count
      FROM referral_commissions
      WHERE beneficiary_id = ?
    `).bind(String(sellerId)).first<{ total_granted: number; total_pending: number; total_paid_out: number; referred_users_count: number }>().catch(() => null)

    const topReferred = await c.env.DB.prepare(`
      SELECT source_user_id,
             COUNT(*) AS order_count,
             SUM(commission_amount) AS total_commission
        FROM referral_commissions
       WHERE beneficiary_id = ?
       GROUP BY source_user_id
       ORDER BY total_commission DESC
       LIMIT 10
    `).bind(String(sellerId)).all().catch(() => ({ results: [] }))

    return c.json({ success: true, data: { summary: summary || { total_granted: 0, total_pending: 0, total_paid_out: 0, referred_users_count: 0 }, top_referred: topReferred.results || [] } })
  } catch (e) {
    return c.json({ success: true, data: { summary: { total_granted: 0, total_pending: 0, total_paid_out: 0, referred_users_count: 0 }, top_referred: [] } })
  }
})
