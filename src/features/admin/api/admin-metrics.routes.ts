import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { WebhookEventRepository } from '@/worker/repositories/webhook.repository'

export const adminMetricsRoutes = new Hono<{ Bindings: Env }>()

/**
 * GET /api/admin/metrics
 * Real-time system metrics for admin dashboard
 */
adminMetricsRoutes.get('/', async (c) => {
  const DB = c.env.DB
  const metrics: Record<string, any> = {}

  // Concurrent live streams
  try {
    const row = await DB.prepare("SELECT COUNT(*) as n FROM live_streams WHERE status = 'live'").first<{ n: number }>()
    metrics.active_streams = row?.n ?? 0
  } catch { metrics.active_streams = null }

  // Orders in last 5 minutes
  try {
    const row = await DB.prepare("SELECT COUNT(*) as n FROM orders WHERE created_at > datetime('now', '-5 minutes')").first<{ n: number }>()
    metrics.orders_last_5min = row?.n ?? 0
  } catch { metrics.orders_last_5min = null }

  // Payment confirmations in last 5 minutes
  try {
    const row = await DB.prepare("SELECT COUNT(*) as n FROM orders WHERE status IN ('PAID', 'DONE') AND updated_at > datetime('now', '-5 minutes')").first<{ n: number }>()
    metrics.payments_last_5min = row?.n ?? 0
  } catch { metrics.payments_last_5min = null }

  // Pending orders (stuck at PENDING > 5 min)
  try {
    const row = await DB.prepare("SELECT COUNT(*) as n FROM orders WHERE status = 'PENDING' AND created_at < datetime('now', '-5 minutes')").first<{ n: number }>()
    metrics.stuck_pending_orders = row?.n ?? 0
  } catch { metrics.stuck_pending_orders = null }

  // Failed webhooks
  try {
    const row = await DB.prepare("SELECT COUNT(*) as n FROM webhook_events WHERE status = 'FAILED' AND created_at > datetime('now', '-1 hour')").first<{ n: number }>()
    metrics.failed_webhooks_last_hour = row?.n ?? 0
  } catch { metrics.failed_webhooks_last_hour = null }

  // Active users (last 5 min)
  try {
    const row = await DB.prepare("SELECT COUNT(DISTINCT user_id) as n FROM user_sessions WHERE last_activity > datetime('now', '-5 minutes')").first<{ n: number }>()
    metrics.active_users_5min = row?.n ?? 0
  } catch { metrics.active_users_5min = null }

  metrics.timestamp = new Date().toISOString()
  metrics.cold_start = !(c.env as any).__warm  // Crude proxy — may not work

  return c.json({ success: true, data: metrics })
})

/**
 * GET /api/admin/metrics/rate-limits
 * Top 20 keys hitting rate limits in the last hour.
 */
adminMetricsRoutes.get('/rate-limits', async (c) => {
  const DB = c.env.DB
  try {
    const rows = await DB.prepare(`
      SELECT key_id, action, COUNT(*) as hits
      FROM rate_limit_attempts
      WHERE created_at > datetime('now', '-1 hour')
      GROUP BY key_id, action
      ORDER BY hits DESC
      LIMIT 20
    `).all()
    return c.json({ success: true, data: rows.results })
  } catch (e) {
    return c.json({ success: false, error: (e as Error).message }, 500)
  }
})

/**
 * GET /api/admin/metrics/webhook-failures
 *
 * 🛡️ 2026-04-26 (M7 / TD-009): Webhook 실패 이벤트 통합 조회.
 *   - stats: 24h 통계 (source/event_type 별 집계, escalated count)
 *   - recent: 최근 50건 (timestamp + error_message + 상태)
 *
 * 사용:
 *   GET /api/admin/metrics/webhook-failures           — 24h 기본
 *   GET /api/admin/metrics/webhook-failures?hours=72  — 72h
 */
adminMetricsRoutes.get('/webhook-failures', async (c) => {
  const DB = c.env.DB
  const hours = Math.min(Math.max(parseInt(c.req.query('hours') || '24'), 1), 720) // 1~720h (30일)

  try {
    const repo = new WebhookEventRepository(DB)
    const [stats, recent] = await Promise.all([
      repo.getFailedStats(hours),
      repo.getRecent(50),
    ])
    return c.json({
      success: true,
      data: {
        stats,
        recent: recent.filter(r => r.status === 'FAILED' || r.status === 'SKIPPED').slice(0, 30),
        period_hours: hours,
        timestamp: new Date().toISOString(),
      },
    })
  } catch (e) {
    return c.json({ success: false, error: (e as Error).message }, 500)
  }
})

/**
 * POST /api/admin/metrics/webhook-failures/:id/retry
 *
 * 실패한 webhook event 를 수동으로 재처리 시도 (1차: 상태 RECEIVED 로 되돌리고 retry_count 유지).
 * 실제 재처리 로직은 cron 또는 별도 트리거에서 다시 시도. 1차 구현은 '재시도 마킹' 만.
 */
adminMetricsRoutes.post('/webhook-failures/:id/retry', async (c) => {
  const DB = c.env.DB
  const id = c.req.param('id')
  if (!id) return c.json({ success: false, error: 'invalid id' }, 400)

  try {
    const result = await DB.prepare(
      "UPDATE webhook_events SET status = 'RECEIVED', error_message = error_message || ' (manual retry queued)' WHERE id = ? AND status = 'FAILED'"
    ).bind(id).run()
    if ((result.meta.changes ?? 0) === 0) {
      return c.json({ success: false, error: '대상 없음 또는 이미 처리됨' }, 404)
    }
    return c.json({ success: true, message: '재처리 마킹 완료' })
  } catch (e) {
    return c.json({ success: false, error: (e as Error).message }, 500)
  }
})

export default adminMetricsRoutes
