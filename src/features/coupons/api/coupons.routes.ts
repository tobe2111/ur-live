import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { requireAuth, requireAdmin, getCurrentUser } from '@/worker/middleware/auth'
import { rateLimit } from '@/worker/middleware/rate-limit'
import type { Env } from '@/worker/types/env'
import { ALLOWED_ORIGINS } from '@/shared/constants'

const couponRoutes = new Hono<{ Bindings: Env }>()
couponRoutes.use('*', cors({ origin: [...ALLOWED_ORIGINS], credentials: true }))

async function ensureTables(DB: D1Database) {
  try { await DB.prepare(`CREATE TABLE IF NOT EXISTS coupons (id INTEGER PRIMARY KEY AUTOINCREMENT, code TEXT UNIQUE NOT NULL, name TEXT NOT NULL, type TEXT NOT NULL, value INTEGER NOT NULL, min_order_amount INTEGER DEFAULT 0, max_discount INTEGER, total_count INTEGER DEFAULT 0, used_count INTEGER DEFAULT 0, seller_id INTEGER, is_active INTEGER DEFAULT 1, starts_at DATETIME, expires_at DATETIME, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`).run() } catch {}
  try { await DB.prepare(`CREATE TABLE IF NOT EXISTS coupon_uses (id INTEGER PRIMARY KEY AUTOINCREMENT, coupon_id INTEGER NOT NULL, user_id TEXT NOT NULL, order_id INTEGER, discount_amount INTEGER NOT NULL, used_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE(coupon_id, user_id))`).run() } catch {}
}

// 쿠폰 적용 (코드 입력 → 할인 금액 반환)
couponRoutes.post('/apply', rateLimit({ action: 'coupon_apply', max: 10, windowSec: 60 }), requireAuth(), async (c) => {
  const user = getCurrentUser(c)
  if (!user) return c.json({ success: false, error: '로그인 필요' }, 401)
  const { DB } = c.env
  await ensureTables(DB)
  const { code, order_amount } = await c.req.json<{ code: string; order_amount: number }>()

  const coupon = await DB.prepare("SELECT * FROM coupons WHERE code = ? AND is_active = 1").bind(code).first<any>()
  if (!coupon) return c.json({ success: false, error: '유효하지 않은 쿠폰입니다' }, 404)
  if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) return c.json({ success: false, error: '만료된 쿠폰입니다' }, 400)
  if (coupon.total_count > 0 && coupon.used_count >= coupon.total_count) return c.json({ success: false, error: '쿠폰이 모두 소진되었습니다' }, 400)
  if (order_amount < coupon.min_order_amount) return c.json({ success: false, error: `최소 주문금액 ${coupon.min_order_amount.toLocaleString()}원 이상` }, 400)

  const used = await DB.prepare("SELECT id FROM coupon_uses WHERE coupon_id = ? AND user_id = ?").bind(coupon.id, String(user.id)).first()
  if (used) return c.json({ success: false, error: '이미 사용한 쿠폰입니다' }, 400)

  let discount = coupon.type === 'percent' ? Math.round(order_amount * coupon.value / 100) : coupon.value
  if (coupon.max_discount && discount > coupon.max_discount) discount = coupon.max_discount

  return c.json({ success: true, data: { coupon_id: coupon.id, name: coupon.name, discount, type: coupon.type, value: coupon.value } })
})

// 쿠폰 사용 확정 (결제 완료 시)
// ✅ BUG #23 FIX: Never trust client-supplied discount_amount. Recompute from
// the coupon row + actual order_amount. Caller may pass `order_amount` so we
// can recompute percent discounts; otherwise we fall back to the fixed value.
couponRoutes.post('/use', rateLimit({ action: 'coupon_use', max: 5, windowSec: 60 }), requireAuth(), async (c) => {
  const user = getCurrentUser(c)
  if (!user) return c.json({ success: false, error: '로그인 필요' }, 401)
  const { DB } = c.env
  const { coupon_id, order_id, order_amount } = await c.req.json<{ coupon_id: number; order_id: number; order_amount?: number }>()

  const coupon = await DB.prepare(
    'SELECT type, value, max_discount FROM coupons WHERE id = ? AND is_active = 1'
  ).bind(coupon_id).first<{ type: string; value: number; max_discount: number | null }>()
  if (!coupon) return c.json({ success: false, error: '유효하지 않은 쿠폰입니다' }, 404)

  const amountBase = Number(order_amount ?? 0)
  let computed = coupon.type === 'percent'
    ? Math.round(amountBase * coupon.value / 100)
    : coupon.value
  if (coupon.max_discount && computed > coupon.max_discount) {
    computed = coupon.max_discount
  }
  if (computed < 0) computed = 0

  await DB.prepare(
    'INSERT INTO coupon_uses (coupon_id, user_id, order_id, discount_amount) VALUES (?, ?, ?, ?)'
  ).bind(coupon_id, String(user.id), order_id, computed).run()
  await DB.prepare('UPDATE coupons SET used_count = used_count + 1 WHERE id = ?').bind(coupon_id).run()
  return c.json({ success: true, data: { discount_amount: computed } })
})

