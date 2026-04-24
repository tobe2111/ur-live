/**
 * Agency Orders & Settlements Routes (인증 필요)
 *
 *   GET  /api/agency/orders                  - 소속 셀러 주문 목록
 *   GET  /api/agency/streams                 - 소속 셀러 라이브 현황
 *   GET  /api/agency/settlements             - 소속 셀러 정산 통합
 *   POST /api/agency/settlements/request     - 에이전시 정산 신청
 *   GET  /api/agency/settlements/csv         - 정산 CSV 다운로드
 */

import type { MiddlewareHandler } from 'hono'
import { createDashboardNotification } from '../../notifications/api/dashboard-notifications.routes'
import { isAgencyPinVerified } from './agency-pin.routes'
import { createAgencyApp, ensureAgencyTables, requireAgency } from './agency-shared'
import type { AgencyCtx } from './agency-shared'

const app = createAgencyApp()
app.use('*', requireAgency as unknown as MiddlewareHandler)

// ── GET /orders ───────────────────────────────────────────────
app.get('/orders', async (c) => {
  await ensureAgencyTables(c.env.DB)
  const { id: agencyId } = c.get('agency') as { id: number }
  const page = Math.max(1, Number(c.req.query('page') || 1))
  const limit = Math.min(Math.max(1, Number(c.req.query('limit') || 20)), 100)
  const offset = (page - 1) * limit
  const sellerId = c.req.query('seller_id')

  const sellerFilter = sellerId ? 'AND o.seller_id = ?' : ''
  const params: unknown[] = sellerId ? [agencyId, Number(sellerId), limit, offset] : [agencyId, limit, offset]

  const [orders, total] = await Promise.all([
    c.env.DB.prepare(`
      SELECT o.id, o.order_number, o.total_amount, o.payment_status, o.status,
             o.created_at, o.shipping_name, o.seller_id,
             s.business_name AS seller_business_name
      FROM orders o
      INNER JOIN agency_sellers ag ON ag.seller_id = o.seller_id
      LEFT JOIN sellers s ON s.id = o.seller_id
      WHERE ag.agency_id = ? ${sellerFilter}
      ORDER BY o.created_at DESC LIMIT ? OFFSET ?
    `).bind(...params).all(),
    c.env.DB.prepare(`
      SELECT COUNT(*) AS cnt FROM orders o
      INNER JOIN agency_sellers ag ON ag.seller_id = o.seller_id
      WHERE ag.agency_id = ? ${sellerFilter}
    `).bind(...(sellerId ? [agencyId, Number(sellerId)] : [agencyId])).first<{ cnt: number }>(),
  ])

  return c.json({
    success: true,
    data: orders.results,
    meta: { total: total?.cnt ?? 0, page, limit },
  })
})

// ── GET /streams ──────────────────────────────────────────────
app.get('/streams', async (c) => {
  await ensureAgencyTables(c.env.DB)
  const { id: agencyId } = c.get('agency') as { id: number }

  const streams = await c.env.DB.prepare(`
    SELECT ls.id, ls.title, ls.status, ls.current_viewers, ls.scheduled_at, ls.created_at, ls.seller_id,
           s.business_name AS seller_business_name, s.name AS seller_name
    FROM live_streams ls
    INNER JOIN agency_sellers ag ON ag.seller_id = ls.seller_id
    LEFT JOIN sellers s ON s.id = ls.seller_id
    WHERE ag.agency_id = ?
    ORDER BY ls.created_at DESC LIMIT 50
  `).bind(agencyId).all()

  return c.json({ success: true, data: streams.results })
})

