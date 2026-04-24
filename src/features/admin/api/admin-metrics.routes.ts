import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'

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
  metrics.cold_start = !c.env.__warm  // Crude proxy — may not work

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

export default adminMetricsRoutes
