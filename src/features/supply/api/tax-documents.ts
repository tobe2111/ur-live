/**
 * 🏭 2026-06-03 유통스타트 도매몰 — 세금계산서/거래명세서 내부 발행 + 문서 생성.
 * (스펙: 세금계산서 To 유통회원, 거래명세서 To 유통회원 / 제조사→유통스타트 매입계산서)
 *
 * 모델 (유통스타트 = 거래 당사자/플랫폼):
 *   - sales      : 유통스타트 → 유통회원 (매출 세금계산서/거래명세서). distributor_seller_id 기준.
 *   - purchase   : 제조사 → 유통스타트 (매입 세금계산서). supplier_id 기준.
 *   금액은 wholesale_orders/items 월별 집계 스냅샷. 부가세 10% 별도 표기.
 *   외부 e-세금계산서(팝빌 등) 연동 없이 발행 기록 + 인쇄용 HTML 생성까지. (status: draft→issued/void)
 */
import { swallow } from '@/worker/utils/swallow'

export const TAX_DOC_TYPES = ['tax_invoice', 'transaction_statement'] as const
export const TAX_DOC_DIRECTIONS = ['sales', 'purchase'] as const
export type TaxDocType = (typeof TAX_DOC_TYPES)[number]
export type TaxDocDirection = (typeof TAX_DOC_DIRECTIONS)[number]

// 🛡️ 완료된 ensure 만 캐시(promise 기반) — add 를 await 전에 하면 첫 ensure 가
//   transient D1 에러로 throw 돼도 DB 가 영구 done 표시 → 이후 모든 호출이 미존재
//   tax_documents 를 참조해 isolate recycle 까지 영구 500. in-flight promise 를
//   공유해 동시 호출이 같은 완료를 기다리고, 실패 시 캐시를 지워 다음 호출이 재시도.
const _ensuring = new WeakMap<object, Promise<void>>()

export async function ensureTaxDocSchema(DB: D1Database): Promise<void> {
  const existing = _ensuring.get(DB)
  if (existing) return existing
  const p = _ensureTaxDocSchema(DB)
  _ensuring.set(DB, p)
  try {
    await p
  } catch {
    _ensuring.delete(DB) // 실패 시 다음 호출이 재시도하도록 캐시 제거
  }
}

async function _ensureTaxDocSchema(DB: D1Database): Promise<void> {
  await DB.prepare(`CREATE TABLE IF NOT EXISTS tax_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    doc_type TEXT NOT NULL,
    direction TEXT NOT NULL,
    period_month TEXT NOT NULL,
    distributor_seller_id INTEGER,
    supplier_id INTEGER,
    party_name TEXT,
    supply_amount INTEGER NOT NULL DEFAULT 0,
    vat_amount INTEGER NOT NULL DEFAULT 0,
    total_amount INTEGER NOT NULL DEFAULT 0,
    order_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'issued',
    issued_at DATETIME,
    nts_confirm_num TEXT,
    invoice_key TEXT,
    external_status TEXT DEFAULT 'none',
    created_at DATETIME DEFAULT (datetime('now')),
    UNIQUE(doc_type, direction, period_month, distributor_seller_id, supplier_id)
  )`).run().catch(swallow('tax-doc:create'))
  await DB.prepare('CREATE INDEX IF NOT EXISTS idx_taxdoc_month ON tax_documents(period_month, direction)')
    .run().catch(swallow('tax-doc:idx'))
  // 이미 생성된 테이블 대비 컬럼 보강 (멱등).
  for (const col of ['nts_confirm_num TEXT', 'invoice_key TEXT', "external_status TEXT DEFAULT 'none'"]) {
    await DB.prepare(`ALTER TABLE tax_documents ADD COLUMN ${col}`).run().catch(() => { /* 이미 존재 */ })
  }
}

