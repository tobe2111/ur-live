/**
 * 🔔 에이전시 콘솔 — 맡은 매장들의 판매 알림 (2026-10-12, 셀러 대시보드 제거 4단계 선행)
 *   마운트: agencyStoresRoutes(`/api/agency-console`) 에 `GET /notifications` · `POST /notifications/read`.
 *
 * 판매 알림(`dashboard_notifications` recipient_type='seller')은 대시보드 껍데기의 종에서만 보였다. 에이전시 직원도
 * 이제 콘솔에서 일하므로 여기서 본다(사장님은 마이에서 — `seller-store-notifications.ts`).
 *
 * ## 범위
 * 우리 에이전시에 **운영 중(active)** 으로 맡겨진 매장 중 **이 직원에게 배정된 것**(`staffStoreAccessSql` — `/stores` 목록과
 * 같은 문장). 읽음 처리도 그 안에서만. 알림함은 매장 단위라 직원이 읽으면 사장님 쪽에서도 읽음이 된다 — 대시보드 종도 그랬다.
 */
import type { Hono, Context } from 'hono'
import { intParam } from '@/shared/pagination'
import { safeError } from '@/worker/utils/safe-error'
import { ensureAgencyConsoleTables, staffStoreAccessSql } from './agency-schema'
import { requireAgencyStaff, type AgencyStaffContext } from './agency-session'

type Bindings = { DB: D1Database; JWT_SECRET: string; FRONTEND_URL?: string }
type Vars = { agencyStaff: AgencyStaffContext }
type App = Hono<{ Bindings: Bindings; Variables: Vars }>
type Ctx = Context<{ Bindings: Bindings; Variables: Vars }>

export const AGENCY_NOTIF_MAX_STORES = 60
/** 🤝 한 매장 · 여러 에이전시(2026-10-24) — 매장 단위 알림함을 에이전시에게 보이지 않는다. */
export const AGENCY_SCOPED_NOTIFICATIONS = true

/** 이 직원이 알림을 볼 수 있는 매장 — `/stores` 와 같은 판정(우리 에이전시 · active · 배정). */
export async function agencyNotifStores(c: Ctx): Promise<{ sellerId: number; name: string }[]> {
  const me = c.get('agencyStaff')
  await ensureAgencyConsoleTables(c.env.DB)
  const { results } = await c.env.DB.prepare(
    `SELECT l.seller_id, s.business_name, s.name AS seller_name
       FROM agency_store_links l
       JOIN agency_staff me ON me.id = ? AND me.agency_id = l.agency_id
       LEFT JOIN sellers s ON s.id = l.seller_id
      WHERE l.agency_id = ? AND l.status = 'active'
        AND ${staffStoreAccessSql('me', 'l.seller_id')}
      LIMIT ${AGENCY_NOTIF_MAX_STORES}`,
  ).bind(me.staffId, me.agencyId).all<{ seller_id: number; business_name: string | null; seller_name: string | null }>()
  return (results || []).map((r) => ({ sellerId: Number(r.seller_id), name: r.business_name || r.seller_name || `매장 ${r.seller_id}` }))
}

export function registerAgencyNotificationRoutes(app: App) {
  app.get('/notifications', requireAgencyStaff(), async (c) => {
    try {
      // 🤝 2026-10-24 — 매장 알림함은 **매장 단위**라 그 안엔 사장님·다른 에이전시의 판매가 섞여 있다(누구 이용권인지
      //   행에 없다). 한 매장 · 여러 에이전시 · 자기 것만(대표 확정)이 된 뒤로는 여기서 보여 줄 수 없다 → 비운다.
      //   에이전시 몫 알림은 다음 단계(판매 시 recipient_type='agency' 로 따로 쌓기 — 결제 확정 경로라 단독 작업).
      if (AGENCY_SCOPED_NOTIFICATIONS) return c.json({ success: true, data: { items: [], unread: 0, scoped: true } })
      const stores = await agencyNotifStores(c)
      if (stores.length === 0) return c.json({ success: true, data: { items: [], unread: 0 } })
      const ids = stores.map((s) => String(s.sellerId))
      const limit = Math.min(Math.max(1, intParam(c.req.query('limit'), 30)), 100)
      const { results } = await c.env.DB.prepare(
        `SELECT id, recipient_id, type, title, message, link, is_read, created_at,
                SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) OVER () AS _unread
           FROM dashboard_notifications
          WHERE recipient_type = 'seller' AND recipient_id IN (${ids.map(() => '?').join(',')})
          ORDER BY created_at DESC LIMIT ?`,
      ).bind(...ids, limit).all<{
        id: number; recipient_id: string; type: string; title: string; message: string | null
        link: string | null; is_read: number; created_at: string; _unread: number
      }>().catch(() => ({ results: [] as never[] }))
      const names = new Map(stores.map((s) => [s.sellerId, s.name]))
      const rows = results || []
      return c.json({
        success: true,
        data: {
          unread: rows.length > 0 ? Number(rows[0]._unread) || 0 : 0,
          items: rows.map((r) => ({
            id: r.id, sellerId: Number(r.recipient_id), storeName: names.get(Number(r.recipient_id)) ?? null,
            type: r.type, title: r.title, message: r.message, link: r.link, isRead: !!r.is_read, createdAt: r.created_at,
          })),
        },
      })
    } catch (err) {
      return safeError(c, err, '알림을 불러오지 못했어요', '[agency-console:notifications]')
    }
  })

  app.post('/notifications/read', requireAgencyStaff(), async (c) => {
    try {
      // 🤝 위와 같은 이유 — 에이전시가 읽으면 **사장님 알림까지** 읽음이 되던 길도 닫는다.
      if (AGENCY_SCOPED_NOTIFICATIONS) return c.json({ success: true, updated: 0 })
      const stores = await agencyNotifStores(c)
      if (stores.length === 0) return c.json({ success: true, updated: 0 })
      const ids = stores.map((s) => String(s.sellerId))
      const body = await c.req.json<{ ids?: unknown; all?: unknown }>().catch(() => ({} as { ids?: unknown; all?: unknown }))
      const scopeSql = `recipient_type = 'seller' AND recipient_id IN (${ids.map(() => '?').join(',')}) AND is_read = 0`
      if (body.all === true) {
        const r = await c.env.DB.prepare(`UPDATE dashboard_notifications SET is_read = 1 WHERE ${scopeSql}`).bind(...ids).run()
        return c.json({ success: true, updated: r.meta?.changes ?? 0 })
      }
      const want = Array.isArray(body.ids) ? body.ids.map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 50) : []
      if (want.length === 0) return c.json({ success: false, error: '읽을 알림이 없어요.' }, 400)
      const r = await c.env.DB.prepare(
        `UPDATE dashboard_notifications SET is_read = 1 WHERE ${scopeSql} AND id IN (${want.map(() => '?').join(',')})`,
      ).bind(...ids, ...want).run()
      return c.json({ success: true, updated: r.meta?.changes ?? 0 })
    } catch (err) {
      return safeError(c, err, '처리하지 못했어요', '[agency-console:notifications]')
    }
  })
}
