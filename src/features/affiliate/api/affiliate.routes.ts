/**
 * 제휴 마케팅 (쿠팡파트너스형)
 * - 유저가 상품/라이브 링크 공유 → 누군가 구매 → 추천인에게 딜 포인트 적립
 * - 추천 링크: /products/123?ref=USER_ID 또는 /live/456?ref=USER_ID
 * - 수수료: 플랫폼 설정 (기본 2%)
 * - 24시간 쿠키 추적 + 부정 방지
 */
import { Hono } from 'hono'
import { requireAuth, getCurrentUser } from '@/worker/middleware/auth'
import { creditAffiliateForOrder, resolveCommissionRate } from '../../../worker/utils/affiliate-credit'
import type { Env } from '@/worker/types/env'
import { ensureUserPointsTable } from '@/worker/utils/ensure-tables'
import { COMMISSION_DEFAULTS } from '../../../shared/constants/policy'

// 🛡️ 2026-05-22 정책 중앙화 — policy.ts (단일 진실원천)
const DEFAULT_COMMISSION_RATE = COMMISSION_DEFAULTS.AFFILIATE_COMMISSION_PCT / 100

export const affiliateRoutes = new Hono<{ Bindings: Env }>()
// 🛡️ 2026-05-13: redundant cors() 제거 — 전역 cors 가 처리.

async function ensureTable(DB: D1Database) {
  if (_done_ensureTable.has(DB)) return
  _done_ensureTable.add(DB)
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

/**
 * 🛡️ 2026-05-19: 상품별 추천 보상률 해석.
 *   1) products.referral_enabled = 1 이어야 추천 적용 (아니면 null 반환 → 차단)
 *   2) products.referral_commission_rate NOT NULL 이면 그 값 사용 (상품별 override)
 *   3) 아니면 platform_settings.affiliate_commission_rate (기본 5%)
 *   반환값은 ratio (0.05 = 5%).
 */
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

  // 🏁 2026-06-12: 코어를 creditAffiliateForOrder(worker/utils/affiliate-credit.ts)로 추출 —
  //   결제확정(/confirm) server-side 경로와 SSOT 공유. 검증/멱등/적립/알림 1:1 동일.
  //   라우트 고유 검사(호출자=구매자)만 여기 유지.
  const ownOrder = await DB.prepare('SELECT user_id FROM orders WHERE id = ?')
    .bind(order_id).first<{ user_id: string | number }>()
  if (!ownOrder) return c.json({ success: false, error: '주문을 찾을 수 없습니다' }, 404)
  if (String(ownOrder.user_id) !== String(authUser.id)) {
    return c.json({ success: false, error: '주문의 구매자만 추천 수수료를 기록할 수 있습니다' }, 403)
  }

  const result = await creditAffiliateForOrder(DB, c.env, {
    referrerId: String(referrer_id), orderId: Number(order_id),
    productId: product_id ? Number(product_id) : null,
    productName: product_name || null, buyerIp,
  })
  if (!result.ok) {
    switch (result.code) {
      case 'NOT_FOUND': return c.json({ success: false, error: '주문을 찾을 수 없습니다' }, 404)
      case 'NOT_PAID': return c.json({ success: false, error: '결제 완료된 주문만 수수료 대상입니다' }, 400)
      case 'SELF_REFERRAL': return c.json({ success: false, error: '본인 추천 불가' }, 400)
      case 'SELF_PURCHASE': return c.json({ success: false, error: '셀러 본인 구매는 추천 수수료 대상이 아닙니다' }, 400)
      case 'DUPLICATE': return c.json({ success: true, message: '이미 기록됨' })
      case 'IP_ABUSE': return c.json({ success: false, error: '비정상 패턴 감지' }, 400)
      case 'REFERRAL_DISABLED': return c.json({ success: false, error: '이 상품은 추천 보상 대상이 아닙니다', code: 'REFERRAL_DISABLED' }, 400)
      default: return c.json({ success: false, error: '추천 기록 중 오류' }, 500)
    }
  }
  return c.json({ success: true, message: '추천 수수료 기록 완료', commission: result.commission })
})

