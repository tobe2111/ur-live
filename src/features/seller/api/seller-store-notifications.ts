/**
 * 🔔 내 매장들의 판매 알림 — 마이·에이전시 콘솔이 읽는다 (2026-10-12, 셀러 대시보드 제거 4단계 선행)
 *   대표: *"셀러 대시보드를 없애는 것을 목표로 하고 마이에서 모두 다 할 수 있게"*
 *
 * ## 왜
 * 판매 알림(결제 확정 · 정산 · 승인 · 제안 · 재고 …)은 `dashboard_notifications(recipient_type='seller')` 에 쌓이고
 * **대시보드 껍데기의 종(`DashboardNotificationBell`)만** 그것을 보여 줬다. 3단계에서 카카오 사장님을 마이로 보내면서
 * 그 종을 볼 길이 사라졌다 — 에러가 안 나서 아무도 모른다. 껍데기를 지우기 전에 이 받은편지함부터 옮긴다.
 *
 * ## 누구의 알림인가
 * 종은 **좌석 하나**(그 토큰의 매장)만 봤다. 여기서는 **사람 기준**이다 — 앉을 수 있는 매장 전부(`resolveStoreScope`,
 * `/my-stores/summary` 와 같은 근거)의 알림을 한 곳에 모은다. 에이전시 좌석이면 맡은 그 매장 하나.
 * 읽음 처리도 같은 범위 안에서만 된다(남의 매장 알림 id 를 보내도 0건).
 */
import type { Hono, Context } from 'hono'
import type { Env } from '@/worker/types/env'
import { isSeatableStoreStatus } from '@/shared/seller-status'
import { intParam } from '@/shared/pagination'
import { safeError } from '@/worker/utils/safe-error'

type Ctx = Context<{ Bindings: Env }>
type Scope = { userId: number | null; agencyId?: number | null; stores: { seller_id: number; business_name?: string | null; name?: string | null; status?: string | null }[] } | null

/**
 * 한 번에 보는 매장 수 상한 — 바인딩 한도(100) 안. 이 문장은 매장 id 뒤에 `LIMIT ?` 하나를 더 묶으므로 90.
 * 🏬 2026-10-17: 종전 20 이라 지점이 많은 브랜드는 21번째 지점부터 판매 알림이 **안 왔다**(에러 0).
 */
export const NOTIF_MAX_STORES = 90

export function scopedStoreIds(scope: Scope): number[] {
  if (!scope) return []
  // 🤝 2026-10-24 — 에이전시 좌석에겐 매장 알림함을 안 보인다(사장님·다른 에이전시 판매가 섞여 있다 — 대표 확정 '자기 것만').
  if (scope.agencyId) return []
  return scope.stores.filter((s) => isSeatableStoreStatus(s.status ?? null)).slice(0, NOTIF_MAX_STORES).map((s) => s.seller_id)
}

export function registerStoreNotificationRoutes(app: Hono<{ Bindings: Env }>, resolveScope: (c: Ctx) => Promise<Scope>) {
  app.get('/my-stores/notifications', async (c) => {
    try {
      const scope = await resolveScope(c)
      if (!scope) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
      const ids = scopedStoreIds(scope)
      if (ids.length === 0) return c.json({ success: true, data: { items: [], unread: 0 } })
      const limit = Math.min(Math.max(1, intParam(c.req.query('limit'), 30)), 100)
      const marks = ids.map(() => '?').join(',')
      // recipient_id 는 TEXT 로 저장된다(createDashboardNotification 이 String(sellerId) 를 쓴다).
      const { results } = await c.env.DB.prepare(
        `SELECT id, recipient_id, type, title, message, link, is_read, created_at,
                SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) OVER () AS _unread
           FROM dashboard_notifications
          WHERE recipient_type = 'seller' AND recipient_id IN (${marks})
          ORDER BY created_at DESC LIMIT ?`,
      ).bind(...ids.map(String), limit).all<{
        id: number; recipient_id: string; type: string; title: string; message: string | null
        link: string | null; is_read: number; created_at: string; _unread: number
      }>().catch(() => ({ results: [] as never[] }))
      const names = new Map(scope.stores.map((s) => [s.seller_id, s.business_name || s.name || `매장 ${s.seller_id}`]))
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
      return safeError(c, err, '알림을 불러오지 못했습니다', '[store-notifications]')
    }
  })

  app.post('/my-stores/notifications/read', async (c) => {
    try {
      const scope = await resolveScope(c)
      if (!scope) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
      const ids = scopedStoreIds(scope)
      if (ids.length === 0) return c.json({ success: true, updated: 0 })
      const body = await c.req.json<{ ids?: unknown; all?: unknown }>().catch(() => ({} as { ids?: unknown; all?: unknown }))
      const marks = ids.map(() => '?').join(',')
      const scopeSql = `recipient_type = 'seller' AND recipient_id IN (${marks}) AND is_read = 0`
      if (body.all === true) {
        const r = await c.env.DB.prepare(`UPDATE dashboard_notifications SET is_read = 1 WHERE ${scopeSql}`).bind(...ids.map(String)).run()
        return c.json({ success: true, updated: r.meta?.changes ?? 0 })
      }
      const want = Array.isArray(body.ids) ? body.ids.map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 50) : []
      if (want.length === 0) return c.json({ success: false, error: '읽을 알림이 없습니다' }, 400)
      const r = await c.env.DB.prepare(
        `UPDATE dashboard_notifications SET is_read = 1 WHERE ${scopeSql} AND id IN (${want.map(() => '?').join(',')})`,
      ).bind(...ids.map(String), ...want).run()
      return c.json({ success: true, updated: r.meta?.changes ?? 0 })
    } catch (err) {
      return safeError(c, err, '처리하지 못했습니다', '[store-notifications]')
    }
  })
}
