/**
 * 제휴 마케팅 (쿠팡파트너스형)
 * - 유저가 상품 링크 공유 → 누군가 구매 → 추천인에게 딜 포인트 적립
 * - 추천 링크: /products/123?ref=USER_ID
 * - 수수료: 구매 금액의 2% 딜 포인트
 */
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { requireAuth, getCurrentUser } from '@/worker/middleware/auth'
import type { Env } from '@/worker/types/env'
import { ALLOWED_ORIGINS } from '@/shared/constants'

const COMMISSION_RATE = 0.02 // 2%

export const affiliateRoutes = new Hono<{ Bindings: Env }>()
affiliateRoutes.use('*', cors({ origin: [...ALLOWED_ORIGINS], credentials: true }))

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
        order_amount INTEGER DEFAULT 0,
        commission INTEGER DEFAULT 0,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run()
  } catch {}
}

// ── POST /api/affiliate/track — 주문 완료 시 추천인 수수료 기록 ──
affiliateRoutes.post('/track', async (c) => {
  const { DB } = c.env
  await ensureTable(DB)
  const { referrer_id, order_id, product_id, product_name, buyer_id, order_amount } = await c.req.json<any>()

  if (!referrer_id || !order_id || !order_amount) {
    return c.json({ success: false, error: '필수 정보 없음' }, 400)
  }
  // 자기 자신 추천 방지
  if (referrer_id === buyer_id) {
    return c.json({ success: false, error: '본인 추천 불가' }, 400)
  }

  const commission = Math.round(order_amount * COMMISSION_RATE)

  // 중복 방지
  const existing = await DB.prepare(
    'SELECT id FROM affiliate_earnings WHERE referrer_id = ? AND order_id = ?'
  ).bind(referrer_id, order_id).first()
  if (existing) return c.json({ success: true, message: '이미 기록됨' })

  // 수수료 기록
  await DB.prepare(`
    INSERT INTO affiliate_earnings (referrer_id, order_id, product_id, product_name, buyer_id, order_amount, commission)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(referrer_id, order_id, product_id || null, product_name || null, buyer_id || null, order_amount, commission).run()

  // 딜 포인트 즉시 적립
  await DB.prepare(
    'UPDATE users SET deal_points = COALESCE(deal_points, 0) + ? WHERE id = ?'
  ).bind(commission, referrer_id).run()

  // 알림
  try {
    await DB.prepare(`
      INSERT INTO user_notifications (user_id, type, title, message, link, created_at)
      VALUES (?, 'affiliate_earning', ?, ?, '/user/affiliate', datetime('now'))
    `).bind(referrer_id, '💰 추천 수수료 적립!', `${commission}딜이 적립되었습니다`).run()
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

  const [total, recent] = await Promise.all([
    DB.prepare(`
      SELECT COUNT(*) AS total_referrals,
        COALESCE(SUM(commission), 0) AS total_earned,
        COALESCE(SUM(order_amount), 0) AS total_sales
      FROM affiliate_earnings WHERE referrer_id = ?
    `).bind(userId).first<{ total_referrals: number; total_earned: number; total_sales: number }>(),
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
      commission_rate: COMMISSION_RATE * 100,
      recent: recent?.results || [],
      share_url: `https://live.ur-team.com?ref=${userId}`,
    },
  })
})

// ── GET /api/affiliate/link/:productId — 추천 링크 생성 ──
affiliateRoutes.get('/link/:productId', requireAuth(), async (c) => {
  const user = getCurrentUser(c)
  if (!user) return c.json({ success: false, error: '로그인 필요' }, 401)
  const productId = c.req.param('productId')
  return c.json({
    success: true,
    data: { url: `https://live.ur-team.com/products/${productId}?ref=${user.id}` },
  })
})