// 내 쿠폰 목록
couponRoutes.get('/my', requireAuth(), async (c) => {
  const user = getCurrentUser(c)
  if (!user) return c.json({ success: false, error: '로그인 필요' }, 401)
  const { DB } = c.env
  await ensureTables(DB)
  // 사용 가능한 쿠폰 (아직 안 쓴 것)
  const { results } = await DB.prepare(`
    SELECT c.* FROM coupons c WHERE c.is_active = 1 AND (c.expires_at IS NULL OR c.expires_at > datetime('now'))
    AND c.id NOT IN (SELECT coupon_id FROM coupon_uses WHERE user_id = ?)
    AND (c.total_count = 0 OR c.used_count < c.total_count)
  `).bind(String(user.id)).all()
  return c.json({ success: true, data: results ?? [] })
})

// 쿠폰 시드 생성 (배포 후 1회 호출: GET /api/coupons/seed)
// ✅ BUG #34 FIX: Require admin auth — previously open to anyone, allowing
// unauthenticated seeding of coupons.
couponRoutes.get('/seed', requireAdmin(), async (c) => {
  const { DB } = c.env
  await ensureTables(DB)

  const existing = await DB.prepare("SELECT id FROM coupons WHERE code = 'WELCOME2026'").first()
  if (existing) return c.json({ success: true, message: '이미 존재합니다', coupon_id: existing.id })

  await DB.prepare(`INSERT INTO coupons (code, name, type, value, min_order_amount, max_discount, total_count, used_count, is_active, expires_at)
    VALUES ('WELCOME2026', '카카오 채널 추가 감사 쿠폰', 'fixed', 3000, 10000, NULL, 10000, 0, 1, '2026-12-31 23:59:59')`).run()

  return c.json({ success: true, message: 'WELCOME2026 쿠폰 생성 완료 (3,000원 할인, 최소주문 10,000원, 10,000장)' })
})

// 자동 쿠폰 발급 (링크 클릭 → 로그인 유저에게 자동 지급)
couponRoutes.get('/claim/:code', requireAuth(), async (c) => {
  const user = getCurrentUser(c)
  if (!user) return c.json({ success: false, error: '로그인 필요' }, 401)
  const { DB } = c.env
  await ensureTables(DB)
  const code = c.req.param('code')

  const coupon = await DB.prepare("SELECT * FROM coupons WHERE code = ? AND is_active = 1").bind(code).first<Record<string, unknown>>()
  if (!coupon) return c.json({ success: false, error: '유효하지 않은 쿠폰입니다' }, 404)
  if (coupon.expires_at && new Date(coupon.expires_at as string) < new Date()) return c.json({ success: false, error: '만료된 쿠폰입니다' }, 400)
  if ((coupon.total_count as number) > 0 && (coupon.used_count as number) >= (coupon.total_count as number)) return c.json({ success: false, error: '쿠폰이 모두 소진되었습니다' }, 400)

  const used = await DB.prepare("SELECT id FROM coupon_uses WHERE coupon_id = ? AND user_id = ?").bind(coupon.id, String(user.id)).first()
  if (used) return c.json({ success: false, error: '이미 받은 쿠폰입니다', already_claimed: true })

  // 쿠폰 발급 (사용은 결제 시 별도)
  try {
    await DB.prepare(`CREATE TABLE IF NOT EXISTS user_coupons (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, coupon_id INTEGER NOT NULL, claimed_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE(user_id, coupon_id))`).run()
  } catch {}
  await DB.prepare("INSERT OR IGNORE INTO user_coupons (user_id, coupon_id) VALUES (?, ?)").bind(String(user.id), coupon.id).run()

  return c.json({ success: true, data: { coupon_id: coupon.id, name: coupon.name, type: coupon.type, value: coupon.value } })
})

export { couponRoutes }
