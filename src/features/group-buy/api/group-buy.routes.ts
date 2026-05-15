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
import { requireAuth, requireAdmin, getCurrentUser } from '@/worker/middleware/auth'
import { rateLimit } from '@/worker/middleware/rate-limit'
import type { Env } from '@/worker/types/env'
import { cacheGet } from '@/worker/utils/cache'

const groupBuyRoutes = new Hono<{ Bindings: Env }>()

// 🛡️ 2026-05-13: redundant cors() 제거 — 전역 cors 가 처리.

const DEFAULT_MEAL_VOUCHER_COMMISSION_RATE = 0.05 // 식사권 기본 수수료 5%

// 🛡️ 2026-05-15: 차등 수수료 — 셀러 GMV 기반 자동 산정 (셀러 lock-in)
//   기본 5%, 월 GMV 1,000만+ 셀러 4%, 월 GMV 1억+ 셀러 3%
//   sellers.commission_rate 컬럼이 있으면 어드민 수동 override 우선.
const TIER_COMMISSION = [
  { min_monthly_gmv: 100_000_000, rate: 0.03 },  // 1억+ → 3%
  { min_monthly_gmv: 10_000_000,  rate: 0.04 },  // 1천만+ → 4%
] as const

// DB에서 수수료율 조회 (어드민 설정 우선, 없으면 기본값)
async function getMealVoucherCommissionRate(DB: D1Database): Promise<number> {
  try {
    const row = await DB.prepare("SELECT value FROM platform_settings WHERE key = 'commission_rate_meal_voucher'").first<{ value: string }>()
    if (row) return Number(row.value) / 100
  } catch { /* table may not exist */ }
  return DEFAULT_MEAL_VOUCHER_COMMISSION_RATE
}

// 🛡️ 2026-05-15: 셀러별 commission rate (override > tier > default)
async function getSellerCommissionRate(DB: D1Database, sellerId: number): Promise<number> {
  // 1. 어드민 수동 설정 (sellers.commission_rate)
  try {
    const seller = await DB.prepare("SELECT commission_rate FROM sellers WHERE id = ?").bind(sellerId).first<{ commission_rate: number | null }>()
    if (seller && seller.commission_rate != null && seller.commission_rate > 0 && seller.commission_rate < 100) {
      return Number(seller.commission_rate) / 100
    }
  } catch { /* column may not exist */ }
  // 2. 자동 tier — 최근 30일 GMV 기준
  try {
    const gmvRow = await DB.prepare(`
      SELECT COALESCE(SUM(p.price * p.group_buy_current), 0) AS gmv
      FROM products p
      WHERE p.seller_id = ?
        AND p.updated_at >= datetime('now', '-30 days')
        AND p.category IN ('meal_voucher','beauty_voucher','health_voucher','pet_voucher','stay_voucher','activity_voucher')
    `).bind(sellerId).first<{ gmv: number }>()
    const gmv = Number(gmvRow?.gmv ?? 0)
    for (const tier of TIER_COMMISSION) {
      if (gmv >= tier.min_monthly_gmv) return tier.rate
    }
  } catch { /* fallback to default */ }
  // 3. 기본값 (platform_settings)
  return await getMealVoucherCommissionRate(DB)
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
    // 🛡️ 2026-05-15: 티어 할인 시스템 — JSON 배열 [{ "min": 5, "discount_pct": 10 }, ...]
    //   현재 group_buy_current 가 minimum 이상 충족된 가장 높은 tier 의 discount_pct 적용.
    //   참여자별 환불 차액 자동 계산은 Phase 2 (cron 또는 voucher 발급 직전 정확한 가격 적용).
    'group_buy_tiers TEXT',
    // 🛡️ 2026-05-15: 마일스톤 알림 dedup (1명 남음, 50%, 80%, 100%)
    'milestone_notified_50 INTEGER DEFAULT 0',
    'milestone_notified_80 INTEGER DEFAULT 0',
    'milestone_notified_lastone INTEGER DEFAULT 0',
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
        applied_discount_pct INTEGER DEFAULT 0,
        applied_price INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run()
  } catch { /* exists */ }
  // applied_* 컬럼 자동 추가 (기존 테이블 마이그레이션)
  for (const col of ['applied_discount_pct INTEGER DEFAULT 0', 'applied_price INTEGER']) {
    try { await DB.prepare(`ALTER TABLE vouchers ADD COLUMN ${col}`).run() } catch { /* exists */ }
  }
}

