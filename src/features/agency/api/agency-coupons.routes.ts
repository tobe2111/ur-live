/**
 * Agency Coupon Distribution Routes (Q7)
 *
 * 마운트: /api/agency/coupons
 * 마이그레이션: 0216_coupons_agency_distribution.sql
 *
 * 흐름: 에이전시가 템플릿 쿠폰 1개 생성 → N명 셀러에게 배포 → 셀러별로 복제된 쿠폰 생성
 *      → 각 셀러는 자기 시청자에게 발급
 *
 * Endpoints:
 *   POST   /distribute              — 템플릿 쿠폰을 셀러 N명에게 배포 (자동 복제)
 *   GET    /distributions           — 본인 에이전시의 배포 이력
 *   GET    /distributions/:id/stats — 배포된 쿠폰의 사용 효과 분석
 *
 * 참조: docs/AGENCY_STRATEGY_QUICKWIN.md (Q7)
 */

import { Hono, type Next } from 'hono'
import { verify } from 'hono/jwt'
import { parseSessionCookie } from '@/worker/utils/session'
import type { Env } from '@/worker/types/env'
import { swallow } from '@/worker/utils/swallow'
import { requireAgencyPermission } from './agency-role-guard'

type AgencyCtx = {
  Bindings: Env
  Variables: { agency: { id: number; email?: string; name?: string } }
}

const app = new Hono<AgencyCtx>()

// ── auth (sub-app 부모 미들웨어 미상속) ──
function getBearerToken(h?: string | null): string | null {
  if (!h) return null
  const m = h.match(/^Bearer\s+(.+)$/i)
  return m ? m[1] : null
}
async function verifyAgencyToken(secret: string, token: string): Promise<{ id: number; email: string } | null> {
  if (!token) return null
  try {
    const payload = await verify(token, secret, 'HS256') as Record<string, unknown>
    if (payload.type !== 'agency' || !payload.sub) return null
    return { id: Number(payload.sub), email: String(payload.email) }
  } catch { return null }
}
const requireAgency = async (c: any, next: Next) => {
  let payload = await verifyAgencyToken(c.env.JWT_SECRET, getBearerToken(c.req.header('Authorization')) ?? '')
  if (!payload) {
    try {
      const sess = await parseSessionCookie(c.req.header('Cookie'), c.env.JWT_SECRET, ['agency'])
      if (sess && sess.userId) payload = { id: Number(sess.userId), email: sess.email || '' }
    } catch { /* */ }
  }
  if (!payload) return c.json({ success: false, error: '인증이 필요합니다.' }, 401)
  c.set('agency', payload)
  return next()
}

app.use('*', requireAgency)

// ── POST /distribute — 새 캠페인 쿠폰 생성 + N명 셀러에게 일괄 배포 ──
//
// body: {
//   name, type ('percent' | 'fixed'), value, min_order_amount?,
//   starts_at?, expires_at?,
//   seller_ids: number[],
//   quantity_per_seller: number  // 셀러당 시청자에게 발급 가능한 수
// }
// 🛡️ 2026-04-27: coupon 권한 필요 (analyst 차단)
app.post('/distribute', requireAgencyPermission('coupon'), async (c) => {
  const agencyId = c.get('agency').id
  const body = await c.req.json<{
    name: string;
    type: 'percent' | 'fixed';
    value: number;
    min_order_amount?: number;
    starts_at?: string;
    expires_at?: string;
    seller_ids: number[];
    quantity_per_seller: number;
  }>().catch(() => null)

  if (!body || !body.name || !body.type || !Number.isFinite(body.value)) {
    return c.json({ success: false, error: 'name, type, value 필수' }, 400)
  }
  if (!['percent', 'fixed'].includes(body.type)) {
    return c.json({ success: false, error: 'type 은 percent 또는 fixed' }, 400)
  }
  if (body.type === 'percent' && (body.value < 1 || body.value > 100)) {
    return c.json({ success: false, error: 'percent 값은 1~100' }, 400)
  }
  if (!Array.isArray(body.seller_ids) || body.seller_ids.length === 0) {
    return c.json({ success: false, error: 'seller_ids 필수' }, 400)
  }
  if (body.seller_ids.length > 100) {
    return c.json({ success: false, error: '한 번에 최대 100명' }, 400)
  }
  if (!Number.isFinite(body.quantity_per_seller) || body.quantity_per_seller < 1) {
    return c.json({ success: false, error: 'quantity_per_seller >= 1 필수' }, 400)
  }

  // 1) 자기 소속 셀러만 필터
  const ph = body.seller_ids.map(() => '?').join(',')
  const { results: ownedSellers } = await c.env.DB.prepare(`
    SELECT s.id AS seller_id, s.name AS seller_name
    FROM agency_sellers ag
    INNER JOIN sellers s ON s.id = ag.seller_id
    WHERE ag.agency_id = ? AND ag.seller_id IN (${ph})
  `).bind(agencyId, ...body.seller_ids).all<{ seller_id: number; seller_name: string }>()

  if (!ownedSellers?.length) {
    return c.json({ success: false, error: '본인 소속 셀러 없음' }, 400)
  }

  // 2) 부모(템플릿) 쿠폰 생성 (seller_id NULL = 에이전시 소유)
  const parentCode = `AG${agencyId}-${Date.now().toString(36).toUpperCase()}`
  const parentResult = await c.env.DB.prepare(`
    INSERT INTO coupons (code, name, type, value, min_order_amount, total_count, used_count, seller_id, distributed_by_agency_id, is_active, starts_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, 0, NULL, ?, 1, ?, ?)
  `).bind(
    parentCode, body.name, body.type, body.value,
    body.min_order_amount ?? 0,
    body.quantity_per_seller * ownedSellers.length,   // total = 셀러수 × 셀러당
    agencyId,
    body.starts_at ?? null, body.expires_at ?? null,
  ).run().catch(async (err) => {
    // distributed_by_agency_id 컬럼 미존재 → fallback (구 schema)
    if (import.meta.env.DEV) console.warn('[agency:coupons:distribute] migration 0216 not applied:', err)
    return c.env.DB.prepare(`
      INSERT INTO coupons (code, name, type, value, min_order_amount, total_count, used_count, is_active, starts_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, 0, 1, ?, ?)
    `).bind(
      parentCode, body.name, body.type, body.value,
      body.min_order_amount ?? 0,
      body.quantity_per_seller * ownedSellers.length,
      body.starts_at ?? null, body.expires_at ?? null,
    ).run()
  })
  const parentCouponId = parentResult.meta.last_row_id

  // 3) 각 셀러별 복제 쿠폰 생성 + distribution row
  let distributed = 0
  let failed = 0
  for (const seller of ownedSellers) {
    try {
      const childCode = `${parentCode}-S${seller.seller_id}`
      const child = await c.env.DB.prepare(`
        INSERT INTO coupons (code, name, type, value, min_order_amount, total_count, used_count, seller_id, distributed_by_agency_id, parent_coupon_id, is_active, starts_at, expires_at)
        VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, 1, ?, ?)
      `).bind(
        childCode, body.name, body.type, body.value,
        body.min_order_amount ?? 0,
        body.quantity_per_seller,
        seller.seller_id, agencyId, parentCouponId,
        body.starts_at ?? null, body.expires_at ?? null,
      ).run()

      await c.env.DB.prepare(`
        INSERT INTO agency_coupon_distributions (agency_id, parent_coupon_id, seller_id, child_coupon_id, quantity_per_seller)
        VALUES (?, ?, ?, ?, ?)
      `).bind(agencyId, parentCouponId, seller.seller_id, child.meta.last_row_id, body.quantity_per_seller)
        .run().catch(swallow('agency:coupon-dist-log'))

      // 셀러에게 알림
      await c.env.DB.prepare(`
        INSERT INTO dashboard_notifications (recipient_type, recipient_id, type, title, message, link, created_at)
        VALUES ('seller', ?, 'coupon_distributed', '에이전시 쿠폰 배포', ?, '/seller/coupons', datetime('now'))
      `).bind(
        String(seller.seller_id),
        `${body.name} (${body.quantity_per_seller}장) — 시청자에게 발급 가능`,
      ).run().catch(swallow('agency:coupon-notify'))

      distributed++
    } catch (e) {
      failed++
      console.error(`[agency:coupons:distribute] seller=${seller.seller_id} failed:`, e)
    }
  }

  return c.json({
    success: true,
    data: {
      parent_coupon_id: parentCouponId,
      parent_code: parentCode,
      distributed,
      failed,
      total_sellers: ownedSellers.length,
      requested_sellers: body.seller_ids.length,
    },
  })
})

