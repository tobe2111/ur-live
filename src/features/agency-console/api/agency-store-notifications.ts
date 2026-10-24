/**
 * 🔔 에이전시 콘솔 — **우리 이용권 판매 알림** (2026-10-12 신설 · 2026-10-24 판매 기록 기반으로 재작성)
 *   마운트: agencyStoresRoutes(`/api/agency-console`) 에 `GET /notifications` · `POST /notifications/read`.
 *
 * ## 왜 매장 알림함을 안 쓰나
 * 매장 알림함(`dashboard_notifications`)은 **매장 단위**라 누구 이용권인지가 행에 없다. 한 매장 · 여러 에이전시 ·
 * 자기 것만(2026-10-24 대표 확정)이 된 뒤로 그대로 보여 주면 사장님·다른 에이전시 판매가 섞인다.
 * 그래서 알림을 **판매 기록에서 바로 만든다**(`channel-sales.ts` `agencySaleEvents` — 우리가 맡은 기간 안에 팔린 우리 이용권).
 * 결제 확정 경로(잠금 파일)에 알림을 새로 쓰지 않아도 된다 — 판매가 기록되는 순간 여기서 보인다.
 *
 * ## 읽음
 * 사람(직원)마다 "어디까지 봤나" 하나(`agency_sales_seen`). 매장 알림함을 건드리지 않으므로 에이전시가 읽어도
 * 사장님 알림은 그대로다(종전엔 같이 읽음이 됐다).
 *
 * ## 범위
 * 우리 에이전시에 **운영 중(active)** 으로 맡겨진 매장 중 **이 직원에게 배정된 것**(`staffStoreAccessSql` — `/stores` 목록과 같은 문장).
 */
import type { Hono, Context } from 'hono'
import { intParam } from '@/shared/pagination'
import { safeError } from '@/worker/utils/safe-error'
import { ensureAgencyConsoleTables, staffStoreAccessSql } from './agency-schema'
import { requireAgencyStaff, type AgencyStaffContext } from './agency-session'
import { agencySaleEvents } from './channel-sales'

type Bindings = { DB: D1Database; JWT_SECRET: string; FRONTEND_URL?: string }
type Vars = { agencyStaff: AgencyStaffContext }
type App = Hono<{ Bindings: Bindings; Variables: Vars }>
type Ctx = Context<{ Bindings: Bindings; Variables: Vars }>

export const AGENCY_NOTIF_MAX_STORES = 60
/** 알림 종류 — 화면이 이 값으로 '판매 내역' 시트를 연다. */
export const AGENCY_SALE_NOTIF_TYPE = 'agency_sale'

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

async function seenAt(DB: D1Database, staffId: number): Promise<string> {
  const r = await DB.prepare('SELECT seen_at FROM agency_sales_seen WHERE staff_id = ?').bind(staffId).first<{ seen_at: string }>().catch(() => null)
  return r?.seen_at || ''
}

export function registerAgencyNotificationRoutes(app: App) {
  app.get('/notifications', requireAgencyStaff(), async (c) => {
    try {
      const me = c.get('agencyStaff')
      const stores = await agencyNotifStores(c)
      if (stores.length === 0) return c.json({ success: true, data: { items: [], unread: 0 } })
      const limit = Math.min(Math.max(1, intParam(c.req.query('limit'), 30)), 100)
      const [events, seen] = await Promise.all([
        agencySaleEvents(c.env.DB, me.agencyId, stores.map((s) => s.sellerId), limit),
        seenAt(c.env.DB, me.staffId),
      ])
      const names = new Map(stores.map((s) => [s.sellerId, s.name]))
      const items = events.map((e) => {
        const kinds = Number(e.kinds) || 1
        return {
          id: Number(e.order_id), type: AGENCY_SALE_NOTIF_TYPE, sellerId: Number(e.seller_id),
          storeName: names.get(Number(e.seller_id)) ?? null,
          title: '이용권이 팔렸어요',
          message: `${e.product_name}${kinds > 1 ? ` 외 ${kinds - 1}종` : ''} ${Number(e.qty) || 0}장 · ${(Number(e.amount) || 0).toLocaleString('ko-KR')}원`,
          link: null, isRead: !!seen && e.created_at <= seen, createdAt: e.created_at,
        }
      })
      return c.json({ success: true, data: { items, unread: items.filter((i) => !i.isRead).length } })
    } catch (err) {
      return safeError(c, err, '알림을 불러오지 못했어요', '[agency-console:notifications]')
    }
  })

  app.post('/notifications/read', requireAgencyStaff(), async (c) => {
    try {
      const me = c.get('agencyStaff')
      const DB = c.env.DB
      await ensureAgencyConsoleTables(DB)
      const body = await c.req.json<{ ids?: unknown; all?: unknown }>().catch(() => ({} as { ids?: unknown; all?: unknown }))
      let upTo: string | null = null
      if (body.all === true) {
        upTo = (await DB.prepare("SELECT datetime('now') AS t").first<{ t: string }>())?.t ?? null
      } else {
        const want = Array.isArray(body.ids) ? body.ids.map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 50) : []
        if (want.length === 0) return c.json({ success: false, error: '읽을 알림이 없어요.' }, 400)
        const stores = await agencyNotifStores(c)
        if (stores.length === 0) return c.json({ success: true, updated: 0 })
        // 🔐 우리 매장 주문만 — 남의 주문 id 로 시각을 앞당길 수 없다. "여기까지 봤음" 은 고른 알림 중 가장 늦은 시각.
        const r = await DB.prepare(
          `SELECT MAX(created_at) AS t FROM orders
            WHERE id IN (${want.map(() => '?').join(',')}) AND seller_id IN (${stores.map(() => '?').join(',')})`,
        ).bind(...want, ...stores.map((s) => s.sellerId)).first<{ t: string | null }>()
        upTo = r?.t ?? null
      }
      if (!upTo) return c.json({ success: true, updated: 0 })
      // 앞으로만 간다(늦은 시각을 이미 봤으면 그대로).
      await DB.prepare(
        `INSERT INTO agency_sales_seen (staff_id, seen_at) VALUES (?, ?)
         ON CONFLICT(staff_id) DO UPDATE SET seen_at = MAX(agency_sales_seen.seen_at, excluded.seen_at)`,
      ).bind(me.staffId, upTo).run()
      return c.json({ success: true, updated: 1 })
    } catch (err) {
      return safeError(c, err, '처리하지 못했어요', '[agency-console:notifications]')
    }
  })
}
