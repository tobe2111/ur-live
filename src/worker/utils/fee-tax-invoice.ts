/**
 * 🧾 매장 수수료 세금계산서(정발행) — 월합계 초안 자동 작성 (2026-11-25 대표 *"너가 할 수 있는거 해줘"*)
 *
 * 결재 `docs/decisions/2026-11-25-fee-vat-exclusive.md`. 유어딜은 통신판매중개라 매출은 **수수료뿐**이고,
 * 그 수수료에 대해 유어딜(공급자)이 매장(공급받는자)에게 세금계산서를 **정발행**한다. 상대 승인은 필요 없다.
 *
 * ## 무엇을 하나
 * - 매월 1일(KST) 지난달 이용권 **사용분** 수수료를 매장별로 합쳐 `fee_tax_invoices` 에 초안을 만든다
 *   (작성일 = 그 달 말일 · 발급 기한 = 다음 달 10일, 부가세법 제34조 월합계).
 * - 금액 출처는 원장(`ledger_entries`) — 사용 분개의 `platform:revenue` 줄과 `platform:vat_payable` 줄, 사용 취소는 뺀다.
 *   부가세 별도 시작 전(부가세 줄이 없는 건)은 받은 수수료를 **부가세 포함**으로 보고 공급가액·세액을 나눈다.
 * - 발행 사업자 연동 전에는 어드민이 CSV 를 받아 홈택스에서 발행하고 "발행 완료" 를 누른다.
 *   연동 뒤에는 같은 초안이 자동 발행된다(`FEE_INVOICE_PROVIDER` — 지금은 없음).
 *
 * ⚠️ 돈을 옮기지 않는다 — 원장을 읽어 서류 초안만 만든다. 쇼핑(꺼진 기능)은 대상이 아니다.
 * ⚠️ 달 합계가 0 이하(취소가 더 많음)인 매장은 만들지 않는다 — 수정세금계산서는 사람이 판단한다.
 */
import type { D1Database } from '@cloudflare/workers-types'
import { FEE_VAT_ACCOUNT } from '../../shared/fee-vat'

const KST_MS = 9 * 3600_000

export interface FeeInvoiceLine { sellerId: number; supply: number; vat: number; total: number; vouchers: number }

/** 'YYYY-MM' → 그 달 말일 'YYYY-MM-DD' · 다음 달 10일. 순수. */
export function invoiceDates(period: string): { writeDate: string; dueDate: string } {
  const [y, m] = period.split('-').map(Number)
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const due = new Date(Date.UTC(y, m, 10))
  const pad = (n: number) => String(n).padStart(2, '0')
  return {
    writeDate: `${y}-${pad(m)}-${pad(last)}`,
    dueDate: `${due.getUTCFullYear()}-${pad(due.getUTCMonth() + 1)}-${pad(due.getUTCDate())}`,
  }
}

/**
 * 이용권 1장 몫 → 공급가액·세액. 부가세 줄이 있으면(별도 시작 뒤) 수수료 = 공급가액,
 * 없으면(시작 전) 수수료를 부가세 포함으로 보고 나눈다. 순수.
 */
export function splitFee(fee: number, vat: number): { supply: number; vat: number } {
  const f = Math.round(Number(fee) || 0)
  const v = Math.round(Number(vat) || 0)
  if (v > 0) return { supply: f, vat: v }
  const supply = Math.round(f / 1.1)
  return { supply, vat: f - supply }
}

/** 지난달(KST) 'YYYY-MM'. 순수. */
export function previousKstPeriod(nowMs: number = Date.now()): string {
  const k = new Date(nowMs + KST_MS)
  k.setUTCDate(1)
  k.setUTCMonth(k.getUTCMonth() - 1)
  return `${k.getUTCFullYear()}-${String(k.getUTCMonth() + 1).padStart(2, '0')}`
}

/** 그 달(KST) 매장별 수수료 합계 — 원장만 읽는다. */
export async function computeFeeInvoiceLines(DB: D1Database, period: string): Promise<FeeInvoiceLine[]> {
  const { results } = await DB.prepare(`
    SELECT reference_id,
           SUM(CASE WHEN credit_account = 'platform:revenue' THEN amount WHEN debit_account = 'platform:revenue' THEN -amount ELSE 0 END) AS fee,
           SUM(CASE WHEN credit_account = ?1 THEN amount WHEN debit_account = ?1 THEN -amount ELSE 0 END) AS vat,
           MAX(CASE WHEN credit_account LIKE 'merchant:%' THEN substr(credit_account, 10)
                    WHEN debit_account LIKE 'merchant:%' THEN substr(debit_account, 10) END) AS merchant
      FROM ledger_entries
     WHERE event_type IN ('voucher_used', 'voucher_use_reversal')
       AND reference_id LIKE 'voucher:%'
       AND strftime('%Y-%m', datetime(created_at, '+9 hours')) = ?2
     GROUP BY reference_id`,
  ).bind(FEE_VAT_ACCOUNT, period).all<{ reference_id: string; fee: number; vat: number; merchant: string | null }>()
  const by = new Map<number, FeeInvoiceLine>()
  for (const r of results || []) {
    const sellerId = Number(r.merchant)
    if (!Number.isInteger(sellerId) || sellerId <= 0) continue
    const part = splitFee(r.fee, r.vat)
    const cur = by.get(sellerId) ?? { sellerId, supply: 0, vat: 0, total: 0, vouchers: 0 }
    cur.supply += part.supply
    cur.vat += part.vat
    cur.total = cur.supply + cur.vat
    cur.vouchers += Number(r.fee) > 0 ? 1 : 0
    by.set(sellerId, cur)
  }
  return [...by.values()].filter((l) => l.total > 0).sort((a, b) => a.sellerId - b.sellerId)
}

