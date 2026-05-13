/**
 * 제휴 마케팅 (쿠팡파트너스형)
 * - 유저가 상품/라이브 링크 공유 → 누군가 구매 → 추천인에게 딜 포인트 적립
 * - 추천 링크: /products/123?ref=USER_ID 또는 /live/456?ref=USER_ID
 * - 수수료: 플랫폼 설정 (기본 2%)
 * - 24시간 쿠키 추적 + 부정 방지
 */
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { requireAuth, getCurrentUser } from '@/worker/middleware/auth'
import type { Env } from '@/worker/types/env'
import { ALLOWED_ORIGINS } from '@/shared/constants'
import { ensureUserPointsTable } from '@/worker/utils/ensure-tables'

const DEFAULT_COMMISSION_RATE = 0.02 // 2%

export const affiliateRoutes = new Hono<{ Bindings: Env }>()
// 🛡️ 2026-05-13: redundant cors() 제거 — 전역 cors 가 처리.

async function ensureTable(DB: D1Database) {
  try {
    await DB.prepare(`
      CREATE TABLE IF NOT EXISTS affiliate_earnings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        referrer_id TEXT NOT NULL,
        order_id INTEGER,
        product_id INTEGER,
        product_name TEXT,
        buyer_id TEXT,
        buyer_ip TEXT,
        order_amount INTEGER DEFAULT 0,
        commission INTEGER DEFAULT 0,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run()
  } catch {}
}

async function getCommissionRate(DB: D1Database): Promise<number> {
  try {
    const row = await DB.prepare("SELECT value FROM platform_settings WHERE key = 'affiliate_commission_rate'").first<{ value: string }>()
    if (row?.value) return parseFloat(row.value) / 100
  } catch {}
  return DEFAULT_COMMISSION_RATE
}

// ── POST /api/affiliate/track — 주문 완료 시 추천인 수수료 기록 ──
// ✅ SECURITY FIX (Payment C1): requireAuth + server-side order lookup.
// Previously unauthenticated and trusted client-supplied referrer_id / order_id /
// order_amount, allowing anyone to credit unlimited points to any account.
affiliateRoutes.post('/track', requireAuth(), async (c) => {
  const authUser = getCurrentUser(c)
  if (!authUser) return c.json({ success: false, error: '로그인 필요' }, 401)

  const { DB } = c.env
  await ensureTable(DB)
  const { referrer_id, order_id, product_id, product_name } = await c.req.json<any>()
  const buyerIp = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || ''

  if (!referrer_id || !order_id) {
    return c.json({ success: false, error: '필수 정보 없음' }, 400)
  }

  // ✅ Look up actual order from DB — trust nothing from client
  const order = await DB.prepare(
    'SELECT id, user_id, total_amount, status FROM orders WHERE id = ?'
  ).bind(order_id).first<{ id: number; user_id: string | number; total_amount: number; status: string }>()

  if (!order) {
    return c.json({ success: false, error: '주문을 찾을 수 없습니다' }, 404)
  }

  // ✅ Caller must be the buyer (prevents random attackers from triggering tracking)
  if (String(order.user_id) !== String(authUser.id)) {
    return c.json({ success: false, error: '주문의 구매자만 추천 수수료를 기록할 수 있습니다' }, 403)
  }

  // ✅ Only allow tracking once payment is confirmed
  const orderStatus = (order.status || '').toUpperCase()
  if (!['DONE', 'PAID'].includes(orderStatus)) {
    return c.json({ success: false, error: '결제 완료된 주문만 수수료 대상입니다' }, 400)
  }

  // ✅ Self-referral prevention (server-side comparison using DB user_id)
  if (String(referrer_id) === String(order.user_id)) {
    try {
      await DB.prepare(
        `INSERT INTO abuse_detections (pattern, user_id, ref_type, ref_id, evidence, severity)
         VALUES ('self_referral', ?, 'order', ?, ?, 'high')`
      ).bind(String(referrer_id), String(order.id), JSON.stringify({ buyer_id: order.user_id })).run()
    } catch { /* */ }
    return c.json({ success: false, error: '본인 추천 불가' }, 400)
  }

  // 🛡️ 2026-05-05 P0: 셀프 구매 차단 (셀러 본인이 추천 받아 자기 상품 구매)
  try {
    const sellerOwner = await DB.prepare(
      `SELECT s.user_id FROM orders o JOIN sellers s ON o.seller_id = s.id WHERE o.id = ? LIMIT 1`
    ).bind(order.id).first<{ user_id: string }>()
    if (sellerOwner?.user_id && String(sellerOwner.user_id) === String(order.user_id)) {
      try {
        await DB.prepare(
          `INSERT INTO abuse_detections (pattern, user_id, ref_type, ref_id, evidence, severity)
           VALUES ('self_purchase', ?, 'order', ?, ?, 'high')`
        ).bind(String(order.user_id), String(order.id), JSON.stringify({ sellerOwner, referrer_id })).run()
      } catch { /* */ }
      return c.json({ success: false, error: '셀러 본인 구매는 추천 수수료 대상이 아닙니다' }, 400)
    }
  } catch { /* */ }

  // 중복 방지
  const existing = await DB.prepare(
    'SELECT id FROM affiliate_earnings WHERE referrer_id = ? AND order_id = ?'
  ).bind(String(referrer_id), order.id).first()
  if (existing) return c.json({ success: true, message: '이미 기록됨' })

  // 부정 방지: 같은 IP에서 같은 추천인으로 24시간 내 3건 이상이면 차단
  if (buyerIp) {
    const recentFromIp = await DB.prepare(`
      SELECT COUNT(*) AS cnt FROM affiliate_earnings
      WHERE referrer_id = ? AND buyer_ip = ? AND created_at > datetime('now', '-24 hours')
    `).bind(String(referrer_id), buyerIp).first<{ cnt: number }>()
    if (recentFromIp && recentFromIp.cnt >= 3) {
      return c.json({ success: false, error: '비정상 패턴 감지' }, 400)
    }
  }

  // ✅ Use server-side total_amount (ignore client order_amount)
  const orderAmount = Number(order.total_amount) || 0
  const rate = await getCommissionRate(DB)
  const commission = Math.round(orderAmount * rate)

  // 수수료 기록
  await DB.prepare(`
    INSERT INTO affiliate_earnings (referrer_id, order_id, product_id, product_name, buyer_id, buyer_ip, order_amount, commission)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    String(referrer_id), order.id, product_id || null, product_name || null,
    String(order.user_id), buyerIp, orderAmount, commission,
  ).run()

  // 딜 포인트 즉시 적립 — user_points 테이블 사용 (production users 테이블에 deal_balance 컬럼 없음)
  try {
    await ensureUserPointsTable(DB)
    await DB.prepare(`
      INSERT INTO user_points (user_id, balance, total_charged)
      VALUES (?, ?, 0)
      ON CONFLICT(user_id) DO UPDATE SET
        balance = balance + excluded.balance,
        updated_at = datetime('now')
    `).bind(String(referrer_id), commission).run()
  } catch (e) {
    if (import.meta.env?.DEV) console.warn('[affiliate] user_points grant failed', e)
  }

  // 알림
  try {
    await DB.prepare(`
      INSERT INTO user_notifications (user_id, type, title, message, link, created_at)
      VALUES (?, 'affiliate_earning', ?, ?, '/user/affiliate', datetime('now'))
    `).bind(String(referrer_id), '💰 추천 수수료 적립!', `${commission}딜이 적립되었습니다`).run()
  } catch {}

  return c.json({ success: true, data: { commission } })
})

