/**
 * 🧾 소비자 정산 역발행(매입세금계산서) 모듈 — 유어딜 공구 (2026-07-01)
 *
 * 유어딜(공급받는자)이 **사업자 유저 셀러(공급자)** 에게 정산금을 지급하면, 그 지급액에 대한
 * 매입세금계산서를 역발행한다: 유어딜이 초안을 자동 작성 → 셀러가 대시보드에서 승인 → NTS 발행.
 * 카카오 애드핏 = 유니포스트 역발행과 동일 모델. 실 발행 채널은 tax-invoice-gateway.ts(provider SSOT).
 *
 * ⚠️ 서비스 분리: 이 모듈은 **소비자(유어딜 공구)** 정산 전용. 도매몰(유통스타트)의
 *   wholesale_tax_invoices / wholesale_purchase_invoices 와는 별개 테이블·별개 흐름이다.
 *
 * ⚠️ 안전: 전부 additive · fail-soft(never throw) · env-gated · 멱등(UNIQUE settlement_id).
 *   기존 정산/원천징수 머니 로직을 절대 건드리지 않는다 — 지급(settlements 'paid') *이후* 기록만.
 *   provider 미설정(기본) → 'draft' 로만 남음(cost-0). 셀러 승인/실 발행은 provider 설정 후.
 */
import {
  requestReverseInvoice,
  reverseInvoiceProvider,
  normalizeBizNo,
  type ReverseInvoiceEnv,
} from '@/worker/utils/tax-invoice-gateway'

/** 공급대가(부가세 포함) → 공급가액/세액 분리. 도매 splitWholesaleVat 와 동일 식(부가세 포함 기준). */
export function splitSettlementVat(grossInclusive: number): { supply: number; vat: number; total: number } {
  const total = Math.max(0, Math.round(Number(grossInclusive) || 0))
  const supply = Math.round(total / 1.1)
  return { supply, vat: total - supply, total }
}

// ── self-ensure: settlement_tax_invoices (repair-schema 에도 등록, CI 불안정 대비) ──
const _ensuring = new WeakMap<object, Promise<void>>()
export async function ensureSettlementTaxSchema(DB: D1Database): Promise<void> {
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
  await DB.prepare(`CREATE TABLE IF NOT EXISTS settlement_tax_invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    settlement_id INTEGER NOT NULL,
    seller_id INTEGER NOT NULL,
    supply_amount INTEGER NOT NULL DEFAULT 0,
    vat_amount INTEGER NOT NULL DEFAULT 0,
    total_amount INTEGER NOT NULL DEFAULT 0,
    supplier_biz_no TEXT,
    period TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    provider TEXT,
    provider_ref TEXT,
    nts_confirm_num TEXT,
    note TEXT,
    requested_at DATETIME,
    approved_at DATETIME,
    issued_at DATETIME,
    created_at DATETIME DEFAULT (datetime('now'))
  )`).run()
  await DB.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_settlement_tax_inv_settlement ON settlement_tax_invoices(settlement_id)').run().catch(() => {})
  await DB.prepare('CREATE INDEX IF NOT EXISTS idx_settlement_tax_inv_seller ON settlement_tax_invoices(seller_id, created_at DESC)').run().catch(() => {})
  await DB.prepare('CREATE INDEX IF NOT EXISTS idx_settlement_tax_inv_status ON settlement_tax_invoices(status, created_at DESC)').run().catch(() => {})
}

const DEV = (() => { try { return !!import.meta.env?.DEV } catch { return false } })()
function logSoft(tag: string, e: unknown) { if (DEV) console.warn(`[settlement-tax-invoice] ${tag}`, e) }

export interface SettlementTaxInvoiceRow {
  id: number
  settlement_id: number
  seller_id: number
  supply_amount: number
  vat_amount: number
  total_amount: number
  supplier_biz_no: string | null
  period: string | null
  status: string
  provider: string | null
  provider_ref: string | null
  nts_confirm_num: string | null
  note: string | null
  requested_at: string | null
  approved_at: string | null
  issued_at: string | null
  created_at: string
}

type SellerBiz = {
  business_number: string | null
  business_name: string | null
  business_registration_status: string | null
  ceo_name: string | null
  business_type: string | null
  business_category: string | null
  address: string | null
  email: string | null
}

