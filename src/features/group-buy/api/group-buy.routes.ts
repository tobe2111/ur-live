/**
 * 공동구매 & 식사권 바우처 API
 *
 * GET  /api/group-buy/products       - 공동구매 상품 목록
 * GET  /api/group-buy/products/:id   - 공동구매 상품 상세
 * POST /api/group-buy/join/:id       - 공동구매 참여 (주문+딜 결제)
 * GET  /api/vouchers/my              - 내 바우처 목록
 * POST /api/vouchers/:code/use       - 바우처 사용 처리
 */

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { requireAuth, getCurrentUser } from '@/worker/middleware/auth'
import type { Env } from '@/worker/types/env'
import { ALLOWED_ORIGINS } from '@/shared/constants'
import { cacheGet } from '@/worker/utils/cache'

const groupBuyRoutes = new Hono<{ Bindings: Env }>()

groupBuyRoutes.use('*', cors({
  origin: [...ALLOWED_ORIGINS],
  credentials: true,
}))

const DEFAULT_MEAL_VOUCHER_COMMISSION_RATE = 0.05 // 식사권 기본 수수료 5%

// DB에서 수수료율 조회 (어드민 설정 우선, 없으면 기본값)
async function getMealVoucherCommissionRate(DB: D1Database): Promise<number> {
  try {
    const row = await DB.prepare("SELECT value FROM platform_settings WHERE key = 'commission_rate_meal_voucher'").first<{ value: string }>()
    if (row) return Number(row.value) / 100
  } catch { /* table may not exist */ }
  return DEFAULT_MEAL_VOUCHER_COMMISSION_RATE
}

