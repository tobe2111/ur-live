/**
 * 🤝💰 에이전시 콘솔 — 인플루언서 소개비 계약 (2026-11-11 결재 ⑤ · 스위치 `agency_influencer_deals_enabled` 기본 OFF)
 *   마운트: `agency-stores.routes.ts` 가 `registerAgencyDealRoutes(agencyStoresRoutes)` 로 얹는다(`/api/agency-console`).
 *
 *   GET    /stores/:sellerId/influencer-deals          — 우리 에이전시가 이 매장에서 건 계약 + 수수료·상한
 *   POST   /stores/:sellerId/influencer-deals          — { handle, pct } 유어샵 아이디에게 소개비를 건다(상한 안 = 바로 발효)
 *   POST   /stores/:sellerId/influencer-deals/:id/end  — 끝내기(다음 판매부터)
 *
 * 🔐 매장 판정은 판매 내역 라우트와 같은 문장(우리가 운영 중 + 이 직원에게 배정된 매장). 경로의 sellerId 는 '요청'일 뿐.
 */
import type { Hono } from 'hono'
import { cors } from 'hono/cors'
import { rateLimit } from '@/worker/middleware/rate-limit'
import { safeError } from '@/worker/utils/safe-error'
import { sendSystemAlimtalk } from '@/lib/system-alimtalk'
import { notifySeller } from '@/lib/notifications'
import { storeGoPath } from '@/shared/store-deep-link'
import { ensureAgencyConsoleTables, staffStoreAccessSql } from './agency-schema'
import { requireAgencyStaff, type AgencyStaffContext } from './agency-session'
import {
  AGENCY_DEAL_TPL, endAgencyDeal, isAgencyDealsEnabled, listAgencyDeals, msgAgencyDealApproval, proposeAgencyDeal,
} from './agency-influencer-deals'

type Bindings = { DB: D1Database; JWT_SECRET: string; FRONTEND_URL?: string }
type Vars = { agencyStaff: AgencyStaffContext }

async function ownsStore(DB: D1Database, me: AgencyStaffContext, sellerId: number): Promise<boolean> {
  await ensureAgencyConsoleTables(DB)
  const ok = await DB.prepare(
    `SELECT 1 AS ok FROM agency_store_links l JOIN agency_staff me ON me.id = ? AND me.agency_id = l.agency_id
      WHERE l.seller_id = ? AND l.agency_id = ? AND l.status = 'active' AND ${staffStoreAccessSql('me', 'l.seller_id')} LIMIT 1`,
  ).bind(me.staffId, sellerId, me.agencyId).first<{ ok: number }>()
  return !!ok
}

const HANDLE_RE = /^[a-z0-9._-]{2,40}$/i

