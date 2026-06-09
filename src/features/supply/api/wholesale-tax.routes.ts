/**
 * 🏭 TAX-1 (2026-06-08) 유통스타트 도매몰 — 세무/정산 어드민 라우터.
 *
 * 3개 영역 (모두 requireAdmin):
 *   (a) GET  /tax/aging                      — 미지급(공급사 미정산) + 미수(유통사 외상) aging 버킷 리포트
 *   (b) GET  /tax/purchase-invoices?period=  — 매입(제조사→유통스타트) 세금계산서 candidates (월 paid 정산 SUM)
 *   (c) POST /tax/purchase-invoices/issue    — **수동(MANUAL)** 1 공급사+기간 역발행 기록(멱등). 자동 발사 금지.
 *
 * 마운트(오케스트레이터): app.route('/api/admin/wholesale', wholesaleTaxRoutes)
 *
 * ⚠️ 역발행 안전장치 (bound scope):
 *   - 이 라우터는 **실 세금계산서를 자동/루프/cron 으로 발행하지 않는다.**
 *   - POST issue 는 어드민 1회 클릭 = (supplier_id, period) 1행 'pending' 기록 + 감사로그만.
 *   - 바로빌 실발행은 staging 검증 + 별도 어드민 승인 후 후속 PR 에서 연결 (현재 TODO note 반환).
 *   - 매입(역발행)은 매출과 발행 주체가 달라 기존 distributor-admin 의 sales-only barobill 와이어를 재사용하지 않는다.
 *
 * 읽기 집계는 전부 graceful — 테이블/컬럼 미존재 시 throw 하지 않고 0/빈 버킷 반환.
 */
import { Hono } from 'hono'
import { safeError } from '@/worker/utils/safe-error'
import type { Env } from '@/worker/types/env'
import { requireAdmin } from '@/worker/middleware/auth'
import { adminIpWhitelist, adminAuditMiddleware, writeAuditLog } from '@/worker/middleware/admin-security'
import { rateLimit } from '@/worker/middleware/rate-limit'
import { swallow } from '@/worker/utils/swallow'
import { listAdminInvoices, reissueInvoice } from './wholesale-tax-invoices'

const app = new Hono<{ Bindings: Env }>()

// 🏭 distributor-admin.routes 와 동일 보안 체인 — IP 화이트리스트(미설정 시 fail-open) + 감사로그.
app.use('*', adminIpWhitelist())
app.use('*', requireAdmin())
app.use('*', adminAuditMiddleware())

// ─────────────────────────────────────────────────────────────────────────────
// self-ensure: wholesale_purchase_invoices (역발행 의도 기록 — 멱등). repair-schema CI 불안정 대비.
// ─────────────────────────────────────────────────────────────────────────────
const _ensured = new WeakMap<object, Promise<void>>()
async function ensurePurchaseInvoiceSchema(DB: D1Database): Promise<void> {
  const existing = _ensured.get(DB)
  if (existing) return existing
  const p = _doEnsure(DB)
  _ensured.set(DB, p)
  try {
    await p
  } catch {
    _ensured.delete(DB) // 실패 시 다음 호출 재시도
  }
}
async function _doEnsure(DB: D1Database): Promise<void> {
  await DB.prepare(`CREATE TABLE IF NOT EXISTS wholesale_purchase_invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id INTEGER NOT NULL,
    period TEXT NOT NULL,
    supply_amount INTEGER NOT NULL DEFAULT 0,
    vat_amount INTEGER NOT NULL DEFAULT 0,
    total_amount INTEGER NOT NULL DEFAULT 0,
    settlement_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',
    barobill_ref TEXT,
    note TEXT,
    created_by TEXT,
    created_at DATETIME DEFAULT (datetime('now')),
    issued_at DATETIME,
    UNIQUE(supplier_id, period)
  )`).run().catch(swallow('wholesale-tax:create'))
  await DB.prepare('CREATE INDEX IF NOT EXISTS idx_wholesale_purchase_inv_period ON wholesale_purchase_invoices(period, supplier_id)')
    .run().catch(swallow('wholesale-tax:idx'))
}

