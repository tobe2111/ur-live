/**
 * 🛡️ 2026-05-25 (migration 0279): 배송 추적 + 일괄 송장 API.
 *
 * 엔드포인트:
 *   - GET /api/shipping/track/:carrier/:trackingNumber  (public, 30s 캐시)
 *     실시간 추적 — tracker.delivery 호출 + audit 저장.
 *   - GET /api/shipping/order/:orderId/track            (requireUser)
 *     본인 주문의 추적 (DB 캐시 우선, stale 시 tracker.delivery 호출)
 *   - GET /api/shipping/couriers                        (public)
 *     택배사 목록 (드롭다운 용)
 *   - POST /api/admin/shipping/bulk-tracking            (requireAdmin)
 *     CSV 일괄 송장 업로드.
 *   - POST /api/admin/shipping/sync                     (requireAdmin)
 *     수동 sync 트리거 (cron 외 응급).
 *
 * 영구 룰:
 *   - tracker.delivery 실패 시 graceful — 외부 URL fallback 반환
 *   - 모든 audit 는 shipping_tracking_events 에 저장
 *   - rate limit: tracker.delivery 호출은 동일 (carrier, number) 60초 dedup
 */

import { Hono } from 'hono'
import type { Env } from '../types/env'
import { requireAuth, requireAdmin, requireUserType } from '../middleware/auth'
import { safeError } from '../utils/safe-error'
import { fetchTrackerDelivery } from '../utils/tracker-delivery'
import {
  COURIERS,
  normalizeCourierKey,
  getTrackerCode,
  getExternalTrackingUrl,
  getCourierDisplayName,
  listCourierOptions,
} from '../utils/courier-codes'

const shippingRoutes = new Hono<{ Bindings: Env }>()

// ── 인증된 user_id 추출 ──
function getAuthUserId(c: any): number | null {
  const raw = c.get?.('userId') ?? c.get?.('userIdNumber')
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : null
}

// ============================================================
// GET /api/shipping/couriers (public)
// 택배사 목록 — 드롭다운/선택 UI 용
// ============================================================
shippingRoutes.get('/couriers', (c) => {
  return c.json({ success: true, couriers: listCourierOptions() })
})

// ============================================================
// GET /api/shipping/track/:carrier/:trackingNumber (public, 60s 캐시)
// 실시간 추적 — tracker.delivery 호출 + 외부 URL fallback 반환
// ============================================================
shippingRoutes.get('/track/:carrier/:trackingNumber', async (c) => {
  try {
    const carrierRaw = c.req.param('carrier')
    const trackingNumber = (c.req.param('trackingNumber') || '').replace(/\s+/g, '')
    if (!trackingNumber) {
      return c.json({ success: false, error: '송장번호 없음' }, 400)
    }

    const courierKey = normalizeCourierKey(carrierRaw)
    if (!courierKey) {
      return c.json({
        success: false,
        error: '지원하지 않는 택배사',
        couriers: listCourierOptions().map(c => c.key),
      }, 400)
    }

    const trackerCode = getTrackerCode(courierKey)!
    const externalUrl = getExternalTrackingUrl(courierKey, trackingNumber)

    // tracker.delivery 호출 (best-effort)
    const result = await fetchTrackerDelivery(trackerCode, trackingNumber)

    // public response — 외부 URL 항상 포함 (자동 추적 실패 시에도 클릭 추적 가능)
    return c.json({
      success: true,
      courier: { key: courierKey, name: getCourierDisplayName(courierKey) },
      tracking_number: trackingNumber,
      tracker: {
        ok: result.ok,
        status: result.status,
        last: result.lastProgress,
        progresses: result.progresses,
        error: result.error,
      },
      external_url: externalUrl,
    }, 200, {
      // tracker.delivery 동일 요청 1분 캐시 (운영 부하 + tracker.delivery API 매너)
      'Cache-Control': result.ok ? 'public, max-age=60, s-maxage=60' : 'no-store',
    })
  } catch (err) {
    return safeError(c, err, '배송 추적 조회 중 오류가 발생했습니다', '[shipping:track]')
  }
})

