/**
 * 🛡️ 2026-04-28: Business Monitoring — gift + consignment 운영 통계
 *
 * 어드민용. cron 자동화 (gift refund, consignment 분배) 의 정상 동작 검증 + 이상 탐지.
 *
 * Endpoints:
 *   GET /api/admin/business-monitoring/gift-stats        — gift 상태 분포 + 환불 실패율
 *   GET /api/admin/business-monitoring/consignment-stats — 위탁 파트너십 + 분배 정확성
 */
import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { requireAdmin } from '@/worker/middleware/auth'

const app = new Hono<{ Bindings: Env }>()
app.use('*', requireAdmin())

// ── GET /gift-stats — 선물 상태 분포 + 환불 자동화 모니터링 ──
app.get('/gift-stats', async (c) => {
  const DB = c.env.DB

  const empty = {
    by_status: {} as Record<string, number>,
    expired_no_payment_key: 0,
    refund_failure_recent_24h: 0,
    pending_24h_overdue: 0,
    paid_unclaimed_15d: 0,
    total_30d: 0,
    total_revenue_30d: 0,
  }

  try {
    // 상태별 분포
    const { results: statusCounts } = await DB.prepare(`
      SELECT status, COUNT(*) AS cnt FROM gifts GROUP BY status
    `).all<{ status: string; cnt: number }>()
    for (const row of statusCounts ?? []) {
      empty.by_status[row.status] = row.cnt
    }

    // 토스 키 없는 expired (= 환불 자동화 못 돌아감 — 이상 신호)
    const a = await DB.prepare(`
      SELECT COUNT(*) AS cnt FROM gifts
      WHERE status = 'expired' AND toss_payment_key IS NULL
    `).first<{ cnt: number }>()
    empty.expired_no_payment_key = a?.cnt ?? 0

    // 24시간 내 환불 실패 추정 (status 가 expired 인 채로 24시간 이상 머문 — refunded 못 된 것)
    const b = await DB.prepare(`
      SELECT COUNT(*) AS cnt FROM gifts
      WHERE status = 'expired' AND updated_at < datetime('now', '-24 hours')
    `).first<{ cnt: number }>()
    empty.refund_failure_recent_24h = b?.cnt ?? 0

    // pending 24시간 초과 (cron 21번이 작동 안 했거나 토스 confirm 미완료)
    const c2 = await DB.prepare(`
      SELECT COUNT(*) AS cnt FROM gifts
      WHERE status = 'pending' AND created_at < datetime('now', '-24 hours')
    `).first<{ cnt: number }>()
    empty.pending_24h_overdue = c2?.cnt ?? 0

    // paid 후 15일 이상 미수령 (만료 임박 — 알림 권장)
    const d = await DB.prepare(`
      SELECT COUNT(*) AS cnt FROM gifts
      WHERE status = 'paid' AND paid_at < datetime('now', '-15 days')
    `).first<{ cnt: number }>()
    empty.paid_unclaimed_15d = d?.cnt ?? 0

    // 30일 누적
    const e = await DB.prepare(`
      SELECT COUNT(*) AS cnt, COALESCE(SUM(amount), 0) AS revenue FROM gifts
      WHERE created_at >= datetime('now', '-30 days')
    `).first<{ cnt: number; revenue: number }>()
    empty.total_30d = e?.cnt ?? 0
    empty.total_revenue_30d = e?.revenue ?? 0

    return c.json({ success: true, data: empty })
  } catch (err) {
    if ((err as Error).message?.includes('no such table')) {
      return c.json({ success: true, data: empty })
    }
    return c.json({ success: false, error: (err as Error).message }, 500)
  }
})

// ── GET /consignment-stats — 위탁 파트너십 + 분배 정확성 검증 ──
app.get('/consignment-stats', async (c) => {
  const DB = c.env.DB

  const empty = {
    by_status: {} as Record<string, number>,
    pending_30d_overdue: 0,
    active_no_orders_30d: 0,
    settlements_recorded_30d: 0,
    settlements_total_amount_30d: 0,
    distribution_anomalies: 0, // host + owner + platform != total 인 행 수 (있으면 안됨)
  }

  try {
    const { results: statusCounts } = await DB.prepare(`
      SELECT status, COUNT(*) AS cnt FROM consignment_partnerships GROUP BY status
    `).all<{ status: string; cnt: number }>()
    for (const row of statusCounts ?? []) {
      empty.by_status[row.status] = row.cnt
    }

    // pending 30일 초과 (cron 22번 자동 정리 안 됐다면 이상)
    const a = await DB.prepare(`
      SELECT COUNT(*) AS cnt FROM consignment_partnerships
      WHERE status = 'pending' AND created_at < datetime('now', '-30 days')
    `).first<{ cnt: number }>()
    empty.pending_30d_overdue = a?.cnt ?? 0

    // active 인데 30일간 주문 0건 (셀러 협업 안 일어남)
    const b = await DB.prepare(`
      SELECT COUNT(*) AS cnt FROM consignment_partnerships cp
      WHERE cp.status = 'active'
        AND cp.created_at < datetime('now', '-30 days')
        AND NOT EXISTS (
          SELECT 1 FROM order_items oi
          INNER JOIN orders o ON o.id = oi.order_id
          WHERE oi.consignment_id = cp.id
            AND o.created_at >= datetime('now', '-30 days')
        )
    `).first<{ cnt: number }>()
    empty.active_no_orders_30d = b?.cnt ?? 0

    // 30일 정산 기록 + 합계
    const c2 = await DB.prepare(`
      SELECT COUNT(*) AS cnt, COALESCE(SUM(total_amount), 0) AS total
      FROM consignment_settlements
      WHERE created_at >= datetime('now', '-30 days')
    `).first<{ cnt: number; total: number }>()
    empty.settlements_recorded_30d = c2?.cnt ?? 0
    empty.settlements_total_amount_30d = c2?.total ?? 0

    // 분배 정확성 검증: host_amount + owner_amount + platform_amount === total_amount 여야 함
    const d = await DB.prepare(`
      SELECT COUNT(*) AS cnt FROM consignment_settlements
      WHERE host_amount + owner_amount + platform_amount != total_amount
    `).first<{ cnt: number }>()
    empty.distribution_anomalies = d?.cnt ?? 0

    return c.json({ success: true, data: empty })
  } catch (err) {
    if ((err as Error).message?.includes('no such table')) {
      return c.json({ success: true, data: empty })
    }
    return c.json({ success: false, error: (err as Error).message }, 500)
  }
})

export { app as adminBusinessMonitoringRoutes }