// 테이블 자동 생성
async function ensureTables(DB: D1Database) {
  const columns = [
    'restaurant_name TEXT', 'restaurant_address TEXT', 'restaurant_phone TEXT',
    'restaurant_lat REAL', 'restaurant_lng REAL',
    'voucher_expiry DATE', 'voucher_terms TEXT',
    'group_buy_target INTEGER DEFAULT 0', 'group_buy_current INTEGER DEFAULT 0',
    'group_buy_deadline DATETIME', "group_buy_status TEXT DEFAULT 'active'",
    'store_verify_pin TEXT',
  ]
  for (const col of columns) {
    try { await DB.prepare(`ALTER TABLE products ADD COLUMN ${col}`).run() } catch { /* exists */ }
  }
  try {
    await DB.prepare(`
      CREATE TABLE IF NOT EXISTS vouchers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        user_id TEXT NOT NULL,
        code TEXT UNIQUE NOT NULL,
        status TEXT DEFAULT 'unused',
        used_at DATETIME,
        expires_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run()
  } catch { /* exists */ }
}

// 바우처 코드 생성
function generateVoucherCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = 'UR-'
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
    if (i === 3) code += '-'
  }
  return code
}

// ── GET /api/group-buy/products ─────────────────────────────────────
groupBuyRoutes.get('/products', async (c) => {
  const { DB } = c.env
  await ensureTables(DB)

  // 마감된 공동구매 자동 상태 업데이트
  try {
    await DB.prepare(`
      UPDATE products SET group_buy_status = 'expired', updated_at = CURRENT_TIMESTAMP
      WHERE category = 'meal_voucher' AND group_buy_status = 'active'
        AND group_buy_deadline IS NOT NULL AND group_buy_deadline < datetime('now')
    `).run()
  } catch { /* ignore */ }

  const status = c.req.query('status') || 'active'

  const results = await cacheGet(
    c.env.SESSION_KV,
    `group_buy_products:${status}`,
    async () => {
      const { results } = await DB.prepare(`
        SELECT p.*, s.name as seller_name, s.profile_image as seller_avatar
        FROM products p
        LEFT JOIN sellers s ON p.seller_id = s.id
        WHERE p.category = 'meal_voucher' AND p.is_active = 1
          AND (p.group_buy_status = ? OR ? = 'all')
        ORDER BY p.created_at DESC
        LIMIT 50
      `).bind(status, status).all()
      return results ?? []
    },
    { ttl: 60, staleWhileRevalidate: 30 }
  )

  return c.json({ success: true, data: results })
})

// ── GET /api/group-buy/products/:id ─────────────────────────────────
groupBuyRoutes.get('/products/:id', async (c) => {
  const { DB } = c.env
  const id = c.req.param('id')

  const product = await DB.prepare(`
    SELECT p.*, s.name as seller_name, s.profile_image as seller_avatar,
           s.bio as seller_bio, s.sns_instagram as seller_instagram
    FROM products p
    LEFT JOIN sellers s ON p.seller_id = s.id
    WHERE p.id = ? AND p.category = 'meal_voucher'
  `).bind(id).first()

  if (!product) return c.json({ success: false, error: '상품을 찾을 수 없습니다' }, 404)

  return c.json({ success: true, data: product })
})

// ── POST /api/group-buy/join/:id — 공동구매 참여 ────────────────────
groupBuyRoutes.post('/join/:id', requireAuth(), async (c) => {
  const user = getCurrentUser(c)
  if (!user) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)

  const { DB } = c.env
  await ensureTables(DB)
  const productId = c.req.param('id')
  const userId = String(user.id)
  const { quantity, payment_method } = await c.req.json<{ quantity?: number; payment_method?: 'deal' | 'toss' }>()
  const qty = quantity || 1

  try {
    // 상품 확인
    const product = await DB.prepare(
      "SELECT * FROM products WHERE id = ? AND category = 'meal_voucher' AND is_active = 1"
    ).bind(productId).first<any>()

    if (!product) return c.json({ success: false, error: '상품을 찾을 수 없습니다' }, 404)

    // 공동구매 마감 확인
    if (product.group_buy_deadline && new Date(product.group_buy_deadline) < new Date()) {
      return c.json({ success: false, error: '공동구매가 마감되었습니다' }, 400)
    }

    // ✅ BUG #26 FIX: Atomic stock reservation. Previous SELECT-then-UPDATE
    // pattern allowed two concurrent joiners to both pass the stock check and
    // then oversell via unconditional decrement.
    const reserveStock = await DB.prepare(
      'UPDATE products SET stock = stock - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND stock >= ?'
    ).bind(qty, productId, qty).run()
    if (!reserveStock.meta.changes) {
      return c.json({ success: false, error: '재고가 부족합니다' }, 409)
    }

    const totalAmount = product.price * qty
    const orderNumber = `GB-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`

    // 딜 결제
    if (payment_method === 'deal') {
      const wallet = await DB.prepare('SELECT balance FROM user_points WHERE user_id = ?')
        .bind(userId).first<{ balance: number }>()

      if (!wallet || wallet.balance < totalAmount) {
        return c.json({ success: false, error: `딜이 부족합니다 (보유: ${wallet?.balance ?? 0}딜)`, code: 'INSUFFICIENT_POINTS' }, 400)
      }

      // 딜 차감 (atomic: balance >= totalAmount 조건으로 race condition 방지)
      const deductResult = await DB.prepare('UPDATE user_points SET balance = balance - ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND balance >= ?')
        .bind(totalAmount, userId, totalAmount).run()
      if (!deductResult.meta.changes) {
        return c.json({ success: false, error: '딜이 부족합니다 (동시 결제 충돌)', code: 'INSUFFICIENT_POINTS' }, 400)
      }

      await DB.prepare(
        `INSERT INTO point_transactions (user_id, type, amount, commission_amount, points_amount, balance_after, description, order_id)
         VALUES (?, 'donate', ?, 0, ?, (SELECT balance FROM user_points WHERE user_id = ?), ?, ?)`
      ).bind(userId, totalAmount, totalAmount, userId, `공동구매: ${product.name}`, orderNumber).run()
    }

    // 수수료 계산 (DB 설정값 또는 기본 10%)
    const commissionRate = await getMealVoucherCommissionRate(DB)
    const commissionAmount = Math.round(totalAmount * commissionRate)
    const sellerAmount = totalAmount - commissionAmount

    // 주문 생성
    await DB.prepare(`
      INSERT INTO orders (order_number, user_id, seller_id, subtotal, shipping_fee, discount_amount, total_amount, currency, status, payment_method)
      VALUES (?, ?, ?, ?, 0, 0, ?, 'KRW', 'PAID', ?)
    `).bind(orderNumber, userId, product.seller_id, totalAmount, totalAmount, payment_method === 'deal' ? 'deal_points' : 'toss').run()

    // 정산 기록 (셀러 수령액 = 총액 - 10% 수수료)
    try {
      await DB.prepare(`
        INSERT INTO donations (live_stream_id, seller_id, donor_user_id, donor_name, amount,
          commission_amount, credit_amount, commission_rate, order_id, payment_status, message)
        VALUES (0, ?, ?, '공동구매', ?, ?, ?, ?, ?, 'completed', ?)
      `).bind(
        product.seller_id, userId,
        totalAmount, commissionAmount, sellerAmount, commissionRate,
        orderNumber, `식사권 공동구매: ${product.name}`
      ).run()
    } catch { /* donations 테이블 없으면 무시 */ }

    const order = await DB.prepare('SELECT id FROM orders WHERE order_number = ? ORDER BY id DESC LIMIT 1')
      .bind(orderNumber).first<{ id: number }>()

    if (order) {
      await DB.prepare(`
        INSERT INTO order_items (order_id, product_id, product_name, unit_price, price, quantity, subtotal)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(order.id, productId, product.name, product.price, product.price, qty, totalAmount).run()

      // 바우처 발급
      for (let i = 0; i < qty; i++) {
        const code = generateVoucherCode()
        const expiresAt = product.voucher_expiry || new Date(Date.now() + 90 * 86400000).toISOString()

        await DB.prepare(`
          INSERT INTO vouchers (order_id, product_id, user_id, code, expires_at)
          VALUES (?, ?, ?, ?, ?)
        `).bind(order.id, productId, userId, code, expiresAt).run()
      }
    }

    // ✅ BUG #26 FIX: Stock was already decremented atomically above — only
    // bump the group-buy counter here to avoid double-subtracting.
    await DB.prepare(`
      UPDATE products SET group_buy_current = group_buy_current + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).bind(qty, productId).run()

    // 목표 달성 확인
    const updated = await DB.prepare('SELECT group_buy_current, group_buy_target FROM products WHERE id = ?')
      .bind(productId).first<any>()

    if (updated && updated.group_buy_target > 0 && updated.group_buy_current >= updated.group_buy_target) {
      await DB.prepare("UPDATE products SET group_buy_status = 'achieved', updated_at = CURRENT_TIMESTAMP WHERE id = ?")
        .bind(productId).run()
    }

    // 바우처 코드 조회
    const vouchers = await DB.prepare(
      'SELECT code, expires_at FROM vouchers WHERE order_id = ? AND user_id = ?'
    ).bind(order?.id, userId).all()

    return c.json({
      success: true,
      data: {
        order_number: orderNumber,
        amount: totalAmount,
        commission: commissionAmount,
        seller_amount: sellerAmount,
        commission_rate: commissionRate,
        vouchers: vouchers.results ?? [],
        group_buy_current: (updated?.group_buy_current ?? 0),
        group_buy_target: updated?.group_buy_target ?? 0,
      },
      message: `공동구매 참여 완료! 바우처 ${qty}장이 발급되었습니다.`,
    })
  } catch (err) {
    console.error('[group-buy] Error:', err)
    return c.json({ success: false, error: '공동구매 참여 중 오류가 발생했습니다' }, 500)
  }
})

// ── GET /api/vouchers/my — 내 바우처 목록 ───────────────────────────
groupBuyRoutes.get('/my', requireAuth(), async (c) => {
  const user = getCurrentUser(c)
  if (!user) return c.json({ success: false, error: '로그인 필요' }, 401)

  const { DB } = c.env
  await ensureTables(DB)

  const { results } = await DB.prepare(`
    SELECT v.*, p.name as product_name, p.restaurant_name, p.restaurant_address, p.image_url as product_image
    FROM vouchers v
    LEFT JOIN products p ON v.product_id = p.id
    WHERE v.user_id = ?
    ORDER BY v.created_at DESC
  `).bind(String(user.id)).all()

  return c.json({ success: true, data: results ?? [] })
})

// ── GET /api/vouchers/verify/:code — 바우처 정보 조회 (비밀번호 입력 전) ──
groupBuyRoutes.get('/verify/:code', async (c) => {
  const { DB } = c.env
  const code = c.req.param('code')

  const voucher = await DB.prepare(`
    SELECT v.*, p.name as product_name, p.restaurant_name, p.image_url as product_image
    FROM vouchers v LEFT JOIN products p ON v.product_id = p.id
    WHERE v.code = ?
  `).bind(code).first<any>()

  if (!voucher) return c.json({ success: false, error: '바우처를 찾을 수 없습니다' }, 404)

  return c.json({
    success: true,
    data: {
      code: voucher.code,
      status: voucher.status,
      product_name: voucher.product_name,
      restaurant_name: voucher.restaurant_name,
      product_image: voucher.product_image,
      expires_at: voucher.expires_at,
    },
  })
})

// ── POST /api/group-buy/refund/:productId — 미달성 공동구매 환불 ────
groupBuyRoutes.post('/refund/:productId', requireAuth(), async (c) => {
  const { DB } = c.env
  const productId = c.req.param('productId')

  try {
    const product = await DB.prepare(
      "SELECT * FROM products WHERE id = ? AND category = 'meal_voucher'"
    ).bind(productId).first<any>()

    if (!product) return c.json({ success: false, error: '상품을 찾을 수 없습니다' }, 404)

    // ✅ OWNERSHIP FIX: Only the product's seller (or admin) can refund
    const authUser = getCurrentUser(c)
    if (!authUser) return c.json({ success: false, error: 'Unauthorized' }, 401)
    if (authUser.type !== 'admin') {
      if (authUser.type !== 'seller' || Number(product.seller_id) !== Number(authUser.id)) {
        return c.json({ success: false, error: 'forbidden — not your product' }, 403)
      }
    }

    if (product.group_buy_status !== 'expired') return c.json({ success: false, error: '마감된 공동구매만 환불 가능합니다' }, 400)
    if (product.group_buy_current >= product.group_buy_target) return c.json({ success: false, error: '목표 달성된 공동구매는 환불 불가' }, 400)

    // 미사용 바우처 환불 처리
    const { results: vouchers } = await DB.prepare(
      "SELECT v.*, o.user_id, o.total_amount, o.payment_method FROM vouchers v LEFT JOIN orders o ON v.order_id = o.id WHERE v.product_id = ? AND v.status = 'unused'"
    ).bind(productId).all()

    let refundCount = 0
    for (const v of (vouchers || [])) {
      // ✅ CONCURRENCY: CAS voucher status unused → refunded. Only credit the
      //    deal refund if WE transitioned this voucher (prevents double-refund
      //    when two admins/sellers race on the same refund API call).
      const casRes = await DB.prepare(
        "UPDATE vouchers SET status = 'refunded' WHERE id = ? AND status = 'unused'"
      ).bind((v as any).id).run()

      if ((casRes.meta?.changes ?? 0) === 0) continue

      // 딜 결제였으면 딜 환불
      // ✅ BUG #45 FIX: `o.total_amount` covers the whole order (N vouchers).
      // Refunding that per-voucher would multiply the refund by N.  Refund
      // exactly one voucher's worth of points — `product.price`.
      if ((v as any).payment_method === 'deal_points' && (v as any).user_id) {
        const amount = product.price
        await DB.prepare('UPDATE user_points SET balance = balance + ? WHERE user_id = ?')
          .bind(amount, (v as any).user_id).run()
        await DB.prepare(
          "INSERT INTO point_transactions (user_id, type, amount, points_amount, balance_after, description) VALUES (?, 'refund', ?, ?, (SELECT balance FROM user_points WHERE user_id = ?), ?)"
        ).bind((v as any).user_id, amount, amount, (v as any).user_id, `공동구매 미달성 환불: ${product.name}`).run()
      }
      refundCount++
    }

    // 상품 상태 업데이트
    await DB.prepare("UPDATE products SET group_buy_status = 'cancelled' WHERE id = ?").bind(productId).run()

    return c.json({ success: true, data: { refunded: refundCount }, message: `${refundCount}건 환불 처리 완료` })
  } catch (err) {
    console.error('[group-buy refund]', err)
    return c.json({ success: false, error: '환불 처리 중 오류' }, 500)
  }
})

// ── POST /api/vouchers/:code/use — 바우처 사용 (비밀번호 인증) ─────
groupBuyRoutes.post('/:code/use', async (c) => {
  const { DB } = c.env
  const code = c.req.param('code')
  const { pin } = await c.req.json<{ pin: string }>()

  const voucher = await DB.prepare(
    "SELECT v.*, p.store_verify_pin FROM vouchers v LEFT JOIN products p ON v.product_id = p.id WHERE v.code = ?"
  ).bind(code).first<any>()

  if (!voucher) return c.json({ success: false, error: '바우처를 찾을 수 없습니다' }, 404)
  if (voucher.status === 'used') return c.json({ success: false, error: '이미 사용된 바우처입니다' }, 400)
  if (voucher.status === 'expired') return c.json({ success: false, error: '만료된 바우처입니다' }, 400)

  if (voucher.expires_at && new Date(voucher.expires_at) < new Date()) {
    await DB.prepare("UPDATE vouchers SET status = 'expired' WHERE id = ?").bind(voucher.id).run()
    return c.json({ success: false, error: '만료된 바우처입니다' }, 400)
  }

  // 비밀번호 확인
  if (voucher.store_verify_pin && voucher.store_verify_pin !== pin) {
    return c.json({ success: false, error: '비밀번호가 일치하지 않습니다' }, 403)
  }

  await DB.prepare("UPDATE vouchers SET status = 'used', used_at = CURRENT_TIMESTAMP WHERE id = ?")
    .bind(voucher.id).run()

  return c.json({ success: true, message: '식사권이 사용 처리되었습니다! 맛있게 드세요 🍽️' })
})

// ── POST /api/group-buy/store-stats/:productId — 식당 사장 통계 (PIN 인증) ──
groupBuyRoutes.post('/store-stats/:productId', async (c) => {
  const { DB } = c.env
  const productId = c.req.param('productId')
  const { pin } = await c.req.json<{ pin: string }>()

  try {
    const product = await DB.prepare(
      "SELECT id, name, restaurant_name, store_verify_pin, group_buy_target, group_buy_current FROM products WHERE id = ? AND category = 'meal_voucher'"
    ).bind(productId).first<any>()

    if (!product) return c.json({ success: false, error: '상품을 찾을 수 없습니다' }, 404)
    if (product.store_verify_pin && product.store_verify_pin !== pin) {
      return c.json({ success: false, error: '비밀번호가 일치하지 않습니다' }, 403)
    }

    // 바우처 통계
    const stats = await DB.prepare(`
      SELECT
        COUNT(*) as total_vouchers,
        SUM(CASE WHEN status = 'used' THEN 1 ELSE 0 END) as used,
        SUM(CASE WHEN status = 'unused' THEN 1 ELSE 0 END) as unused,
        SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END) as expired
      FROM vouchers WHERE product_id = ?
    `).bind(productId).first<any>()

    return c.json({
      success: true,
      data: {
        product_name: product.name,
        restaurant_name: product.restaurant_name,
        total_vouchers: stats?.total_vouchers || 0,
        used: stats?.used || 0,
        unused: stats?.unused || 0,
        expired: stats?.expired || 0,
        group_buy_current: product.group_buy_current || 0,
        group_buy_target: product.group_buy_target || 0,
      },
    })
  } catch (err) {
    return c.json({ success: false, error: '통계 조회 실패' }, 500)
  }
})

export { groupBuyRoutes }
