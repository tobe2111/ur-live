/**
 * 🛡️ 2026-05-25 (migration 0279): 배송 추적 cron sync.
 *
 * 주기: 6시간 (SHIPPING_DEFAULTS.TRACKER_SYNC_INTERVAL_HOURS)
 * 대상: status='SHIPPING' AND tracking_number IS NOT NULL AND
 *       (last_tracking_sync_at IS NULL OR < datetime('now', '-1 hour'))
 *
 * 동작:
 *   1. 50개씩 batch (TRACKER_SYNC_BATCH_SIZE)
 *   2. 각 주문에 대해 tracker.delivery 호출
 *   3. 결과를 shipping_tracking_events 에 audit
 *   4. tracking_status 갱신
 *   5. status==='delivered' → orders.status='DELIVERED' + delivered_at + push 알림
 *   6. tracker.delivery 실패 시 silent skip (다음 cron 에서 재시도)
 *
 * Fallback: 7일+ SHIPPING 인데 tracker 응답 없는 케이스 → status='DELIVERED' 추정 (정책).
 */

import { SHIPPING_DEFAULTS } from '../../shared/constants/policy'
import { fetchTrackerDelivery } from '../utils/tracker-delivery'
import { getTrackerCode, normalizeCourierKey } from '../utils/courier-codes'

type Env = Record<string, unknown> & { DB?: D1Database }

export interface SyncBatchResult {
  scanned: number
  synced: number
  delivered: number
  errors: number
  skipped: number
}

export async function syncShippingStatusBatch(env: Env | any): Promise<SyncBatchResult> {
  const DB = env.DB as D1Database | undefined
  if (!DB) return { scanned: 0, synced: 0, delivered: 0, errors: 0, skipped: 0 }

  const minIntervalMin = SHIPPING_DEFAULTS.TRACKER_SYNC_MIN_INTERVAL_MIN
  const batchSize = SHIPPING_DEFAULTS.TRACKER_SYNC_BATCH_SIZE

  // 대상 주문 조회
  let candidates: Array<{
    id: number
    user_id: number
    order_number: string
    courier: string | null
    tracking_carrier_code: string | null
    tracking_number: string
  }> = []
  try {
    const { results } = await DB.prepare(
      `SELECT id, user_id, order_number, courier, tracking_carrier_code, tracking_number
       FROM orders
       WHERE status = 'SHIPPING'
         AND tracking_number IS NOT NULL
         AND tracking_number != ''
         AND (last_tracking_sync_at IS NULL OR last_tracking_sync_at < datetime('now', ?))
       LIMIT ?`,
    ).bind(`-${minIntervalMin} minutes`, batchSize).all<any>()
    candidates = results ?? []
  } catch (e: any) {
    console.error('[shipping-sync] fetch candidates failed', e?.message || e)
    return { scanned: 0, synced: 0, delivered: 0, errors: 1, skipped: 0 }
  }

  let synced = 0
  let delivered = 0
  let errors = 0
  let skipped = 0

  for (const order of candidates) {
    const courierKey = normalizeCourierKey(order.tracking_carrier_code || order.courier)
    const trackerCode = getTrackerCode(courierKey)
    if (!trackerCode) {
      skipped++
      continue
    }

    const result = await fetchTrackerDelivery(trackerCode, order.tracking_number)

    if (!result.ok) {
      // tracker.delivery 실패 → 다음 cron 에서 재시도. last_sync 만 갱신.
      try {
        await DB.prepare(`UPDATE orders SET last_tracking_sync_at = datetime('now') WHERE id = ?`)
          .bind(order.id).run()
      } catch {}
      errors++
      continue
    }

    try {
      // audit
      if (result.lastProgress) {
        await DB.prepare(
          `INSERT INTO shipping_tracking_events (order_id, carrier_code, tracking_number, status, status_text, location, occurred_at, source, raw_response)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'cron', ?)`,
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
      }

      // 상태 갱신
      const updates: string[] = ['tracking_status = ?', `last_tracking_sync_at = datetime('now')`]
      const params: any[] = [result.status]
      if (courierKey) {
        updates.push('tracking_carrier_code = COALESCE(tracking_carrier_code, ?)')
        params.push(courierKey)
      }

      if (result.status === 'delivered') {
        updates.push(`status = 'DELIVERED'`, `delivered_at = COALESCE(delivered_at, datetime('now'))`)
        delivered++

        // push 알림 (best-effort, fire-and-forget)
        try {
          const { sendSystemPush } = await import('../../lib/system-push')
          await sendSystemPush(env as any, 'user', String(order.user_id), {
            title: '📦 배송이 완료되었어요',
            body: `주문 ${order.order_number} 이 도착했습니다`,
            url: '/my-orders',
            tag: `delivered-${order.id}`,
          }).catch(() => {})
        } catch {}
      }

      params.push(order.id)
      await DB.prepare(`UPDATE orders SET ${updates.join(', ')} WHERE id = ?`).bind(...params).run()
      synced++
    } catch (e: any) {
      console.error('[shipping-sync] update failed', order.id, e?.message || e)
      errors++
    }

    // rate limit 보호 — 100ms 간격
    await new Promise(r => setTimeout(r, 100))
  }

  return { scanned: candidates.length, synced, delivered, errors, skipped }
}
