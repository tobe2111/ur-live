/**
 * 🛡️ 2026-04-28 TD-006 (split): Agency Settlements API (4 endpoints)
 *
 * 원본: agency.routes.ts (681-867).
 * - GET  /settlements
 * - GET  /settlement-invoices
 * - GET  /settlement-invoices/:id
 * - POST /settlements/request
 */
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { verify } from 'hono/jwt'
import type { Context, Next } from 'hono'
import type { Env } from '@/worker/types/env'
import { requireAgency, type AgencyVars, type AgencyCtx } from '@/lib/agency-shared'
import { swallow } from '@/worker/utils/swallow'
// 테이블 ensure (agency.routes.ts 와 동일 — 모듈 분리 후속 정리 대상)
let _agencyTablesEnsured = false
async function ensureAgencyTables(DB: D1Database) {
  if (_agencyTablesEnsured) return
  await DB.prepare(`CREATE TABLE IF NOT EXISTS agencies (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, email TEXT)`).run().catch(swallow('agency-settlements'))
  await DB.prepare(`CREATE TABLE IF NOT EXISTS agency_sellers (id INTEGER PRIMARY KEY AUTOINCREMENT, agency_id INTEGER NOT NULL, seller_id INTEGER NOT NULL, UNIQUE(agency_id, seller_id))`).run().catch(swallow('agency-settlements'))
  _agencyTablesEnsured = true
}
const app = new Hono<{ Bindings: Env; Variables: AgencyVars }>()
// 🛡️ 2026-05-13: redundant cors() 제거 — worker/index.ts:243 글로벌 cors 가 처리.

app.use('*', requireAgency)

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

// ── GET /settlement-invoices — 발행된 송장 목록 (M6) ──
//
// 매월 자동 발행되는 송장. cron 이 매월 1일 01:00 UTC 실행.
// 참조: src/worker/cron/agency-monthly-invoices.ts
app.get('/settlement-invoices', async (c) => {
  const agencyId = c.get('agency').id
  const limit = Math.min(parseInt(c.req.query('limit') || '24'), 60)

  try {
    const { results } = await c.env.DB.prepare(`
      SELECT id, month, invoice_number, total_orders, total_amount,
             commission_rate, commission_amount, tax_amount, net_amount,
             status, paid_at, generated_by, created_at
      FROM agency_settlement_invoices
      WHERE agency_id = ?
      ORDER BY month DESC
      LIMIT ?
    `).bind(agencyId, limit).all()
    return c.json({ success: true, data: results || [] })
  } catch {
    return c.json({ success: true, data: [], _note: 'migration 0219 not applied' })
  }
})

// ── GET /settlement-invoices/:id — 송장 HTML 다운로드 ──
//
// HTML 본문 그대로 반환 (브라우저에서 inline 표시 또는 PDF 인쇄).
app.get('/settlement-invoices/:id', async (c) => {
  const agencyId = c.get('agency').id
  const id = parseInt(c.req.param('id'))
  if (!Number.isFinite(id)) return c.json({ success: false, error: 'invalid id' }, 400)

  try {
    const row = await c.env.DB.prepare(
      'SELECT html_content, invoice_number FROM agency_settlement_invoices WHERE id = ? AND agency_id = ?'
    ).bind(id, agencyId).first<{ html_content: string; invoice_number: string }>()

    if (!row) return c.json({ success: false, error: 'not found' }, 404)

    // HTML 직접 응답
    return new Response(row.html_content, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `inline; filename="${row.invoice_number}.html"`,
      },
    })
  } catch {
    return c.json({ success: false, error: '조회 실패' }, 500)
  }
})

// ── POST /settlements/request — 에이전시 정산 신청 ──
app.post('/settlements/request', async (c) => {
  await ensureAgencyTables(c.env.DB)
  const { id: agencyId } = c.get('agency') as { id: number }

  // 🛡️ 민감 액션 — 최근 15분 내 에이전시 PIN 인증 필수
  const { isAgencyPinVerified } = await import('./agency-pin.routes')
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

    const result = await c.env.DB.prepare(`
      INSERT INTO agency_settlements (agency_id, total_orders, total_amount, commission_rate, commission_amount, bank_name, bank_account, account_holder)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      agencyId, eligibleOrders.length, totalAmount, rate, commissionAmount,
      agency.bank_name || null, agency.bank_account || null, agency.account_holder || null
    ).run()

    // 정산 신청된 주문들 마킹 — batch() 로 단일 라운드트립
    const orderIds = eligibleOrders.map(o => o.id)
    if (orderIds.length > 0) {
      await c.env.DB.batch(
        orderIds.map(oid => c.env.DB.prepare('UPDATE orders SET agency_settled = 1 WHERE id = ?').bind(oid))
      )
    }

    // 어드민 알림
    try {
      const { createDashboardNotification } = await import('../../notifications/api/dashboard-notifications.routes')
      createDashboardNotification(c.env.DB, 'admin', null, 'agency_settlement', '에이전시 정산 신청', `${agency.name}: ${Number(commissionAmount ?? 0).toLocaleString('ko-KR')}원 (${eligibleOrders.length}건)`, '/admin/settlements').catch(swallow('agency:api:agency'))
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
export { app as agencySettlementsRoutes }
