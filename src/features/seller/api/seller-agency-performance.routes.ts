/**
 * 📊 사장님 — **누가 팔았나** · 이용권을 에이전시에 맡기기 (2026-10-24 대표 확정)
 *   등록: `registerAgencyLinkRoutes` 가 `registerAgencyPerformanceRoutes(app, requireOwner)` 로 얹는다(`/api/seller` 아래).
 *
 *   GET  /agency-link/performance?period=month|30d|all — 사장님 직접 · 에이전시별 · 소개(유어샵 링크)별 판매
 *   GET  /agency-link/products                          — 이 매장 이용권 + 지금 맡은 에이전시
 *   POST /agency-link/assign { product_id, agency_id }  — 이용권을 에이전시에 맡기기 · 돌려받기(agency_id: null)
 *
 * 대표: *"사장님 화면에서 에이전시 별 성과(인플루언서 혹은 고유링크별 성과)를 따로 보여줘야지."*
 *       *"이미 있는 이용권을 특정 에이전시에도 배정하는 기능 필요해."*
 *
 * 🔐 셋 다 **현재 매장의 소유자**만(`requireOwner`). 에이전시 좌석은 서버 기본 차단(`agency-product-scope`)에도 걸린다 —
 *   에이전시가 이용권을 자기 쪽으로 끌어오거나 남의 성과를 볼 길이 없다.
 * 💰 집계는 읽기 전용이고, 배정은 성과 귀속 기록만 바꾼다(결제·정산·원장 무접촉).
 */
import type { Context, Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { rateLimit } from '@/worker/middleware/rate-limit'
import { safeError } from '@/worker/utils/safe-error'
import { ensureAgencyConsoleTables } from '../../agency-console/api/agency-schema'
import { assignAgencyProduct, parsePeriod, storeChannelPerformance } from '../../agency-console/api/channel-sales'

type Ctx = Context<{ Bindings: Env }>
type RequireOwner = (c: Ctx) => Promise<{ userId: number; sellerId: number } | Response>

const posInt = (v: unknown): number | null => {
  const n = Number(v)
  return Number.isInteger(n) && n > 0 ? n : null
}

export function registerAgencyPerformanceRoutes(app: Hono<{ Bindings: Env }>, requireOwner: RequireOwner): void {
  app.get('/agency-link/performance', async (c) => {
    try {
      const g = await requireOwner(c)
      if (g instanceof Response) return g
      await ensureAgencyConsoleTables(c.env.DB)
      const data = await storeChannelPerformance(c.env.DB, g.sellerId, parsePeriod(c.req.query('period')))
      return c.json({ success: true, data })
    } catch (err) {
      return safeError(c, err, '성과를 불러오지 못했어요', '[seller-agency-performance]')
    }
  })

  app.get('/agency-link/products', async (c) => {
    try {
      const g = await requireOwner(c)
      if (g instanceof Response) return g
      const DB = c.env.DB
      await ensureAgencyConsoleTables(DB)
      const { results } = await DB.prepare(
        `SELECT p.id, p.name, p.price, p.is_active, ap.agency_id
           FROM products p LEFT JOIN agency_products ap ON ap.product_id = p.id AND ap.seller_id = p.seller_id
          WHERE p.seller_id = ? AND COALESCE(p.status, '') != 'DELETED'
          ORDER BY p.is_active DESC, p.id DESC LIMIT 200`,
      ).bind(g.sellerId).all<{ id: number; name: string; price: number | null; is_active: number | null; agency_id: number | null }>()
      return c.json({
        success: true,
        data: (results || []).map((r) => ({
          id: Number(r.id), name: r.name, price: Number(r.price) || 0, active: Number(r.is_active) === 1,
          agencyId: r.agency_id == null ? null : Number(r.agency_id),
        })),
      })
    } catch (err) {
      return safeError(c, err, '이용권을 불러오지 못했어요', '[seller-agency-performance]')
    }
  })

  app.post('/agency-link/assign', rateLimit({ action: 'seller_agency_assign', max: 200, windowSec: 3600 }), async (c) => {
    try {
      const g = await requireOwner(c)
      if (g instanceof Response) return g
      const body = await c.req.json<{ product_id?: unknown; agency_id?: unknown }>().catch(() => ({} as { product_id?: unknown; agency_id?: unknown }))
      const productId = posInt(body.product_id)
      if (!productId) return c.json({ success: false, error: '이용권을 골라 주세요.' }, 400)
      const agencyId = body.agency_id == null ? null : posInt(body.agency_id)
      if (body.agency_id != null && !agencyId) return c.json({ success: false, error: '에이전시를 골라 주세요.' }, 400)
      const DB = c.env.DB
      await ensureAgencyConsoleTables(DB)
      // 🔐 이 매장 이용권만 — 경로·본문의 id 는 '요청'일 뿐이다.
      const product = await DB.prepare(
        "SELECT id FROM products WHERE id = ? AND seller_id = ? AND COALESCE(status, '') != 'DELETED' LIMIT 1",
      ).bind(productId, g.sellerId).first<{ id: number }>()
      if (!product) return c.json({ success: false, error: '이 매장의 이용권이 아니에요.' }, 404)
      // 지금 **운영 중**인 에이전시에만 맡긴다(수락 전 · 끊은 에이전시는 그 이용권을 열 수 없다).
      if (agencyId != null) {
        const link = await DB.prepare(
          "SELECT id FROM agency_store_links WHERE seller_id = ? AND agency_id = ? AND status = 'active' LIMIT 1",
        ).bind(g.sellerId, agencyId).first<{ id: number }>()
        if (!link) return c.json({ success: false, code: 'AGENCY_NOT_ACTIVE', error: '지금 운영 중인 에이전시에만 맡길 수 있어요.' }, 409)
      }
      const changed = await assignAgencyProduct(DB, productId, g.sellerId, agencyId)
      return c.json({ success: true, changed, data: { productId, agencyId } })
    } catch (err) {
      return safeError(c, err, '처리하지 못했어요', '[seller-agency-performance]')
    }
  })
}