/** 셀러 사업자 정보(표기/발행용). sellers + seller_business_info(있으면) 병합. */
async function loadSellerBiz(DB: D1Database, sellerId: number): Promise<SellerBiz | null> {
  const s = await DB.prepare(
    'SELECT business_number, business_name, business_registration_status, email FROM sellers WHERE id = ?'
  ).bind(sellerId).first<{ business_number: string | null; business_name: string | null; business_registration_status: string | null; email: string | null }>().catch(() => null)
  if (!s) return null
  // seller_business_info(대표자명/업태/종목/주소) — migration 0012. 없어도 graceful.
  const ext = await DB.prepare(
    'SELECT ceo_name, business_type, business_category, address, email FROM seller_business_info WHERE seller_id = ? ORDER BY id DESC LIMIT 1'
  ).bind(sellerId).first<{ ceo_name: string | null; business_type: string | null; business_category: string | null; address: string | null; email: string | null }>().catch(() => null)
  return {
    business_number: s.business_number,
    business_name: s.business_name,
    business_registration_status: s.business_registration_status,
    ceo_name: ext?.ceo_name ?? null,
    business_type: ext?.business_type ?? null,
    business_category: ext?.business_category ?? null,
    address: ext?.address ?? null,
    email: ext?.email ?? s.email ?? null,
  }
}

/** 사업자 유저(현금 정산 = 세금계산서 대상)인지. verified + 유효 사업자번호. */
function isBusinessSeller(biz: SellerBiz | null): boolean {
  if (!biz) return false
  const st = biz.business_registration_status
  if (st !== 'verified') return false // 'exempt'(면세/간이 등)은 표준 세금계산서 미대상 — 제외
  return !!normalizeBizNo(biz.business_number)
}

/**
 * 정산 지급(settlements 'paid') 직후 역발행 초안 생성 + (provider 설정 시) 요청 전송.
 *   - 사업자 유저(verified) 셀러만. 비사업자(원천징수 경로)는 대상 아님 → skip.
 *   - settlements.amount(지급액)를 공급대가(부가세 포함)로 보고 공급가액/세액 분리.
 *   - UNIQUE(settlement_id) 멱등 — 재호출/동시요청 시 이중 생성 없음.
 * ⚠️ fail-soft — 절대 throw 하지 않음. 정산 지급 흐름을 막지 않는다.
 */
export async function generateSettlementReverseInvoice(DB: D1Database, env: unknown, settlementId: number): Promise<void> {
  if (!settlementId) return
  try {
    await ensureSettlementTaxSchema(DB)

    const st = await DB.prepare(
      "SELECT id, seller_id, amount, status, period_start, period_end FROM settlements WHERE id = ?"
    ).bind(settlementId).first<{ id: number; seller_id: number; amount: number | null; status: string; period_start: string | null; period_end: string | null }>().catch(() => null)
    if (!st || st.status !== 'paid') return
    const sellerId = Number(st.seller_id) || 0
    if (sellerId <= 0) return

    const biz = await loadSellerBiz(DB, sellerId)
    if (!isBusinessSeller(biz)) return // 비사업자/미검증 → 세금계산서 대상 아님(원천징수 경로가 처리)

    const split = splitSettlementVat(Number(st.amount) || 0)
    if (split.total <= 0) return

    // 표기용 기간(YYYY-MM) — period_start 우선, 없으면 지급 시점 월.
    const period = (st.period_start && /^\d{4}-\d{2}/.test(st.period_start)) ? st.period_start.slice(0, 7) : null

    // 멱등 INSERT — 이미 있으면 no-op.
    await DB.prepare(
      `INSERT INTO settlement_tax_invoices
         (settlement_id, seller_id, supply_amount, vat_amount, total_amount, supplier_biz_no, period, status, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?, datetime('now'))
       ON CONFLICT(settlement_id) DO NOTHING`
    ).bind(
      settlementId, sellerId, split.supply, split.vat, split.total,
      normalizeBizNo(biz!.business_number), period, '유어딜 정산 매입 역발행(셀러→플랫폼)',
    ).run().catch((e) => { logSoft('insert', e); return null })

    const row = await DB.prepare('SELECT id, status FROM settlement_tax_invoices WHERE settlement_id = ?')
      .bind(settlementId).first<{ id: number; status: string }>().catch(() => null)
    if (!row?.id || row.status !== 'draft') return

    // provider 설정 시 역발행 요청 전송(셀러 승인 대기). 미설정 → draft 유지.
    await fileReverseRequest(DB, env, row.id, {
      mgtKey: `stx-${settlementId}`,
      biz: biz!,
      split,
      itemName: `유어딜 정산${period ? ` (${period})` : ''}`,
    })
  } catch (e) {
    logSoft('generate', e) // 절대 throw 금지.
  }
}

