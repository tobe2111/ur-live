/**
 * 🏬 2026-06-09 멀티-몰(Phase 2) — 크로스-몰 어드민 통합 현황 대시보드 (v1, 검토 필요).
 *
 * 슈퍼-어드민(한 운영자, 식품/패션 등 카테고리별 도매몰 운영)이 ONE 화면에서 몰별 + 합산 건강도를 봄.
 *   - GET /api/admin/wholesale-overview — 몰별 행 + totals 객체 (read-only 집계).
 *
 * 모델 B: 회원가입이 몰별이라 sellers.id / suppliers.id 가 몰-고유. 주문/예치금/입금요청은
 *   sellers.id 에 매달려 있으므로 mall 은 sellers JOIN 으로 해석(distributor_seller_id → sellers.mall_id).
 *   상품/유통사/제조사/제안은 자체 mall_id 컬럼(DEFAULT 1) 으로 직접 GROUP BY.
 *
 * ⚠️ adminApp(IP whitelist + requireAdmin + audit) 체인. 순수 read — 쓰기 없음. additive only.
 *   효율: 몰당 N쿼리 금지 → mall_id 로 GROUP BY 하는 소수 쿼리 후 클라이언트에서 머지.
 *   모든 금액 NaN-safe(SUM null → 0). 마운트: app.route('/api/admin/wholesale-overview', adminWholesaleOverviewRoutes)
 */
import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { safeError } from '@/worker/utils/safe-error'
import { requireAdmin } from '@/worker/middleware/auth'
import { adminIpWhitelist, adminAuditMiddleware } from '@/worker/middleware/admin-security'
import { ensureMallSchema, DEFAULT_MALL_ID } from './wholesale-malls'

const app = new Hono<{ Bindings: Env }>()
app.use('*', adminIpWhitelist())
app.use('*', requireAdmin())
app.use('*', adminAuditMiddleware())

// SUM/COUNT row → finite number(0 fallback). D1 은 빈 집계에 null 반환.
function num(v: unknown): number {
  const n = Number(v ?? 0)
  return Number.isFinite(n) ? n : 0
}
// COALESCE(mall_id, 1) 와 정합 — 행의 mall_id 가 null/0 이면 기본 몰로 귀속.
function mallKey(v: unknown): number {
  const n = Number(v ?? DEFAULT_MALL_ID)
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_MALL_ID
}

interface MallOverview {
  mall_id: number
  mall_name: string
  active: number
  distributors: number
  suppliers: number
  products: number
  gmv_month: number
  deposit_liability: number
  pending_charge_requests: number
  pending_proposals: number
  orders_month: number
}

function emptyRow(mall_id: number, mall_name: string, active: number): MallOverview {
  return {
    mall_id, mall_name, active,
    distributors: 0, suppliers: 0, products: 0,
    gmv_month: 0, deposit_liability: 0,
    pending_charge_requests: 0, pending_proposals: 0, orders_month: 0,
  }
}