const _ensured = new WeakSet<object>()
export async function ensureFeeInvoiceTable(DB: D1Database): Promise<void> {
  if (_ensured.has(DB)) return
  await DB.prepare(`CREATE TABLE IF NOT EXISTS fee_tax_invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    seller_id INTEGER NOT NULL,
    period TEXT NOT NULL,
    write_date TEXT NOT NULL,
    supply_amount INTEGER NOT NULL DEFAULT 0,
    vat_amount INTEGER NOT NULL DEFAULT 0,
    total_amount INTEGER NOT NULL DEFAULT 0,
    voucher_count INTEGER NOT NULL DEFAULT 0,
    buyer_biz_no TEXT,
    buyer_name TEXT,
    buyer_ceo TEXT,
    buyer_email TEXT,
    buyer_address TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    provider TEXT,
    nts_confirm_num TEXT,
    issued_at TEXT,
    issued_by INTEGER,
    provider_ref TEXT,
    last_error TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`).run()
  await DB.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_fee_tax_invoices_seller_period ON fee_tax_invoices(seller_id, period)').run()
  // 🧾 발행 사업자 문서번호 · 마지막 오류 — 표가 먼저 생긴 라이브에도 붙도록(있으면 무시).
  for (const col of ['provider_ref TEXT', 'last_error TEXT']) {
    await DB.prepare(`ALTER TABLE fee_tax_invoices ADD COLUMN ${col}`).run().catch(() => null)
  }
  _ensured.add(DB)
}

/**
 * 초안 만들기(멱등). 이미 발행된(issued) 행은 건드리지 않고, 초안(draft)은 최신 원장 값으로 덮는다.
 * 매장 사업자 정보도 그때의 값으로 스냅샷한다. 반환: 초안 수·합계·사업자번호 없는 매장 수.
 */
export async function buildFeeInvoiceDrafts(DB: D1Database, period: string): Promise<{ drafts: number; supply: number; vat: number; missingBizNo: number }> {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw new Error('period must be YYYY-MM')
  await ensureFeeInvoiceTable(DB)
  const lines = await computeFeeInvoiceLines(DB, period)
  const { writeDate } = invoiceDates(period)
  let drafts = 0, supply = 0, vat = 0, missingBizNo = 0
  for (const l of lines) {
    const s = await DB.prepare(
      `SELECT business_number, COALESCE(business_name, name) AS bname, representative_name, COALESCE(tax_email, email) AS email,
              COALESCE(business_address, address) AS addr FROM sellers WHERE id = ?`,
    ).bind(l.sellerId).first<{ business_number: string | null; bname: string | null; representative_name: string | null; email: string | null; addr: string | null }>()
    const bizNo = String(s?.business_number || '').replace(/\D/g, '') || null
    if (!bizNo) missingBizNo++
    await DB.prepare(`
      INSERT INTO fee_tax_invoices (seller_id, period, write_date, supply_amount, vat_amount, total_amount, voucher_count,
                                    buyer_biz_no, buyer_name, buyer_ceo, buyer_email, buyer_address)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(seller_id, period) DO UPDATE SET
        write_date = excluded.write_date, supply_amount = excluded.supply_amount, vat_amount = excluded.vat_amount,
        total_amount = excluded.total_amount, voucher_count = excluded.voucher_count, buyer_biz_no = excluded.buyer_biz_no,
        buyer_name = excluded.buyer_name, buyer_ceo = excluded.buyer_ceo, buyer_email = excluded.buyer_email,
        buyer_address = excluded.buyer_address, updated_at = datetime('now')
      WHERE fee_tax_invoices.status = 'draft'`,
    ).bind(l.sellerId, period, writeDate, l.supply, l.vat, l.total, l.vouchers, bizNo, s?.bname ?? null,
      s?.representative_name ?? null, s?.email ?? null, s?.addr ?? null).run()
    drafts++; supply += l.supply; vat += l.vat
  }
  return { drafts, supply, vat, missingBizNo }
}

