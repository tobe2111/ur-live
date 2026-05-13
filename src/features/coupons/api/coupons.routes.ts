import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { requireAuth, requireAdmin, getCurrentUser } from '@/worker/middleware/auth'
import { rateLimit } from '@/worker/middleware/rate-limit'
import type { Env } from '@/worker/types/env'
import { ALLOWED_ORIGINS } from '@/shared/constants'
const couponRoutes = new Hono<{ Bindings: Env }>()
// 🛡️ 2026-05-13: redundant cors() 제거 — 전역 cors 가 처리.

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

  // 🛡️ 입력 검증: code 는 문자열 + 길이 제한, order_amount 는 유한 숫자
  if (typeof code !== 'string' || code.length === 0 || code.length > 50) {
    return c.json({ success: false, error: '유효하지 않은 쿠폰 코드입니다' }, 400)
  }
  if (!Number.isFinite(order_amount) || order_amount < 0 || order_amount > 1_000_000_000) {
    return c.json({ success: false, error: '유효하지 않은 주문 금액입니다' }, 400)
  }

  const coupon = await DB.prepare("SELECT * FROM coupons WHERE code = ? AND is_active = 1").bind(code).first<any>()
  if (!coupon) return c.json({ success: false, error: '유효하지 않은 쿠폰입니다' }, 404)
  if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) return c.json({ success: false, error: '만료된 쿠폰입니다' }, 400)
  if (coupon.total_count > 0 && coupon.used_count >= coupon.total_count) return c.json({ success: false, error: '쿠폰이 모두 소진되었습니다' }, 400)
  if (order_amount < coupon.min_order_amount) return c.json({ success: false, error: `최소 주문금액 ${Number(coupon.min_order_amount ?? 0).toLocaleString('ko-KR')}원 이상` }, 400)

  const used = await DB.prepare("SELECT id FROM coupon_uses WHERE coupon_id = ? AND user_id = ?").bind(coupon.id, String(user.id)).first()
  if (used) return c.json({ success: false, error: '이미 사용한 쿠폰입니다' }, 400)

  let discount = coupon.type === 'percent' ? Math.round(order_amount * coupon.value / 100) : coupon.value
  if (coupon.max_discount && discount > coupon.max_discount) discount = coupon.max_discount

  return c.json({ success: true, data: { coupon_id: coupon.id, name: coupon.name, discount, type: coupon.type, value: coupon.value } })
})

