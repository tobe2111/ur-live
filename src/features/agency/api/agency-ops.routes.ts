/**
 * 🛡️ 2026-04-28 TD-006 (split): Agency 운영 관리 (notices/tasks/targets/contracts)
 *
 * 원본: agency.routes.ts (1097-1383). 7 endpoints.
 *
 * - POST /notices              — 소속 셀러에게 공지 발송
 * - GET  /notices              — 발송 이력 조회
 * - GET  /monthly-tasks        — 월간 의무 작업 목록 + 진행률
 * - GET  /targets              — 매출 목표 조회
 * - PUT  /targets              — 매출 목표 갱신
 * - GET  /settlements/csv      — 정산 CSV 내보내기
 * - GET  /sellers/compare      — 셀러간 성과 비교
 * - GET  /contracts            — 계약서 목록
 * - POST /contracts            — 계약 등록
 * - PUT  /contracts/:id        — 계약 수정 (PIN 필수)
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

let _agencyTablesEnsured = false
async function ensureAgencyTables(DB: D1Database) {
  if (_agencyTablesEnsured) return
  await DB.prepare(`CREATE TABLE IF NOT EXISTS agencies (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, email TEXT)`).run().catch(swallow('agency-ops'))
  await DB.prepare(`CREATE TABLE IF NOT EXISTS agency_sellers (id INTEGER PRIMARY KEY AUTOINCREMENT, agency_id INTEGER NOT NULL, seller_id INTEGER NOT NULL, UNIQUE(agency_id, seller_id))`).run().catch(swallow('agency-ops'))
  _agencyTablesEnsured = true
}

// ── POST /api/agency/notices — 셀러 공지사항 발송 ──
app.post('/notices', async (c: AgencyCtx) => {
  const agencyId = c.get('agency').id
  const { title, message } = await c.req.json<{ title: string; message: string }>()
  if (!title || !message) return c.json({ success: false, error: '제목과 내용을 입력해주세요' }, 400)

  const { results: sellers } = await c.env.DB.prepare(
    'SELECT seller_id FROM agency_sellers WHERE agency_id = ?'
  ).bind(agencyId).all<{ seller_id: number }>()

  if (!sellers?.length) return c.json({ success: false, error: '소속 셀러가 없습니다' })

  const stmts = sellers.map(s =>
    c.env.DB.prepare(`
      INSERT INTO dashboard_notifications (recipient_type, recipient_id, type, title, message, created_at)
      VALUES ('seller', ?, 'agency_notice', ?, ?, datetime('now'))
    `).bind(String(s.seller_id), title, message)
  )
  for (let i = 0; i < stmts.length; i += 50) {
    await c.env.DB.batch(stmts.slice(i, i + 50))
  }

  return c.json({ success: true, message: `${sellers.length}명의 셀러에게 공지를 발송했습니다.` })
})

// ── GET /api/agency/notices — 공지 이력 ──
app.get('/notices', async (c: AgencyCtx) => {
  const agencyId = c.get('agency').id
  const { results } = await c.env.DB.prepare(`
    SELECT DISTINCT dn.title, dn.message, dn.created_at
    FROM dashboard_notifications dn
    JOIN agency_sellers ag ON dn.recipient_id = CAST(ag.seller_id AS TEXT)
    WHERE ag.agency_id = ? AND dn.type = 'agency_notice'
    GROUP BY dn.title, dn.message, dn.created_at
    ORDER BY dn.created_at DESC
    LIMIT 50
  `).bind(agencyId).all()

  return c.json({ success: true, data: results || [] })
})

// ── GET /monthly-tasks — 의무 작업 진행 상황 (Q6) ──
//
// 응답: 이번 달 3종 의무 작업의 target/actual/status.
// row 가 없으면 cron 이 다음 실행 시 자동 생성. 빈 배열 반환.
//
// 참조: docs/AGENCY_STRATEGY_QUICKWIN.md (Q6)
app.get('/monthly-tasks', async (c: AgencyCtx) => {
  const agencyId = c.get('agency').id
  const now = new Date()
  const month = c.req.query('month') ||
    `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`

  if (!/^\d{4}-\d{2}$/.test(month)) {
    return c.json({ success: false, error: 'month 형식: YYYY-MM' }, 400)
  }

  try {
    const { results } = await c.env.DB.prepare(
      `SELECT * FROM agency_monthly_tasks WHERE agency_id = ? AND month = ? ORDER BY task_type`
    ).bind(agencyId, month).all<Record<string, unknown>>()
    return c.json({ success: true, data: results || [], month })
  } catch {
    // migration 0215 미적용
    return c.json({ success: true, data: [], month, _note: 'migration 0215 not applied yet' })
  }
})

// ── GET/PUT /api/agency/targets — 셀러 매출 목표 ──
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

  // 🛡️ 2026-04-29 보안 audit CRITICAL: agency_sellers 소유권 검증.
  // 이전: body 의 seller_id 를 인증된 agency 가 진짜 소속 셀러인지 검증 없이 INSERT
  // → 다른 에이전시의 seller_id 로 fake target 생성 가능 (DB 오염).
  const ownership = await c.env.DB.prepare(
    'SELECT 1 FROM agency_sellers WHERE agency_id = ? AND seller_id = ? LIMIT 1'
  ).bind(agencyId, seller_id).first()
  if (!ownership) return c.json({ success: false, error: '소속 셀러가 아닙니다.' }, 403)

  // target_amount 입력 검증
  const amount = typeof target_amount === 'number' ? target_amount : 0
  if (!Number.isFinite(amount) || amount < 0 || amount > 1_000_000_000) {
    return c.json({ success: false, error: '목표 금액은 0 ~ 10억 범위여야 합니다.' }, 400)
  }

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
  `).bind(agencyId, seller_id, month, amount).run()

  return c.json({ success: true })
})

// ── GET /api/agency/settlements/csv — 정산 CSV 다운로드 ──
app.get('/settlements/csv', async (c: AgencyCtx) => {
  const agencyId = c.get('agency').id
  const { results } = await c.env.DB.prepare(`
    SELECT s.name AS seller_name, s.email,
      COUNT(DISTINCT o.id) AS settled_orders,
      COALESCE(SUM(o.total_amount), 0) AS total_amount,
      COALESCE(SUM(o.total_amount * 0.05), 0) AS seller_commission,
      COALESCE(SUM(o.total_amount * 0.02), 0) AS agency_commission
    FROM agency_sellers ag
    JOIN sellers s ON ag.seller_id = s.id
    LEFT JOIN orders o ON o.seller_id = s.id AND COALESCE(o.settlement_status, '') = 'settled'
    WHERE ag.agency_id = ?
    GROUP BY s.id ORDER BY total_amount DESC
  `).bind(agencyId).all()

  const rows = results || []
  const csv = [
    '셀러명,이메일,정산건수,총매출(원),셀러수수료5%(원),에이전시수수료2%(원)',
    ...rows.map((r: any) => `${r.seller_name},${r.email},${r.settled_orders},${r.total_amount},${Math.round(r.seller_commission)},${Math.round(r.agency_commission)}`)
  ].join('\n')

  return new Response('\uFEFF' + csv, {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="agency-settlements.csv"' },
  })
})

// ── GET /api/agency/sellers/compare — 셀러 성과 비교 ──
app.get('/sellers/compare', async (c: AgencyCtx) => {
  const agencyId = c.get('agency').id
  const period = c.req.query('period') || '30'

  const { results } = await c.env.DB.prepare(`
    SELECT s.id, s.name, s.business_name,
      COUNT(DISTINCT o.id) AS order_count,
      COALESCE(SUM(CASE WHEN o.status NOT IN ('CANCELLED','FAILED','REFUNDED') THEN o.total_amount END), 0) AS revenue,
      COUNT(DISTINCT CASE WHEN ls.status = 'live' THEN ls.id END) AS live_count,
      COUNT(DISTINCT CASE WHEN ls.status = 'ended' THEN ls.id END) AS ended_streams
    FROM agency_sellers ag
    JOIN sellers s ON ag.seller_id = s.id
    LEFT JOIN orders o ON o.seller_id = s.id AND o.created_at > datetime('now', '-' || ? || ' days')
    LEFT JOIN live_streams ls ON ls.seller_id = s.id AND ls.created_at > datetime('now', '-' || ? || ' days')
    WHERE ag.agency_id = ?
    GROUP BY s.id, s.name ORDER BY revenue DESC
  `).bind(period, period, agencyId).all()

  // Fetch voucher usage stats per seller
  const { results: voucherStats } = await c.env.DB.prepare(`
    SELECT p.seller_id,
      COUNT(*) AS total_vouchers,
      SUM(CASE WHEN v.status = 'used' THEN 1 ELSE 0 END) AS used_vouchers
    FROM vouchers v
    JOIN products p ON v.product_id = p.id
    JOIN agency_sellers ag ON ag.seller_id = p.seller_id
    WHERE ag.agency_id = ?
    GROUP BY p.seller_id
  `).bind(agencyId).all<{ seller_id: number; total_vouchers: number; used_vouchers: number }>().catch(() => ({ results: [] as any[] }))

  // Fetch group buy participation per seller
  const { results: groupBuyStats } = await c.env.DB.prepare(`
    SELECT p.seller_id,
      COUNT(*) AS total_group_buys,
      SUM(CASE WHEN p.group_buy_status = 'achieved' THEN 1 ELSE 0 END) AS achieved_group_buys
    FROM products p
    JOIN agency_sellers ag ON ag.seller_id = p.seller_id
    WHERE ag.agency_id = ? AND p.category = 'meal_voucher' AND p.group_buy_status IS NOT NULL
    GROUP BY p.seller_id
  `).bind(agencyId).all<{ seller_id: number; total_group_buys: number; achieved_group_buys: number }>().catch(() => ({ results: [] as any[] }))

  const voucherMap: Record<number, { total_vouchers: number; used_vouchers: number }> = {}
  for (const v of (voucherStats || [])) voucherMap[v.seller_id] = v

  const groupBuyMap: Record<number, { total_group_buys: number; achieved_group_buys: number }> = {}
  for (const g of (groupBuyStats || [])) groupBuyMap[g.seller_id] = g

  const enriched = (results || []).map((r: any) => ({
    ...r,
    total_vouchers: voucherMap[r.id]?.total_vouchers ?? 0,
    used_vouchers: voucherMap[r.id]?.used_vouchers ?? 0,
    voucher_usage_rate: voucherMap[r.id]?.total_vouchers
      ? Math.round((voucherMap[r.id].used_vouchers / voucherMap[r.id].total_vouchers) * 100)
      : 0,
    total_group_buys: groupBuyMap[r.id]?.total_group_buys ?? 0,
    achieved_group_buys: groupBuyMap[r.id]?.achieved_group_buys ?? 0,
    group_buy_success_rate: groupBuyMap[r.id]?.total_group_buys
      ? Math.round((groupBuyMap[r.id].achieved_group_buys / groupBuyMap[r.id].total_group_buys) * 100)
      : 0,
  }))

  return c.json({ success: true, data: enriched })
})

// ── 셀러 계약 관리 ──
app.get('/contracts', async (c: AgencyCtx) => {
  const agencyId = c.get('agency').id
  try { await c.env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS agency_contracts (
      id INTEGER PRIMARY KEY AUTOINCREMENT, agency_id INTEGER NOT NULL, seller_id INTEGER NOT NULL,
      start_date TEXT NOT NULL, end_date TEXT NOT NULL, terms TEXT,
      status TEXT DEFAULT 'active', created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(agency_id, seller_id)
    )`).run() } catch {}

  const { results } = await c.env.DB.prepare(`
    SELECT ac.*, s.name AS seller_name, s.email AS seller_email
    FROM agency_contracts ac JOIN sellers s ON ac.seller_id = s.id
    WHERE ac.agency_id = ? ORDER BY ac.end_date ASC
  `).bind(agencyId).all()

  return c.json({ success: true, data: results || [] })
})

app.post('/contracts', async (c: AgencyCtx) => {
  const agencyId = c.get('agency').id

  // 🛡️ 계약 생성 민감 액션 — PIN 인증 필수
  const { isAgencyPinVerified } = await import('./agency-pin.routes')
  const pinOk = await isAgencyPinVerified(c.req.header('Cookie'), agencyId, c.env.JWT_SECRET)
  if (!pinOk) return c.json({ success: false, error: 'PIN 인증이 필요합니다', code: 'PIN_REQUIRED' }, 412)

  const { seller_id, start_date, end_date, terms } = await c.req.json<any>()
  if (!seller_id || !start_date || !end_date) return c.json({ success: false, error: '필수 항목을 입력해주세요' }, 400)

  // 🛡️ 2026-04-29 보안 audit CRITICAL: agency_sellers 소유권 검증.
  // 이전: body 의 seller_id 가 인증된 agency 의 소속 셀러인지 검증 없이 INSERT
  // → 다른 에이전시의 seller_id 로 fake 계약 생성 가능.
  const ownership = await c.env.DB.prepare(
    'SELECT 1 FROM agency_sellers WHERE agency_id = ? AND seller_id = ? LIMIT 1'
  ).bind(agencyId, seller_id).first()
  if (!ownership) return c.json({ success: false, error: '소속 셀러가 아닙니다.' }, 403)

  try { await c.env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS agency_contracts (
      id INTEGER PRIMARY KEY AUTOINCREMENT, agency_id INTEGER NOT NULL, seller_id INTEGER NOT NULL,
      start_date TEXT NOT NULL, end_date TEXT NOT NULL, terms TEXT,
      status TEXT DEFAULT 'active', created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(agency_id, seller_id)
    )`).run() } catch {}

  await c.env.DB.prepare(`
    INSERT INTO agency_contracts (agency_id, seller_id, start_date, end_date, terms)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(agency_id, seller_id) DO UPDATE SET start_date = excluded.start_date, end_date = excluded.end_date, terms = excluded.terms, status = 'active'
  `).bind(agencyId, seller_id, start_date, end_date, terms || null).run()

  return c.json({ success: true, message: '계약이 등록되었습니다' })
})

app.put('/contracts/:id', async (c: AgencyCtx) => {
  const agencyId = c.get('agency').id

  // 🛡️ 계약 수정 민감 액션 — PIN 인증 필수
  const { isAgencyPinVerified } = await import('./agency-pin.routes')
  const pinOk = await isAgencyPinVerified(c.req.header('Cookie'), agencyId, c.env.JWT_SECRET)
  if (!pinOk) return c.json({ success: false, error: 'PIN 인증이 필요합니다', code: 'PIN_REQUIRED' }, 412)

  const id = c.req.param('id')
  const body = await c.req.json<any>()

  // 🛡️ 2026-04-29 보안 audit: status enum 검증
  const ALLOWED_STATUS = new Set(['active', 'paused', 'terminated', 'expired'])
  if (body.status !== undefined && !ALLOWED_STATUS.has(body.status)) {
    return c.json({ success: false, error: '유효하지 않은 상태값입니다.' }, 400)
  }

  const sets: string[] = []; const vals: any[] = []
  if (body.end_date) { sets.push('end_date = ?'); vals.push(body.end_date) }
  if (body.terms !== undefined) { sets.push('terms = ?'); vals.push(body.terms) }
  if (body.status) { sets.push('status = ?'); vals.push(body.status) }
  if (!sets.length) return c.json({ success: false, error: '변경할 항목이 없습니다' }, 400)
  vals.push(id, agencyId)
  await c.env.DB.prepare(`UPDATE agency_contracts SET ${sets.join(', ')} WHERE id = ? AND agency_id = ?`).bind(...vals).run()
  return c.json({ success: true })
})
export { app as agencyOpsRoutes }