export interface FeeInvoiceRow {
  id: number; seller_id: number; period: string; write_date: string; supply_amount: number; vat_amount: number; total_amount: number
  voucher_count: number; buyer_biz_no: string | null; buyer_name: string | null; buyer_ceo: string | null; buyer_email: string | null
  buyer_address: string | null; status: string; nts_confirm_num: string | null; issued_at: string | null
  provider_ref?: string | null; last_error?: string | null
}

export async function listFeeInvoices(DB: D1Database, period: string): Promise<FeeInvoiceRow[]> {
  await ensureFeeInvoiceTable(DB)
  const { results } = await DB.prepare('SELECT * FROM fee_tax_invoices WHERE period = ? ORDER BY seller_id').bind(period).all<FeeInvoiceRow>()
  return results || []
}

/** 홈택스에서 발행한 뒤 "발행 완료" — draft 만(CAS). 승인번호는 선택. */
export async function markFeeInvoiceIssued(DB: D1Database, id: number, adminId: number | null, confirmNum: string | null): Promise<boolean> {
  await ensureFeeInvoiceTable(DB)
  const num = confirmNum && /^[0-9A-Za-z-]{8,40}$/.test(confirmNum) ? confirmNum : null
  const r = await DB.prepare(
    `UPDATE fee_tax_invoices SET status = 'issued', provider = 'hometax_manual', nts_confirm_num = ?, issued_at = datetime('now'),
            issued_by = ?, updated_at = datetime('now') WHERE id = ? AND status IN ('draft', 'requested')`,
  ).bind(num, adminId, id).run()
  return (r.meta?.changes ?? 0) > 0
}

/**
 * 팝빌로 즉시 발행 — 초안(draft)만. 발행되면 'issued'(국세청 승인번호 기록), 실패하면 초안 그대로 + 오류 기록.
 * 팝빌이 "이미 쓴 문서번호" 로 거부하면 같은 달에 이미 발행된 것이다 — 'issued' 로 맞추고 승인번호는 비워 둔다(팝빌 화면에서 확인).
 * `ids` 가 없으면 그 달 초안 전부. 반환: 발행·실패 수.
 */
export async function sendFeeInvoicesViaPopbill(
  DB: D1Database, creds: import('./popbill-invoice').PopbillCreds, period: string, ids?: number[], fetchImpl?: typeof fetch,
): Promise<{ issued: number; failed: number; errors: Array<{ id: number; error: string }> }> {
  const { issueFeeInvoiceViaPopbill } = await import('./popbill-invoice')
  const rows = (await listFeeInvoices(DB, period)).filter((r) => r.status === 'draft' && (!ids || ids.includes(r.id)))
  let issued = 0, failed = 0
  const errors: Array<{ id: number; error: string }> = []
  for (const r of rows) {
    const res = await issueFeeInvoiceViaPopbill(creds, r, fetchImpl)
    if (res.ok || res.duplicate) {
      const u = await DB.prepare(
        `UPDATE fee_tax_invoices SET status = 'issued', provider = ?, provider_ref = ?, nts_confirm_num = ?, last_error = NULL,
                issued_at = datetime('now'), updated_at = datetime('now') WHERE id = ? AND status = 'draft'`,
      ).bind(creds.isTest ? 'popbill_test' : 'popbill', `UD${period.replace('-', '')}-${r.seller_id}`, res.ntsConfirmNum ?? null, r.id).run()
      if ((u.meta?.changes ?? 0) > 0) issued++
    } else {
      failed++
      errors.push({ id: r.id, error: res.error || '알 수 없는 오류' })
      await DB.prepare(`UPDATE fee_tax_invoices SET last_error = ?, updated_at = datetime('now') WHERE id = ? AND status = 'draft'`)
        .bind(String(res.error || '').slice(0, 300), r.id).run().catch(() => null)
    }
  }
  return { issued, failed, errors }
}

/** 순수 — 홈택스 수기 발행용 CSV(공급받는자·작성일·공급가액·세액·품목). 수식 인젝션 방어. */
export function feeInvoicesCsv(rows: FeeInvoiceRow[]): string {
  const cell = (v: unknown): string => {
    let s = String(v ?? '')
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s
    return `"${s.replace(/"/g, '""')}"`
  }
  const header = ['번호', '상태', '작성일자', '공급받는자 사업자번호', '상호', '대표자', '이메일', '주소', '품목', '공급가액', '세액', '합계', '이용권 수', '국세청 승인번호']
  const body = rows.map((r) => {
    const [y, m] = r.period.split('-').map(Number)
    return [r.id, r.status === 'issued' ? '발행 완료' : '발행 대기', r.write_date, r.buyer_biz_no || '(사업자번호 없음)', r.buyer_name, r.buyer_ceo,
      r.buyer_email, r.buyer_address, `유어딜 중개수수료 (${y}년 ${m}월)`, r.supply_amount, r.vat_amount, r.total_amount, r.voucher_count, r.nts_confirm_num]
  })
  return '﻿' + [header, ...body].map((r) => r.map(cell).join(',')).join('\r\n')
}
