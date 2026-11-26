/**
 * 🧾 어드민 — 매장 수수료 세금계산서(정발행) 초안 · 분기 판매대행 명세 (2026-11-25)
 *
 * 집계 SSOT: `worker/utils/fee-tax-invoice.ts` · `worker/utils/sales-agency-report.ts`. 이 파일은 문만 연다.
 *   GET  /api/admin/tax/fee-invoices?period=YYYY-MM        목록(+합계)
 *   POST /api/admin/tax/fee-invoices/build {period}         초안 다시 만들기(발행된 건은 안 건드림)
 *   GET  /api/admin/tax/fee-invoices/csv?period=YYYY-MM    홈택스 수기 발행용 CSV
 *   POST /api/admin/tax/fee-invoices/:id/issued {nts_confirm_num?}  홈택스에서 발행한 뒤 "발행 완료"
 *   GET  /api/admin/tax/sales-agency-report?quarter=YYYY-Qn  분기 판매·결제대행 명세 집계 CSV
 *   GET  /api/admin/tax/simplified-statement?month=YYYY-MM  간이지급명세서(사업소득) — 주민번호 원문 포함이라 2FA·감사 로그
 *   POST /api/admin/tax/fee-invoices/send-popbill {period, ids?}  팝빌로 즉시 발행(초안만, 자격 없으면 409)
 * 돈을 옮기지 않는다(서류·집계만).
 */
import type { Hono } from 'hono'
import { requireAdminRole } from '../../../worker/middleware/auth'
import { auditLog } from '../../../worker/middleware/audit-log'
import { require2FA } from '../../../worker/middleware/require-2fa'
import { computeSimplifiedStatement, simplifiedStatementCsv } from '../../../worker/utils/simplified-payment-statement'
import type { Env } from '../../../worker/types/env'
import { safeError } from '../../../worker/utils/safe-error'
import {
  buildFeeInvoiceDrafts, listFeeInvoices, markFeeInvoiceIssued, feeInvoicesCsv, previousKstPeriod, invoiceDates,
} from '../../../worker/utils/fee-tax-invoice'
import { computeSalesAgencyReport, salesAgencyCsv, previousKstQuarter } from '../../../worker/utils/sales-agency-report'
import { resolvePopbillCreds } from '../../../worker/utils/popbill-invoice'
import { sendFeeInvoicesViaPopbill } from '../../../worker/utils/fee-tax-invoice'