// ============================================================
// GET /api/shipping/order/:orderId/track (requireUser)
// 본인 주문의 추적 — DB 캐시 우선, stale 시 tracker.delivery 호출
// ============================================================
shippingRoutes.get('/order/:orderId/track', requireAuth(), async (c) => {
  try {
    const userId = getAuthUserId(c)
    if (!userId) return c.json({ success: false, error: '인증 필요' }, 401)
    const orderIdRaw = c.req.param('orderId')
    if (!orderIdRaw) return c.json({ success: false, error: 'invalid' }, 400)

    const DB = c.env.DB
    // user_id 일치 확인 (vouchers.user_id 는 TEXT 이나 orders.user_id 는 INTEGER — both 처리)
    const order = await DB.prepare(
      `SELECT id, user_id, courier, tracking_carrier_code, tracking_number,
              tracking_status, last_tracking_sync_at, status, shipped_at
       FROM orders
       WHERE (id = ? OR order_number = ?) AND user_id = ?
       LIMIT 1`,
    ).bind(orderIdRaw, orderIdRaw, userId).first<{
      id: number
      user_id: number
      courier: string | null
      tracking_carrier_code: string | null
      tracking_number: string | null
      tracking_status: string | null
      last_tracking_sync_at: string | null
      status: string
      shipped_at: string | null
    }>()

    if (!order) return c.json({ success: false, error: '주문을 찾을 수 없습니다' }, 404)

    const courierKey = normalizeCourierKey(order.tracking_carrier_code || order.courier)
    if (!courierKey || !order.tracking_number) {
      return c.json({
        success: true,
        has_tracking: false,
        status: order.status,
        shipped_at: order.shipped_at,
      })
    }

    const trackerCode = getTrackerCode(courierKey)!
    const externalUrl = getExternalTrackingUrl(courierKey, order.tracking_number)

    // 최근 60초 내 sync 가 있으면 DB 이벤트로 응답 (rate limit 보호)
    const recent = await DB.prepare(
      `SELECT status, status_text, location, occurred_at, created_at
       FROM shipping_tracking_events
       WHERE order_id = ?
       ORDER BY created_at DESC
       LIMIT 20`,
    ).bind(order.id).all<{ status: string; status_text: string; location: string; occurred_at: string; created_at: string }>().catch(() => ({ results: [] as any[] }))

    const last = recent.results?.[0]
    const lastSyncMs = order.last_tracking_sync_at ? Date.parse(order.last_tracking_sync_at) : 0
    const ageSec = (Date.now() - lastSyncMs) / 1000

    if (last && ageSec < 60) {
      return c.json({
        success: true,
        has_tracking: true,
        cached: true,
        courier: { key: courierKey, name: getCourierDisplayName(courierKey) },
        tracking_number: order.tracking_number,
        status: order.tracking_status || last.status,
        events: recent.results,
        external_url: externalUrl,
      })
    }

    // tracker.delivery 호출
    const result = await fetchTrackerDelivery(trackerCode, order.tracking_number)

    // 결과를 shipping_tracking_events 에 저장 (audit)
    if (result.ok && result.lastProgress) {
      try {
        await DB.prepare(
          `INSERT INTO shipping_tracking_events (order_id, carrier_code, tracking_number, status, status_text, location, occurred_at, source, raw_response)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'tracker_delivery', ?)`,
        ).bind(
          order.id,
          trackerCode,
          order.tracking_number,
          result.status,
          result.lastProgress.status.text,
          result.lastProgress.location?.name ?? null,
          result.lastProgress.time,
          JSON.stringify(result.progresses).slice(0, 4000),
        ).run()
        await DB.prepare(
          `UPDATE orders SET tracking_status = ?, last_tracking_sync_at = datetime('now'),
                             tracking_carrier_code = COALESCE(tracking_carrier_code, ?)
           WHERE id = ?`,
        ).bind(result.status, courierKey, order.id).run()
      } catch { /* audit 실패는 무시 — 응답은 우선 */ }
    }

    return c.json({
      success: true,
      has_tracking: true,
      cached: false,
      courier: { key: courierKey, name: getCourierDisplayName(courierKey) },
      tracking_number: order.tracking_number,
      status: result.status,
      events: result.progresses,
      external_url: externalUrl,
      error: result.error,
    })
  } catch (err) {
    return safeError(c, err, '주문 배송 추적 중 오류가 발생했습니다', '[shipping:order-track]')
  }
})