// ── GET /api/affiliate/stats — 내 추천 실적 ──
affiliateRoutes.get('/stats', requireAuth(), async (c) => {
  const user = getCurrentUser(c)
  if (!user) return c.json({ success: false, error: '로그인 필요' }, 401)
  const { DB } = c.env
  await ensureTable(DB)

  const userId = String(user.id)
  const rate = (await resolveCommissionRate(DB, null)) ?? 0.05

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

// ── GET /api/affiliate/funnel — 인플루언서 share 성과 funnel ──
// 🛡️ 2026-05-15: 본인 share 링크 클릭 → 가입 → 첫 결제 funnel 시각화
//   데이터: referral_commissions + point_transactions(type='referral_bonus')
affiliateRoutes.get('/funnel', requireAuth(), async (c) => {
  const user = getCurrentUser(c)
  if (!user) return c.json({ success: false, error: '로그인 필요' }, 401)
  const userId = user.id
  const { DB } = c.env

  try {
    // 1. 추천 보상 받은 횟수 (= 친구가 결제한 횟수)
    const bonusRow = await DB.prepare(`
      SELECT COUNT(*) AS bonus_count, COALESCE(SUM(amount), 0) AS total_earned
      FROM point_transactions
      WHERE user_id = ? AND type = 'referral_bonus'
    `).bind(userId).first<{ bonus_count: number; total_earned: number }>().catch(() => null)

    // 2. 카테고리별 분포 (description 에서 product 추출 — best-effort)
    const { results: byCategory } = await DB.prepare(`
      SELECT
        CASE
          WHEN description LIKE '%식사%' THEN 'meal'
          WHEN description LIKE '%뷰티%' THEN 'beauty'
          WHEN description LIKE '%헬스%' THEN 'health'
          WHEN description LIKE '%펫%' OR description LIKE '%반려%' THEN 'pet'
          WHEN description LIKE '%숙박%' OR description LIKE '%펜션%' THEN 'stay'
          WHEN description LIKE '%액티비티%' OR description LIKE '%클래스%' THEN 'activity'
          ELSE 'other'
        END AS category,
        COUNT(*) AS count,
        SUM(amount) AS earned
      FROM point_transactions
      WHERE user_id = ? AND type = 'referral_bonus'
      GROUP BY category
      ORDER BY earned DESC
    `).bind(userId).all().catch(() => ({ results: [] }))

    // 3. 일별 추이 (최근 30일)
    const { results: daily } = await DB.prepare(`
      SELECT DATE(created_at, '+9 hours') AS day,
             COUNT(*) AS count,
             SUM(amount) AS earned
      FROM point_transactions
      WHERE user_id = ?
        AND type = 'referral_bonus'
        AND created_at >= datetime('now', '-30 days')
      GROUP BY day
      ORDER BY day DESC
    `).bind(userId).all().catch(() => ({ results: [] }))

    return c.json({
      success: true,
      data: {
        total_referrals: Number(bonusRow?.bonus_count ?? 0),
        total_earned: Number(bonusRow?.total_earned ?? 0),
        by_category: byCategory ?? [],
        daily: daily ?? [],
      },
    })
  } catch (err) {
    console.error('[affiliate funnel]', err)
    return c.json({ success: true, data: { total_referrals: 0, total_earned: 0, by_category: [], daily: [] } })
  }
})

// ── GET /api/affiliate/top-groups — 인플루언서 추천: 지금 share 하면 좋을 공구 ──
// 🛡️ 2026-05-15: 알고리즘 — (1) 마감임박 + (2) 진행률 60%+ + (3) 단계별 할인 활성
//   = 지금 share → 친구 가입 가능성 높음 (양쪽 0.5% 보너스).
affiliateRoutes.get('/top-groups', requireAuth(), async (c) => {
  const user = getCurrentUser(c)
  if (!user) return c.json({ success: false, error: '로그인 필요' }, 401)
  const userId = user.id
  const { DB } = c.env
  try {
    const { results } = await DB.prepare(`
      SELECT
        p.id, p.name, p.image_url, p.price, p.category,
        p.restaurant_name, p.group_buy_target, p.group_buy_current,
        p.group_buy_deadline, p.group_buy_tiers,
        s.name AS seller_name,
        ROUND(p.group_buy_current * 100.0 / NULLIF(p.group_buy_target, 0)) AS progress_pct,
        ROUND(p.price * 0.005) AS my_potential_bonus
      FROM products p
      LEFT JOIN sellers s ON s.id = p.seller_id
      WHERE p.is_active = 1
        AND p.category IN ('meal_voucher','beauty_voucher','stay_voucher','etc_voucher','health_voucher','pet_voucher','activity_voucher')
        AND p.group_buy_status = 'active'
        AND p.group_buy_target > 0
        AND p.group_buy_deadline > datetime('now')
        AND p.group_buy_deadline < datetime('now', '+72 hours')
      ORDER BY
        (p.group_buy_current * 1.0 / p.group_buy_target) DESC,  -- 진행률 높은 순
        p.group_buy_deadline ASC                                  -- 마감임박 순
      LIMIT 10
    `).all().catch(() => ({ results: [] }))

    // share URL with ref + 'type' 필드 추가 (인플 대시보드가 type 별 다른 라우팅).
    const data = (results ?? []).map((r: any) => ({
      ...r,
      type: 'group-buy' as const,
      share_url: `https://live.ur-team.com/group-buy/${r.id}?ref=${userId}`,
    }))

    // 🛡️ 2026-05-18: referral 활성화된 stay 도 같이 추가 (top 10).
    const { results: stays } = await DB.prepare(`
      SELECT
        p.id, p.name, p.image_url, p.price,
        psi.influencer_discount_pct AS discount_pct,
        psi.influencer_commission_pct AS commission_pct,
        psi.region_sido, psi.property_type
      FROM products p
      INNER JOIN product_stay_info psi ON psi.product_id = p.id
      WHERE p.is_active = 1
        AND p.category = 'stay_voucher'
        AND psi.referral_enabled = 1
        AND psi.influencer_discount_pct > 0
      ORDER BY psi.influencer_commission_pct DESC, p.id DESC
      LIMIT 10
    `).all().catch(() => ({ results: [] }))
    const stayData = (stays ?? []).map((r: any) => ({
      ...r,
      type: 'stay' as const,
      share_url: `https://live.ur-team.com/stays/${r.id}?ref=${userId}`,
    }))

    return c.json({ success: true, data: [...stayData, ...data] })
  } catch (err) {
    console.error('[affiliate top-groups]', err)
    return c.json({ success: true, data: [] })
  }
})

// ── GET /api/affiliate/link/:type/:id — 추천 링크 생성 (상품/라이브) ──
affiliateRoutes.get('/link/:type/:id', requireAuth(), async (c) => {
  const user = getCurrentUser(c)
  if (!user) return c.json({ success: false, error: '로그인 필요' }, 401)
  const type = c.req.param('type') // 'product' | 'live' | 'group-buy' | 'stay'
  const id = c.req.param('id')
  // 🛡️ 2026-05-18: 'stay' 타입 추가 — 인플루언서 호텔 referral.
  const path = type === 'live' ? `/live/${id}`
    : type === 'group-buy' ? `/group-buy/${id}`
    : type === 'stay' ? `/stays/${id}`
    : `/products/${id}`
  return c.json({
    success: true,
    data: { url: `https://live.ur-team.com${path}?ref=${user.id}` },
  })
})


// 🛡️ 2026-05-19: ensure* per-worker 메모이제이션 (파일 끝).
const _done_ensureTable = new WeakSet<object>()