// 🛡️ 2026-05-15: 티어 할인 계산 — group_buy_tiers JSON 파싱 + current 에 맞는 최고 tier 적용.
//   tiers = [{ min: 5, discount_pct: 5 }, { min: 10, discount_pct: 15 }, { min: 20, discount_pct: 25 }]
//   current=12 → discount_pct=15 (가장 높은 충족 tier)
//   tiers null/empty → discount_pct=0
function calcTierDiscount(tiersJson: string | null, current: number): { discount_pct: number; next_tier: { min: number; discount_pct: number } | null } {
  if (!tiersJson) return { discount_pct: 0, next_tier: null }
  try {
    const tiers = JSON.parse(tiersJson) as Array<{ min: number; discount_pct: number }>
    if (!Array.isArray(tiers) || tiers.length === 0) return { discount_pct: 0, next_tier: null }
    // 정렬 후 current 이하 max + current 초과 min 찾기
    const sorted = [...tiers].sort((a, b) => a.min - b.min)
    let achieved = 0
    let next: { min: number; discount_pct: number } | null = null
    for (const t of sorted) {
      if (current >= t.min) achieved = Math.max(achieved, t.discount_pct)
      else { next = t; break }
    }
    return { discount_pct: achieved, next_tier: next }
  } catch { return { discount_pct: 0, next_tier: null } }
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
    WHERE p.id = ? AND p.category IN ('meal_voucher','beauty_voucher','health_voucher','pet_voucher','stay_voucher','activity_voucher')
  `).bind(id).first<any>()

  if (!product) return c.json({ success: false, error: '상품을 찾을 수 없습니다' }, 404)

  // 🛡️ 2026-05-15: 티어 정보 + 다음 tier 까지 남은 인원 함께 반환
  const tierInfo = calcTierDiscount(product.group_buy_tiers, Number(product.group_buy_current ?? 0))

  return c.json({
    success: true,
    data: {
      ...product,
      current_discount_pct: tierInfo.discount_pct,
      next_tier: tierInfo.next_tier,
      next_tier_remaining: tierInfo.next_tier ? Math.max(0, tierInfo.next_tier.min - Number(product.group_buy_current ?? 0)) : null,
    },
  })
})

// ── GET /api/group-buy/live-ticker — 전체 공구 최근 참여 (SNS 스타일 ticker) ──
// 🛡️ 2026-05-15: 실시간 "지원님이 N분 전 참여" 흐름. 홈 / 리스트 페이지에 노출.
//   privacy: name 1자만 + 마스킹. cache 30s (실시간 느낌 유지하면서 D1 부하 방어).
groupBuyRoutes.get('/live-ticker', async (c) => {
  const { DB } = c.env
  try {
    const { results } = await DB.prepare(`
      SELECT
        SUBSTR(COALESCE(u.display_name, u.email, '익명'), 1, 1) || '**' AS masked_name,
        u.profile_image AS avatar,
        p.id AS product_id,
        p.name AS product_name,
        p.restaurant_name,
        p.image_url AS product_image,
        p.category,
        oi.quantity,
        o.created_at
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      JOIN products p ON p.id = oi.product_id
      LEFT JOIN users u ON u.id = o.user_id
      WHERE o.order_number LIKE 'GB-%'
        AND o.status = 'PAID'
        AND o.created_at >= datetime('now', '-2 hours')
        AND p.category IN ('meal_voucher','beauty_voucher','health_voucher','pet_voucher','stay_voucher','activity_voucher')
      ORDER BY o.created_at DESC
      LIMIT 30
    `).all().catch(() => ({ results: [] }))
    return c.json({ success: true, data: results ?? [] })
  } catch (err) {
    console.error('[gb live-ticker]', err)
    return c.json({ success: true, data: [] })
  }
})

// ── GET /api/group-buy/products/:id/participants ──── 최근 참여자 (마스킹) ──
groupBuyRoutes.get('/products/:id/participants', async (c) => {
  const { DB } = c.env
  const idRaw = c.req.param('id')
  const idNum = Number(idRaw)
  if (!Number.isFinite(idNum) || idNum <= 0 || !Number.isInteger(idNum)) {
    return c.json({ success: false, error: '잘못된 상품 ID 입니다' }, 400)
  }
  const id = idNum
  try {
    const { results } = await DB.prepare(`
      SELECT
        SUBSTR(COALESCE(u.display_name, u.email, '익명'), 1, 1) || '**' AS masked_name,
        u.profile_image AS avatar,
        o.created_at,
        oi.quantity
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      LEFT JOIN users u ON u.id = o.user_id
      WHERE oi.product_id = ? AND o.status = 'PAID'
      ORDER BY o.created_at DESC
      LIMIT 20
    `).bind(id).all().catch(() => ({ results: [] }))
    return c.json({ success: true, data: results ?? [] })
  } catch (err) {
    console.error('[gb participants]', err)
    return c.json({ success: true, data: [] })
  }
})

// ── POST /api/group-buy/join/:id — 공동구매 참여 ────────────────────
// 🛡️ 2026-05-15: rate limit 5/min per user — 동시 클릭 / 자동화 방어 (재고 + voucher 중복 발급 위험)
groupBuyRoutes.post('/join/:id', rateLimit({ action: 'group_buy_join', max: 5, windowSec: 60 }), requireAuth(), async (c) => {
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

    // 🛡️ 2026-05-15: 이미 종료/취소된 공구 차단 (status 가드)
    if (product.group_buy_status === 'expired' || product.group_buy_status === 'cancelled') {
      return c.json({ success: false, error: '종료된 공동구매입니다' }, 400)
    }

    // 🛡️ 2026-05-15: voucher 만료일 가드 — 공구 마감 전에 voucher 가 먼저 만료되면 무용지물
    if (product.voucher_expiry && product.group_buy_deadline) {
      if (new Date(product.voucher_expiry) <= new Date(product.group_buy_deadline)) {
        return c.json({ success: false, error: '바우처 만료일이 공구 마감 전이라 발급할 수 없습니다. 셀러에게 문의해주세요.' }, 400)
      }
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

    // 🛡️ 2026-05-15: 티어 할인 적용 — 현재 group_buy_current 기준 (이번 참여자 포함 전).
    //   join 직후 increment 되면서 다음 참여자부터 새 tier 적용 가능 (자연스러운 dynamic pricing).
    const currentTier = calcTierDiscount(product.group_buy_tiers, Number(product.group_buy_current ?? 0))
    const appliedDiscountPct = currentTier.discount_pct
    const unitPrice = Math.round(product.price * (1 - appliedDiscountPct / 100))
    const totalAmount = unitPrice * qty
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

    // 🛡️ 2026-05-13 (운영 안정성 #2): 딜 차감 후 후속 INSERT (orders/items/vouchers/progress)
    //   실패 시 자동 환불. D1 은 trx 미지원 — 명시적 rollback 으로 처리.
    //   복구 대상: deal 차감 + stock 차감 (이미 위에서 atomic 처리됨 → 여기서 함께 복구).
    const rollbackDealAndStock = async () => {
      if (payment_method === 'deal') {
        try {
          await DB.prepare("UPDATE user_points SET balance = balance + ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?")
            .bind(totalAmount, userId).run()
          await DB.prepare(
            `INSERT INTO point_transactions (user_id, type, amount, commission_amount, points_amount, balance_after, description, order_id)
             VALUES (?, 'refund', ?, 0, ?, (SELECT balance FROM user_points WHERE user_id = ?), ?, ?)`
          ).bind(userId, totalAmount, totalAmount, userId, `공동구매 자동 환불 (주문 실패): ${product.name}`, orderNumber).run()
        } catch (e) { console.error('[group-buy/join] deal rollback failed', e) }
      }
      // stock 도 복구
      try {
        await DB.prepare("UPDATE products SET stock = stock + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
          .bind(qty, productId).run()
      } catch (e) { console.error('[group-buy/join] stock rollback failed', e) }
    }

    try {

    // 🛡️ 2026-05-15: 셀러 차등 수수료 — GMV 기반 자동 (1천만+ 4%, 1억+ 3%) / 어드민 override 우선
    const commissionRate = await getSellerCommissionRate(DB, Number(product.seller_id))
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

      // 바우처 발급 (티어 할인 정보도 함께 기록)
      for (let i = 0; i < qty; i++) {
        const code = generateVoucherCode()
        const expiresAt = product.voucher_expiry || new Date(Date.now() + 90 * 86400000).toISOString()

        await DB.prepare(`
          INSERT INTO vouchers (order_id, product_id, user_id, code, expires_at, applied_discount_pct, applied_price)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).bind(order.id, productId, userId, code, expiresAt, appliedDiscountPct, unitPrice).run()
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

    const updated = await DB.prepare('SELECT group_buy_current, group_buy_target, group_buy_status, milestone_notified_50, milestone_notified_80, milestone_notified_lastone FROM products WHERE id = ?')
      .bind(productId).first<any>()

    // 🛡️ 2026-05-15: 마일스톤 알림 (50%, 80%, 1명 남음) — atomic CAS dedup
    //   진행 중 공구의 전환율을 높이기 위한 hot notification. push 만 (이메일 X — 너무 잦음).
    try {
      const tgt = Number(updated?.group_buy_target ?? 0)
      const cur = Number(updated?.group_buy_current ?? 0)
      if (tgt > 0 && updated?.group_buy_status === 'active') {
        const pct = (cur / tgt) * 100
        const remaining = tgt - cur

        const milestones: Array<{ flag: 'lastone' | '80' | '50'; condition: boolean; title: string; body: string }> = []
        if (remaining === 1 && !updated.milestone_notified_lastone) {
          milestones.push({ flag: 'lastone', condition: true, title: '🔥 1명만 더 모이면 공구 성공!', body: `${product.name} — 마지막 한 자리, 지금 참여하세요` })
        } else if (pct >= 80 && !updated.milestone_notified_80) {
          milestones.push({ flag: '80', condition: true, title: '🎯 공구 80% 달성!', body: `${product.name} — ${remaining}자리 남았어요` })
        } else if (pct >= 50 && !updated.milestone_notified_50) {
          milestones.push({ flag: '50', condition: true, title: '✨ 공구 절반 달성!', body: `${product.name} — ${remaining}자리 더 모이면 성공` })
        }

        for (const m of milestones) {
          // CAS: flag 컬럼이 0 일 때만 1로 set (멱등)
          const colName = `milestone_notified_${m.flag}`
          const cas = await DB.prepare(`UPDATE products SET ${colName} = 1 WHERE id = ? AND ${colName} = 0`).bind(productId).run().catch(() => ({ meta: { changes: 0 } }))
          if ((cas.meta?.changes ?? 0) === 0) continue

          // 관심 유저 알림 (interest_list 등록자) — 참여자 본인은 제외
          try {
            const { results: interested } = await DB.prepare(
              `SELECT DISTINCT user_id FROM interest_list WHERE product_id = ? AND user_id IS NOT NULL AND user_id != ?`
            ).bind(productId, userId).all<{ user_id: string }>().catch(() => ({ results: [] as { user_id: string }[] }))
            const { sendSystemPush } = await import('../../../lib/system-push')
            for (const u of interested ?? []) {
              try {
                await sendSystemPush(c.env, 'user', u.user_id, {
                  title: m.title, body: m.body,
                  url: `/group-buy/${productId}`, tag: `gb-milestone-${productId}-${m.flag}`,
                })
              } catch { /* ignore */ }
            }
          } catch { /* interest_list table may not exist */ }
        }
      }
    } catch (e) { console.error('[group-buy milestone notify]', e) }

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
    ).bind(order?.id, userId).all<{ code: string; expires_at: string }>()

    // 🛡️ 2026-05-15: Referral 추적 — affiliate_ref 헤더로 추천인 식별 시
    //   양쪽 0.5% 보너스 딜 (네트워크 효과 vs 마진 보호 균형).
    //   ✨ first-time-only: 같은 (ref, joiner) 조합은 1회만 보상 — point_transactions 에서 dedup.
    //   본인 self-refer 차단.
    try {
      const refRaw = c.req.header('X-Affiliate-Ref') || ''
      const refUserId = refRaw && /^\d+$/.test(refRaw) ? refRaw : null
      if (refUserId && refUserId !== String(userId)) {
        const refExists = await DB.prepare("SELECT 1 FROM users WHERE id = ?").bind(refUserId).first().catch(() => null)
        if (refExists) {
          // first-time check — 같은 추천 조합 이미 보상 받았는지 확인
          const alreadyRewarded = await DB.prepare(
            `SELECT 1 FROM point_transactions
             WHERE type = 'referral_bonus'
               AND user_id = ?
               AND description LIKE '%' || ? || '%'
             LIMIT 1`
          ).bind(userId, `from:${refUserId}`).first().catch(() => null)

          if (!alreadyRewarded) {
            const bonus = Math.round(totalAmount * 0.005)  // 0.5% 양쪽 (이전 1% → 절반)
            if (bonus > 0) {
              // 추천인 보너스
              await DB.prepare("UPDATE user_points SET balance = balance + ? WHERE user_id = ?").bind(bonus, refUserId).run().catch(() => {})
              await DB.prepare(
                `INSERT INTO point_transactions (user_id, type, amount, points_amount, balance_after, description, order_id)
                 VALUES (?, 'referral_bonus', ?, ?, (SELECT balance FROM user_points WHERE user_id = ?), ?, ?)`
              ).bind(refUserId, bonus, bonus, refUserId, `공구 추천 보상 (to:${userId}): ${product.name}`, orderNumber).run().catch(() => {})
              // 참여자 보너스
              await DB.prepare("UPDATE user_points SET balance = balance + ? WHERE user_id = ?").bind(bonus, userId).run().catch(() => {})
              await DB.prepare(
                `INSERT INTO point_transactions (user_id, type, amount, points_amount, balance_after, description, order_id)
                 VALUES (?, 'referral_bonus', ?, ?, (SELECT balance FROM user_points WHERE user_id = ?), ?, ?)`
              ).bind(userId, bonus, bonus, userId, `친구 추천 가입 보상 (from:${refUserId}): ${product.name}`, orderNumber).run().catch(() => {})
            }
          }
        }
      }
    } catch (e) { console.warn('[group-buy referral]', e) }

    // 🛡️ 2026-05-15: 이메일 영수증 — voucher 코드 첨부, best-effort (실패해도 join 성공).
    //   유저 email 조회 → Resend 발송 → 실패 시 silent (push 알림이 백업).
    try {
      const userRow = await DB.prepare("SELECT email, display_name FROM users WHERE id = ?")
        .bind(userId).first<{ email: string | null; display_name: string | null }>().catch(() => null)
      const userEmail = userRow?.email
      if (userEmail && (c.env as Env & { RESEND_API_KEY?: string }).RESEND_API_KEY) {
        // 🛡️ 2026-05-15: sendSystemEmail 사용 — 실패 시 email_failures 큐 자동 적재 → cron 재시도
        const { sendSystemEmail } = await import('../../../lib/system-email')
        const voucherList = (vouchers.results ?? []).map(v => `
          <tr>
            <td style="padding:8px 12px;border:1px solid #e5e7eb;font-family:monospace;font-size:13px;color:#ec4899;font-weight:700;">${v.code}</td>
            <td style="padding:8px 12px;border:1px solid #e5e7eb;font-size:13px;color:#6b7280;">${v.expires_at ? new Date(v.expires_at).toLocaleDateString('ko-KR') + ' 까지' : '-'}</td>
          </tr>`).join('')
        const html = `
          <div style="font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#fff;">
            <div style="text-align:center;padding:20px 0;border-bottom:1px solid #e5e7eb;">
              <h1 style="margin:0;font-size:22px;color:#111827;">🎫 공동구매 참여 영수증</h1>
              <p style="margin:8px 0 0;font-size:13px;color:#6b7280;">유어딜 (live.ur-team.com)</p>
            </div>
            <div style="padding:20px 0;">
              <p style="margin:0 0 12px;font-size:15px;color:#111827;">${userRow?.display_name || '고객'}님, 공동구매 참여를 확인했어요!</p>
              <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;">
                <tr><td style="padding:6px 0;color:#6b7280;width:120px;">주문번호</td><td style="padding:6px 0;font-family:monospace;color:#111827;">${orderNumber}</td></tr>
                <tr><td style="padding:6px 0;color:#6b7280;">상품명</td><td style="padding:6px 0;color:#111827;">${product.name}</td></tr>
                ${product.restaurant_name ? `<tr><td style="padding:6px 0;color:#6b7280;">매장</td><td style="padding:6px 0;color:#111827;">${product.restaurant_name}</td></tr>` : ''}
                <tr><td style="padding:6px 0;color:#6b7280;">수량</td><td style="padding:6px 0;color:#111827;">${qty}장</td></tr>
                ${appliedDiscountPct > 0 ? `<tr><td style="padding:6px 0;color:#6b7280;">🎉 티어 할인</td><td style="padding:6px 0;color:#ec4899;font-weight:700;">-${appliedDiscountPct}% 적용</td></tr>` : ''}
                <tr><td style="padding:6px 0;color:#6b7280;">결제 금액</td><td style="padding:6px 0;color:#111827;font-weight:700;">${totalAmount.toLocaleString('ko-KR')}딜</td></tr>
              </table>
              <h3 style="margin:20px 0 8px;font-size:15px;color:#111827;">발급된 바우처 코드</h3>
              <table style="width:100%;border-collapse:collapse;">
                <thead><tr><th style="padding:8px 12px;border:1px solid #e5e7eb;background:#f9fafb;font-size:12px;text-align:left;color:#6b7280;">코드</th><th style="padding:8px 12px;border:1px solid #e5e7eb;background:#f9fafb;font-size:12px;text-align:left;color:#6b7280;">만료일</th></tr></thead>
                <tbody>${voucherList}</tbody>
              </table>
              <div style="margin:24px 0;padding:14px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;">
                <p style="margin:0;font-size:13px;color:#991b1b;">💡 매장 방문 시 위 코드를 보여주세요. QR 코드는 <a href="https://live.ur-team.com/my-vouchers" style="color:#ec4899;text-decoration:none;font-weight:700;">내 바우처</a> 페이지에서 확인 가능합니다.</p>
              </div>
              <p style="margin:16px 0 0;text-align:center;">
                <a href="https://live.ur-team.com/my-vouchers" style="display:inline-block;padding:12px 24px;background:#ec4899;color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:700;">내 바우처 보기</a>
              </p>
            </div>
            <div style="padding:16px 0;border-top:1px solid #e5e7eb;text-align:center;font-size:11px;color:#9ca3af;">
              <p style="margin:0;">© 2026 리스터코퍼레이션. 문의: jiwon@ur-team.com</p>
            </div>
          </div>`
        await sendSystemEmail(c.env, userEmail, {
          subject: `[유어딜] 공구 참여 완료 — ${product.name} (${qty}장)`,
          html,
        }).catch((e) => console.warn('[group-buy email]', e))
      }
    } catch (e) { console.warn('[group-buy email outer]', e) }

    return c.json({
      success: true,
      data: {
        order_number: orderNumber,
        amount: totalAmount,
        unit_price: unitPrice,
        applied_discount_pct: appliedDiscountPct,
        commission: commissionAmount,
        seller_amount: sellerAmount,
        commission_rate: commissionRate,
        vouchers: vouchers.results ?? [],
        group_buy_current: (updated?.group_buy_current ?? 0),
        group_buy_target: updated?.group_buy_target ?? 0,
        next_tier: currentTier.next_tier,
      },
      message: appliedDiscountPct > 0
        ? `공동구매 참여 완료! 티어 할인 ${appliedDiscountPct}% 적용 + 바우처 ${qty}장 발급`
        : `공동구매 참여 완료! 바우처 ${qty}장이 발급되었습니다.`,
    })
    } catch (innerErr) {
      // 🛡️ 2026-05-13 (운영 안정성 #2): 딜 차감 후 후속 INSERT 실패 시 자동 환불 + stock 복구
      console.error('[group-buy/join] post-deduction failure, rolling back', innerErr)
      await rollbackDealAndStock()
      throw innerErr  // 외부 catch 가 사용자에게 안내
    }
  } catch (err) {
    console.error('[group-buy] Error:', err)
    return c.json({ success: false, error: '공동구매 참여 중 오류가 발생했습니다. 차감된 딜은 자동 환불되었습니다.' }, 500)
  }
})

