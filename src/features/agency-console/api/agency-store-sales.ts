/**
 * 📊 에이전시 콘솔 — 우리 이용권 **판매 내역 · 통계** (2026-10-24 대표 확정 "판매 내역·통계까지")
 *   마운트: `agency-stores.routes.ts` 가 `registerAgencySalesRoute(agencyStoresRoutes)` 로 얹는다(`/api/agency-console`).
 *
 *   GET /stores/:sellerId/sales?period=month|30d|all
 *
 * 매장 좌석 없이 **직원 토큰**으로 본다 — 오늘 숫자(목록 응답)와 같은 규칙이다(화면을 여는 것만으로 좌석을 받지 않는다).
 * 범위: 우리 에이전시에 운영 중으로 맡겨진 매장 + 이 직원에게 배정된 매장(`/stores` · 좌석 발급과 같은 판정).
 * 세는 것: 그 매장에서 **우리가 맡은 기간 안에** 팔린 이용권만(`channel-sales.ts` — 사장님 성과표와 같은 귀속 문장).
 * 🔒 손님 정보(이름·연락처·이용권 코드)는 싣지 않는다 — 에이전시에게 필요한 건 판매·사용·환불 흐름이다.
 * 사용처리(QR)는 매장 몫이라 여기엔 보기만 있다.
 */
import type { Hono } from 'hono'
import { safeError } from '@/worker/utils/safe-error'
import { ensureAgencyConsoleTables, staffStoreAccessSql } from './agency-schema'
import { requireAgencyStaff, type AgencyStaffContext } from './agency-session'
import { agencyStoreSales, parsePeriod } from './channel-sales'

type Bindings = { DB: D1Database; JWT_SECRET: string; FRONTEND_URL?: string }
type Vars = { agencyStaff: AgencyStaffContext }

export function registerAgencySalesRoute(app: Hono<{ Bindings: Bindings; Variables: Vars }>) {
  app.get('/stores/:sellerId/sales', requireAgencyStaff(), async (c) => {
    try {
      const me = c.get('agencyStaff')
      const sellerId = Number(c.req.param('sellerId'))
      if (!Number.isInteger(sellerId) || sellerId <= 0) return c.json({ success: false, error: '잘못된 매장이에요.' }, 400)
      const DB = c.env.DB
      await ensureAgencyConsoleTables(DB)
      // 🔐 유일한 방어선 — 경로의 sellerId 는 '요청'일 뿐. 우리가 운영 중이고 이 직원에게 배정된 매장인지 본다.
      const ok = await DB.prepare(
        `SELECT 1 AS ok FROM agency_store_links l JOIN agency_staff me ON me.id = ? AND me.agency_id = l.agency_id
          WHERE l.seller_id = ? AND l.agency_id = ? AND l.status = 'active' AND ${staffStoreAccessSql('me', 'l.seller_id')} LIMIT 1`,
      ).bind(me.staffId, sellerId, me.agencyId).first<{ ok: number }>()
      if (!ok) return c.json({ success: false, error: '우리 에이전시가 맡은 매장이 아니에요.' }, 403)
      const data = await agencyStoreSales(DB, sellerId, me.agencyId, parsePeriod(c.req.query('period')))
      return c.json({ success: true, data })
    } catch (err) {
      return safeError(c, err, '판매 내역을 불러오지 못했어요', '[agency-console:sales]')
    }
  })
}
