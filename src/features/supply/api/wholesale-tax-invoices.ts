/**
 * 🏭 2026-06-09 Wave 3c — 도매 전자세금계산서 자동발행/정산 (per-order).
 *
 * 플랫폼(유통스타트)은 B2B 중개 사업자 → 두 방향 전자세금계산서가 발생한다:
 *   1) 매출(sales)   : 플랫폼 → 유통사   — 주문 결제완료(PAID) 시 1건. (order_id 멱등)
 *   2) 매입(purchase): 제조사 → 플랫폼   — 제조사 정산 적립 시 제조사별 1건. (order_id+supplier_id 멱등)
 *                       = 역발행(제조사가 플랫폼에 발행). 기존 수동 TAX-1(월 집계)를 거래단위로 자동 보완.
 *
 * 금액 산식(VAT split):
 *   - 도매 주문 subtotal / 라인 공급가는 **부가세 포함(공급대가)** 으로 취급한다(WHOLESALE_PRICE_VAT_INCLUSIVE).
 *   - 공급가액 = round(gross / 1.1), 세액 = gross − 공급가액. (wholesale-tax.routes.splitVat 와 동일 식)
 *
 * provider 발행:
 *   - 레코드를 'draft' 로 INSERT 후 issueTaxInvoice()(admin-tax.routes, env-gated stub) 호출.
 *   - TAX_INVOICE_API_KEY + TAX_INVOICE_SENDER_BIZ_NO 설정 시 → 발행 후 'issued' + provider_ref.
 *   - 미설정(기본) → skip → 'draft' 유지(cost-0, 후속 발행 가능).
 *
 * ⚠️ 전부 fail-soft(try/catch, log-only) — 세금레코드 실패가 주문/정산/환불을 절대 막거나 되돌리지 않는다.
 *    돈-CAS(예치금 차감/정산 적립)는 호출측이 보호하며, 이 모듈은 그 *이후* additive 로만 호출된다.
 *    서버 재계산 금액만 사용(클라이언트 값 미신뢰).
 */
import { issueTaxInvoice } from '@/features/admin/api/admin-tax.routes'

/** 🏭 도매 가격(주문 subtotal / 라인 공급가)을 부가세 포함(공급대가)으로 취급한다. */
export const WHOLESALE_PRICE_VAT_INCLUSIVE = true

/** 매출 레코드의 supplier_id sentinel(0) — SQLite UNIQUE 가 NULL 을 distinct 취급하는 문제 회피(멱등). */
const SALES_SUPPLIER_SENTINEL = 0

export interface VatSplit { supply: number; vat: number; total: number }

/**
 * 부가세 포함 총액(공급대가) → 공급가액/세액/합계 분리.
 * WHOLESALE_PRICE_VAT_INCLUSIVE=false 인 가상 케이스(공급가액 기준)면 세액=round(supply*0.1).
 */
export function splitWholesaleVat(grossOrSupply: number): VatSplit {
  const amount = Math.max(0, Math.round(Number(grossOrSupply) || 0))
  if (WHOLESALE_PRICE_VAT_INCLUSIVE) {
    const supply = Math.round(amount / 1.1)
    return { supply, vat: amount - supply, total: amount }
  }
  const vat = Math.round(amount * 0.1)
  return { supply: amount, vat, total: amount + vat }
}