/** provider 로 역발행 요청 전송 후 status/ref 업데이트. fail-soft. */
async function fileReverseRequest(
  DB: D1Database,
  env: unknown,
  invoiceId: number,
  params: { mgtKey: string; biz: SellerBiz; split: { supply: number; vat: number; total: number }; itemName: string },
): Promise<void> {
  const rEnv = (env || {}) as ReverseInvoiceEnv
  if (reverseInvoiceProvider(rEnv) === 'none') return // draft 유지
  try {
    const today = new Date().toISOString().slice(0, 10)
    const result = await requestReverseInvoice(rEnv, {
      mgtKey: params.mgtKey,
      supplierBizNo: params.biz.business_number || '',
      supplierName: params.biz.business_name || '',
      supplierCeo: params.biz.ceo_name,
      supplierAddress: params.biz.address,
      supplierBizType: params.biz.business_type,
      supplierBizCategory: params.biz.business_category,
      supplierEmail: params.biz.email,
      supplyAmount: params.split.supply,
      vatAmount: params.split.vat,
      totalAmount: params.split.total,
      writeDate: today,
      itemName: params.itemName,
    })
    if (result.status === 'requested' || result.status === 'issued') {
      await DB.prepare(
        `UPDATE settlement_tax_invoices
            SET status = ?, provider = ?, provider_ref = ?, nts_confirm_num = ?,
                requested_at = datetime('now'), issued_at = CASE WHEN ? = 'issued' THEN datetime('now') ELSE issued_at END
          WHERE id = ? AND status = 'draft'`
      ).bind(result.status, result.provider, result.providerRef, result.ntsConfirmNum ?? null, result.status, invoiceId).run().catch((e) => logSoft('mark-requested', e))
    } else if (result.status === 'failed') {
      await DB.prepare("UPDATE settlement_tax_invoices SET status = 'failed', note = ? WHERE id = ? AND status = 'draft'")
        .bind((result.error || '발행 실패').slice(0, 200), invoiceId).run().catch((e) => logSoft('mark-failed', e))
    }
    // skipped → draft 유지(후속 발행 가능).
  } catch (e) {
    logSoft('file', e)
  }
}

/** 셀러 본인 역발행 세금계산서 목록. */
export async function listSellerSettlementInvoices(DB: D1Database, sellerId: number, limit = 200): Promise<SettlementTaxInvoiceRow[]> {
  await ensureSettlementTaxSchema(DB)
  const res = await DB.prepare(
    `SELECT id, settlement_id, seller_id, supply_amount, vat_amount, total_amount, supplier_biz_no, period,
            status, provider, provider_ref, nts_confirm_num, note, requested_at, approved_at, issued_at, created_at
       FROM settlement_tax_invoices WHERE seller_id = ?
      ORDER BY created_at DESC LIMIT ?`
  ).bind(sellerId, Math.min(Math.max(limit, 1), 500)).all<SettlementTaxInvoiceRow>().catch(() => ({ results: [] as SettlementTaxInvoiceRow[] }))
  return res.results || []
}

/**
 * 셀러 역발행 승인 — draft/requested → approved. (provider 가 승인까지 API 로 처리하면 이후 issued 로.)
 *   소유권 검증(seller_id) 필수. CAS 로 이중 승인 차단.
 * @returns { ok, status } | null(없음/권한없음)
 */
export async function approveSettlementInvoice(DB: D1Database, _env: unknown, id: number, sellerId: number): Promise<{ ok: boolean; status: string } | null> {
  await ensureSettlementTaxSchema(DB)
  const rec = await DB.prepare('SELECT id, seller_id, status FROM settlement_tax_invoices WHERE id = ?')
    .bind(id).first<{ id: number; seller_id: number; status: string }>().catch(() => null)
  if (!rec || Number(rec.seller_id) !== Number(sellerId)) return null
  if (rec.status === 'issued' || rec.status === 'approved') return { ok: true, status: rec.status }

  // CAS: draft/requested/failed → approved (셀러 확인). 실 NTS 발행은 provider 승인 웹훅/폴링으로 issued 전환.
  const upd = await DB.prepare(
    "UPDATE settlement_tax_invoices SET status = 'approved', approved_at = datetime('now') WHERE id = ? AND status IN ('draft','requested','failed')"
  ).bind(id).run().catch(() => null)
  if (!upd?.meta?.changes) {
    const cur = await DB.prepare('SELECT status FROM settlement_tax_invoices WHERE id = ?').bind(id).first<{ status: string }>().catch(() => null)
    return { ok: true, status: cur?.status || rec.status }
  }
  return { ok: true, status: 'approved' }
}