// ── GET /settlements — 소속 셀러 정산 통합 (에이전시 수수료 포함) ──
app.get('/settlements', async (c) => {
  await ensureAgencyTables(c.env.DB)
  const { id: agencyId } = c.get('agency') as { id: number }

  try {
    // 에이전시 수수료율 조회
    const agency = await c.env.DB.prepare('SELECT commission_rate FROM agencies WHERE id = ?')
      .bind(agencyId).first<{ commission_rate: number }>()
    const agencyRate = agency?.commission_rate ?? 2.0

    const { results } = await c.env.DB.prepare(`
      SELECT o.id, o.order_number, o.total_amount, o.seller_id,
             s.name AS seller_name, s.business_name,
             COALESCE(s.commission_rate, 5) AS seller_commission_rate,
             COALESCE(o.settlement_status, 'pending') AS settlement_status,
             o.created_at
      FROM orders o
      INNER JOIN agency_sellers ag ON ag.seller_id = o.seller_id
      LEFT JOIN sellers s ON s.id = o.seller_id
      WHERE ag.agency_id = ? AND o.status IN ('delivered', 'DONE')
      ORDER BY o.created_at DESC LIMIT 100
    `).bind(agencyId).all()

    // 에이전시 수수료 계산
    const enriched = (results || []).map((r: any) => ({
      ...r,
      agency_commission_rate: agencyRate,
      total_commission_rate: (r.seller_commission_rate || 5) + agencyRate,
      agency_commission: Math.round((r.total_amount || 0) * agencyRate / 100),
      seller_amount: Math.round((r.total_amount || 0) * (100 - (r.seller_commission_rate || 5) - agencyRate) / 100),
    }))

    const totalAgencyCommission = enriched.reduce((s: number, r: any) => s + (r.agency_commission || 0), 0)

    const summary = {
      total: enriched.length,
      pending: enriched.filter((r: any) => r.settlement_status === 'pending').length,
      confirmed: enriched.filter((r: any) => r.settlement_status === 'confirmed').length,
      completed: enriched.filter((r: any) => r.settlement_status === 'completed').length,
      total_amount: enriched.reduce((s: number, r: any) => s + (r.total_amount || 0), 0),
      agency_commission_rate: agencyRate,
      total_agency_commission: totalAgencyCommission,
    }

    return c.json({ success: true, data: enriched, summary })
  } catch {
    return c.json({ success: true, data: [], summary: { total: 0, pending: 0, confirmed: 0, completed: 0, total_amount: 0, agency_commission_rate: 2, total_agency_commission: 0 } })
  }
})

