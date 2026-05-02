/**
 * 🛡️ 2026-04-28: MD 위탁 판매 API (셀러간 협업)
 *
 * 흐름:
 *   1) host 가 owner 의 상품을 위탁 신청 (POST /request)
 *   2) owner 가 승인 (POST /:id/approve)
 *   3) host 라이브에서 판매 → order_items.consignment_id 기록
 *   4) 정산 시 lib/consignment-split 으로 분배
 *
 * 마운트: app.route('/api/seller/consignment', consignmentRoutes)
 */
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { requireSeller, getCurrentUser } from '@/worker/middleware/auth'
import { ALLOWED_ORIGINS } from '@/shared/constants'
import { canApprove, canTerminate } from '@/lib/consignment-split'
import { getConsignmentSettlementsForSeller } from '@/lib/consignment-settlement'

type Bindings = {
  DB: D1Database
  JWT_SECRET: string
}

export const consignmentRoutes = new Hono<{ Bindings: Bindings }>()

consignmentRoutes.use('*', cors({
  origin: [...ALLOWED_ORIGINS],
  credentials: true,
}))

interface PartnershipRow {
  id: number
  host_seller_id: number
  owner_seller_id: number
  product_id: number
  host_commission_rate: number
  status: 'pending' | 'active' | 'paused' | 'ended'
  invited_by: 'host' | 'owner'
  message: string | null
  approved_at: string | null
  ended_at: string | null
  created_at: string
}

// ── POST /api/seller/consignment/request — 위탁 신청 (host 또는 owner 발신) ──
consignmentRoutes.post('/request', requireSeller(), async (c) => {
  try {
    const user = getCurrentUser(c)
    const sellerId = user?.id
    if (!sellerId) return c.json({ success: false, error: 'Unauthorized' }, 401)

    const body = await c.req.json<{
      counterparty_seller_id: number
      product_id: number
      host_commission_rate?: number
      message?: string
      role: 'host' | 'owner' // 신청자가 host (B 상품 받아오겠다) 인지 owner (B 상품 빌려주겠다) 인지
    }>()

    const { counterparty_seller_id, product_id, host_commission_rate, message, role } = body

    if (!counterparty_seller_id || !product_id || !role) {
      return c.json({ success: false, error: 'counterparty_seller_id, product_id, role 필수' }, 400)
    }
    if (sellerId === counterparty_seller_id) {
      return c.json({ success: false, error: '자기 자신과 위탁 파트너십을 만들 수 없습니다' }, 400)
    }

    // 🛡️ 2026-05-02: 위탁 판매 host 수수료 fallback 5% (platform_settings.commission_rate_default 와 일치)
    const rate = Number.isFinite(host_commission_rate) ? Math.max(0, Math.min(50, Number(host_commission_rate))) : 5

    // role 따라 host_seller_id / owner_seller_id 결정
    const hostId = role === 'host' ? sellerId : counterparty_seller_id
    const ownerId = role === 'host' ? counterparty_seller_id : sellerId

    // 상품 owner 검증 (owner_seller_id 가 실제 product 소유자여야 함)
    const product = await c.env.DB.prepare(
      'SELECT seller_id FROM products WHERE id = ? AND is_active = 1'
    ).bind(product_id).first<{ seller_id: number }>()

    if (!product) return c.json({ success: false, error: '상품을 찾을 수 없습니다' }, 404)
    if (product.seller_id !== ownerId) {
      return c.json({ success: false, error: '해당 상품의 소유자가 아닙니다' }, 403)
    }

    // 중복 파트너십 체크 (UNIQUE constraint 도 있지만 친절한 에러)
    const existing = await c.env.DB.prepare(
      'SELECT id, status FROM consignment_partnerships WHERE host_seller_id = ? AND product_id = ?'
    ).bind(hostId, product_id).first<{ id: number; status: string }>()

    if (existing && existing.status !== 'ended') {
      return c.json({
        success: false,
        error: `이미 진행 중인 위탁 파트너십이 있습니다 (status=${existing.status}, id=${existing.id})`,
      }, 409)
    }

    const result = await c.env.DB.prepare(`
      INSERT INTO consignment_partnerships
        (host_seller_id, owner_seller_id, product_id, host_commission_rate,
         status, invited_by, message, created_at, updated_at)
      VALUES (?, ?, ?, ?, 'pending', ?, ?, datetime('now'), datetime('now'))
    `).bind(hostId, ownerId, product_id, rate, role, message || null).run()

    return c.json({
      success: true,
      data: { id: result.meta?.last_row_id, status: 'pending' },
    })
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500)
  }
})

