/**
 * 🤝💰 사장님 — 에이전시 소개비 계약 보기 · 승인 · 거절 · 끝내기 (2026-11-11 결재 ⑤ · 스위치 OFF 면 빈 목록)
 *   등록: `registerAgencyLinkRoutes` 가 `registerOwnerAgencyDealRoutes(app, requireOwner)` 로 얹는다(`/api/seller` 아래).
 *
 *   GET  /agency-link/deals                 — 이 매장에 걸린 에이전시 소개비 계약(발효 · 승인 대기)
 *   POST /agency-link/deals/:id/decide      — { approve: boolean } 상한을 넘은 제안을 승인/거절(대기일 때만)
 *   POST /agency-link/deals/:id/end         — 끝내기(다음 판매부터)
 *
 * 🔐 주인만(`requireOwner`) — 에이전시 좌석은 이 경로에 못 온다(`agency-product-scope.ts` 허용목록 밖).
 */
import type { Context, Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { safeError } from '@/worker/utils/safe-error'
import { decideAgencyDeal, endAgencyDeal, isAgencyDealsEnabled, listAgencyDeals } from '../../agency-console/api/agency-influencer-deals'

type Ctx = Context<{ Bindings: Env }>
type RequireOwner = (c: Ctx) => Promise<{ userId: number; sellerId: number } | Response>

const posInt = (v: unknown): number | null => {
  const n = Number(v)
  return Number.isInteger(n) && n > 0 ? n : null
}

export function registerOwnerAgencyDealRoutes(app: Hono<{ Bindings: Env }>, requireOwner: RequireOwner): void {
  app.get('/agency-link/deals', async (c) => {
    try {
      const g = await requireOwner(c)
      if (g instanceof Response) return g
      if (!(await isAgencyDealsEnabled(c.env.DB))) return c.json({ success: true, enabled: false, deals: [] })
      const deals = await listAgencyDeals(c.env.DB, { sellerId: g.sellerId })
      return c.json({ success: true, enabled: true, deals })
    } catch (err) {
      return safeError(c, err, '소개비 계약을 불러오지 못했어요', '[seller-agency-deals]')
    }
  })

  app.post('/agency-link/deals/:id/decide', async (c) => {
    try {
      const g = await requireOwner(c)
      if (g instanceof Response) return g
      const id = posInt(c.req.param('id'))
      if (!id) return c.json({ success: false, error: '잘못된 요청이에요.' }, 400)
      const body = await c.req.json<{ approve?: unknown }>().catch(() => ({} as { approve?: unknown }))
      if (typeof body.approve !== 'boolean') return c.json({ success: false, error: '승인 또는 거절을 골라 주세요.' }, 400)
      const ok = await decideAgencyDeal(c.env.DB, { sellerId: g.sellerId, dealId: id, approve: body.approve, userId: g.userId })
      if (!ok) return c.json({ success: false, error: '이미 처리된 요청이에요.' }, 409)
      return c.json({ success: true, message: body.approve ? '승인했어요. 지금부터 붙어요.' : '거절했어요.' })
    } catch (err) {
      return safeError(c, err, '처리하지 못했어요', '[seller-agency-deals]')
    }
  })

  app.post('/agency-link/deals/:id/end', async (c) => {
    try {
      const g = await requireOwner(c)
      if (g instanceof Response) return g
      const id = posInt(c.req.param('id'))
      if (!id) return c.json({ success: false, error: '잘못된 요청이에요.' }, 400)
      const ok = await endAgencyDeal(c.env.DB, { dealId: id, sellerId: g.sellerId })
      return ok ? c.json({ success: true, message: '끝냈어요. 다음 판매부터 붙지 않아요.' }) : c.json({ success: false, error: '이미 끝난 계약이에요.' }, 409)
    } catch (err) {
      return safeError(c, err, '처리하지 못했어요', '[seller-agency-deals]')
    }
  })
}
