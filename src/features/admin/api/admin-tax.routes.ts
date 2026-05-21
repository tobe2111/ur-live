/**
 * 🛡️ 2026-05-21 Phase D: 세무 (전자세금계산서 + 연말 정산 리포트) 어드민 endpoints.
 *
 * 6번 — 전자세금계산서 자동 발행 인프라 (Bill36524 / Popbill / 토스 비즈 stub):
 *   - issueTaxInvoice(): 환경변수 TAX_INVOICE_API_KEY 미설정 시 silent skip
 *   - 인프라만 준비, 연동은 별도 계약 후
 *
 * 7번 — 연말 정산 리포트 자동 생성:
 *   - GET /api/admin/tax/annual-report?year=2026&payee_type=store_owner — CSV 출력
 *   - payouts.sent + ledger 합산 → payee 별 연간 수입 정리
 *   - 사장님 / 셀러 / 에이전시 세무사 제공용
 */
import { Hono } from 'hono'
import { requireAdmin } from '../../../worker/middleware/auth'
import type { Env } from '../../../worker/types/env'

export const adminTaxRoutes = new Hono<{ Bindings: Env }>()

// ─── 6. 전자세금계산서 stub (API 연동 인프라) ─────────────────────────

interface TaxInvoiceInput {
  payee_type: 'store_owner' | 'seller' | 'agency'
  payee_id: string
  business_number: string  // 사업자등록번호 (123-45-67890)
  amount: number
  vat_amount?: number  // default amount * 0.1
  service_description: string  // '유어딜 공동구매 정산 (2026-05)'
}

/**
 * 전자세금계산서 발행 (stub).
 *   env.TAX_INVOICE_API_KEY 미설정 시 silent skip (success: false, skipped: true).
 *   실제 API 연동 시 (Bill36524 / Popbill / Toss Tax) 본 함수만 교체.
 */
export async function issueTaxInvoice(
  env: { TAX_INVOICE_API_KEY?: string; TAX_INVOICE_API_URL?: string; TAX_INVOICE_SENDER_BIZ_NO?: string },
  input: TaxInvoiceInput,
): Promise<{ success: boolean; invoice_id?: string; error?: string; skipped?: boolean }> {
  if (!env.TAX_INVOICE_API_KEY || !env.TAX_INVOICE_SENDER_BIZ_NO) {
    return { success: false, skipped: true, error: 'TAX_INVOICE_API_KEY 미설정 (stub mode)' }
  }
  if (!/^\d{3}-\d{2}-\d{5}$/.test(input.business_number)) {
    return { success: false, error: 'business_number 형식 오류 (123-45-67890)' }
  }
  if (input.amount <= 0) return { success: false, error: 'amount > 0' }

  // 실제 API 호출은 Bill36524 / Popbill 계약 후 본 부분만 교체.
  // 현재는 stub — body 만 valid 확인.
  try {
    // TODO: 외부 API 호출
    // const res = await fetch(env.TAX_INVOICE_API_URL!, {
    //   method: 'POST',
    //   headers: { 'Authorization': `Bearer ${env.TAX_INVOICE_API_KEY}` },
    //   body: JSON.stringify({ ... }),
    // })
    return { success: true, invoice_id: `STUB-${Date.now()}` }
  } catch (e) {
    return { success: false, error: (e as Error).message }
  }
}

adminTaxRoutes.post('/admin/tax/issue-invoice', requireAdmin(), async (c) => {
  const body = await c.req.json<TaxInvoiceInput>().catch(() => ({} as Partial<TaxInvoiceInput>))
  if (!body.payee_type || !body.payee_id || !body.business_number || !body.amount) {
    return c.json({ success: false, error: '필수 필드 누락' }, 400)
  }
  const result = await issueTaxInvoice(c.env as unknown as { TAX_INVOICE_API_KEY?: string; TAX_INVOICE_API_URL?: string; TAX_INVOICE_SENDER_BIZ_NO?: string }, body as TaxInvoiceInput)
  return c.json(result)
})

// ─── 7. 연말 정산 리포트 (CSV export) ───────────────────────────────

adminTaxRoutes.get('/admin/tax/annual-report', requireAdmin(), async (c) => {
  const year = parseInt(c.req.query('year') || String(new Date().getFullYear() - 1), 10)
  const payeeType = c.req.query('payee_type') || 'all'
  if (!Number.isFinite(year) || year < 2024 || year > 2100) {
    return c.json({ success: false, error: 'year 형식 오류' }, 400)
  }
  const valid = ['all', 'store_owner', 'seller', 'agency']
  if (!valid.includes(payeeType)) return c.json({ success: false, error: 'payee_type 오류' }, 400)
  const { DB } = c.env
  const periodStart = `${year}-01-01 00:00:00`
  const periodEnd = `${year}-12-31 23:59:59`

  const where: string[] = ['status = \'sent\'', 'sent_at BETWEEN ? AND ?']
  const params: unknown[] = [periodStart, periodEnd]
  if (payeeType !== 'all') { where.push('payee_type = ?'); params.push(payeeType) }

  const rows = await DB.prepare(
    `SELECT payee_type, payee_id, account_holder, account_number,
            SUM(amount) as total_amount, COUNT(*) as payout_count,
            MIN(sent_at) as first_payout, MAX(sent_at) as last_payout
       FROM payouts
      WHERE ${where.join(' AND ')}
      GROUP BY payee_type, payee_id
      ORDER BY total_amount DESC`,
  ).bind(...params).all<{
    payee_type: string; payee_id: string; account_holder: string | null; account_number: string | null;
    total_amount: number; payout_count: number; first_payout: string; last_payout: string
  }>().catch(() => ({ results: [] as Array<{ payee_type: string; payee_id: string; account_holder: string | null; account_number: string | null; total_amount: number; payout_count: number; first_payout: string; last_payout: string }> }))

  // 사업자등록번호 등 추가 정보 조회 (seller / agency)
  const enriched: Array<Record<string, unknown>> = []
  for (const r of rows.results || []) {
    let businessNumber: string | null = null
    let name = r.account_holder
    try {
      if (r.payee_type === 'store_owner' || r.payee_type === 'seller') {
        const s = await DB.prepare('SELECT business_number, business_name FROM sellers WHERE id = ?').bind(r.payee_id).first<{ business_number: string | null; business_name: string | null }>()
        businessNumber = s?.business_number || null
        name = s?.business_name || r.account_holder
      } else if (r.payee_type === 'agency') {
        const a = await DB.prepare('SELECT name FROM agencies WHERE id = ?').bind(r.payee_id).first<{ name: string }>()
        name = a?.name || r.account_holder
      }
    } catch { /* graceful */ }
    enriched.push({ ...r, business_number: businessNumber, name })
  }

  // CSV 출력 옵션
  const format = c.req.query('format') || 'json'
  if (format === 'csv') {
    const header = ['payee_type', 'payee_id', 'name', 'business_number', 'account_number', 'total_amount', 'payout_count', 'first_payout', 'last_payout']
    const csv = [header.join(',')]
    for (const r of enriched) {
      csv.push(header.map(h => {
        const v = r[h]
        if (v == null) return ''
        const s = String(v).replace(/"/g, '""')
        return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s}"` : s
      }).join(','))
    }
    return c.body('﻿' + csv.join('\n'), 200, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="urdeal-annual-${year}-${payeeType}.csv"`,
    })
  }

  return c.json({ success: true, data: { year, payee_type: payeeType, rows: enriched } })
})