const VALID_PERIOD = /^\d{4}-\d{2}$/

/** VAT 추출(부가세 포함 총액 → 공급가액/부가세). distributor-admin splitVat 와 동일 식. */
function splitVat(grossInclusive: number): { supply: number; vat: number; total: number } {
  const total = Math.max(0, Math.round(Number(grossInclusive) || 0))
  const supply = Math.round(total / 1.1)
  return { supply, vat: total - supply, total }
}

// ─────────────────────────────────────────────────────────────────────────────
// (a) GET /tax/aging — 미지급(공급사) + 미수(유통사 외상) aging
// ─────────────────────────────────────────────────────────────────────────────
// 버킷: 0-7d / 8-30d / 31-60d / 60d+. 기준일:
//   - 미지급(공급사): 아직 미지급(pending/available, 양수 supply_amount)인 정산을 기준일(available_at,
//     없으면 created_at)의 경과일로 버킷팅. status='paid'/'cancelled' 및 클로백 음수 row 제외.
//   - 미수(유통사 외상): sellers.outstanding_balance(양수) — 미상환 외상 총액. ledger 가 있으면
//     마지막 외상 발생일(type='charge')을 기준일로 경과 버킷팅(없으면 'unknown' 버킷에 합산).
function bucketIndex(days: number): 0 | 1 | 2 | 3 {
  if (days <= 7) return 0
  if (days <= 30) return 1
  if (days <= 60) return 2
  return 3
}
const EMPTY_BUCKETS = () => ({ b0_7: 0, b8_30: 0, b31_60: 0, b60_plus: 0, total: 0, count: 0 })
type Buckets = ReturnType<typeof EMPTY_BUCKETS>
function addToBucket(b: Buckets, days: number, amount: number) {
  const amt = Math.max(0, Math.floor(Number(amount) || 0))
  if (amt <= 0) return
  const idx = bucketIndex(days)
  if (idx === 0) b.b0_7 += amt
  else if (idx === 1) b.b8_30 += amt
  else if (idx === 2) b.b31_60 += amt
  else b.b60_plus += amt
  b.total += amt
  b.count += 1
}

