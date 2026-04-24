/**
 * Agency Analytics Routes (인증 필요)
 *
 *   GET  /api/agency/stats             - 전체 집계 통계
 *   GET  /api/agency/stats/daily       - 일별 매출 추이
 *   GET  /api/agency/stats/batch       - 셀러별 일괄 통계
 *   GET  /api/agency/schedule          - 소속 셀러 방송 스케줄 캘린더
 *   GET  /api/agency/returns           - 소속 셀러 반품/CS 통합
 *   GET  /api/agency/report/csv        - 매출 리포트 CSV 다운로드
 *   GET  /api/agency/targets           - 셀러 매출 목표 조회
 *   PUT  /api/agency/targets           - 셀러 매출 목표 설정
 */

import { createAgencyApp, ensureAgencyTables, requireAgency } from './agency-shared'
import type { AgencyCtx } from './agency-shared'

const app = createAgencyApp()
app.use('*', requireAgency as any)

// ── GET /stats ────────────────────────────────────────────────
app.get('/stats', async (c) => {
  await ensureAgencyTables(c.env.DB)
  const { id: agencyId } = c.get('agency') as { id: number }

  const [sellerCount, orderStats, activeStreams] = await Promise.all([
    c.env.DB.prepare('SELECT COUNT(*) AS cnt FROM agency_sellers WHERE agency_id = ?')
      .bind(agencyId).first<{ cnt: number }>(),
    c.env.DB.prepare(`
      SELECT
        COUNT(*) AS order_count,
        COALESCE(SUM(o.total_amount), 0) AS total_revenue,
        COALESCE(SUM(o.seller_amount), 0) AS net_revenue
      FROM orders o
      INNER JOIN agency_sellers ag ON ag.seller_id = o.seller_id
      WHERE ag.agency_id = ? AND o.status IN ('PAID','DONE')
        AND o.created_at >= date('now', '-30 days')
    `).bind(agencyId).first<{ order_count: number; total_revenue: number; net_revenue: number }>(),
    c.env.DB.prepare(`
      SELECT COUNT(*) AS cnt
      FROM live_streams ls
      INNER JOIN agency_sellers ag ON ag.seller_id = ls.seller_id
      WHERE ag.agency_id = ? AND ls.status = 'live'
    `).bind(agencyId).first<{ cnt: number }>(),
  ])

  return c.json({
    success: true,
    data: {
      sellers: sellerCount?.cnt ?? 0,
      orders_30d: orderStats?.order_count ?? 0,
      revenue_30d: orderStats?.total_revenue ?? 0,
      net_revenue_30d: orderStats?.net_revenue ?? 0,
      active_streams: activeStreams?.cnt ?? 0,
    },
  })
})

// ── GET /stats/daily — 일별 매출 추이 (RevenueTrendChart 용) ───
app.get('/stats/daily', async (c: AgencyCtx) => {
  const agencyId = c.get('agency').id
  const days = Number(c.req.query('days') || 7)
  try {
    const { results } = await c.env.DB.prepare(`
      SELECT date(o.created_at) AS date,
        COALESCE(SUM(CASE WHEN o.status IN ('PAID','DONE','SHIPPING','DELIVERED') THEN o.total_amount END), 0) AS revenue,
        COUNT(*) AS orders
      FROM orders o
      JOIN agency_sellers ag ON ag.seller_id = o.seller_id
      WHERE ag.agency_id = ?
        AND o.created_at > datetime('now', '-' || ? || ' days')
      GROUP BY date(o.created_at)
      ORDER BY date ASC
    `).bind(agencyId, days).all()
    return c.json({ success: true, data: results || [] })
  } catch {
    return c.json({ success: true, data: [] })
  }
})

// ── GET /stats/batch — 셀러별 일괄 통계 (N+1 방지) ─────────────
app.get('/stats/batch', async (c) => {
  await ensureAgencyTables(c.env.DB)
  const { id: agencyId } = c.get('agency') as { id: number }

  const period = c.req.query('period') || '30d'
  const days = period === '7d' ? 7 : period === '90d' ? 90 : 30
  const since = new Date(Date.now() - days * 86400_000).toISOString()

  const [orderStats, streamStats] = await Promise.all([
    c.env.DB.prepare(`
      SELECT
        o.seller_id,
        COUNT(*) AS order_count,
        COALESCE(SUM(o.total_amount), 0) AS revenue,
        COALESCE(SUM(o.seller_amount), 0) AS net_revenue
      FROM orders o
      INNER JOIN agency_sellers ag ON ag.seller_id = o.seller_id
      WHERE ag.agency_id = ? AND o.status IN ('PAID','DONE') AND o.created_at >= ?
      GROUP BY o.seller_id
    `).bind(agencyId, since).all<{ seller_id: number; order_count: number; revenue: number; net_revenue: number }>(),
    c.env.DB.prepare(`
      SELECT
        ls.seller_id,
        COUNT(*) AS stream_count,
        COALESCE(SUM(ls.current_viewers), 0) AS total_viewers
      FROM live_streams ls
      INNER JOIN agency_sellers ag ON ag.seller_id = ls.seller_id
      WHERE ag.agency_id = ? AND ls.created_at >= ?
      GROUP BY ls.seller_id
    `).bind(agencyId, since).all<{ seller_id: number; stream_count: number; total_viewers: number }>(),
  ])

  const orders: Record<number, { order_count: number; revenue: number; net_revenue: number }> = {}
  for (const r of orderStats.results) orders[r.seller_id] = r

  const streams: Record<number, { stream_count: number; total_viewers: number }> = {}
  for (const r of streamStats.results) streams[r.seller_id] = r

  return c.json({ success: true, data: { orders, streams, period } })
})

