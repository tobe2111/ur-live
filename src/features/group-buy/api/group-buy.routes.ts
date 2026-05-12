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
import { rateLimit } from '@/worker/middleware/rate-limit'
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
    // 🛡️ 2026-04-27: Magic Link — 사장님 PIN 없이 통계 페이지 진입.
    'store_owner_token TEXT',
  ]
  for (const col of columns) {
    try { await DB.prepare(`ALTER TABLE products ADD COLUMN ${col}`).run() } catch { /* exists */ }
  }
  try {
    await DB.prepare(`CREATE INDEX IF NOT EXISTS idx_products_store_owner_token ON products(store_owner_token)`).run()
  } catch { /* exists */ }
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
// 🛡️ 2026-04-22: Math.random → crypto.getRandomValues (guessable code 방어)
function generateVoucherCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  let code = 'UR-'
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(bytes[i] % chars.length)
    if (i === 3) code += '-'
  }
  return code
}

// ── GET /api/group-buy/products ─────────────────────────────────────
//   ?status=active|achieved|expired|all  (default: active)
//   ?category=meal_voucher|beauty_voucher|health_voucher|all  (default: all = 3종 모두)
//   🛡️ 2026-04-28: beauty/health 카테고리 추가 — meal 인프라 그대로 재활용.
groupBuyRoutes.get('/products', async (c) => {
  const { DB } = c.env
  await ensureTables(DB)

  // 🛡️ 2026-05-04 (perf): 매 요청 UPDATE 제거 (100-300ms latency 절감).
  //   마감된 공동구매 자동 만료는 scheduled-cleanup cron 에서 처리 (6종 카테고리 전체).

  const status = c.req.query('status') || 'active'
  const categoryParam = c.req.query('category') || 'all'
  const validCategories = ['meal_voucher', 'beauty_voucher', 'health_voucher', 'pet_voucher', 'stay_voucher', 'activity_voucher']
  const categories = categoryParam === 'all'
    ? validCategories
    : (validCategories.includes(categoryParam) ? [categoryParam] : validCategories)

  const results = await cacheGet(
    c.env.SESSION_KV,
    `group_buy_products:${status}:${categories.join(',')}`,
    async () => {
      const placeholders = categories.map(() => '?').join(',')
      const { results } = await DB.prepare(`
        SELECT p.*, s.name as seller_name, s.profile_image as seller_avatar
        FROM products p
        LEFT JOIN sellers s ON p.seller_id = s.id
        WHERE p.category IN (${placeholders}) AND p.is_active = 1
          AND (p.group_buy_status = ? OR ? = 'all')
        ORDER BY p.created_at DESC
        LIMIT 50
      `).bind(...categories, status, status).all()
      return results ?? []
    },
    { ttl: 60, staleWhileRevalidate: 30 }
  )

  return c.json({ success: true, data: results })
})