app.get('/tax/aging', async (c) => {
  try {
    const DB = c.env.DB
    const now = Date.now()

    // ── 미지급(공급사 미정산) ──────────────────────────────────────────────
    const payable = EMPTY_BUCKETS()
    const payableBySupplier: Record<number, { supplier_id: number; supplier_name: string | null } & Buckets> = {}
    const settleRows = await DB.prepare(
      `SELECT ss.supplier_id AS supplier_id, ss.supply_amount AS amt,
              COALESCE(ss.available_at, ss.created_at) AS ref_at,
              s.name AS supplier_name, s.business_name AS supplier_biz
       FROM supplier_settlements ss
       LEFT JOIN suppliers s ON s.id = ss.supplier_id
       WHERE ss.status IN ('pending','available')
         AND ss.supply_amount > 0
         AND (ss.note IS NULL OR ss.note != 'clawback')
       LIMIT 20000`
    ).all<{ supplier_id: number; amt: number; ref_at: string | null; supplier_name: string | null; supplier_biz: string | null }>()
      .catch(() => ({ results: [] as { supplier_id: number; amt: number; ref_at: string | null; supplier_name: string | null; supplier_biz: string | null }[] }))
    for (const r of settleRows.results || []) {
      const refMs = r.ref_at ? Date.parse(String(r.ref_at)) : now
      const days = Number.isFinite(refMs) ? Math.max(0, Math.floor((now - refMs) / 86400_000)) : 0
      addToBucket(payable, days, r.amt)
      const sid = Number(r.supplier_id) || 0
      if (!payableBySupplier[sid]) {
        payableBySupplier[sid] = { supplier_id: sid, supplier_name: r.supplier_biz || r.supplier_name || null, ...EMPTY_BUCKETS() }
      }
      addToBucket(payableBySupplier[sid], days, r.amt)
    }

    // ── 미수(유통사 외상 outstanding) ──────────────────────────────────────
    const receivable = EMPTY_BUCKETS()
    const receivableByDistributor: Record<number, { seller_id: number; name: string | null; username: string | null } & Buckets> = {}
    // sellers.outstanding_balance — 미상환 외상(플랫폼 채권). 컬럼/테이블 미존재 시 graceful 빈 결과.
    const owingRows = await DB.prepare(
      `SELECT id AS seller_id, name, username, COALESCE(outstanding_balance, 0) AS owed
       FROM sellers WHERE COALESCE(outstanding_balance, 0) > 0 LIMIT 5000`
    ).all<{ seller_id: number; name: string | null; username: string | null; owed: number }>()
      .catch(() => ({ results: [] as { seller_id: number; name: string | null; username: string | null; owed: number }[] }))

    // ledger(wholesale_credit_ledger)가 있으면 유통사별 마지막 외상발생일을 aging 기준으로 사용.
    //   type='charge' 의 최근 created_at. 미존재(테이블 없음/행 없음)면 0일(0-7d) 버킷으로 안전 합산.
    const lastChargeRows = await DB.prepare(
      `SELECT distributor_seller_id AS seller_id, MAX(created_at) AS last_charge
       FROM wholesale_credit_ledger WHERE type = 'charge' GROUP BY distributor_seller_id LIMIT 5000`
    ).all<{ seller_id: number; last_charge: string | null }>()
      .catch(() => ({ results: [] as { seller_id: number; last_charge: string | null }[] }))
    const lastChargeMap: Record<number, number> = {}
    for (const r of lastChargeRows.results || []) {
      const ms = r.last_charge ? Date.parse(String(r.last_charge)) : NaN
      if (Number.isFinite(ms)) lastChargeMap[Number(r.seller_id) || 0] = ms
    }

    for (const r of owingRows.results || []) {
      const sid = Number(r.seller_id) || 0
      const lastMs = lastChargeMap[sid]
      const days = Number.isFinite(lastMs) ? Math.max(0, Math.floor((now - (lastMs as number)) / 86400_000)) : 0
      addToBucket(receivable, days, r.owed)
      if (!receivableByDistributor[sid]) {
        receivableByDistributor[sid] = { seller_id: sid, name: r.name, username: r.username, ...EMPTY_BUCKETS() }
      }
      addToBucket(receivableByDistributor[sid], days, r.owed)
    }

    return c.json({
      success: true,
      as_of: new Date(now).toISOString(),
      buckets: ['0-7d', '8-30d', '31-60d', '60d+'],
      payable: {
        summary: payable,
        by_supplier: Object.values(payableBySupplier).sort((a, b) => b.total - a.total).slice(0, 200),
      },
      receivable: {
        summary: receivable,
        by_distributor: Object.values(receivableByDistributor).sort((a, b) => b.total - a.total).slice(0, 200),
      },
    })
  } catch (err) {
    return safeError(c, err, '미수/미지급 리포트 조회 중 오류가 발생했습니다', '[wholesale-tax]')
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// (b) GET /tax/purchase-invoices?period=YYYY-MM — 매입(역발행) candidates
// ─────────────────────────────────────────────────────────────────────────────
// 공급사별, 해당 월에 **paid** 된 정산(supply_amount>0) 의 SUM = 플랫폼이 제조사에 지급한 매입액.
//   paid_at 기준 월 필터. 음수 클로백 row 제외(note='clawback'). 이미 발행기록(pending/issued) 매칭 표기.
app.get('/tax/purchase-invoices', async (c) => {
  try {
    const DB = c.env.DB
    await ensurePurchaseInvoiceSchema(DB)
    const period = (c.req.query('period') || '').slice(0, 7)
    if (!VALID_PERIOD.test(period)) {
      return c.json({ success: false, error: '기간(period=YYYY-MM)이 필요합니다' }, 400)
    }

    const candRows = await DB.prepare(
      `SELECT ss.supplier_id AS supplier_id,
              SUM(ss.supply_amount) AS paid_amount,
              COUNT(*) AS settlement_count,
              s.name AS supplier_name, s.business_name AS supplier_biz, s.business_number AS biz_no
       FROM supplier_settlements ss
       LEFT JOIN suppliers s ON s.id = ss.supplier_id
       WHERE ss.status = 'paid'
         AND ss.supply_amount > 0
         AND (ss.note IS NULL OR ss.note != 'clawback')
         AND ss.paid_at IS NOT NULL
         AND strftime('%Y-%m', ss.paid_at) = ?
       GROUP BY ss.supplier_id
       HAVING paid_amount > 0
       ORDER BY paid_amount DESC
       LIMIT 1000`
    ).bind(period).all<{ supplier_id: number; paid_amount: number; settlement_count: number; supplier_name: string | null; supplier_biz: string | null; biz_no: string | null }>()
      .catch(() => ({ results: [] as { supplier_id: number; paid_amount: number; settlement_count: number; supplier_name: string | null; supplier_biz: string | null; biz_no: string | null }[] }))

    // 기존 발행기록(같은 period) — supplier_id 별로 status/ref 매칭.
    const issuedRows = await DB.prepare(
      `SELECT supplier_id, status, total_amount, barobill_ref, issued_at, created_at, note
       FROM wholesale_purchase_invoices WHERE period = ?`
    ).bind(period).all<{ supplier_id: number; status: string; total_amount: number; barobill_ref: string | null; issued_at: string | null; created_at: string | null; note: string | null }>()
      .catch(() => ({ results: [] as { supplier_id: number; status: string; total_amount: number; barobill_ref: string | null; issued_at: string | null; created_at: string | null; note: string | null }[] }))
    const issuedMap: Record<number, { status: string; total_amount: number; barobill_ref: string | null; issued_at: string | null; created_at: string | null; note: string | null }> = {}
    for (const r of issuedRows.results || []) issuedMap[Number(r.supplier_id) || 0] = r

    const candidates = (candRows.results || []).map((r) => {
      const sid = Number(r.supplier_id) || 0
      const { supply, vat, total } = splitVat(Number(r.paid_amount) || 0)
      const rec = issuedMap[sid]
      return {
        supplier_id: sid,
        supplier_name: r.supplier_biz || r.supplier_name || null,
        business_number: r.biz_no || null,
        paid_amount: Math.max(0, Math.floor(Number(r.paid_amount) || 0)),
        supply_amount: supply,
        vat_amount: vat,
        total_amount: total,
        settlement_count: Number(r.settlement_count) || 0,
        invoice_status: rec?.status || 'none', // none | pending | issued
        barobill_ref: rec?.barobill_ref || null,
        issued_at: rec?.issued_at || null,
      }
    })

    return c.json({ success: true, period, candidates })
  } catch (err) {
    return safeError(c, err, '매입 세금계산서 목록 조회 중 오류가 발생했습니다', '[wholesale-tax]')
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// (c) POST /tax/purchase-invoices/issue — 수동 역발행 기록 (1 supplier+period). 멱등.
// ─────────────────────────────────────────────────────────────────────────────
//   v1: 의도를 wholesale_purchase_invoices 에 status='pending' 으로 기록 + 감사로그.
//   **실 바로빌 발행은 하지 않음** — staging 검증 후 후속 PR 에서 연결. TODO note 반환.
app.post('/tax/purchase-invoices/issue', rateLimit({ action: 'wholesale-purchase-invoice-issue', max: 30, windowSec: 60 }), async (c) => {
  try {
    const DB = c.env.DB
    await ensurePurchaseInvoiceSchema(DB)
    const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
    const supplierId = Number(body.supplier_id)
    const period = String(body.period || '').slice(0, 7)
    if (!Number.isFinite(supplierId) || supplierId <= 0) {
      return c.json({ success: false, error: 'supplier_id 가 필요합니다' }, 400)
    }
    if (!VALID_PERIOD.test(period)) {
      return c.json({ success: false, error: '기간(period=YYYY-MM)이 올바르지 않습니다' }, 400)
    }

    // 서버 재계산 — 클라이언트 금액 신뢰 금지. 해당 월 paid 정산 SUM.
    const agg = await DB.prepare(
      `SELECT COALESCE(SUM(supply_amount), 0) AS paid_amount, COUNT(*) AS cnt
       FROM supplier_settlements
       WHERE supplier_id = ? AND status = 'paid' AND supply_amount > 0
         AND (note IS NULL OR note != 'clawback')
         AND paid_at IS NOT NULL AND strftime('%Y-%m', paid_at) = ?`
    ).bind(supplierId, period).first<{ paid_amount: number; cnt: number }>().catch(() => null)
    const paidAmount = Math.max(0, Math.floor(Number(agg?.paid_amount) || 0))
    const count = Number(agg?.cnt) || 0
    if (paidAmount <= 0 || count <= 0) {
      return c.json({ success: false, error: '해당 기간에 지급된 매입 정산이 없습니다' }, 400)
    }
    const { supply, vat, total } = splitVat(paidAmount)

    // 멱등: 이미 발행기록 있으면 그대로 반환(중복 발행 차단).
    const existing = await DB.prepare(
      'SELECT id, status, total_amount, barobill_ref, note FROM wholesale_purchase_invoices WHERE supplier_id = ? AND period = ?'
    ).bind(supplierId, period).first<{ id: number; status: string; total_amount: number; barobill_ref: string | null; note: string | null }>().catch(() => null)
    if (existing) {
      return c.json({
        success: true,
        already: true,
        invoice: { id: existing.id, supplier_id: supplierId, period, status: existing.status, total_amount: existing.total_amount, barobill_ref: existing.barobill_ref },
        note: existing.note || '이미 기록된 역발행 의도입니다.',
      })
    }

    // 공급사 정보(감사/표기용).
    const sup = await DB.prepare('SELECT name, business_name, business_number FROM suppliers WHERE id = ?')
      .bind(supplierId).first<{ name: string | null; business_name: string | null; business_number: string | null }>().catch(() => null)

    // ⚠️ bound scope: 실 바로빌 역발행은 자동 발사 금지 — 의도만 'pending' 기록.
    const TODO_NOTE = '역발행 의도 기록(pending). 실 전자세금계산서(바로빌) 발행은 staging 검증 + 어드민 최종 승인 후 후속 작업에서 연결됩니다.'
    const ins = await DB.prepare(
      `INSERT INTO wholesale_purchase_invoices (supplier_id, period, supply_amount, vat_amount, total_amount, settlement_count, status, note, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, datetime('now'))
       ON CONFLICT(supplier_id, period) DO NOTHING`
    ).bind(
      supplierId, period, supply, vat, total, count, TODO_NOTE,
      String(((c.get as (k: string) => unknown)('user') as { id?: string | number } | undefined)?.id ?? 'admin'),
    ).run().catch(() => null)

    // 동시 요청으로 ON CONFLICT 발생 시 — 방금 들어간 행을 다시 읽어 반환(멱등).
    const row = await DB.prepare(
      'SELECT id, status FROM wholesale_purchase_invoices WHERE supplier_id = ? AND period = ?'
    ).bind(supplierId, period).first<{ id: number; status: string }>().catch(() => null)

    await writeAuditLog(c, {
      action: 'wholesale_purchase_invoice_issue_record',
      targetType: 'wholesale_purchase_invoice',
      targetId: row?.id ?? `${supplierId}:${period}`,
      after: { supplier_id: supplierId, supplier_name: sup?.business_name || sup?.name || null, period, supply_amount: supply, vat_amount: vat, total_amount: total, settlement_count: count, status: 'pending' },
    }).catch(() => { /* audit 실패해도 성공 처리 */ })

    return c.json({
      success: true,
      invoice: {
        id: row?.id ?? Number(ins?.meta?.last_row_id) ?? null,
        supplier_id: supplierId,
        supplier_name: sup?.business_name || sup?.name || null,
        business_number: sup?.business_number || null,
        period,
        supply_amount: supply,
        vat_amount: vat,
        total_amount: total,
        settlement_count: count,
        status: 'pending',
      },
      todo: TODO_NOTE,
    })
  } catch (err) {
    return safeError(c, err, '역발행 기록 중 오류가 발생했습니다', '[wholesale-tax]')
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// 🏭 Wave 3c — 거래단위(per-order) 자동 전자세금계산서 어드민 뷰 + 재발행.
//   매출(sales: 플랫폼→유통사) / 매입(purchase: 제조사→플랫폼 역발행). status: draft|issued|failed.
//   provider 발행은 env-gated(TAX_INVOICE_API_KEY) — 미설정 시 'draft' 로 남아 재발행 대기.
//   경로: GET  /api/admin/wholesale/wholesale-tax-invoices?status=&type=
//         POST /api/admin/wholesale/wholesale-tax-invoices/:id/reissue
// ─────────────────────────────────────────────────────────────────────────────
app.get('/wholesale-tax-invoices', async (c) => {
  try {
    const status = (c.req.query('status') || '').slice(0, 16)
    const type = (c.req.query('type') || '').slice(0, 16)
    // 🏬 멀티-몰: ?mall_id= 가 주어진 경우에만 귀속 몰로 필터(미지정=전 몰, 기존 동작 byte-identical).
    const mallQ = c.req.query('mall_id')
    const mallN = Math.floor(Number(mallQ))
    const mallId = (mallQ != null && mallQ !== '' && Number.isFinite(mallN) && mallN > 0) ? mallN : undefined
    const invoices = await listAdminInvoices(c.env.DB, { status, type, mallId, limit: 500 })
    return c.json({ success: true, invoices })
  } catch (err) {
    return safeError(c, err, '세금계산서 목록 조회 중 오류가 발생했습니다', '[wholesale-tax]')
  }
})

app.post('/wholesale-tax-invoices/:id/reissue', rateLimit({ action: 'wholesale-tax-invoice-reissue', max: 60, windowSec: 60 }), async (c) => {
  try {
    const id = Number(c.req.param('id'))
    if (!Number.isFinite(id) || id <= 0) return c.json({ success: false, error: '잘못된 ID' }, 400)
    const result = await reissueInvoice(c.env.DB, c.env, id)
    if (!result) return c.json({ success: false, error: '세금계산서를 찾을 수 없습니다' }, 404)
    await writeAuditLog(c, {
      action: 'wholesale_tax_invoice_reissue',
      targetType: 'wholesale_tax_invoice',
      targetId: id,
      after: { status: result.status, provider_ref: result.provider_ref, skipped: result.skipped },
    }).catch(() => { /* audit best-effort */ })
    // skipped(env 미설정) 도 200 — 어드민에게 '발행 연동 미설정' 을 명확히 안내.
    return c.json({
      success: result.ok,
      status: result.status,
      provider_ref: result.provider_ref,
      skipped: result.skipped || false,
      message: result.ok
        ? '세금계산서가 발행되었습니다'
        : result.skipped
          ? '발행 연동(TAX_INVOICE_API_KEY)이 설정되지 않아 임시저장 상태로 유지됩니다'
          : (result.error || '발행에 실패했습니다'),
    })
  } catch (err) {
    return safeError(c, err, '세금계산서 재발행 중 오류가 발생했습니다', '[wholesale-tax]')
  }
})

export default app