// ── self-ensure: wholesale_tax_invoices (repair-schema CI 불안정 대비, in-flight promise 공유) ──
const _ensuring = new WeakMap<object, Promise<void>>()
async function ensureSchema(DB: D1Database): Promise<void> {
  const existing = _ensuring.get(DB)
  if (existing) return existing
  const p = _doEnsure(DB)
  _ensuring.set(DB, p)
  try {
    await p
  } catch {
    _ensuring.delete(DB) // 실패 시 다음 호출 재시도
  }
}
async function _doEnsure(DB: D1Database): Promise<void> {
  await DB.prepare(`CREATE TABLE IF NOT EXISTS wholesale_tax_invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    type TEXT NOT NULL,
    supplier_id INTEGER,
    distributor_seller_id INTEGER,
    supply_amount INTEGER NOT NULL DEFAULT 0,
    vat_amount INTEGER NOT NULL DEFAULT 0,
    total_amount INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'draft',
    provider_ref TEXT,
    note TEXT,
    issued_at DATETIME,
    created_at DATETIME DEFAULT (datetime('now'))
  )`).run()
  await DB.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_wholesale_tax_inv_unique ON wholesale_tax_invoices(order_id, type, supplier_id)').run().catch(() => {})
  await DB.prepare('CREATE INDEX IF NOT EXISTS idx_wholesale_tax_inv_distributor ON wholesale_tax_invoices(distributor_seller_id, type, created_at DESC)').run().catch(() => {})
  await DB.prepare('CREATE INDEX IF NOT EXISTS idx_wholesale_tax_inv_supplier ON wholesale_tax_invoices(supplier_id, type, created_at DESC)').run().catch(() => {})
  await DB.prepare('CREATE INDEX IF NOT EXISTS idx_wholesale_tax_inv_status ON wholesale_tax_invoices(status, type, created_at DESC)').run().catch(() => {})
}

/** issueTaxInvoice 가 받는 env 구조(structural). */
type TaxEnv = { TAX_INVOICE_API_KEY?: string; TAX_INVOICE_API_URL?: string; TAX_INVOICE_SENDER_BIZ_NO?: string }
function asTaxEnv(env: unknown): TaxEnv { return (env || {}) as TaxEnv }

const DEV = (() => { try { return !!import.meta.env?.DEV } catch { return false } })()
function logSoft(tag: string, e: unknown) { if (DEV) console.warn(`[wholesale-tax-invoice] ${tag}`, e) }

/**
 * 'draft' 레코드 INSERT(멱등) 후 provider 발행 시도. 이미 있으면 그 레코드를 반환(no-op).
 * provider 성공(env 설정) → 'issued' + provider_ref. 미설정/실패 → 'draft' 유지.
 * @returns 처리된 레코드 id (또는 null — 전부 fail-soft)
 */
async function upsertAndFile(
  DB: D1Database,
  env: unknown,
  params: {
    orderId: number
    type: 'sales' | 'purchase'
    supplierId: number // 매출은 SALES_SUPPLIER_SENTINEL(0)
    distributorSellerId: number | null
    split: VatSplit
    note: string
    // provider 발행 입력
    payeeType: 'store_owner' | 'seller' | 'agency'
    payeeId: string
    businessNumber: string | null
    serviceDescription: string
  },
): Promise<number | null> {
  const { orderId, type, supplierId, distributorSellerId, split, note } = params
  if (split.total <= 0) return null

  // 멱등 INSERT — UNIQUE(order_id, type, supplier_id) 충돌 시 no-op.
  const ins = await DB.prepare(
    `INSERT INTO wholesale_tax_invoices
       (order_id, type, supplier_id, distributor_seller_id, supply_amount, vat_amount, total_amount, status, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?, datetime('now'))
     ON CONFLICT(order_id, type, supplier_id) DO NOTHING`,
  ).bind(orderId, type, supplierId, distributorSellerId, split.supply, split.vat, split.total, note).run().catch((e) => { logSoft('insert', e); return null })

  // 방금 들어간(또는 기존) 레코드 조회.
  const row = await DB.prepare(
    'SELECT id, status FROM wholesale_tax_invoices WHERE order_id = ? AND type = ? AND supplier_id = ?'
  ).bind(orderId, type, supplierId).first<{ id: number; status: string }>().catch(() => null)
  // 🛠️ 2026-06-09 코드리뷰 #4: last_row_id 는 실제 INSERT(changes===1)일 때만 신뢰 — ON CONFLICT no-op 시
  //   last_row_id 가 직전 무관 행을 가리켜 엉뚱한 세금레코드를 issued 처리할 수 있음. SELECT 우선, fallback gated.
  const insertedId = ins?.meta?.changes === 1 ? Number(ins.meta.last_row_id) : 0
  const recId = row?.id ?? (insertedId > 0 ? insertedId : null)
  if (!recId) return null
  // 이미 발행(issued)된 레코드면 재발행하지 않음(멱등).
  if (row?.status === 'issued') return recId

  // provider 발행 시도(env-gated). business_number 형식 미충족 시 issueTaxInvoice 가 거부(success:false) → draft 유지.
  try {
    const result = await issueTaxInvoice(asTaxEnv(env), {
      payee_type: params.payeeType,
      payee_id: params.payeeId,
      business_number: params.businessNumber || '',
      amount: split.supply,        // 공급가액
      vat_amount: split.vat,       // 세액(명시 — default amount*0.1 대신 정확값)
      service_description: params.serviceDescription,
    })
    if (result.success && result.invoice_id) {
      await DB.prepare(
        "UPDATE wholesale_tax_invoices SET status = 'issued', provider_ref = ?, issued_at = datetime('now') WHERE id = ? AND status != 'issued'"
      ).bind(result.invoice_id, recId).run().catch((e) => logSoft('mark-issued', e))
    }
    // skipped(env 미설정) 또는 success:false → 'draft' 유지(후속 발행 가능). 에러로 취급하지 않음.
  } catch (e) {
    logSoft('issue', e) // 발행 예외도 fail-soft — 레코드는 draft 로 남음.
  }
  return recId
}