// ── GET /api/vouchers/my — 내 바우처 목록 ───────────────────────────
groupBuyRoutes.get('/my', requireAuth(), async (c) => {
  const user = getCurrentUser(c)
  if (!user) return c.json({ success: false, error: '로그인 필요' }, 401)

  const { DB } = c.env
  await ensureTables(DB)

  // 🛡️ 2026-05-15: lat/lng 추가 — 지도 뷰용
  const { results } = await DB.prepare(`
    SELECT v.*, p.name as product_name, p.restaurant_name, p.restaurant_address,
           p.restaurant_lat, p.restaurant_lng, p.restaurant_phone,
           p.image_url as product_image
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

    // 🛡️ 2026-05-13 (운영 안정성 #3): 모든 사용 시도 로그 — 셀러가 사용 흐름 추적.
    //   PIN 정답 여부는 노출하지 않지만, 셀러 본인은 자기 가게의 PIN 오류 빈도 알 필요 있음.
    //   table 자동 생성 (lazy CREATE IF NOT EXISTS).
    try {
      await DB.prepare(`
        CREATE TABLE IF NOT EXISTS voucher_use_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          code TEXT NOT NULL,
          product_id INTEGER,
          seller_id INTEGER,
          success INTEGER NOT NULL,
          reason TEXT,
          ip_hash TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `).run()
      await DB.prepare(`
        CREATE INDEX IF NOT EXISTS idx_voucher_use_logs_seller ON voucher_use_logs(seller_id, created_at DESC)
      `).run()
    } catch { /* ignore */ }

    const success = (result.meta?.changes ?? 0) > 0
    let failReason: string | null = null
    let voucherRecord: { status: string; expires_at: string | null; product_id: number } | null = null
    if (!success) {
      voucherRecord = await DB.prepare(
        "SELECT status, expires_at, product_id FROM vouchers WHERE code = ?"
      ).bind(code).first()
      if (!voucherRecord) failReason = 'not_found'
      else if (voucherRecord.status === 'used') failReason = 'already_used'
      else if (voucherRecord.status === 'expired') failReason = 'expired'
      else if (voucherRecord.status === 'refunded') failReason = 'refunded'
      else failReason = 'pin_mismatch'
    }
    // 로그 INSERT (best-effort) — seller_id 는 product 에서 조회
    try {
      const productId = voucherRecord?.product_id ?? (success
        ? (await DB.prepare("SELECT product_id FROM vouchers WHERE code = ?").bind(code).first<{ product_id: number }>())?.product_id
        : null)
      const sellerId = productId
        ? (await DB.prepare("SELECT seller_id FROM products WHERE id = ?").bind(productId).first<{ seller_id: number }>())?.seller_id
        : null
      const ipRaw = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || ''
      // IP 해시 (개인정보 직접 저장 X)
      const ipHash = ipRaw ? Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ipRaw + (c.env.JWT_SECRET || '')))))
        .slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join('') : null
      await DB.prepare(`
        INSERT INTO voucher_use_logs (code, product_id, seller_id, success, reason, ip_hash)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(code, productId ?? null, sellerId ?? null, success ? 1 : 0, failReason, ipHash).run()
    } catch (e) {
      if (import.meta.env?.DEV) console.warn('[voucher use log]', e)
    }

    if (!success) {
      if (failReason === 'not_found') return c.json({ success: false, error: '바우처를 찾을 수 없습니다' }, 404)
      if (failReason === 'already_used') return c.json({ success: false, error: '이미 사용된 바우처입니다' }, 400)
      if (failReason === 'expired') return c.json({ success: false, error: '만료된 바우처입니다' }, 400)
      if (failReason === 'refunded') return c.json({ success: false, error: '환불된 바우처입니다' }, 400)
      return c.json({ success: false, error: '이미 사용되었거나 PIN이 틀립니다.' }, 400)
    }

    return c.json({ success: true, message: '식사권이 사용 처리되었습니다! 맛있게 드세요 🍽️' })
  }
)