// ── GET /distributions — 배포 이력 ──────────────────────
app.get('/distributions', async (c) => {
  const agencyId = c.get('agency').id
  const limit = Math.min(parseInt(c.req.query('limit') || '50'), 200)

  try {
    const { results } = await c.env.DB.prepare(`
      SELECT
        d.parent_coupon_id,
        p.name AS coupon_name,
        p.code AS parent_code,
        p.type, p.value, p.expires_at,
        COUNT(DISTINCT d.seller_id) AS distributed_to_sellers,
        SUM(d.quantity_per_seller) AS total_quantity,
        SUM(c.used_count) AS total_used,
        MIN(d.distributed_at) AS first_distributed_at
      FROM agency_coupon_distributions d
      INNER JOIN coupons p ON p.id = d.parent_coupon_id
      LEFT JOIN coupons c ON c.id = d.child_coupon_id
      WHERE d.agency_id = ?
      GROUP BY d.parent_coupon_id
      ORDER BY first_distributed_at DESC
      LIMIT ?
    `).bind(agencyId, limit).all()
    return c.json({ success: true, data: results || [] })
  } catch {
    return c.json({ success: false, data: [], error: 'agency_coupon_distributions 미존재 — migration 0216 필요' })
  }
})

// ── GET /distributions/:parentId/stats — 사용 효과 분석 ──
app.get('/distributions/:parentId/stats', async (c) => {
  const agencyId = c.get('agency').id
  const parentId = parseInt(c.req.param('parentId'))
  if (!Number.isFinite(parentId) || parentId <= 0) return c.json({ success: false, error: 'invalid id' }, 400)

  // 자기 에이전시 배포인지 확인
  const owned = await c.env.DB.prepare(
    'SELECT 1 FROM agency_coupon_distributions WHERE agency_id = ? AND parent_coupon_id = ? LIMIT 1'
  ).bind(agencyId, parentId).first()
  if (!owned) return c.json({ success: false, error: 'not found' }, 404)

  const { results: bySeller } = await c.env.DB.prepare(`
    SELECT
      d.seller_id,
      s.name AS seller_name,
      d.quantity_per_seller,
      c.used_count,
      ROUND(CAST(c.used_count AS REAL) / NULLIF(d.quantity_per_seller, 0) * 100, 1) AS usage_pct
    FROM agency_coupon_distributions d
    LEFT JOIN coupons c ON c.id = d.child_coupon_id
    LEFT JOIN sellers s ON s.id = d.seller_id
    WHERE d.agency_id = ? AND d.parent_coupon_id = ?
    ORDER BY c.used_count DESC
  `).bind(agencyId, parentId).all()

  return c.json({ success: true, data: { by_seller: bySeller || [] } })
})

export const agencyCouponsRoutes = app