// ── GET / — 몰별 행 + totals 합산 ────────────────────────────────────────────
app.get('/', async (c) => {
  const { DB } = c.env
  try {
    await ensureMallSchema(DB)

    // 이번달 시작(UTC) — paid_at >= 비교용. SQLite datetime 문자열과 정합.
    const now = new Date()
    const monthStart = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-01 00:00:00`

    // 1) 몰 목록(기준 행). 비활성 포함 — 운영자가 모든 몰 건강도를 봄.
    const mallsRes = await DB.prepare(
      'SELECT id, name, active FROM wholesale_malls ORDER BY id ASC LIMIT 200'
    ).all<{ id: number; name: string | null; active: number }>().catch(() => ({ results: [] as { id: number; name: string | null; active: number }[] }))
    const malls = mallsRes.results ?? []

    // mall_id → 누적 행. 기준 몰 목록으로 seed(주문/예치금만 있고 몰 row 없는 경우는 거의 없지만 안전하게 fallback).
    const byMall = new Map<number, MallOverview>()
    for (const m of malls) {
      const id = mallKey(m.id)
      byMall.set(id, emptyRow(id, m.name || `몰 #${id}`, Number(m.active ?? 1) ? 1 : 0))
    }
    function row(mallId: number): MallOverview {
      const id = mallKey(mallId)
      let r = byMall.get(id)
      if (!r) { r = emptyRow(id, `몰 #${id}`, 1); byMall.set(id, r) }
      return r
    }

    // 2) 유통사 수 — sellers.is_distributor=1, GROUP BY mall.
    const distRes = await DB.prepare(
      `SELECT COALESCE(mall_id, 1) AS m, COUNT(*) AS cnt
       FROM sellers WHERE is_distributor = 1 GROUP BY COALESCE(mall_id, 1)`
    ).all<{ m: number; cnt: number }>().catch(() => ({ results: [] as { m: number; cnt: number }[] }))
    for (const r of distRes.results ?? []) row(r.m).distributors = num(r.cnt)

    // 3) 제조사(공급자) 수 — suppliers, GROUP BY mall.
    const supRes = await DB.prepare(
      `SELECT COALESCE(mall_id, 1) AS m, COUNT(*) AS cnt
       FROM suppliers GROUP BY COALESCE(mall_id, 1)`
    ).all<{ m: number; cnt: number }>().catch(() => ({ results: [] as { m: number; cnt: number }[] }))
    for (const r of supRes.results ?? []) row(r.m).suppliers = num(r.cnt)

    // 4) 도매 카탈로그 상품 수 — is_supply_product=1 AND supply_source_id IS NULL(원본만), GROUP BY mall.
    const prodRes = await DB.prepare(
      `SELECT COALESCE(mall_id, 1) AS m, COUNT(*) AS cnt
       FROM products
       WHERE is_supply_product = 1 AND supply_source_id IS NULL
       GROUP BY COALESCE(mall_id, 1)`
    ).all<{ m: number; cnt: number }>().catch(() => ({ results: [] as { m: number; cnt: number }[] }))
    for (const r of prodRes.results ?? []) row(r.m).products = num(r.cnt)

    // 5) 이번달 GMV + 주문수 — wholesale_orders(PAID, paid_at>=월초) JOIN sellers 로 mall 해석.
    const gmvRes = await DB.prepare(
      `SELECT COALESCE(s.mall_id, 1) AS m,
              COALESCE(SUM(o.subtotal), 0) AS gmv,
              COUNT(*) AS cnt
       FROM wholesale_orders o
       JOIN sellers s ON s.id = o.distributor_seller_id
       WHERE o.status = 'PAID' AND o.paid_at >= ?
       GROUP BY COALESCE(s.mall_id, 1)`
    ).bind(monthStart).all<{ m: number; gmv: number; cnt: number }>().catch(() => ({ results: [] as { m: number; gmv: number; cnt: number }[] }))
    for (const r of gmvRes.results ?? []) { const rr = row(r.m); rr.gmv_month = num(r.gmv); rr.orders_month = num(r.cnt) }

    // 6) 예치금 부채 — SUM(wholesale_deposits.balance) JOIN sellers 로 mall 해석(플랫폼이 유통사에 진 빚).
    const depRes = await DB.prepare(
      `SELECT COALESCE(s.mall_id, 1) AS m, COALESCE(SUM(d.balance), 0) AS liability
       FROM wholesale_deposits d
       JOIN sellers s ON s.id = d.seller_id
       GROUP BY COALESCE(s.mall_id, 1)`
    ).all<{ m: number; liability: number }>().catch(() => ({ results: [] as { m: number; liability: number }[] }))
    for (const r of depRes.results ?? []) row(r.m).deposit_liability = num(r.liability)

    // 7) 대기 입금확인 — wholesale_deposit_requests(status='pending') JOIN sellers 로 mall 해석.
    const chargeRes = await DB.prepare(
      `SELECT COALESCE(s.mall_id, 1) AS m, COUNT(*) AS cnt
       FROM wholesale_deposit_requests r
       JOIN sellers s ON s.id = r.seller_id
       WHERE r.status = 'pending'
       GROUP BY COALESCE(s.mall_id, 1)`
    ).all<{ m: number; cnt: number }>().catch(() => ({ results: [] as { m: number; cnt: number }[] }))
    for (const r of chargeRes.results ?? []) row(r.m).pending_charge_requests = num(r.cnt)

    // 8) 대기 제안 — wholesale_proposal_tickets(status='open'), 자체 mall_id GROUP BY.
    const propRes = await DB.prepare(
      `SELECT COALESCE(mall_id, 1) AS m, COUNT(*) AS cnt
       FROM wholesale_proposal_tickets WHERE status = 'open' GROUP BY COALESCE(mall_id, 1)`
    ).all<{ m: number; cnt: number }>().catch(() => ({ results: [] as { m: number; cnt: number }[] }))
    for (const r of propRes.results ?? []) row(r.m).pending_proposals = num(r.cnt)

    // 9) 행 정리(mall_id 오름차순) + totals 합산.
    const rows = [...byMall.values()].sort((a, b) => a.mall_id - b.mall_id)
    const totals = rows.reduce((acc, r) => {
      acc.malls += 1
      acc.distributors += r.distributors
      acc.suppliers += r.suppliers
      acc.products += r.products
      acc.gmv_month += r.gmv_month
      acc.deposit_liability += r.deposit_liability
      acc.pending_charge_requests += r.pending_charge_requests
      acc.pending_proposals += r.pending_proposals
      acc.orders_month += r.orders_month
      return acc
    }, {
      malls: 0, distributors: 0, suppliers: 0, products: 0,
      gmv_month: 0, deposit_liability: 0,
      pending_charge_requests: 0, pending_proposals: 0, orders_month: 0,
    })

    return c.json({ success: true, month_start: monthStart, malls: rows, totals })
  } catch (err) {
    return safeError(c, err, '도매 통합 현황 조회 중 오류가 발생했습니다', '[admin-wholesale-overview]')
  }
})

export { app as adminWholesaleOverviewRoutes }