// ── GET /schedule — 소속 셀러 방송 스케줄 캘린더 ──────────────────
app.get('/schedule', async (c) => {
  await ensureAgencyTables(c.env.DB)
  const { id: agencyId } = c.get('agency') as { id: number }

  try {
    const { results } = await c.env.DB.prepare(`
      SELECT ls.id, ls.title, ls.status, ls.scheduled_at, ls.youtube_video_id,
             ls.seller_id, s.name AS seller_name
      FROM live_streams ls
      INNER JOIN agency_sellers ag ON ag.seller_id = ls.seller_id
      LEFT JOIN sellers s ON s.id = ls.seller_id
      WHERE ag.agency_id = ? AND ls.status IN ('scheduled', 'live')
      ORDER BY ls.scheduled_at ASC
    `).bind(agencyId).all()

    return c.json({ success: true, data: results })
  } catch {
    return c.json({ success: true, data: [] })
  }
})

// ── GET /returns — 소속 셀러 반품/CS 통합 ────────────────────────
app.get('/returns', async (c) => {
  await ensureAgencyTables(c.env.DB)
  const { id: agencyId } = c.get('agency') as { id: number }

  try {
    const { results } = await c.env.DB.prepare(`
      SELECT r.id, r.order_number, r.status, r.reason, r.refund_amount,
             r.seller_id, s.name AS seller_name, r.created_at
      FROM returns r
      INNER JOIN agency_sellers ag ON ag.seller_id = r.seller_id
      LEFT JOIN sellers s ON s.id = r.seller_id
      WHERE ag.agency_id = ?
      ORDER BY r.created_at DESC LIMIT 50
    `).bind(agencyId).all()

    return c.json({ success: true, data: results })
  } catch {
    return c.json({ success: true, data: [] })
  }
})

// ── GET /report/csv — 매출 리포트 CSV 다운로드 ──
app.get('/report/csv', async (c: AgencyCtx) => {
  const agencyId = c.get('agency').id
  const period = c.req.query('period') || '30'
  const days = parseInt(period)

  const { results } = await c.env.DB.prepare(`
    SELECT s.name AS seller_name, s.email,
      COUNT(DISTINCT o.id) AS order_count,
      COALESCE(SUM(CASE WHEN o.status NOT IN ('CANCELLED','FAILED','REFUNDED') THEN o.total_amount END), 0) AS revenue,
      COALESCE(SUM(CASE WHEN o.status NOT IN ('CANCELLED','FAILED','REFUNDED') THEN o.total_amount END) * 0.07, 0) AS commission
    FROM agency_sellers ag
    JOIN sellers s ON ag.seller_id = s.id
    LEFT JOIN orders o ON o.seller_id = s.id AND o.created_at > datetime('now', '-' || ? || ' days')
    WHERE ag.agency_id = ?
    GROUP BY s.id, s.name, s.email
    ORDER BY revenue DESC
  `).bind(days, agencyId).all()

  const rows = results || []
  const csv = [
    '셀러명,이메일,주문수,매출(원),수수료(원)',
    ...rows.map((r: any) => `${r.seller_name},${r.email},${r.order_count},${r.revenue},${Math.round(r.commission)}`)
  ].join('\n')

  return new Response('﻿' + csv, {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="agency-report-${days}d.csv"` },
  })
})

// ── GET /targets — 셀러 매출 목표 ──
app.get('/targets', async (c: AgencyCtx) => {
  const agencyId = c.get('agency').id
  try {
    await c.env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS agency_seller_targets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agency_id INTEGER NOT NULL,
        seller_id INTEGER NOT NULL,
        month TEXT NOT NULL,
        target_amount INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(agency_id, seller_id, month)
      )
    `).run()
  } catch {}

  const month = c.req.query('month') || new Date().toISOString().slice(0, 7)

  const { results } = await c.env.DB.prepare(`
    SELECT s.id AS seller_id, s.name AS seller_name,
      COALESCE(t.target_amount, 0) AS target_amount,
      COALESCE(SUM(CASE WHEN o.status NOT IN ('CANCELLED','FAILED','REFUNDED')
        AND strftime('%Y-%m', o.created_at) = ? THEN o.total_amount END), 0) AS current_amount
    FROM agency_sellers ag
    JOIN sellers s ON ag.seller_id = s.id
    LEFT JOIN agency_seller_targets t ON t.seller_id = s.id AND t.agency_id = ? AND t.month = ?
    LEFT JOIN orders o ON o.seller_id = s.id
    WHERE ag.agency_id = ?
    GROUP BY s.id, s.name, t.target_amount
    ORDER BY s.name
  `).bind(month, agencyId, month, agencyId).all()

  return c.json({ success: true, data: results || [], month })
})

app.put('/targets', async (c: AgencyCtx) => {
  const agencyId = c.get('agency').id
  const { seller_id, month, target_amount } = await c.req.json<{ seller_id: number; month: string; target_amount: number }>()
  if (!seller_id || !month) return c.json({ success: false, error: '셀러와 월을 선택해주세요' }, 400)

  try {
    await c.env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS agency_seller_targets (
        id INTEGER PRIMARY KEY AUTOINCREMENT, agency_id INTEGER NOT NULL, seller_id INTEGER NOT NULL,
        month TEXT NOT NULL, target_amount INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(agency_id, seller_id, month)
      )
    `).run()
  } catch {}

  await c.env.DB.prepare(`
    INSERT INTO agency_seller_targets (agency_id, seller_id, month, target_amount)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(agency_id, seller_id, month) DO UPDATE SET target_amount = excluded.target_amount
  `).bind(agencyId, seller_id, month, target_amount || 0).run()

  return c.json({ success: true })
})

export { app as agencyAnalyticsRoutes }