/**
 * 1) 매출 세금계산서 (플랫폼 → 유통사) — 주문 PAID 시 1건. order_id 멱등.
 *    subtotal 을 VAT 포함 공급대가로 보고 공급가액/세액 분리.
 *    ⚠️ fail-soft — 절대 throw 하지 않음(호출측이 try/catch 로 한 번 더 감싸도 안전).
 */
export async function generateWholesaleSalesInvoice(DB: D1Database, env: unknown, orderId: number): Promise<void> {
  if (!orderId) return
  try {
    await ensureSchema(DB)
    const order = await DB.prepare(
      'SELECT id, distributor_seller_id, subtotal, status FROM wholesale_orders WHERE id = ?'
    ).bind(orderId).first<{ id: number; distributor_seller_id: number; subtotal: number; status: string }>().catch(() => null)
    if (!order) return
    const split = splitWholesaleVat(Number(order.subtotal) || 0)
    if (split.total <= 0) return

    // 유통사(공급받는 자) 사업자번호 — 표기/발행 payee 용.
    const dist = await DB.prepare('SELECT business_number, business_name FROM sellers WHERE id = ?')
      .bind(order.distributor_seller_id).first<{ business_number: string | null; business_name: string | null }>().catch(() => null)

    await upsertAndFile(DB, env, {
      orderId,
      type: 'sales',
      supplierId: SALES_SUPPLIER_SENTINEL,
      distributorSellerId: order.distributor_seller_id ?? null,
      split,
      note: '도매 주문 매출(플랫폼→유통사)',
      payeeType: 'seller',
      payeeId: String(order.distributor_seller_id),
      businessNumber: dist?.business_number ?? null,
      serviceDescription: `유통스타트 도매 매출 (주문 #${orderId})`,
    })
  } catch (e) {
    logSoft('sales', e) // 절대 throw 금지.
  }
}

/**
 * 2) 매입 역발행 세금계산서 (제조사 → 플랫폼) — 제조사 정산 적립 시 제조사별 1건.
 *    (order_id, supplier_id) 멱등. 라인의 제조사 공급가 합(base_supply_price × qty)을 VAT split.
 *    ⚠️ creditSupplierOnWholesaleOrder 직후 additive 호출 — 정산(돈) 로직과 무관, fail-soft.
 */
