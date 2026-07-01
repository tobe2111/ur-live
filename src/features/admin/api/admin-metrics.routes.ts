import { Hono } from 'hono'
import { safeError } from '@/worker/utils/safe-error'
import type { Env } from '@/worker/types/env'
import { WebhookEventRepository } from '@/worker/repositories/webhook.repository'
import { intParam } from '@/shared/pagination'

export const adminMetricsRoutes = new Hono<{ Bindings: Env }>()

// 🏭 2026-06-05 (사용자 신고 — /admin/health 의 webhook-failures 500): webhook_events 테이블이
//   미존재(마이그레이션 미적용)인 환경에서 조회가 500 나던 것 자가치유. 1회 CREATE TABLE IF NOT EXISTS.
//   webhook.repository 의 INSERT 스키마와 동일 컬럼. 생성 후엔 0건(정상)으로 응답.
let _webhookTableReady = false
async function ensureWebhookEventsTable(DB: D1Database): Promise<void> {
  if (_webhookTableReady) return
  await DB.prepare(`CREATE TABLE IF NOT EXISTS webhook_events (
    id TEXT PRIMARY KEY,
    source TEXT NOT NULL DEFAULT 'toss',
    event_type TEXT NOT NULL,
    payload TEXT,
    status TEXT NOT NULL DEFAULT 'RECEIVED',
    toss_order_id TEXT,
    order_number TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    error_message TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    processed_at TEXT
  )`).run().catch(() => { /* 이미 존재/권한 — 무시 */ })
  _webhookTableReady = true
}

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
    return safeError(c, e, '요청 처리 중 오류가 발생했습니다', '[admin]')
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
    await ensureWebhookEventsTable(DB)
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
    return safeError(c, e, '요청 처리 중 오류가 발생했습니다', '[admin]')
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
    await ensureWebhookEventsTable(DB)
    const result = await DB.prepare(
      "UPDATE webhook_events SET status = 'RECEIVED', error_message = error_message || ' (manual retry queued)' WHERE id = ? AND status = 'FAILED'"
    ).bind(id).run()
    if ((result.meta.changes ?? 0) === 0) {
      return c.json({ success: false, error: '대상 없음 또는 이미 처리됨' }, 404)
    }
    return c.json({ success: true, message: '재처리 마킹 완료' })
  } catch (e) {
    return safeError(c, e, '요청 처리 중 오류가 발생했습니다', '[admin]')
  }
})

/**
 * GET /api/admin/metrics/groupbuy-settlement-audit?days=30
 *
 * 🏭 2026-06-05 (B2 — 읽기 전용 정산 정합성 점검, 돈 미변경):
 *   공구(GB-) PAID/DONE 주문 중 ledger_entries(group_buy_join) / donations 정산 기록이 누락된 건을
 *   집계. confirm-toss(카드)·/join(딜) 둘 다 orderNumber 로 ledger+donations 를 기록하므로(2026-05-31),
 *   누락이 0 이면 정합, >0 이면 실제 드리프트(실패 swallow·구버전 주문 등) → 후속 수동 보정 판단 근거.
 *   순수 SELECT — 어떤 돈/상태도 변경하지 않음.
 */
adminMetricsRoutes.get('/groupbuy-settlement-audit', async (c) => {
  const DB = c.env.DB
  const days = Math.min(Math.max(intParam(c.req.query('days'), 30), 1), 365)
  const since = `-${days} days`
  const GB = "order_number LIKE 'GB-%' AND status IN ('PAID','DONE') AND created_at > datetime('now', ?)"
  const GBO = "o.order_number LIKE 'GB-%' AND o.status IN ('PAID','DONE') AND o.created_at > datetime('now', ?)"

  try {
    const total = await DB.prepare(
      `SELECT COUNT(*) AS n, COALESCE(SUM(total_amount),0) AS amt FROM orders WHERE ${GB}`
    ).bind(since).first<{ n: number; amt: number }>().catch(() => ({ n: 0, amt: 0 }))

    const byMethod = await DB.prepare(
      `SELECT COALESCE(payment_method,'(none)') AS method, COUNT(*) AS n FROM orders WHERE ${GB}
       GROUP BY payment_method ORDER BY n DESC`
    ).bind(since).all<{ method: string; n: number }>().catch(() => ({ results: [] as { method: string; n: number }[] }))

    // ledger_entries 누락 (event_type='group_buy_join', reference_id=order_number)
    let missingLedger: { available: boolean; n: number; samples: unknown[] } = { available: false, n: 0, samples: [] }
    try {
      const notExists = `NOT EXISTS (SELECT 1 FROM ledger_entries l WHERE l.reference_id = o.order_number AND l.event_type='group_buy_join')`
      const cnt = await DB.prepare(`SELECT COUNT(*) AS n FROM orders o WHERE ${GBO} AND ${notExists}`).bind(since).first<{ n: number }>()
      const samples = await DB.prepare(`SELECT o.order_number, o.payment_method, o.total_amount, o.created_at FROM orders o WHERE ${GBO} AND ${notExists} ORDER BY o.created_at DESC LIMIT 20`).bind(since).all()
      missingLedger = { available: true, n: cnt?.n ?? 0, samples: samples.results || [] }
    } catch { missingLedger = { available: false, n: 0, samples: [] } }

    // donations 누락 (order_id=order_number)
    let missingDonation: { available: boolean; n: number; samples: unknown[] } = { available: false, n: 0, samples: [] }
    try {
      const notExists = `NOT EXISTS (SELECT 1 FROM donations d WHERE d.order_id = o.order_number)`
      const cnt = await DB.prepare(`SELECT COUNT(*) AS n FROM orders o WHERE ${GBO} AND ${notExists}`).bind(since).first<{ n: number }>()
      const samples = await DB.prepare(`SELECT o.order_number, o.payment_method, o.total_amount, o.created_at FROM orders o WHERE ${GBO} AND ${notExists} ORDER BY o.created_at DESC LIMIT 20`).bind(since).all()
      missingDonation = { available: true, n: cnt?.n ?? 0, samples: samples.results || [] }
    } catch { missingDonation = { available: false, n: 0, samples: [] } }

    return c.json({
      success: true,
      data: {
        period_days: days,
        total_orders: total?.n ?? 0,
        total_amount: total?.amt ?? 0,
        by_method: byMethod.results || [],
        missing_ledger: missingLedger,
        missing_donation: missingDonation,
        timestamp: new Date().toISOString(),
      },
    })
  } catch (e) {
    return safeError(c, e, '요청 처리 중 오류가 발생했습니다', '[admin]')
  }
})

export default adminMetricsRoutes