/** 어드민 전체 목록(status 필터). */
export async function listAdminSettlementInvoices(DB: D1Database, opts: { status?: string; sellerId?: number; limit?: number } = {}): Promise<(SettlementTaxInvoiceRow & { seller_name?: string | null })[]> {
  await ensureSettlementTaxSchema(DB)
  const where: string[] = ['1=1']
  const binds: unknown[] = []
  if (opts.status && ['draft', 'requested', 'approved', 'issued', 'failed', 'cancelled'].includes(opts.status)) { where.push('ti.status = ?'); binds.push(opts.status) }
  if (opts.sellerId && Number.isFinite(opts.sellerId) && opts.sellerId > 0) { where.push('ti.seller_id = ?'); binds.push(Math.floor(opts.sellerId)) }
  const limit = Math.min(Math.max(opts.limit || 300, 1), 1000)
  const res = await DB.prepare(
    `SELECT ti.id, ti.settlement_id, ti.seller_id, ti.supply_amount, ti.vat_amount, ti.total_amount, ti.supplier_biz_no, ti.period,
            ti.status, ti.provider, ti.provider_ref, ti.nts_confirm_num, ti.note, ti.requested_at, ti.approved_at, ti.issued_at, ti.created_at,
            COALESCE(s.business_name, s.name) AS seller_name
       FROM settlement_tax_invoices ti
       LEFT JOIN sellers s ON s.id = ti.seller_id
      WHERE ${where.join(' AND ')}
      ORDER BY ti.created_at DESC LIMIT ?`
  ).bind(...binds, limit).all<SettlementTaxInvoiceRow & { seller_name?: string | null }>().catch(() => ({ results: [] as (SettlementTaxInvoiceRow & { seller_name?: string | null })[] }))
  return res.results || []
}

/**
 * 어드민 재발행/재요청 — draft/failed 레코드를 provider 로 다시 요청. 멱등.
 * @returns { ok, status, skipped, error } | null(레코드 없음)
 */
export async function reissueSettlementInvoice(DB: D1Database, env: unknown, id: number): Promise<{ ok: boolean; status: string; skipped?: boolean; error?: string } | null> {
  await ensureSettlementTaxSchema(DB)
  const rec = await DB.prepare('SELECT id, settlement_id, seller_id, supply_amount, vat_amount, total_amount, period, status FROM settlement_tax_invoices WHERE id = ?')
    .bind(id).first<{ id: number; settlement_id: number; seller_id: number; supply_amount: number; vat_amount: number; total_amount: number; period: string | null; status: string }>().catch(() => null)
  if (!rec) return null
  if (rec.status === 'issued') return { ok: true, status: 'issued' }

  const rEnv = (env || {}) as ReverseInvoiceEnv
  if (reverseInvoiceProvider(rEnv) === 'none') {
    return { ok: false, status: rec.status, skipped: true, error: 'REVERSE_INVOICE_PROVIDER 미설정' }
  }
  const biz = await loadSellerBiz(DB, rec.seller_id)
  if (!isBusinessSeller(biz)) return { ok: false, status: rec.status, error: '사업자 정보 미검증' }

  try {
    const today = new Date().toISOString().slice(0, 10)
    const result = await requestReverseInvoice(rEnv, {
      mgtKey: `stx-${rec.settlement_id}`,
      supplierBizNo: biz!.business_number || '',
      supplierName: biz!.business_name || '',
      supplierCeo: biz!.ceo_name,
      supplierAddress: biz!.address,
      supplierBizType: biz!.business_type,
      supplierBizCategory: biz!.business_category,
      supplierEmail: biz!.email,
      supplyAmount: rec.supply_amount,
      vatAmount: rec.vat_amount,
      totalAmount: rec.total_amount,
      writeDate: today,
      itemName: `유어딜 정산${rec.period ? ` (${rec.period})` : ''}`,
    })
    if (result.status === 'requested' || result.status === 'issued') {
      await DB.prepare(
        `UPDATE settlement_tax_invoices
            SET status = ?, provider = ?, provider_ref = ?, nts_confirm_num = ?,
                requested_at = datetime('now'), issued_at = CASE WHEN ? = 'issued' THEN datetime('now') ELSE issued_at END
          WHERE id = ? AND status != 'issued'`
      ).bind(result.status, result.provider, result.providerRef, result.ntsConfirmNum ?? null, result.status, id).run().catch((e) => logSoft('reissue-mark', e))
      return { ok: true, status: result.status }
    }
    if (result.skipped) return { ok: false, status: rec.status, skipped: true, error: result.error }
    await DB.prepare("UPDATE settlement_tax_invoices SET status = 'failed', note = ? WHERE id = ? AND status != 'issued'")
      .bind((result.error || '발행 실패').slice(0, 200), id).run().catch((e) => logSoft('reissue-failed', e))
    return { ok: false, status: 'failed', error: result.error }
  } catch (e) {
    logSoft('reissue', e)
    return { ok: false, status: rec.status, error: '재발행 실패' }
  }
}
