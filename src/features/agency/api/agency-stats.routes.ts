/**
 * 🛡️ 2026-04-28 TD-006 (split): Agency Stats API (5 endpoints)
 *
 * 원본 위치: agency.routes.ts (623-919). 분할 후 회귀 0 보장 위해
 * helper(verifyAgencyToken/getToken/requireAgency/ensureAgencyTables)는
 * 자체 정의 — 향후 lib/agency-shared.ts 추출 권장.
 *
 * - GET /stats          — 30일 매출 + 셀러 수 + 라이브 수
 * - GET /stats/kpi      — TikTok Backstage 1.4 핵심 KPI 6종
 * - GET /stats/daily    — 일별 시계열
 * - GET /stats/realtime — 실시간 라이브 + 신규 매출
 * - GET /stats/batch    — 셀러별 일괄 통계
 */
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { verify } from 'hono/jwt'
import type { Context, Next } from 'hono'
import type { Env } from '@/worker/types/env'
import { requireAgency, type AgencyVars, type AgencyCtx } from '@/lib/agency-shared'
import { swallow } from '@/worker/utils/swallow'
const app = new Hono<{ Bindings: Env; Variables: AgencyVars }>()
// 🛡️ 2026-05-13: redundant cors() 제거 — worker/index.ts:243 글로벌 cors 가 처리.

app.use('*', requireAgency)

// 테이블 ensure (agency.routes.ts 와 동일 — 모듈 분리로 인한 코드 중복은 후속 정리)
let _agencyTablesEnsured = false
async function ensureAgencyTables(DB: D1Database) {
  if (_agencyTablesEnsured) return
  await DB.prepare(`CREATE TABLE IF NOT EXISTS agencies (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, email TEXT)`).run().catch(swallow('agency-stats'))
  await DB.prepare(`CREATE TABLE IF NOT EXISTS agency_sellers (id INTEGER PRIMARY KEY AUTOINCREMENT, agency_id INTEGER NOT NULL, seller_id INTEGER NOT NULL, UNIQUE(agency_id, seller_id))`).run().catch(swallow('agency-stats'))
  _agencyTablesEnsured = true
}

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

