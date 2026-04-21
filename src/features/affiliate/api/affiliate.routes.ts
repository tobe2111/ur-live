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

const DEFAULT_COMMISSION_RATE = 0.02 // 2%

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
affiliateRoutes.post('/track', async (c) => {
  const { DB } = c.env
  await ensureTable(DB)
  const { referrer_id, order_id, product_id, product_name, buyer_id, order_amount } = await c.req.json<any>()
  const buyerIp = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || ''

  if (!referrer_id || !order_id || !order_amount) {
    return c.json({ success: false, error: '필수 정보 없음' }, 400)
  }
  // 자기 자신 추천 방지
  if (referrer_id === buyer_id) {
    return c.json({ success: false, error: '본인 추천 불가' }, 400)
  }

  // 중복 방지
  const existing = await DB.prepare(
    'SELECT id FROM affiliate_earnings WHERE referrer_id = ? AND order_id = ?'
  ).bind(referrer_id, order_id).first()
  if (existing) return c.json({ success: true, message: '이미 기록됨' })

  // 부정 방지: 같은 IP에서 같은 추천인으로 24시간 내 3건 이상이면 차단
  if (buyerIp) {
    const recentFromIp = await DB.prepare(`
      SELECT COUNT(*) AS cnt FROM affiliate_earnings
      WHERE referrer_id = ? AND buyer_ip = ? AND created_at > datetime('now', '-24 hours')
    `).bind(referrer_id, buyerIp).first<{ cnt: number }>()
    if (recentFromIp && recentFromIp.cnt >= 3) {
      return c.json({ success: false, error: '비정상 패턴 감지' }, 400)
    }
  }

  const rate = await getCommissionRate(DB)
  const commission = Math.round(order_amount * rate)

  // 수수료 기록
  await DB.prepare(`
    INSERT INTO affiliate_earnings (referrer_id, order_id, product_id, product_name, buyer_id, buyer_ip, order_amount, commission)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(referrer_id, order_id, product_id || null, product_name || null, buyer_id || null, buyerIp, order_amount, commission).run()

  // 딜 포인트 즉시 적립 (deal_balance 컬럼이 없는 환경에서는 silently ignore)
  try {
    await DB.prepare(
      'UPDATE users SET deal_balance = COALESCE(deal_balance, 0) + ? WHERE id = ?'
    ).bind(commission, referrer_id).run()
  } catch { /* deal_balance column may not exist */ }

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