// ── GET /api/affiliate/stats — 내 추천 실적 ──
affiliateRoutes.get('/stats', requireAuth(), async (c) => {
  const user = getCurrentUser(c)
  if (!user) return c.json({ success: false, error: '로그인 필요' }, 401)
  const { DB } = c.env
  await ensureTable(DB)

  const userId = String(user.id)
  const rate = await getCommissionRate(DB)

  const [total, monthly, recent] = await Promise.all([
    DB.prepare(`
      SELECT COUNT(*) AS total_referrals,
        COALESCE(SUM(commission), 0) AS total_earned,
        COALESCE(SUM(order_amount), 0) AS total_sales
      FROM affiliate_earnings WHERE referrer_id = ?
    `).bind(userId).first<{ total_referrals: number; total_earned: number; total_sales: number }>(),
    DB.prepare(`
      SELECT COUNT(*) AS count, COALESCE(SUM(commission), 0) AS earned
      FROM affiliate_earnings WHERE referrer_id = ? AND created_at > datetime('now', '-30 days')
    `).bind(userId).first<{ count: number; earned: number }>(),
    DB.prepare(`
      SELECT product_name, order_amount, commission, created_at
      FROM affiliate_earnings WHERE referrer_id = ?
      ORDER BY created_at DESC LIMIT 20
    `).bind(userId).all(),
  ])

  return c.json({
    success: true,
    data: {
      total_referrals: total?.total_referrals || 0,
      total_earned: total?.total_earned || 0,
      total_sales: total?.total_sales || 0,
      monthly_count: monthly?.count || 0,
      monthly_earned: monthly?.earned || 0,
      commission_rate: rate * 100,
      recent: recent?.results || [],
      share_url: `https://live.ur-team.com?ref=${userId}`,
    },
  })
})

// ── GET /api/affiliate/link/:type/:id — 추천 링크 생성 (상품/라이브) ──
affiliateRoutes.get('/link/:type/:id', requireAuth(), async (c) => {
  const user = getCurrentUser(c)
  if (!user) return c.json({ success: false, error: '로그인 필요' }, 401)
  const type = c.req.param('type') // 'product' or 'live'
  const id = c.req.param('id')
  const path = type === 'live' ? `/live/${id}` : `/products/${id}`
  return c.json({
    success: true,
    data: { url: `https://live.ur-team.com${path}?ref=${user.id}` },
  })
})