// 쿠폰 사용 확정 (결제 완료 시)
// ✅ BUG #23 FIX: Never trust client-supplied discount_amount. Recompute from
// the coupon row + actual order_amount.
// ✅ SECURITY FIX (Payment C5): Verify the order belongs to the caller and use
// server-side total_amount. Also require max_discount cap for percent coupons.
couponRoutes.post('/use', rateLimit({ action: 'coupon_use', max: 5, windowSec: 60 }), requireAuth(), async (c) => {
  const user = getCurrentUser(c)
  if (!user) return c.json({ success: false, error: '로그인 필요' }, 401)
  const { DB } = c.env
  const { coupon_id, order_id } = await c.req.json<{ coupon_id: number; order_id: number; order_amount?: number }>()

  // 🛡️ 입력 검증: 양수 정수만 허용
  const couponIdNum = Number(coupon_id)
  const orderIdNum = Number(order_id)
  if (!Number.isFinite(couponIdNum) || couponIdNum < 1 || !Number.isInteger(couponIdNum)) {
    return c.json({ success: false, error: '유효하지 않은 coupon_id' }, 400)
  }
  if (!Number.isFinite(orderIdNum) || orderIdNum < 1 || !Number.isInteger(orderIdNum)) {
    return c.json({ success: false, error: '유효하지 않은 order_id' }, 400)
  }

  // ✅ Fetch order server-side and verify ownership
  const order = await DB.prepare(
    'SELECT user_id, total_amount FROM orders WHERE id = ?'
  ).bind(orderIdNum).first<{ user_id: string | number; total_amount: number }>()
  if (!order) return c.json({ success: false, error: '주문을 찾을 수 없습니다' }, 404)
  if (String(order.user_id) !== String(user.id)) {
    return c.json({ success: false, error: 'Forbidden' }, 403)
  }

  const coupon = await DB.prepare(
    'SELECT type, value, max_discount FROM coupons WHERE id = ? AND is_active = 1'
  ).bind(couponIdNum).first<{ type: string; value: number; max_discount: number | null }>()
  if (!coupon) return c.json({ success: false, error: '유효하지 않은 쿠폰입니다' }, 404)

  // ✅ Use authoritative order.total_amount (ignore any client-supplied order_amount)
  const amountBase = Number(order.total_amount) || 0
  let computed = coupon.type === 'percent'
    ? Math.round(amountBase * coupon.value / 100)
    : coupon.value

  // ✅ Percent coupons MUST have a max_discount cap; fall back to order amount
  //    to prevent excessive discounts on manipulated / large orders.
  if (coupon.type === 'percent') {
    const cap = coupon.max_discount ?? amountBase
    if (computed > cap) computed = cap
  } else if (coupon.max_discount && computed > coupon.max_discount) {
    computed = coupon.max_discount
  }
  // Never exceed the order total
  if (computed > amountBase) computed = amountBase
  if (computed < 0) computed = 0

  // ✅ CONCURRENCY: UNIQUE(coupon_id, user_id) guarantees single-use.
  //    If two concurrent requests both pass the earlier SELECT check,
  //    exactly one of these INSERTs will succeed; the other throws.
  try {
    const insertRes = await DB.prepare(
      'INSERT INTO coupon_uses (coupon_id, user_id, order_id, discount_amount) VALUES (?, ?, ?, ?)'
    ).bind(couponIdNum, String(user.id), orderIdNum, computed).run()
    if ((insertRes.meta?.changes ?? 0) === 0) {
      return c.json({ success: false, error: '이미 사용한 쿠폰입니다' }, 409)
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    if (/UNIQUE|constraint/i.test(msg)) {
      return c.json({ success: false, error: '이미 사용한 쿠폰입니다' }, 409)
    }
    throw e
  }
  // ✅ CONCURRENCY: also cap the global used_count so late inserts cannot
  //    push used_count past total_count (race with coupon_apply).
  await DB.prepare(
    'UPDATE coupons SET used_count = used_count + 1 WHERE id = ? AND (total_count = 0 OR used_count < total_count)'
  ).bind(couponIdNum).run()
  return c.json({ success: true, data: { discount_amount: computed } })
})

/**
 * v26 FIX: 결제 취소/환불 시 쿠폰 복원
 * webhook.routes.ts의 payment.cancelled 및 order.routes.ts의 refund 핸들러에서 호출.
 * 내부용이므로 requireAuth 대신 인증된 컨텍스트에서만 호출됨을 가정.
 *
 * @param DB D1Database
 * @param orderIds 복원할 주문 ID 배열
 */
export async function restoreCouponsForOrders(DB: D1Database, orderIds: (number | string)[]): Promise<number> {
  if (!orderIds.length) return 0
  // coupon_uses 조회 (취소할 쿠폰 + 전역 used_count 차감용)
  const placeholders = orderIds.map(() => '?').join(',')
  const rows = await DB.prepare(
    `SELECT coupon_id FROM coupon_uses WHERE order_id IN (${placeholders})`
  ).bind(...orderIds).all<{ coupon_id: number }>()
  const rawCouponIds = (rows.results || []).map(r => r.coupon_id)
  if (!rawCouponIds.length) return 0

  // v26 FIX: multi-seller 주문에서 같은 쿠폰이 여러 order에 쓰였으면 중복 제거
  // 쿠폰은 주문 단위가 아니라 쿠폰 단위로 used_count를 차감해야 함.
  const couponIds = [...new Set(rawCouponIds)]

  // D1 batch: DELETE + UPDATE used_count (per-coupon decrement)
  const stmts = [
    DB.prepare(`DELETE FROM coupon_uses WHERE order_id IN (${placeholders})`).bind(...orderIds),
    ...couponIds.map(id =>
      DB.prepare('UPDATE coupons SET used_count = MAX(used_count - 1, 0) WHERE id = ?').bind(id)
    ),
  ]
  await DB.batch(stmts)
  return couponIds.length
}

// 내 쿠폰 목록 — 발급받은 (claimed) 쿠폰만 표시.
// 🛡️ 2026-05-01 (CRITICAL fix): 사용자 신고 "카카오 채널 추가 감사 쿠폰을 추가도 안
//   했는데 발급되어 있다" — 이전 쿼리가 user_coupons (claim 테이블) 조회 안 하고
//   coupons 전체를 반환 → 모든 active 쿠폰이 사용자 쿠폰함에 표시됨.
//   수정: user_coupons (claim 기록) 와 INNER JOIN — claim 한 것만 표시.
couponRoutes.get('/my', requireAuth(), async (c) => {
  const user = getCurrentUser(c)
  if (!user) return c.json({ success: false, error: '로그인 필요' }, 401)
  const { DB } = c.env
  await ensureTables(DB)
  // user_coupons (claim 기록) 있고 + 아직 사용 안 한 (coupon_uses 에 없음) + 활성 쿠폰
  const { results } = await DB.prepare(`
    SELECT c.*, uc.claimed_at FROM coupons c
    INNER JOIN user_coupons uc ON uc.coupon_id = c.id
    WHERE uc.user_id = ?
      AND c.is_active = 1
      AND (c.expires_at IS NULL OR c.expires_at > datetime('now'))
      AND c.id NOT IN (SELECT coupon_id FROM coupon_uses WHERE user_id = ?)
    ORDER BY uc.claimed_at DESC
  `).bind(String(user.id), String(user.id)).all()
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

  // 🛡️ 입력 검증: code 길이 제한
  if (typeof code !== 'string' || code.length === 0 || code.length > 50) {
    return c.json({ success: false, error: '유효하지 않은 쿠폰 코드입니다' }, 400)
  }

  const coupon = await DB.prepare("SELECT * FROM coupons WHERE code = ? AND is_active = 1").bind(code).first<Record<string, unknown>>()
  if (!coupon) return c.json({ success: false, error: '유효하지 않은 쿠폰입니다' }, 404)
  if (coupon.expires_at && new Date(coupon.expires_at as string) < new Date()) return c.json({ success: false, error: '만료된 쿠폰입니다' }, 400)
  if ((coupon.total_count as number) > 0 && (coupon.used_count as number) >= (coupon.total_count as number)) return c.json({ success: false, error: '쿠폰이 모두 소진되었습니다' }, 400)

  // 🛡️ FIX: claim 중복 체크는 user_coupons (claim 테이블) 기준이어야 함.
  //   기존엔 coupon_uses (사용 기록) 기준이라, 발급만 받고 안 쓴 사용자가 무한 발급 가능.
  try {
    await DB.prepare(`CREATE TABLE IF NOT EXISTS user_coupons (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT NOT NULL, coupon_id INTEGER NOT NULL, claimed_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE(user_id, coupon_id))`).run()
  } catch {}
  const alreadyClaimed = await DB.prepare("SELECT id FROM user_coupons WHERE coupon_id = ? AND user_id = ?").bind(coupon.id, String(user.id)).first()
  if (alreadyClaimed) return c.json({ success: false, error: '이미 받은 쿠폰입니다', already_claimed: true })

  // 쿠폰 발급 (사용은 결제 시 별도). UNIQUE(user_id, coupon_id) 가 동시 요청 차단.
  await DB.prepare("INSERT OR IGNORE INTO user_coupons (user_id, coupon_id) VALUES (?, ?)").bind(String(user.id), coupon.id).run()

  return c.json({ success: true, data: { coupon_id: coupon.id, name: coupon.name, type: coupon.type, value: coupon.value } })
})

// 🛡️ 2026-05-01: 신규 가입자 자동 환영 쿠폰 발급 — WelcomeOnboardingModal 에서 호출.
//   기존엔 /coupons/apply 호출했지만 그건 검증만 (claim 안 됨). 이 endpoint 가
//   존재하는 'WELCOME' 코드 쿠폰을 사용자에게 발급 (user_coupons 에 INSERT).
//   - WELCOME 쿠폰이 admin 에 의해 코드로 등록돼 있어야 함 (없으면 silent skip).
//   - 이미 받은 사용자면 already_claimed 반환 (idempotent).
couponRoutes.post('/auto-issue/welcome', requireAuth(), async (c) => {
  const user = getCurrentUser(c)
  if (!user) return c.json({ success: false, error: '로그인 필요' }, 401)
  const { DB } = c.env
  await ensureTables(DB)

  // WELCOME 코드 쿠폰 조회 (admin 이 등록해야 작동)
  const coupon = await DB.prepare(
    "SELECT id, name, type, value, expires_at FROM coupons WHERE code = 'WELCOME' AND is_active = 1"
  ).first<{ id: number; name: string; type: string; value: number; expires_at: string | null }>()

  if (!coupon) {
    // admin 이 WELCOME 코드 쿠폰 등록 안 한 상태 — silent skip (UX 진행).
    return c.json({ success: true, data: null, message: 'WELCOME 코드 미등록 (silent skip)' })
  }

  if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
    return c.json({ success: true, data: null, message: '만료된 환영 쿠폰' })
  }

  // 이미 받은 사용자 체크 (idempotent)
  const existing = await DB.prepare(
    "SELECT id FROM user_coupons WHERE user_id = ? AND coupon_id = ?"
  ).bind(String(user.id), coupon.id).first()
  if (existing) {
    return c.json({ success: true, data: { coupon_id: coupon.id, name: coupon.name, type: coupon.type, value: coupon.value }, already_claimed: true })
  }

  // 발급
  await DB.prepare("INSERT OR IGNORE INTO user_coupons (user_id, coupon_id) VALUES (?, ?)")
    .bind(String(user.id), coupon.id).run()

  return c.json({ success: true, data: { coupon_id: coupon.id, name: coupon.name, type: coupon.type, value: coupon.value } })
})

export { couponRoutes }