export function registerAgencyDealRoutes(app: Hono<{ Bindings: Bindings; Variables: Vars }>) {
  app.get('/stores/:sellerId/influencer-deals', requireAgencyStaff(), async (c) => {
    try {
      const me = c.get('agencyStaff')
      const sellerId = Number(c.req.param('sellerId'))
      if (!Number.isInteger(sellerId) || sellerId <= 0) return c.json({ success: false, error: '잘못된 매장이에요.' }, 400)
      const DB = c.env.DB
      const enabled = await isAgencyDealsEnabled(DB)
      if (!enabled) return c.json({ success: true, enabled: false, deals: [] })
      if (!(await ownsStore(DB, me, sellerId))) return c.json({ success: false, error: '우리 에이전시가 맡은 매장이 아니에요.' }, 403)
      const deals = await listAgencyDeals(DB, { sellerId, agencyId: me.agencyId })
      return c.json({ success: true, enabled: true, deals })
    } catch (err) {
      return safeError(c, err, '소개비 계약을 불러오지 못했어요', '[agency-console:deals]')
    }
  })

  app.post('/stores/:sellerId/influencer-deals', cors(), requireAgencyStaff(),
    rateLimit({ action: 'agency_influencer_deal', max: 60, windowSec: 3600 }), async (c) => {
      try {
        const me = c.get('agencyStaff')
        const sellerId = Number(c.req.param('sellerId'))
        if (!Number.isInteger(sellerId) || sellerId <= 0) return c.json({ success: false, error: '잘못된 매장이에요.' }, 400)
        const DB = c.env.DB
        if (!(await isAgencyDealsEnabled(DB))) return c.json({ success: false, code: 'FEATURE_OFF', error: '아직 열리지 않은 기능이에요.' }, 403)
        if (!(await ownsStore(DB, me, sellerId))) return c.json({ success: false, error: '우리 에이전시가 맡은 매장이 아니에요.' }, 403)
        const body = await c.req.json<{ handle?: unknown; pct?: unknown }>().catch(() => ({} as { handle?: unknown; pct?: unknown }))
        const handle = typeof body.handle === 'string' ? body.handle.trim().replace(/^@/, '') : ''
        if (!HANDLE_RE.test(handle)) return c.json({ success: false, error: '유어샵 아이디를 확인해 주세요.' }, 400)
        const pct = typeof body.pct === 'number' ? body.pct : typeof body.pct === 'string' && body.pct.trim() !== '' ? Number(body.pct) : NaN
        const user = await DB.prepare('SELECT id, name FROM users WHERE handle = ? LIMIT 1').bind(handle).first<{ id: number; name: string | null }>()
        if (!user) return c.json({ success: false, error: '그 유어샵을 찾지 못했어요.' }, 404)
        const r = await proposeAgencyDeal(DB, { sellerId, agencyId: me.agencyId, staffId: me.staffId, influencerUserId: Number(user.id), pct })
        if (!r.ok) return c.json({ success: false, code: r.code, error: r.error }, r.status)
        if (r.status === 'pending_owner') {
          // 상한을 넘었다 — 사장님께 승인 요청(앱 알림은 언제나, 알림톡은 카카오 검수 뒤부터).
          const store = await DB.prepare('SELECT COALESCE(NULLIF(business_name, \'\'), name) AS name, phone FROM sellers WHERE id = ? LIMIT 1')
            .bind(sellerId).first<{ name: string | null; phone: string | null }>().catch(() => null)
          const agency = await DB.prepare('SELECT name FROM agency_accounts WHERE id = ? LIMIT 1').bind(me.agencyId).first<{ name: string | null }>().catch(() => null)
          const msg = msgAgencyDealApproval({ store: store?.name || '매장', agency: agency?.name || '에이전시', influencer: user.name || `@${handle}`, pct: Number(pct), fee: r.fee, budget: r.budget })
          await notifySeller(DB, sellerId, 'agency_deal', '에이전시 소개비 승인 요청', `${agency?.name || '에이전시'} · ${user.name || `@${handle}`} · ${pct}%`, storeGoPath(sellerId, 'agency')).catch(() => null)
          if (store?.phone) await sendSystemAlimtalk(c.env, store.phone, AGENCY_DEAL_TPL, msg, { sellerId, dedupKey: `agencydeal:${r.id}` }).catch(() => null)
        }
        return c.json({
          success: true, id: r.id, status: r.status,
          message: r.status === 'active' ? '소개비를 걸었어요. 지금부터 이 인플루언서 링크로 팔리면 붙어요.' : '총 마케팅 비용 상한을 넘어서 사장님께 승인을 요청했어요.',
        })
      } catch (err) {
        return safeError(c, err, '소개비를 걸지 못했어요', '[agency-console:deals]')
      }
    })

  app.post('/stores/:sellerId/influencer-deals/:id/end', cors(), requireAgencyStaff(), async (c) => {
    try {
      const me = c.get('agencyStaff')
      const sellerId = Number(c.req.param('sellerId'))
      const id = Number(c.req.param('id'))
      if (!Number.isInteger(sellerId) || sellerId <= 0 || !Number.isInteger(id) || id <= 0) return c.json({ success: false, error: '잘못된 요청이에요.' }, 400)
      if (!(await ownsStore(c.env.DB, me, sellerId))) return c.json({ success: false, error: '우리 에이전시가 맡은 매장이 아니에요.' }, 403)
      const ok = await endAgencyDeal(c.env.DB, { dealId: id, sellerId, agencyId: me.agencyId })
      return ok ? c.json({ success: true, message: '끝냈어요. 다음 판매부터 붙지 않아요.' }) : c.json({ success: false, error: '이미 끝난 계약이에요.' }, 409)
    } catch (err) {
      return safeError(c, err, '처리하지 못했어요', '[agency-console:deals]')
    }
  })
}