// 🛡️ 2026-05-13 (공구 UX #1): 공개 수수료율 — 셀러 정산 미리보기용
//   셀러 인증 시 본인 차등 수수료 (GMV 기반) 반환, 비인증 시 기본값.
groupBuyRoutes.get('/commission-rate', async (c) => {
  try {
    const user = getCurrentUser(c)
    const userAsAny = user as unknown as { id?: number | string; type?: string; role?: string }
    const isSeller = user && (userAsAny.type === 'seller' || userAsAny.role === 'seller')
    if (isSeller && userAsAny.id) {
      const rate = await getSellerCommissionRate(c.env.DB, Number(userAsAny.id))
      return c.json({ success: true, rate, tiered: true })
    }
    const rate = await getMealVoucherCommissionRate(c.env.DB)
    return c.json({ success: true, rate, tiered: false })
  } catch {
    return c.json({ success: true, rate: 0.05, tiered: false })  // fallback 5%
  }
})

// 🛡️ 2026-05-13 (공구 UX #2): 셀러 본인 상품의 바우처 통계 (사용/미사용/만료/환불)
groupBuyRoutes.get('/seller-voucher-stats', requireAuth(), async (c) => {
  const user = getCurrentUser(c)
  if (!user) return c.json({ success: false, error: '로그인 필요' }, 401)
  const userAsAny = user as unknown as { id: number | string; type?: string; role?: string }
  const isSeller = userAsAny.type === 'seller' || userAsAny.role === 'seller'
  if (!isSeller) return c.json({ success: false, error: '셀러만 접근 가능' }, 403)

  const idsRaw = c.req.query('product_ids') || ''
  const ids = idsRaw.split(',').map(s => parseInt(s.trim())).filter(n => Number.isFinite(n) && n > 0)
  if (ids.length === 0) return c.json({ success: true, data: [] })

  try {
    const placeholders = ids.map(() => '?').join(',')
    // 셀러 본인 상품 검증
    const { results: owned } = await c.env.DB.prepare(
      `SELECT id FROM products WHERE seller_id = ? AND id IN (${placeholders})`
    ).bind(user.id, ...ids).all<{ id: number }>()
    const ownedIds = (owned ?? []).map(r => r.id)
    if (ownedIds.length === 0) return c.json({ success: true, data: [] })

    const ownedPlaceholders = ownedIds.map(() => '?').join(',')
    const { results } = await c.env.DB.prepare(`
      SELECT product_id,
        COUNT(*) as total,
        SUM(CASE WHEN status = 'used' THEN 1 ELSE 0 END) as used,
        SUM(CASE WHEN status = 'unused' THEN 1 ELSE 0 END) as unused,
        SUM(CASE WHEN status = 'expired' THEN 1 ELSE 0 END) as expired,
        SUM(CASE WHEN status = 'refunded' THEN 1 ELSE 0 END) as refunded
      FROM vouchers
      WHERE product_id IN (${ownedPlaceholders})
      GROUP BY product_id
    `).bind(...ownedIds).all()
    return c.json({ success: true, data: results ?? [] })
  } catch (err) {
    console.error('[seller-voucher-stats]', err)
    return c.json({ success: true, data: [] })
  }
})