// ── POST /api/seller/consignment/:id/approve ──────────────────────────────
consignmentRoutes.post('/:id/approve', requireSeller(), async (c) => {
  try {
    const user = getCurrentUser(c)
    const sellerId = user?.id
    if (!sellerId) return c.json({ success: false, error: 'Unauthorized' }, 401)

    const id = Number(c.req.param('id'))
    if (!Number.isFinite(id)) return c.json({ success: false, error: 'invalid id' }, 400)

    const partnership = await c.env.DB.prepare(
      'SELECT * FROM consignment_partnerships WHERE id = ?'
    ).bind(id).first<PartnershipRow>()

    if (!partnership) return c.json({ success: false, error: '파트너십을 찾을 수 없습니다' }, 404)

    // actor 결정 (현재 셀러가 host 인지 owner 인지)
    const actor = partnership.host_seller_id === sellerId ? 'host'
      : partnership.owner_seller_id === sellerId ? 'owner'
      : null
    if (!actor) return c.json({ success: false, error: '파트너십 당사자가 아닙니다' }, 403)

    if (!canApprove(partnership.status, partnership.invited_by, actor)) {
      return c.json({
        success: false,
        error: `현재 상태(${partnership.status}) + 신청자(${partnership.invited_by}) + 승인자(${actor}) 조합으로는 승인할 수 없습니다`,
      }, 400)
    }

    await c.env.DB.prepare(`
      UPDATE consignment_partnerships
      SET status = 'active', approved_at = datetime('now'), updated_at = datetime('now')
      WHERE id = ?
    `).bind(id).run()

    return c.json({ success: true, data: { id, status: 'active' } })
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500)
  }
})

// ── POST /api/seller/consignment/:id/terminate ─────────────────────────────
consignmentRoutes.post('/:id/terminate', requireSeller(), async (c) => {
  try {
    const user = getCurrentUser(c)
    const sellerId = user?.id
    if (!sellerId) return c.json({ success: false, error: 'Unauthorized' }, 401)

    const id = Number(c.req.param('id'))
    const partnership = await c.env.DB.prepare(
      'SELECT * FROM consignment_partnerships WHERE id = ?'
    ).bind(id).first<PartnershipRow>()
    if (!partnership) return c.json({ success: false, error: '파트너십을 찾을 수 없습니다' }, 404)

    const actor = partnership.host_seller_id === sellerId ? 'host'
      : partnership.owner_seller_id === sellerId ? 'owner'
      : null
    if (!actor) return c.json({ success: false, error: '파트너십 당사자가 아닙니다' }, 403)

    if (!canTerminate(partnership.status, actor)) {
      return c.json({ success: false, error: '현재 상태에서 종료할 수 없습니다' }, 400)
    }

    await c.env.DB.prepare(`
      UPDATE consignment_partnerships
      SET status = 'ended', ended_at = datetime('now'), updated_at = datetime('now')
      WHERE id = ?
    `).bind(id).run()

    return c.json({ success: true, data: { id, status: 'ended' } })
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500)
  }
})

// ── GET /api/seller/consignment — 내 파트너십 목록 (host 또는 owner 입장 모두) ──
consignmentRoutes.get('/', requireSeller(), async (c) => {
  try {
    const user = getCurrentUser(c)
    const sellerId = user?.id
    if (!sellerId) return c.json({ success: false, error: 'Unauthorized' }, 401)

    const role = c.req.query('role') // 'host' | 'owner' | undefined (둘 다)
    const status = c.req.query('status') // optional filter

    const conditions: string[] = []
    const params: unknown[] = []
    if (role === 'host') {
      conditions.push('cp.host_seller_id = ?')
      params.push(sellerId)
    } else if (role === 'owner') {
      conditions.push('cp.owner_seller_id = ?')
      params.push(sellerId)
    } else {
      conditions.push('(cp.host_seller_id = ? OR cp.owner_seller_id = ?)')
      params.push(sellerId, sellerId)
    }
    if (status) {
      conditions.push('cp.status = ?')
      params.push(status)
    }

    const sql = `
      SELECT cp.*,
             p.name as product_name, p.thumbnail as product_thumbnail, p.price as product_price,
             hs.name as host_seller_name, os.name as owner_seller_name
      FROM consignment_partnerships cp
      LEFT JOIN products p ON p.id = cp.product_id
      LEFT JOIN sellers hs ON hs.id = cp.host_seller_id
      LEFT JOIN sellers os ON os.id = cp.owner_seller_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY cp.created_at DESC
      LIMIT 100
    `
    const { results } = await c.env.DB.prepare(sql).bind(...params).all()

    return c.json({ success: true, data: results || [] })
  } catch (err) {
    if ((err as Error).message?.includes('no such table')) {
      return c.json({ success: true, data: [] })
    }
    return c.json({ success: false, error: (err as Error).message }, 500)
  }
})

// ── GET /api/seller/consignment/settlements — 위탁 정산 조회 ─────────────
//   ?from=YYYY-MM-DD&to=YYYY-MM-DD (default: 이번 달)
//   응답: { as_host: [...], as_owner: [...], host_total, owner_total, platform_total }
consignmentRoutes.get('/settlements', requireSeller(), async (c) => {
  try {
    const user = getCurrentUser(c)
    const sellerId = user?.id
    if (!sellerId) return c.json({ success: false, error: 'Unauthorized' }, 401)

    const now = new Date()
    const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
    const defaultTo = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString().slice(0, 19).replace('T', ' ')
    const from = c.req.query('from') || defaultFrom
    const to = c.req.query('to') || defaultTo

    const result = await getConsignmentSettlementsForSeller(c.env.DB, Number(sellerId), from, to)
    return c.json({ success: true, data: { ...result, period: { from, to } } })
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500)
  }
})