// ── GET /stats/kpi — TikTok Backstage 1.4 핵심 지표 6가지 (Q5) ──
//
// 에이전시 운영의 핵심 KPI. 매일 봐야 하는 지표를 한 번에 반환.
// "유효" 라이브 = 1시간 이상 진행 (TikTok 기준).
//
// 반환:
//  - diamond_total: 30일 누적 받은 딜 + 후원 (다이아몬드 등가)
//  - live_rate: 라이브 진행 셀러 / 총 소속 셀러
//  - effective_live_rate: 1시간 이상 라이브 진행 셀러 / 총 소속 셀러
//  - active_creators: 라이브 진행 셀러 수 (탈퇴 제외)
//  - effective_active_creators: 1시간 이상 진행 셀러 수
//  - new_creators_today: 오늘 시작된 매니지먼트 관계 셀러 수
//
// 참조: docs/AGENCY_BACKSTAGE_LEARNING.md (1.2 핵심 데이터 지표 6가지)
app.get('/stats/kpi', async (c) => {
  await ensureAgencyTables(c.env.DB)
  const { id: agencyId } = c.get('agency') as { id: number }

  const period = parseInt(c.req.query('days') || '30')
  const since = new Date(Date.now() - period * 86400_000).toISOString()
  const todayStart = new Date(Date.UTC(
    new Date().getUTCFullYear(),
    new Date().getUTCMonth(),
    new Date().getUTCDate()
  )).toISOString()

  const [totalSellersRow, diamondRow, liveStatsRow, newTodayRow] = await Promise.all([
    // 1) 총 소속 활성 셀러 수
    c.env.DB.prepare(`
      SELECT COUNT(DISTINCT ag.seller_id) AS total
      FROM agency_sellers ag
      INNER JOIN sellers s ON s.id = ag.seller_id
      WHERE ag.agency_id = ? AND COALESCE(s.is_active, 1) = 1
    `).bind(agencyId).first<{ total: number }>(),

    // 2) 다이아몬드 (= 매출 + 후원) 30일 누적
    c.env.DB.prepare(`
      SELECT
        COALESCE((SELECT SUM(o.total_amount)
          FROM orders o
          INNER JOIN agency_sellers ag ON ag.seller_id = o.seller_id
          WHERE ag.agency_id = ? AND o.status IN ('PAID','DONE') AND o.created_at >= ?), 0) AS revenue,
        COALESCE((SELECT SUM(d.amount)
          FROM donations d
          INNER JOIN agency_sellers ag ON ag.seller_id = d.seller_id
          WHERE ag.agency_id = ? AND d.payment_status = 'approved' AND d.created_at >= ?), 0) AS donations
    `).bind(agencyId, since, agencyId, since).first<{ revenue: number; donations: number }>(),

    // 3) 라이브 진행 통계 (period 기준)
    //    - active: started_at 이 있는 라이브 1회 이상 셀러
    //    - effective: 종료 시각 - 시작 시각 >= 60분
    c.env.DB.prepare(`
      SELECT
        COUNT(DISTINCT ls.seller_id) AS active_count,
        COUNT(DISTINCT CASE
          WHEN ls.ended_at IS NOT NULL
            AND (julianday(ls.ended_at) - julianday(ls.started_at)) * 1440 >= 60
          THEN ls.seller_id
        END) AS effective_count
      FROM live_streams ls
      INNER JOIN agency_sellers ag ON ag.seller_id = ls.seller_id
      WHERE ag.agency_id = ?
        AND ls.created_at >= ?
        AND ls.status IN ('live','ended')
    `).bind(agencyId, since).first<{ active_count: number; effective_count: number }>(),

    // 4) 오늘 매니지먼트 관계 시작 (agency_sellers 의 created_at)
    //    실제 컬럼이 없을 수 있어 try/catch 로 감쌈 (구 스키마 호환)
    c.env.DB.prepare(`
      SELECT COUNT(*) AS cnt
      FROM agency_sellers ag
      WHERE ag.agency_id = ?
        AND ag.created_at >= ?
    `).bind(agencyId, todayStart).first<{ cnt: number }>().catch(() => ({ cnt: 0 })),
  ])

  const totalSellers = totalSellersRow?.total ?? 0
  const activeCount = liveStatsRow?.active_count ?? 0
  const effectiveCount = liveStatsRow?.effective_count ?? 0
  const diamondTotal = (diamondRow?.revenue ?? 0) + (diamondRow?.donations ?? 0)

  return c.json({
    success: true,
    data: {
      // 30일 누적 매출 + 후원 (= 다이아몬드 등가)
      diamond_total: diamondTotal,
      // 라이브 진행 셀러 비율 (총 소속 셀러 대비)
      live_rate: totalSellers > 0 ? Math.round((activeCount / totalSellers) * 1000) / 10 : 0,
      // 1시간 이상 라이브 진행 셀러 비율
      effective_live_rate: totalSellers > 0 ? Math.round((effectiveCount / totalSellers) * 1000) / 10 : 0,
      // 활성 라이브 크리에이터 수 (탈퇴/비활성 제외)
      active_creators: activeCount,
      // 유효 활성 크리에이터 수 (1시간 이상)
      effective_active_creators: effectiveCount,
      // 오늘 영입한 셀러 수
      new_creators_today: newTodayRow?.cnt ?? 0,
      // 메타
      total_sellers: totalSellers,
      period_days: period,
      timestamp: new Date().toISOString(),
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

// ── GET /stats/realtime — 실시간 매출/주문 (Agency P0 #2) ─────
//
// 대시보드 폴링용. Today (KST midnight ~ now) + 최근 1시간 + 라이브 카운트.
// 🛡️ 2026-05-13: KV 무료 한도 보호 — 30초 → 300초 (5분) 캐시.
//   매출 통계는 5분 지연 무관. admin 폴링 시 KV ops 90% 감소.
//
// 클라이언트 권장 폴링: 30초 간격 (캐시 TTL 와 동기).
//
// 참조: docs/AGENCY_BACKSTAGE_GAP_ANALYSIS.md (P0 #2)
app.get('/stats/realtime', async (c) => {
  await ensureAgencyTables(c.env.DB)
  const { id: agencyId } = c.get('agency') as { id: number }
  const cacheKey = `agency:${agencyId}:realtime`

  // 1. KV 캐시 시도
  const KV = (c.env as any).RATE_LIMIT_KV as KVNamespace | undefined
  if (KV) {
    try {
      const cached = await KV.get(cacheKey, 'json')
      if (cached) return c.json({ success: true, data: cached, _cached: true })
    } catch { /* KV miss → fall through */ }
  }

  // 2. KST midnight (UTC-9 → KST 자정 = UTC 15:00 전날)
  // 간단화: SQLite 의 datetime 'now', 'localtime' 은 환경 의존이므로 직접 계산.
  const now = new Date()
  const kstOffsetMs = 9 * 60 * 60 * 1000
  const kstNow = new Date(now.getTime() + kstOffsetMs)
  const kstMidnight = new Date(Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), kstNow.getUTCDate()))
  const todayStart = new Date(kstMidnight.getTime() - kstOffsetMs).toISOString()
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString()

  const [today, lastHour, activeStreams, todayViewers] = await Promise.all([
    c.env.DB.prepare(`
      SELECT
        COUNT(*) AS order_count,
        COALESCE(SUM(o.total_amount), 0) AS revenue,
        COUNT(DISTINCT o.user_id) AS unique_buyers
      FROM orders o
      INNER JOIN agency_sellers ag ON ag.seller_id = o.seller_id
      WHERE ag.agency_id = ? AND o.status IN ('PAID','DONE') AND o.created_at >= ?
    `).bind(agencyId, todayStart).first<{ order_count: number; revenue: number; unique_buyers: number }>(),
    c.env.DB.prepare(`
      SELECT
        COUNT(*) AS order_count,
        COALESCE(SUM(o.total_amount), 0) AS revenue
      FROM orders o
      INNER JOIN agency_sellers ag ON ag.seller_id = o.seller_id
      WHERE ag.agency_id = ? AND o.status IN ('PAID','DONE') AND o.created_at >= ?
    `).bind(agencyId, oneHourAgo).first<{ order_count: number; revenue: number }>(),
    c.env.DB.prepare(`
      SELECT
        COUNT(*) AS live_count,
        COALESCE(SUM(ls.current_viewers), 0) AS total_viewers
      FROM live_streams ls
      INNER JOIN agency_sellers ag ON ag.seller_id = ls.seller_id
      WHERE ag.agency_id = ? AND ls.status = 'live'
    `).bind(agencyId).first<{ live_count: number; total_viewers: number }>(),
    c.env.DB.prepare(`
      SELECT COALESCE(SUM(ls.peak_viewers), 0) AS peak_today
      FROM live_streams ls
      INNER JOIN agency_sellers ag ON ag.seller_id = ls.seller_id
      WHERE ag.agency_id = ? AND ls.created_at >= ?
    `).bind(agencyId, todayStart).first<{ peak_today: number }>().catch(() => ({ peak_today: 0 })),
  ])

  const data = {
    timestamp: now.toISOString(),
    today: {
      orders: today?.order_count ?? 0,
      revenue: today?.revenue ?? 0,
      unique_buyers: today?.unique_buyers ?? 0,
    },
    last_hour: {
      orders: lastHour?.order_count ?? 0,
      revenue: lastHour?.revenue ?? 0,
    },
    streams: {
      live_count: activeStreams?.live_count ?? 0,
      current_viewers: activeStreams?.total_viewers ?? 0,
      peak_today: todayViewers?.peak_today ?? 0,
    },
  }

  // 3. KV 캐시 저장 (best-effort, TTL 30초)
  if (KV) {
    c.executionCtx?.waitUntil?.(
      KV.put(cacheKey, JSON.stringify(data), { expirationTtl: 300 }).catch(swallow('agency:api:agency'))
    )
  }

  return c.json({ success: true, data, _cached: false })
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

// 🛡️ 2026-05-19: KT Alpha (기프티쇼) voucher 발송 통계 — 담당 셀러 단위.
// ── GET /stats/kt-alpha ───────────────────────────────────────
app.get('/stats/kt-alpha', async (c) => {
  await ensureAgencyTables(c.env.DB)
  const { id: agencyId } = c.get('agency') as { id: number }
  const period = Math.min(365, Math.max(1, Number(c.req.query('days')) || 30))
  const since = new Date(Date.now() - period * 86400000).toISOString().slice(0, 19).replace('T', ' ')

  const [totals, perSeller, statusMix] = await Promise.all([
    c.env.DB.prepare(`
      SELECT COUNT(*) as total,
             SUM(CASE WHEN v.status='sent' THEN 1 ELSE 0 END) as sent,
             SUM(CASE WHEN v.status='failed' THEN 1 ELSE 0 END) as failed,
             SUM(CASE WHEN v.status='used' THEN 1 ELSE 0 END) as used,
             COALESCE(SUM(CASE WHEN v.status='sent' THEN v.total_amount ELSE 0 END), 0) as total_amount,
             COALESCE(SUM(CASE WHEN v.status='sent' THEN v.withholding_amount ELSE 0 END), 0) as total_withheld
        FROM voucher_orders v
        INNER JOIN agency_sellers ag ON ag.seller_id = v.seller_id
       WHERE ag.agency_id = ? AND v.created_at >= ?
    `).bind(agencyId, since).first<{
      total: number; sent: number; failed: number; used: number;
      total_amount: number; total_withheld: number;
    }>().catch(() => null),
    c.env.DB.prepare(`
      SELECT v.seller_id, s.name as seller_name,
             COUNT(*) as count,
             SUM(CASE WHEN v.status='sent' THEN 1 ELSE 0 END) as sent_count,
             COALESCE(SUM(CASE WHEN v.status='sent' THEN v.total_amount ELSE 0 END), 0) as amount,
             COALESCE(SUM(CASE WHEN v.status='sent' THEN v.withholding_amount ELSE 0 END), 0) as withheld
        FROM voucher_orders v
        INNER JOIN agency_sellers ag ON ag.seller_id = v.seller_id
        INNER JOIN sellers s ON s.id = v.seller_id
       WHERE ag.agency_id = ? AND v.created_at >= ?
       GROUP BY v.seller_id
       ORDER BY amount DESC
       LIMIT 50
    `).bind(agencyId, since).all<{
      seller_id: number; seller_name: string; count: number; sent_count: number;
      amount: number; withheld: number;
    }>().catch(() => ({ results: [] })),
    c.env.DB.prepare(`
      SELECT v.status, COUNT(*) as cnt
        FROM voucher_orders v
        INNER JOIN agency_sellers ag ON ag.seller_id = v.seller_id
       WHERE ag.agency_id = ? AND v.created_at >= ?
       GROUP BY v.status
    `).bind(agencyId, since).all<{ status: string; cnt: number }>().catch(() => ({ results: [] })),
  ])

  return c.json({
    success: true,
    data: {
      period_days: period,
      totals: totals || { total: 0, sent: 0, failed: 0, used: 0, total_amount: 0, total_withheld: 0 },
      per_seller: perSeller.results || [],
      status_mix: statusMix.results || [],
    },
  })
})

export { app as agencyStatsRoutes }