// ── GET /api/group-buy/voucher-logs — 셀러 본인 가게 바우처 사용 시도 로그 ──
// 🛡️ 2026-05-13 (운영 안정성 #3): 셀러가 PIN 오류 / 만료 / 사용 빈도 확인 → 가게 문제 자가 진단.
groupBuyRoutes.get('/voucher-logs', requireAuth(), async (c) => {
  const user = getCurrentUser(c)
  if (!user) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const userAsAny = user as unknown as { id: number | string; type?: string; role?: string }
  const isSeller = userAsAny.type === 'seller' || userAsAny.role === 'seller'
  if (!isSeller) return c.json({ success: false, error: '셀러만 접근 가능합니다' }, 403)

  const { DB } = c.env
  const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') || '50')))
  try {
    const { results } = await DB.prepare(`
      SELECT l.id, l.code, l.product_id, l.success, l.reason, l.created_at,
             p.name as product_name, p.restaurant_name
      FROM voucher_use_logs l
      LEFT JOIN products p ON p.id = l.product_id
      WHERE l.seller_id = ?
      ORDER BY l.created_at DESC
      LIMIT ?
    `).bind(user.id, limit).all()

    // 요약 통계
    const summary = await DB.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as success_count,
        SUM(CASE WHEN reason = 'pin_mismatch' THEN 1 ELSE 0 END) as pin_errors,
        SUM(CASE WHEN reason = 'expired' THEN 1 ELSE 0 END) as expired_errors,
        SUM(CASE WHEN reason = 'already_used' THEN 1 ELSE 0 END) as already_used_errors
      FROM voucher_use_logs
      WHERE seller_id = ? AND created_at >= datetime('now', '-7 days')
    `).bind(user.id).first()

    return c.json({ success: true, data: { logs: results ?? [], summary } })
  } catch (err) {
    console.error('[voucher-logs]', err)
    return c.json({ success: true, data: { logs: [], summary: { total: 0 } } })  // fail-soft
  }
})

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

// ── GET /api/group-buy/admin/analytics — 어드민: 카테고리별 funnel + top groups ──
// 🛡️ 2026-05-15: 공구 의사결정 데이터 — 카테고리별 진행/달성률, 매출 top, 평균 참여율
groupBuyRoutes.get('/admin/analytics', requireAdmin(), async (c) => {
  const { DB } = c.env
  try {
    // 카테고리별 통계
    const { results: byCategory } = await DB.prepare(`
      SELECT
        category,
        COUNT(*) AS total_groups,
        SUM(CASE WHEN group_buy_status = 'achieved' THEN 1 ELSE 0 END) AS achieved,
        SUM(CASE WHEN group_buy_status = 'expired' AND group_buy_current < group_buy_target THEN 1 ELSE 0 END) AS failed,
        SUM(CASE WHEN group_buy_status = 'active' THEN 1 ELSE 0 END) AS active,
        SUM(group_buy_current) AS total_participants,
        SUM(group_buy_current * price) AS total_gmv
      FROM products
      WHERE category IN ('meal_voucher','beauty_voucher','health_voucher','pet_voucher','stay_voucher','activity_voucher')
        AND group_buy_target > 0
      GROUP BY category
      ORDER BY total_gmv DESC
    `).all().catch(() => ({ results: [] }))

    // GMV top 10
    const { results: topGroups } = await DB.prepare(`
      SELECT p.id, p.name, p.category, p.group_buy_current, p.group_buy_target, p.group_buy_status,
             p.price, (p.group_buy_current * p.price) AS gmv,
             s.name AS seller_name
      FROM products p
      LEFT JOIN sellers s ON s.id = p.seller_id
      WHERE p.category IN ('meal_voucher','beauty_voucher','health_voucher','pet_voucher','stay_voucher','activity_voucher')
        AND p.group_buy_target > 0
        AND p.group_buy_current > 0
      ORDER BY gmv DESC
      LIMIT 10
    `).all().catch(() => ({ results: [] }))

    // 일별 참여 추이 (최근 30일)
    const { results: daily } = await DB.prepare(`
      SELECT DATE(o.created_at) AS day,
             COUNT(DISTINCT o.id) AS orders,
             COUNT(DISTINCT v.id) AS vouchers_issued,
             SUM(o.total_amount) AS gmv
      FROM orders o
      LEFT JOIN vouchers v ON v.order_id = o.id
      WHERE o.order_number LIKE 'GB-%'
        AND o.created_at >= datetime('now', '-30 days')
        AND o.status = 'PAID'
      GROUP BY DATE(o.created_at)
      ORDER BY day DESC
    `).all().catch(() => ({ results: [] }))

    // 전체 합계
    const totals = await DB.prepare(`
      SELECT
        COUNT(*) AS total_groups,
        SUM(CASE WHEN group_buy_status = 'achieved' THEN 1 ELSE 0 END) AS achieved_groups,
        SUM(CASE WHEN group_buy_status = 'active' THEN 1 ELSE 0 END) AS active_groups,
        SUM(group_buy_current) AS total_participants
      FROM products
      WHERE category IN ('meal_voucher','beauty_voucher','health_voucher','pet_voucher','stay_voucher','activity_voucher')
        AND group_buy_target > 0
    `).first().catch(() => null)

    return c.json({
      success: true,
      data: { totals, by_category: byCategory ?? [], top_groups: topGroups ?? [], daily: daily ?? [] }
    })
  } catch (err) {
    console.error('[admin gb analytics]', err)
    return c.json({ success: false, error: '집계 실패' }, 500)
  }
})

// ── GET /api/group-buy/admin/list — 어드민: 전체 공구 현황 ──────────
// 🛡️ 2026-05-15: 어드민이 진행중/만료/취소 전부 조회 + 미달성 공구 필터
groupBuyRoutes.get('/admin/list', requireAdmin(), async (c) => {
  const { DB } = c.env
  const status = c.req.query('status') || 'all'
  const filter = c.req.query('filter') || ''
  try {
    let sql = `
      SELECT p.id, p.name, p.price, p.image_url, p.category,
             p.group_buy_target, p.group_buy_current, p.group_buy_status, p.group_buy_deadline,
             p.seller_id, s.name AS seller_name, s.profile_image AS seller_avatar,
             p.created_at, p.updated_at
      FROM products p
      LEFT JOIN sellers s ON s.id = p.seller_id
      WHERE p.category IN ('meal_voucher','beauty_voucher','health_voucher','pet_voucher','stay_voucher','activity_voucher')
    `
    const binds: unknown[] = []
    if (status !== 'all') { sql += ` AND p.group_buy_status = ?`; binds.push(status) }
    if (filter === 'unsuccessful') {
      sql += ` AND p.group_buy_status IN ('expired','cancelled') AND p.group_buy_target > 0 AND p.group_buy_current < p.group_buy_target`
    }
    sql += ` ORDER BY p.created_at DESC LIMIT 200`
    const { results } = await DB.prepare(sql).bind(...binds).all()
    return c.json({ success: true, data: results ?? [] })
  } catch (err) {
    console.error('[admin gb list]', err)
    return c.json({ success: false, error: '조회 실패' }, 500)
  }
})

// ── POST /api/group-buy/admin/force-refund/:productId — 어드민 강제 환불 ──
// 🛡️ 2026-05-15: status 와 무관하게 미사용 voucher 일괄 환불 + audit_logs 기록.
//   기존 /refund/:productId 는 status='expired' 필요. 분쟁/긴급 케이스에 어드민 직접 개입.
groupBuyRoutes.post('/admin/force-refund/:productId', requireAdmin(), async (c) => {
  const { DB } = c.env
  const adminUser = getCurrentUser(c)
  const productIdRaw = c.req.param('productId')
  const productIdNum = Number(productIdRaw)
  if (!Number.isFinite(productIdNum) || productIdNum <= 0 || !Number.isInteger(productIdNum)) {
    return c.json({ success: false, error: '잘못된 상품 ID 입니다' }, 400)
  }
  const productId = productIdNum
  let body: { reason?: string } = {}
  try { body = await c.req.json() } catch { /* allow empty */ }
  const reason = (body?.reason || '').toString().slice(0, 500)
  if (!reason || reason.length < 5) {
    return c.json({ success: false, error: '환불 사유(5자 이상)를 입력해주세요' }, 400)
  }

  try {
    const product = await DB.prepare(
      "SELECT id, name, price, seller_id, group_buy_status FROM products WHERE id = ?"
    ).bind(productId).first<{ id: number; name: string; price: number; seller_id: number; group_buy_status: string }>()
    if (!product) return c.json({ success: false, error: '상품을 찾을 수 없습니다' }, 404)

    const { results: vouchers } = await DB.prepare(
      "SELECT v.id, v.user_id, o.payment_method FROM vouchers v LEFT JOIN orders o ON v.order_id = o.id WHERE v.product_id = ? AND v.status = 'unused'"
    ).bind(productId).all<{ id: number; user_id: string; payment_method: string | null }>()

    let refundCount = 0
    const refundedUsers = new Set<string>()
    for (const v of vouchers ?? []) {
      const cas = await DB.prepare(
        "UPDATE vouchers SET status = 'refunded' WHERE id = ? AND status = 'unused'"
      ).bind(v.id).run()
      if ((cas.meta?.changes ?? 0) === 0) continue
      if (v.payment_method === 'deal_points' && v.user_id) {
        const amount = product.price
        try {
          await DB.prepare("UPDATE user_points SET balance = balance + ? WHERE user_id = ?")
            .bind(amount, v.user_id).run()
          await DB.prepare(
            "INSERT INTO point_transactions (user_id, type, amount, points_amount, balance_after, description) VALUES (?, 'refund', ?, ?, (SELECT balance FROM user_points WHERE user_id = ?), ?)"
          ).bind(v.user_id, amount, amount, v.user_id, `[어드민 환불] ${product.name}: ${reason}`).run()
        } catch (e) { console.error('[admin force-refund credit]', e) }
      }
      if (v.user_id) refundedUsers.add(v.user_id)
      refundCount++
    }

    await DB.prepare("UPDATE products SET group_buy_status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ?")
      .bind(productId).run()

    // audit log
    try {
      await DB.prepare(`
        CREATE TABLE IF NOT EXISTS audit_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          actor_type TEXT, actor_id TEXT,
          action TEXT NOT NULL, target_type TEXT, target_id TEXT,
          metadata TEXT, ip_hash TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `).run()
      await DB.prepare(
        "INSERT INTO audit_logs (actor_type, actor_id, action, target_type, target_id, metadata) VALUES ('admin', ?, 'group_buy.force_refund', 'product', ?, ?)"
      ).bind(String(adminUser?.id ?? ''), String(productId), JSON.stringify({ reason, refundCount, productName: product.name })).run()
    } catch { /* table missing — skip */ }

    // 환불받은 유저 + 셀러에게 푸시
    try {
      const { sendSystemPush } = await import('../../../lib/system-push')
      for (const uid of refundedUsers) {
        try {
          await DB.prepare(
            `INSERT INTO user_notifications (user_id, type, title, message, link)
             VALUES (?, 'group_buy_refunded', ?, ?, ?)`
          ).bind(uid, '공구 환불 완료', `${product.name} 보증금이 환불됐어요`, '/user/profile').run()
        } catch { /* ignore */ }
        try {
          await sendSystemPush(c.env, 'user', uid, {
            title: '공구 환불 완료',
            body: `${product.name} 환불됐어요`,
            url: '/user/profile',
            tag: `gb-refunded-${productId}`,
          })
        } catch { /* ignore */ }
      }
      // 셀러 dashboard notification
      try {
        await DB.prepare(
          `INSERT INTO notifications (user_id, type, title, body, link, created_at)
           VALUES ((SELECT user_id FROM sellers WHERE id = ?), 'group_buy_admin_refund', ?, ?, '/seller/group-buy', CURRENT_TIMESTAMP)`
        ).bind(product.seller_id, '관리자 환불 처리', `${product.name} 공구가 어드민에 의해 환불 처리됐습니다 (${refundCount}건). 사유: ${reason}`).run()
      } catch { /* notifications table may not exist */ }
    } catch (e) { console.error('[admin force-refund notify]', e) }

    return c.json({ success: true, data: { refunded: refundCount }, message: `${refundCount}건 환불 처리 완료` })
  } catch (err) {
    console.error('[admin gb force-refund]', err)
    return c.json({ success: false, error: '환불 처리 중 오류' }, 500)
  }
})

export { generateStoreOwnerToken, sendStoreOwnerAlimtalk }

export { groupBuyRoutes }