export async function generateWholesalePurchaseInvoices(DB: D1Database, env: unknown, orderId: number): Promise<void> {
  if (!orderId) return
  try {
    await ensureSchema(DB)
    // 제조사별 공급가 합(주문 라인). base_supply_price×qty 가 제조사가 플랫폼에 청구하는 공급대가(VAT 포함).
    const rows = await DB.prepare(
      `SELECT supplier_id AS supplier_id, SUM(base_supply_price * qty) AS supply_gross
         FROM wholesale_order_items
        WHERE wholesale_order_id = ? AND supplier_id IS NOT NULL AND base_supply_price > 0
        GROUP BY supplier_id`
    ).bind(orderId).all<{ supplier_id: number; supply_gross: number }>().catch(() => ({ results: [] as { supplier_id: number; supply_gross: number }[] }))

    for (const r of rows.results || []) {
      const supplierId = Number(r.supplier_id) || 0
      if (supplierId <= 0) continue
      const split = splitWholesaleVat(Number(r.supply_gross) || 0)
      if (split.total <= 0) continue

      // 제조사(역발행 주체) 사업자번호 — 표기용. suppliers.business_number.
      const sup = await DB.prepare('SELECT business_number, business_name FROM suppliers WHERE id = ?')
        .bind(supplierId).first<{ business_number: string | null; business_name: string | null }>().catch(() => null)

      // 주문의 유통사(참고 표기) — 한 주문엔 단일 유통사.
      const order = await DB.prepare('SELECT distributor_seller_id FROM wholesale_orders WHERE id = ?')
        .bind(orderId).first<{ distributor_seller_id: number }>().catch(() => null)

      await upsertAndFile(DB, env, {
        orderId,
        type: 'purchase',
        supplierId,
        distributorSellerId: order?.distributor_seller_id ?? null,
        split,
        note: '도매 주문 매입 역발행(제조사→플랫폼)',
        // 매입 역발행: 발행 payee 는 플랫폼(공급받는 자)이지만 stub 은 사업자번호 검증만 하므로
        // 제조사 사업자번호로 발행 입력을 구성(역발행 = 제조사가 작성). store_owner 채널로 분류.
        payeeType: 'store_owner',
        payeeId: String(supplierId),
        businessNumber: sup?.business_number ?? null,
        serviceDescription: `유통스타트 도매 매입 (주문 #${orderId})`,
      })
    }
  } catch (e) {
    logSoft('purchase', e) // 절대 throw 금지.
  }
}

// ── 조회 헬퍼 (라우터에서 재사용) ───────────────────────────────────────────────
export interface TaxInvoiceRow {
  id: number
  order_id: number
  type: string
  supplier_id: number | null
  distributor_seller_id: number | null
  supply_amount: number
  vat_amount: number
  total_amount: number
  status: string
  provider_ref: string | null
  issued_at: string | null
  created_at: string
}

/** 유통사 본인이 받은 매출(sales) 세금계산서 목록. */
export async function listDistributorSalesInvoices(DB: D1Database, distributorSellerId: number, limit = 200): Promise<TaxInvoiceRow[]> {
  await ensureSchema(DB)
  const res = await DB.prepare(
    `SELECT id, order_id, type, supplier_id, distributor_seller_id, supply_amount, vat_amount, total_amount, status, provider_ref, issued_at, created_at
       FROM wholesale_tax_invoices
      WHERE type = 'sales' AND distributor_seller_id = ?
      ORDER BY created_at DESC LIMIT ?`
  ).bind(distributorSellerId, Math.min(Math.max(limit, 1), 500)).all<TaxInvoiceRow>().catch(() => ({ results: [] as TaxInvoiceRow[] }))
  return res.results || []
}

/** 제조사 본인이 발행한 매입(purchase) 역발행 세금계산서 목록. */
export async function listSupplierPurchaseInvoices(DB: D1Database, supplierId: number, limit = 200): Promise<TaxInvoiceRow[]> {
  await ensureSchema(DB)
  const res = await DB.prepare(
    `SELECT id, order_id, type, supplier_id, distributor_seller_id, supply_amount, vat_amount, total_amount, status, provider_ref, issued_at, created_at
       FROM wholesale_tax_invoices
      WHERE type = 'purchase' AND supplier_id = ?
      ORDER BY created_at DESC LIMIT ?`
  ).bind(supplierId, Math.min(Math.max(limit, 1), 500)).all<TaxInvoiceRow>().catch(() => ({ results: [] as TaxInvoiceRow[] }))
  return res.results || []
}

/** 어드민 전체 목록 (status/type 필터). */
export async function listAdminInvoices(DB: D1Database, opts: { status?: string; type?: string; limit?: number } = {}): Promise<TaxInvoiceRow[]> {
  await ensureSchema(DB)
  const where: string[] = ['1=1']
  const binds: unknown[] = []
  if (opts.status && ['draft', 'issued', 'failed'].includes(opts.status)) { where.push('status = ?'); binds.push(opts.status) }
  if (opts.type && ['sales', 'purchase'].includes(opts.type)) { where.push('type = ?'); binds.push(opts.type) }
  const limit = Math.min(Math.max(opts.limit || 300, 1), 1000)
  const res = await DB.prepare(
    `SELECT id, order_id, type, supplier_id, distributor_seller_id, supply_amount, vat_amount, total_amount, status, provider_ref, issued_at, created_at
       FROM wholesale_tax_invoices
      WHERE ${where.join(' AND ')}
      ORDER BY created_at DESC LIMIT ?`
  ).bind(...binds, limit).all<TaxInvoiceRow>().catch(() => ({ results: [] as TaxInvoiceRow[] }))
  return res.results || []
}