const periodOf = (raw: unknown) => {
  const p = String(raw ?? '').trim()
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(p) ? p : previousKstPeriod()
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function registerFeeInvoiceRoutes(app: Hono<{ Bindings: Env }, any, any>) {
  app.get('/admin/tax/fee-invoices', requireAdminRole('finance'), async (c) => {
    try {
      const period = periodOf(c.req.query('period'))
      const rows = await listFeeInvoices(c.env.DB, period)
      const sum = (k: 'supply_amount' | 'vat_amount' | 'total_amount') => rows.reduce((s, r) => s + (Number(r[k]) || 0), 0)
      return c.json({
        success: true,
        data: {
          period, ...invoiceDates(period), invoices: rows,
          totals: { count: rows.length, issued: rows.filter((r) => r.status === 'issued').length, supply: sum('supply_amount'), vat: sum('vat_amount'), total: sum('total_amount') },
        },
      })
    } catch (err) {
      return safeError(c, err, '수수료 세금계산서 목록을 불러오지 못했습니다', '[fee-invoices]')
    }
  })

  app.post('/admin/tax/fee-invoices/build', requireAdminRole('finance'), auditLog('tax.fee_invoices_build'), async (c) => {
    try {
      const body = await c.req.json().catch(() => ({})) as { period?: string }
      const r = await buildFeeInvoiceDrafts(c.env.DB, periodOf(body.period))
      return c.json({ success: true, data: r })
    } catch (err) {
      return safeError(c, err, '세금계산서 초안을 만들지 못했습니다', '[fee-invoices]')
    }
  })

  app.get('/admin/tax/fee-invoices/csv', requireAdminRole('finance'), async (c) => {
    try {
      const period = periodOf(c.req.query('period'))
      const rows = await listFeeInvoices(c.env.DB, period)
      return c.body(feeInvoicesCsv(rows), 200, {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="urdeal-fee-invoices-${period}.csv"`,
      })
    } catch (err) {
      return safeError(c, err, '세금계산서 CSV 를 만들지 못했습니다', '[fee-invoices]')
    }
  })

  app.post('/admin/tax/fee-invoices/:id/issued', requireAdminRole('finance'), auditLog('tax.fee_invoice_issued'), async (c) => {
    try {
      const id = Number(c.req.param('id'))
      if (!Number.isInteger(id) || id <= 0) return c.json({ success: false, error: '잘못된 번호입니다' }, 400)
      const body = await c.req.json().catch(() => ({})) as { nts_confirm_num?: string }
      const admin = (c as unknown as { get: (k: string) => { id?: number } | undefined }).get('user')
      const ok = await markFeeInvoiceIssued(c.env.DB, id, Number(admin?.id) || null, typeof body.nts_confirm_num === 'string' ? body.nts_confirm_num.trim() : null)
      if (!ok) return c.json({ success: false, code: 'NOT_DRAFT', error: '이미 발행 완료됐거나 없는 건입니다' }, 409)
      return c.json({ success: true })
    } catch (err) {
      return safeError(c, err, '발행 완료 처리에 실패했습니다', '[fee-invoices]')
    }
  })

  app.get('/admin/tax/simplified-statement', requireAdminRole('finance'), require2FA(), auditLog('tax.simplified_statement_export'), async (c) => {
    try {
      const month = periodOf(c.req.query('month'))
      const rows = await computeSimplifiedStatement(c.env.DB, c.env.DATA_ENCRYPTION_KEY, month, true)
      return c.body(simplifiedStatementCsv(month, rows), 200, {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="urdeal-simplified-statement-${month}.csv"`,
        'Cache-Control': 'no-store',
      })
    } catch (err) {
      return safeError(c, err, '간이지급명세서를 만들지 못했습니다', '[simplified-statement]')
    }
  })

  app.post('/admin/tax/fee-invoices/send-popbill', requireAdminRole('finance'), auditLog('tax.fee_invoices_send_popbill'), async (c) => {
    try {
      const body = await c.req.json().catch(() => ({})) as { period?: string; ids?: unknown }
      const creds = await resolvePopbillCreds(c.env.DB, c.env as unknown as { POPBILL_LINK_ID?: string; POPBILL_SECRET_KEY?: string })
      if (!creds) return c.json({ success: false, code: 'POPBILL_NOT_CONFIGURED', error: '팝빌 연동 자격(LinkID·SecretKey)이 없습니다. 어드민 설정에 넣어 주세요' }, 409)
      const ids = Array.isArray(body.ids) ? body.ids.map(Number).filter((n) => Number.isInteger(n) && n > 0) : undefined
      const r = await sendFeeInvoicesViaPopbill(c.env.DB, creds, periodOf(body.period), ids)
      return c.json({ success: true, data: { ...r, test: creds.isTest } })
    } catch (err) {
      return safeError(c, err, '팝빌 발행에 실패했습니다', '[fee-invoices]')
    }
  })

  app.get('/admin/tax/sales-agency-report', requireAdminRole('finance'), async (c) => {
    try {
      const raw = String(c.req.query('quarter') || '').trim()
      const quarter = /^\d{4}-Q[1-4]$/.test(raw) ? raw : previousKstQuarter()
      const rows = await computeSalesAgencyReport(c.env.DB, quarter)
      return c.body(salesAgencyCsv(quarter, rows), 200, {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="urdeal-sales-agency-${quarter}.csv"`,
      })
    } catch (err) {
      return safeError(c, err, '판매대행 명세를 만들지 못했습니다', '[sales-agency]')
    }
  })
}