// ============================================================
// POST /api/admin/shipping/bulk-tracking (requireAdmin)
// CSV 일괄 송장 업로드.
// Body: { items: [{ order_id, courier, tracking_number, shipped_at? }] }
// ============================================================
shippingRoutes.post('/admin/bulk-tracking', requireAdmin(), async (c) => {
  try {
    const body = await c.req.json<{ items?: Array<{ order_id?: string | number; courier?: string; tracking_number?: string; shipped_at?: string }>; dry_run?: boolean }>().catch(() => ({} as any))
    const items = Array.isArray(body.items) ? body.items.slice(0, 1000) : []
    if (!items.length) return c.json({ success: false, error: 'items 필요' }, 400)

    const dryRun = Boolean(body.dry_run)
    const DB = c.env.DB
    const results: Array<{ order_id: string; status: 'ok' | 'skip' | 'error'; reason?: string; courier?: string }> = []

    for (const item of items) {
      const orderIdRaw = String(item.order_id || '').trim()
      const trackingNumber = String(item.tracking_number || '').replace(/\s+/g, '')
      const courierKey = normalizeCourierKey(item.courier)
      if (!orderIdRaw || !trackingNumber) {
        results.push({ order_id: orderIdRaw, status: 'error', reason: 'missing order_id or tracking_number' })
        continue
      }
      if (!courierKey) {
        results.push({ order_id: orderIdRaw, status: 'error', reason: `unknown courier: ${item.courier}` })
        continue
      }

      // 주문 존재 + 상태 확인
      const order = await DB.prepare(
        `SELECT id, user_id, order_number, status, tracking_number FROM orders WHERE (id = ? OR order_number = ?) LIMIT 1`,
      ).bind(orderIdRaw, orderIdRaw).first<{ id: number; user_id: number; order_number: string; status: string; tracking_number: string | null }>().catch(() => null)

      if (!order) {
        results.push({ order_id: orderIdRaw, status: 'error', reason: 'order not found' })
        continue
      }

      if (order.tracking_number && order.tracking_number === trackingNumber) {
        results.push({ order_id: orderIdRaw, status: 'skip', reason: 'same tracking number already set' })
        continue
      }

      if (dryRun) {
        results.push({ order_id: orderIdRaw, status: 'ok', courier: courierKey })
        continue
      }

      try {
        const shippedAt = item.shipped_at && /^\d{4}-\d{2}-\d{2}/.test(item.shipped_at) ? item.shipped_at : null
        await DB.prepare(
          `UPDATE orders
           SET courier = ?, tracking_carrier_code = ?, tracking_number = ?,
               shipped_at = COALESCE(?, shipped_at, datetime('now')),
               status = CASE WHEN status IN ('PAID','PAY_COMPLETE','READY') THEN 'SHIPPING' ELSE status END,
               updated_at = datetime('now')
           WHERE id = ?`,
        ).bind(
          courierKey,
          courierKey,
          trackingNumber,
          shippedAt,
          order.id,
        ).run()

        // audit
        await DB.prepare(
          `INSERT INTO shipping_tracking_events (order_id, carrier_code, tracking_number, status, status_text, source)
           VALUES (?, ?, ?, 'pending', 'bulk_upload', 'manual')`,
        ).bind(order.id, courierKey, trackingNumber).run().catch(() => {})

        results.push({ order_id: orderIdRaw, status: 'ok', courier: courierKey })
      } catch (e: any) {
        results.push({ order_id: orderIdRaw, status: 'error', reason: String(e?.message || e).slice(0, 100) })
      }
    }

    const summary = {
      total: items.length,
      succeeded: results.filter(r => r.status === 'ok').length,
      skipped: results.filter(r => r.status === 'skip').length,
      failed: results.filter(r => r.status === 'error').length,
    }

    return c.json({ success: true, dry_run: dryRun, summary, results })
  } catch (err) {
    return safeError(c, err, 'CSV 업로드 중 오류가 발생했습니다', '[shipping:bulk-tracking]')
  }
})

// ============================================================
// POST /api/admin/shipping/sync (requireAdmin) — 수동 cron trigger
// ============================================================
shippingRoutes.post('/admin/sync', requireAdmin(), async (c) => {
  try {
    const { syncShippingStatusBatch } = await import('../cron/shipping-sync')
    const result = await syncShippingStatusBatch(c.env)
    return c.json({ success: true, ...result })
  } catch (err) {
    return safeError(c, err, 'sync 실행 중 오류가 발생했습니다', '[shipping:sync]')
  }
})

export { shippingRoutes }