// ── POST /settlements/request — 에이전시 정산 신청 ──
app.post('/settlements/request', async (c) => {
  await ensureAgencyTables(c.env.DB)
  const { id: agencyId } = c.get('agency') as { id: number }

  // 🛡️ 민감 액션 — 최근 15분 내 에이전시 PIN 인증 필수
  const pinOk = await isAgencyPinVerified(c.req.header('Cookie'), agencyId, c.env.JWT_SECRET)
  if (!pinOk) {
    return c.json({ success: false, error: 'PIN 인증이 필요합니다', code: 'PIN_REQUIRED' }, 412)
  }

  try {
    const agency = await c.env.DB.prepare('SELECT id, name, commission_rate, bank_name, bank_account, account_holder FROM agencies WHERE id = ?')
      .bind(agencyId).first<Record<string, any>>()
    if (!agency) return c.json({ success: false, error: '에이전시 정보를 찾을 수 없습니다' }, 404)

    // 정산 가능 금액 계산: 확정(confirmed) 주문 중 아직 에이전시 정산 안 된 것
    try { await c.env.DB.prepare("ALTER TABLE orders ADD COLUMN agency_settled INTEGER DEFAULT 0").run() } catch {}

    const { results: eligibleOrders } = await c.env.DB.prepare(`
      SELECT o.id, o.total_amount, o.seller_id
      FROM orders o
      INNER JOIN agency_sellers ag ON ag.seller_id = o.seller_id
      WHERE ag.agency_id = ? AND o.status IN ('delivered', 'DONE')
        AND COALESCE(o.settlement_status, 'pending') = 'confirmed'
        AND COALESCE(o.agency_settled, 0) = 0
    `).bind(agencyId).all<{ id: number; total_amount: number; seller_id: number }>()

    if (!eligibleOrders?.length) {
      return c.json({ success: false, error: '정산 가능한 주문이 없습니다' }, 400)
    }

    const rate = agency.commission_rate ?? 2.0
    const totalAmount = eligibleOrders.reduce((s, o) => s + (o.total_amount || 0), 0)
    const commissionAmount = Math.round(totalAmount * rate / 100)

    // 정산 레코드 생성
    try {
      await c.env.DB.prepare(`CREATE TABLE IF NOT EXISTS agency_settlements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agency_id INTEGER NOT NULL,
        total_orders INTEGER NOT NULL,
        total_amount INTEGER NOT NULL,
        commission_rate REAL NOT NULL,
        commission_amount INTEGER NOT NULL,
        bank_name TEXT, bank_account TEXT, account_holder TEXT,
        status TEXT DEFAULT 'pending',
        requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        settled_at DATETIME
      )`).run()
    } catch {}

    await c.env.DB.prepare(`
      INSERT INTO agency_settlements (agency_id, total_orders, total_amount, commission_rate, commission_amount, bank_name, bank_account, account_holder)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      agencyId, eligibleOrders.length, totalAmount, rate, commissionAmount,
      agency.bank_name || null, agency.bank_account || null, agency.account_holder || null
    ).run()

    // 정산 신청된 주문들 마킹
    const orderIds = eligibleOrders.map(o => o.id)
    for (const oid of orderIds) {
      await c.env.DB.prepare('UPDATE orders SET agency_settled = 1 WHERE id = ?').bind(oid).run()
    }

    // 어드민 알림
    try {
      createDashboardNotification(c.env.DB, 'admin', null, 'agency_settlement', '에이전시 정산 신청', `${agency.name}: ${commissionAmount.toLocaleString()}원 (${eligibleOrders.length}건)`, '/admin/settlements').catch(() => {})
    } catch {}

    return c.json({
      success: true,
      data: {
        orders: eligibleOrders.length,
        total_amount: totalAmount,
        commission_rate: rate,
        commission_amount: commissionAmount,
      },
    })
  } catch (e) {
    console.error('[Agency] Settlement request error:', e)
    return c.json({ success: false, error: '정산 신청에 실패했습니다' }, 500)
  }
})

// ── GET /settlements/csv — 정산 CSV 다운로드 ──
app.get('/settlements/csv', async (c: AgencyCtx) => {
  const agencyId = c.get('agency').id
  const agencyRow = await c.env.DB.prepare('SELECT commission_rate FROM agencies WHERE id = ?')
    .bind(agencyId).first<{ commission_rate: number }>()
  const agencyRate = (agencyRow?.commission_rate ?? 2.0) / 100
  const { results } = await c.env.DB.prepare(`
    SELECT s.name AS seller_name, s.email,
      COALESCE(s.commission_rate, 5) AS seller_rate,
      COUNT(DISTINCT o.id) AS settled_orders,
      COALESCE(SUM(o.total_amount), 0) AS total_amount
    FROM agency_sellers ag
    JOIN sellers s ON ag.seller_id = s.id
    LEFT JOIN orders o ON o.seller_id = s.id AND COALESCE(o.settlement_status, '') = 'settled'
    WHERE ag.agency_id = ?
    GROUP BY s.id ORDER BY total_amount DESC
  `).bind(agencyId).all<{ seller_name: string; email: string; seller_rate: number; settled_orders: number; total_amount: number }>()

  const rows = results || []
  const csv = [
    `셀러명,이메일,정산건수,총매출(원),셀러수수료(원),에이전시수수료(원)`,
    ...rows.map((r) => {
      const sellerComm = Math.round(r.total_amount * (r.seller_rate / 100))
      const agencyComm = Math.round(r.total_amount * agencyRate)
      return `${r.seller_name},${r.email},${r.settled_orders},${r.total_amount},${sellerComm},${agencyComm}`
    })
  ].join('\n')

  return new Response('﻿' + csv, {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="agency-settlements.csv"' },
  })
})

export { app as agencyOrdersRoutes }