// ── GET /api/group-buy/products/:id ─────────────────────────────────
groupBuyRoutes.get('/products/:id', async (c) => {
  const { DB } = c.env
  const idRaw = c.req.param('id')
  const idNum = Number(idRaw)
  if (!Number.isFinite(idNum) || idNum <= 0 || !Number.isInteger(idNum)) {
    return c.json({ success: false, error: '잘못된 상품 ID 입니다' }, 400)
  }
  const id = idNum

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
  const productIdRaw = c.req.param('id')
  const productIdNum = Number(productIdRaw)
  if (!Number.isFinite(productIdNum) || productIdNum <= 0 || !Number.isInteger(productIdNum)) {
    return c.json({ success: false, error: '잘못된 상품 ID 입니다' }, 400)
  }
  const productId = productIdNum
  const userId = String(user.id)
  const { quantity, payment_method } = await c.req.json<{ quantity?: number; payment_method?: 'deal' | 'toss' }>().catch(() => ({ quantity: 1, payment_method: 'deal' as const }))
  const qty = Number(quantity ?? 1)
  if (!Number.isFinite(qty) || !Number.isInteger(qty) || qty < 1 || qty > 100) {
    return c.json({ success: false, error: '수량은 1~100 사이의 정수여야 합니다' }, 400)
  }
  if (payment_method !== undefined && payment_method !== 'deal' && payment_method !== 'toss') {
    return c.json({ success: false, error: '잘못된 결제 수단입니다' }, 400)
  }

  try {
    // 상품 확인
    const product = await DB.prepare(
      "SELECT * FROM products WHERE id = ? AND category = 'meal_voucher' AND is_active = 1"
    ).bind(productId).first<any>()

    if (!product) return c.json({ success: false, error: '상품을 찾을 수 없습니다' }, 404)

    // 🛡️ 2026-04-22: 셀러가 본인 공구에 자기 참여 차단 (목표 조작 방지)
    if (product.seller_id && Number(product.seller_id) === Number(userId)) {
      return c.json({
        success: false,
        error: '본인의 공동구매 상품에는 참여할 수 없습니다',
        code: 'SELF_PARTICIPATION_BLOCKED'
      }, 403)
    }

    // 공동구매 마감 확인 (마감 시간이 참여보다 먼저 체크되도록)
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

    // 수수료 계산 (DB 설정값 platform_settings.commission_rate_meal_voucher, 기본 5%)
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
    // ✅ CONCURRENCY: atomic increment + target/achievement transition done in
    //    a single UPDATE so two concurrent joiners cannot both read the same
    //    group_buy_current and skip the achieved transition.
    await DB.prepare(`
      UPDATE products
         SET group_buy_current = group_buy_current + ?,
             group_buy_status = CASE
               WHEN group_buy_target > 0 AND (group_buy_current + ?) >= group_buy_target THEN 'achieved'
               ELSE group_buy_status
             END,
             updated_at = CURRENT_TIMESTAMP
       WHERE id = ?
    `).bind(qty, qty, productId).run()

    const updated = await DB.prepare('SELECT group_buy_current, group_buy_target, group_buy_status FROM products WHERE id = ?')
      .bind(productId).first<any>()

    // 🛡️ 공구 성공 시 모든 참여자에게 푸시 + dashboard notification (best-effort)
    //   updated.group_buy_status === 'achieved' 이며, 직전 UPDATE 가 처음으로 트랜지션 시켰을 때만 발송하도록
    //   product.group_buy_status (사전 상태) 와 비교하여 중복 발송 방지.
    try {
      if (updated?.group_buy_status === 'achieved' && product.group_buy_status !== 'achieved') {
        const { results: participants } = await DB.prepare(
          `SELECT DISTINCT o.user_id FROM orders o
           JOIN order_items oi ON oi.order_id = o.id
           WHERE oi.product_id = ? AND o.user_id IS NOT NULL`
        ).bind(productId).all<{ user_id: string }>()
        const { sendSystemPush } = await import('../../../lib/system-push')
        for (const p of participants ?? []) {
          try {
            await DB.prepare(
              `INSERT INTO user_notifications (user_id, type, title, message, link)
               VALUES (?, 'group_buy_achieved', ?, ?, ?)`
            ).bind(p.user_id, '🎉 공구 성공!', `${product.name} 곧 식사권이 발급됩니다`, `/group-buy/${productId}`).run()
          } catch { /* ignore */ }
          try {
            await sendSystemPush(c.env, 'user', p.user_id, {
              title: '🎉 공구 성공!',
              body: `${product.name} 곧 식사권이 발급됩니다`,
              url: `/group-buy/${productId}`,
              tag: `gb-achieved-${productId}`,
            })
          } catch { /* ignore */ }
        }
      }
    } catch (e) { console.error('[group-buy achieved notify]', e) }

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
  if (!code || typeof code !== 'string' || code.length < 4 || code.length > 64 || !/^[A-Za-z0-9-]+$/.test(code)) {
    return c.json({ success: false, error: '잘못된 바우처 코드입니다' }, 400)
  }

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
  const productIdRaw = c.req.param('productId')
  const productIdNum = Number(productIdRaw)
  if (!Number.isFinite(productIdNum) || productIdNum <= 0 || !Number.isInteger(productIdNum)) {
    return c.json({ success: false, error: '잘못된 상품 ID 입니다' }, 400)
  }
  const productId = productIdNum

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
// ✅ C1 FIX: rate limit (brute-force 차단) + atomic CAS (race condition 차단).
//    6자리 PIN은 IP당 5회/분으로 제한하여 단시간 무차별 대입 방지.
groupBuyRoutes.post(
  '/:code/use',
  rateLimit({ action: 'voucher_use', max: 5, windowSec: 60 }),
  async (c) => {
    const { DB } = c.env
    const code = c.req.param('code')
    if (!code || typeof code !== 'string' || code.length < 4 || code.length > 64 || !/^[A-Za-z0-9-]+$/.test(code)) {
      return c.json({ success: false, error: '잘못된 바우처 코드입니다' }, 400)
    }
    const { pin } = await c.req.json<{ pin?: string }>().catch(() => ({ pin: undefined }))

    if (!pin || typeof pin !== 'string' || pin.length > 64) {
      return c.json({ success: false, error: '비밀번호를 입력해주세요' }, 400)
    }

    // 만료된 바우처 선차단: 만료 기한이 지났다면 상태를 전이시킨 뒤 400 응답.
    // (CAS 조건에 만료 체크를 묶으면 만료 자체가 "PIN 오류"로 혼동될 수 있어 분리)
    try {
      await DB.prepare(
        "UPDATE vouchers SET status = 'expired' WHERE code = ? AND status = 'unused' AND expires_at IS NOT NULL AND expires_at < datetime('now')"
      ).bind(code).run()
    } catch { /* ignore */ }

    // CAS: code + pin + status='unused' 세 조건을 원자적으로 검증/갱신.
    // 중간 SELECT 없이 단일 UPDATE 로 경쟁 조건과 PIN 타이밍 공격을 동시에 차단.
    const result = await DB.prepare(
      `UPDATE vouchers
         SET status = 'used', used_at = datetime('now')
       WHERE code = ?
         AND status = 'unused'
         AND (expires_at IS NULL OR expires_at > datetime('now'))
         AND product_id IN (
           SELECT id FROM products
           WHERE id = vouchers.product_id
             AND (store_verify_pin IS NULL OR store_verify_pin = ?)
         )`
    ).bind(code, pin).run()

    if ((result.meta?.changes ?? 0) === 0) {
      // 실패 원인 분기: 존재 여부만 확인 (PIN 정답 여부는 노출하지 않음)
      const exists = await DB.prepare(
        "SELECT status, expires_at FROM vouchers WHERE code = ?"
      ).bind(code).first<{ status: string; expires_at: string | null }>()

      if (!exists) return c.json({ success: false, error: '바우처를 찾을 수 없습니다' }, 404)
      if (exists.status === 'used') return c.json({ success: false, error: '이미 사용된 바우처입니다' }, 400)
      if (exists.status === 'expired') return c.json({ success: false, error: '만료된 바우처입니다' }, 400)
      if (exists.status === 'refunded') return c.json({ success: false, error: '환불된 바우처입니다' }, 400)
      return c.json({ success: false, error: '이미 사용되었거나 PIN이 틀립니다.' }, 400)
    }

    return c.json({ success: true, message: '식사권이 사용 처리되었습니다! 맛있게 드세요 🍽️' })
  }
)

// ── POST /api/group-buy/store-stats/:productId — 식당 사장 통계 (PIN 또는 token 인증) ──
// 🛡️ 2026-04-22: 조회 전 PIN 검증 필수 + rate limit (PIN brute force 방어)
// 🛡️ 2026-04-27: Magic Link 토큰(?t=...) 도 허용 — 사장님이 알림톡 링크로 무인증 진입.
groupBuyRoutes.post('/store-stats/:productId', rateLimit({ action: 'store_stats_pin', max: 5, windowSec: 300 }), async (c) => {
  const { DB } = c.env
  await ensureTables(DB)
  const productIdRaw = c.req.param('productId')
  const productIdNum = Number(productIdRaw)
  if (!Number.isFinite(productIdNum) || productIdNum <= 0 || !Number.isInteger(productIdNum)) {
    return c.json({ success: false, error: '잘못된 상품 ID 입니다' }, 400)
  }
  const productId = productIdNum
  const tokenFromQuery = c.req.query('t')?.trim() || ''
  let pin = ''
  try {
    const body = await c.req.json<{ pin?: string }>()
    pin = (body?.pin || '').trim()
  } catch { /* GET-style 호환: body 없을 수 있음 */ }

  // 인증 방식: token 우선, 없으면 PIN
  if (!tokenFromQuery && (!pin || pin.length < 4)) {
    return c.json({ success: false, error: '인증 토큰 또는 PIN(4자 이상)이 필요합니다' }, 400)
  }

  try {
    // 🛡️ CAS 패턴: token/PIN 검증과 조회를 한 번에 (timing attack 방어)
    const product = tokenFromQuery
      ? await DB.prepare(
          "SELECT id, name, restaurant_name, group_buy_target, group_buy_current FROM products WHERE id = ? AND category = 'meal_voucher' AND store_owner_token = ?"
        ).bind(productId, tokenFromQuery).first<any>()
      : await DB.prepare(
          "SELECT id, name, restaurant_name, group_buy_target, group_buy_current FROM products WHERE id = ? AND category = 'meal_voucher' AND store_verify_pin = ?"
        ).bind(productId, pin).first<any>()

    if (!product) {
      // 상품 없음 vs 인증 실패 구분하지 않음 (enumeration 방어)
      return c.json({ success: false, error: '상품을 찾을 수 없거나 인증이 올바르지 않습니다' }, 403)
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

// 🛡️ 2026-04-27: Magic Link 토큰 생성 — 32자 hex (128bit), URL-safe.
function generateStoreOwnerToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
}

// 🛡️ 2026-04-27: 알림톡 발송 (사장님께 통계 페이지 link)
// alimtalkRoutes 의 sendBillgateAlimtalk 직접 호출하기엔 의존성 큼 →
// 간단히 ALIMTALK_API 환경변수로 fetch (Solapi/NHN/Toast/Aligo 등 구분 X).
// 실패해도 등록은 진행 (graceful degradation).
async function sendStoreOwnerAlimtalk(
  env: { ALIMTALK_API_KEY?: string; ALIMTALK_SENDER_KEY?: string },
  phone: string,
  data: { restaurantName: string; productName: string; statsUrl: string }
): Promise<void> {
  if (!env.ALIMTALK_API_KEY || !phone) return // 미설정 시 silently skip
  try {
    // 정규화: 010-xxxx-xxxx → 01012345678
    const cleanPhone = phone.replace(/[^0-9]/g, '')
    if (!/^01\d{8,9}$/.test(cleanPhone)) return

    const message = `[유어딜] 식사권 통계 페이지 안내

안녕하세요, ${data.restaurantName} 사장님!
"${data.productName}" 식사권 공동구매가 등록되었습니다.

📊 실시간 발급/사용 현황 확인:
${data.statsUrl}

✅ 이 링크는 사장님 전용 영구 링크입니다.
즐겨찾기에 추가하시면 편하게 확인할 수 있어요.

문의가 있으시면 언제든 연락주세요.`

    // Solapi-style 호출 (실제 provider 마다 다름 — 환경변수로 baseURL 받으면 더 유연)
    await fetch('https://api.solapi.com/messages/v4/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.ALIMTALK_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          to: cleanPhone,
          from: env.ALIMTALK_SENDER_KEY || '15441234',
          text: message,
          type: 'LMS', // 알림톡 템플릿 미등록 시 LMS fallback
        },
      }),
      signal: AbortSignal.timeout(10000),
    }).catch(() => { /* silently fail — 운영 영향 없게 */ })
  } catch { /* graceful */ }
}

export { generateStoreOwnerToken, sendStoreOwnerAlimtalk }

export { groupBuyRoutes }