/**
 * 부가세 분리 — 입력은 판매사가 실제 결제한 **VAT 포함 총액**(wholesale_orders.subtotal = Toss 청구액).
 * 공급가액 = round(총액 / 1.1), 부가세 = 총액 − 공급가액. (VAT 를 더하지 않고 추출 — 실거래액 보존)
 */
export function splitVat(grossInclusive: number): { supply: number; vat: number; total: number } {
  const total = Math.max(0, Math.round(grossInclusive))
  const supply = Math.round(total / 1.1)
  return { supply, vat: total - supply, total }
}

const esc = (v: unknown): string =>
  String(v ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] as string))

const won = (n: number): string => `₩${Math.round(n || 0).toLocaleString('ko-KR')}`

export interface TaxDocRow {
  id: number
  doc_type: string
  direction: string
  period_month: string
  party_name: string | null
  supply_amount: number
  vat_amount: number
  total_amount: number
  order_count: number
  status: string
  issued_at: string | null
}

/** 인쇄용 HTML 문서 (세금계산서/거래명세서). 외부 의존 0 — 브라우저 인쇄/PDF 저장. */
export function renderTaxDocHtml(doc: TaxDocRow): string {
  const isInvoice = doc.doc_type === 'tax_invoice'
  const title = isInvoice ? '세금계산서' : '거래명세서'
  const isSales = doc.direction === 'sales'
  const supplier = isSales ? '유통스타트' : esc(doc.party_name || '제조사')
  const buyer = isSales ? esc(doc.party_name || '판매사') : '유통스타트'
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} — ${esc(doc.period_month)}</title>
<style>
  body{font-family:'Malgun Gothic',sans-serif;padding:32px;color:#111;max-width:780px;margin:0 auto}
  h1{text-align:center;font-size:24px;letter-spacing:8px;border:3px solid #111;padding:10px;margin-bottom:4px}
  .meta{display:flex;justify-content:space-between;font-size:12px;color:#555;margin-bottom:16px}
  table{width:100%;border-collapse:collapse;margin-bottom:16px;font-size:13px}
  th,td{border:1px solid #999;padding:8px 10px;text-align:left}
  th{background:#f3f4f6;width:120px}
  .amt{text-align:right;font-variant-numeric:tabular-nums}
  .total{font-size:18px;font-weight:800}
  .badge{display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700}
  .issued{background:#dcfce7;color:#166534}.draft{background:#fef9c3;color:#854d0e}.void{background:#fee2e2;color:#991b1b}
  @media print{.noprint{display:none}}
</style></head><body>
  <h1>${title}</h1>
  <div class="meta">
    <span>작성월: <b>${esc(doc.period_month)}</b> · 거래건수: ${doc.order_count}건</span>
    <span>상태: <span class="badge ${esc(doc.status)}">${doc.status === 'issued' ? '발행완료' : doc.status === 'void' ? '취소' : '임시'}</span> ${doc.issued_at ? `· ${esc(String(doc.issued_at).slice(0, 10))}` : ''}</span>
  </div>
  <table>
    <tr><th>공급자</th><td>${supplier}</td><th>공급받는자</th><td>${buyer}</td></tr>
    <tr><th>품목</th><td colspan="3">${esc(doc.period_month)} 도매 거래 합계 (${title})</td></tr>
  </table>
  <table>
    <tr><th>공급가액</th><td class="amt">${won(doc.supply_amount)}</td></tr>
    <tr><th>부가세 (10%)</th><td class="amt">${won(doc.vat_amount)}</td></tr>
    <tr><th>합계금액</th><td class="amt total">${won(doc.total_amount)}</td></tr>
  </table>
  <p style="font-size:11px;color:#888;margin-top:24px">본 문서는 유통스타트 B2B 도매몰에서 자동 생성된 ${title}입니다. (내부 발행 — 정식 전자세금계산서는 별도 발행)</p>
  <button class="noprint" onclick="window.print()" style="margin-top:16px;padding:10px 24px;background:#111;color:#fff;border:0;border-radius:8px;font-size:14px;cursor:pointer">인쇄 / PDF 저장</button>
</body></html>`
}
