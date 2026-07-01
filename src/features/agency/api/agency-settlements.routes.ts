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
import { intParam } from '@/shared/pagination'
// 테이블 ensure (agency.routes.ts 와 동일 — 모듈 분리 후속 정리 대상)
let _agencyTablesEnsured = false
async function ensureAgencyTables(DB: D1Database) {
  if (_done_ensureAgencyTables.has(DB)) return
  _done_ensureAgencyTables.add(DB)
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
  const limit = Math.min(intParam(c.req.query('limit'), 24), 60)

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

// ── POST /settlements/request — 🏁 2026-06-12 (P3 사용자 결정) 레일 폐기 ──
//   에이전시 보상 정본 = 영입 커미션(agency_store_intro_commissions, 자동 적립·멱등) —
//   같은 매출 2%+2% 이중 산정 구조 제거. 지급은 어드민 지급 센터(T+7 성숙분 일괄)가 처리.
//   기존 신청 이력 GET 은 존치(기록 보존).
app.post('/settlements/request', async (c) => {
  return c.json({
    success: false,
    code: 'RAIL_DEPRECATED',
    error: '정산 방식이 변경되었습니다 — 영입 커미션이 자동 집계되어 매주 지급됩니다. 별도 신청이 필요 없습니다.',
  }, 410)
})

export { app as agencySettlementsRoutes }


// 🛡️ 2026-05-19: ensure* per-worker 메모이제이션 (파일 끝).
const _done_ensureAgencyTables = new WeakSet<object>()