/**
 * 어드민 재발행 — draft/failed 레코드를 issueTaxInvoice 로 재시도(env-gated). 멱등.
 * @returns { ok, status, provider_ref } | null(레코드 없음)
 */
export async function reissueInvoice(DB: D1Database, env: unknown, id: number): Promise<{ ok: boolean; status: string; provider_ref: string | null; skipped?: boolean; error?: string } | null> {
  await ensureSchema(DB)
  const rec = await DB.prepare(
    'SELECT id, order_id, type, supplier_id, supply_amount, vat_amount, status FROM wholesale_tax_invoices WHERE id = ?'
  ).bind(id).first<{ id: number; order_id: number; type: string; supplier_id: number | null; supply_amount: number; vat_amount: number; status: string }>().catch(() => null)
  if (!rec) return null
  if (rec.status === 'issued') {
    const cur = await DB.prepare('SELECT provider_ref FROM wholesale_tax_invoices WHERE id = ?').bind(id).first<{ provider_ref: string | null }>().catch(() => null)
    return { ok: true, status: 'issued', provider_ref: cur?.provider_ref ?? null }
  }

  // payee 사업자번호 재조회(type 별).
  let businessNumber: string | null = null
  let payeeType: 'store_owner' | 'seller' = 'seller'
  let payeeId = ''
  if (rec.type === 'purchase' && rec.supplier_id) {
    const sup = await DB.prepare('SELECT business_number FROM suppliers WHERE id = ?').bind(rec.supplier_id).first<{ business_number: string | null }>().catch(() => null)
    businessNumber = sup?.business_number ?? null
    payeeType = 'store_owner'
    payeeId = String(rec.supplier_id)
  } else {
    const order = await DB.prepare('SELECT distributor_seller_id FROM wholesale_orders WHERE id = ?').bind(rec.order_id).first<{ distributor_seller_id: number }>().catch(() => null)
    const distId = order?.distributor_seller_id
    if (distId) {
      const dist = await DB.prepare('SELECT business_number FROM sellers WHERE id = ?').bind(distId).first<{ business_number: string | null }>().catch(() => null)
      businessNumber = dist?.business_number ?? null
      payeeId = String(distId)
    }
  }

  try {
    const result = await issueTaxInvoice(asTaxEnv(env), {
      payee_type: payeeType,
      payee_id: payeeId || String(rec.order_id),
      business_number: businessNumber || '',
      amount: Math.max(0, Math.floor(Number(rec.supply_amount) || 0)),
      vat_amount: Math.max(0, Math.floor(Number(rec.vat_amount) || 0)),
      service_description: `유어딜 도매 ${rec.type === 'purchase' ? '매입' : '매출'} 재발행 (주문 #${rec.order_id})`,
    })
    if (result.success && result.invoice_id) {
      await DB.prepare("UPDATE wholesale_tax_invoices SET status = 'issued', provider_ref = ?, issued_at = datetime('now') WHERE id = ?").bind(result.invoice_id, id).run().catch(() => {})
      return { ok: true, status: 'issued', provider_ref: result.invoice_id }
    }
    if (result.skipped) {
      return { ok: false, status: rec.status, provider_ref: null, skipped: true, error: result.error }
    }
    // provider 거부(형식 오류 등) → 'failed' 로 마킹(재시도 가능).
    await DB.prepare("UPDATE wholesale_tax_invoices SET status = 'failed' WHERE id = ? AND status != 'issued'").bind(id).run().catch(() => {})
    return { ok: false, status: 'failed', provider_ref: null, error: result.error }
  } catch (e) {
    logSoft('reissue', e)
    return { ok: false, status: rec.status, provider_ref: null, error: 'reissue 실패' }
  }
}
