/**
 * 🧾 월별 회계 집계 SSOT — 세무사용 CSV(`GET /api/admin/tax/monthly-accounting`)와 매월 1일 자동 요약 알림이 같은 숫자를 쓴다.
 *
 * 2026-07-08 무인운영 감사로 라우트 안에 있던 집계를 2026-11-25 이 파일로 옮겼다(대표 *"최대한 자동화하자
 * 지급대행 안쓰는 선에서"* — 월 마감 요약을 자동으로 보내려는데 같은 식을 두 번 쓰면 숫자가 갈린다).
 * 식은 한 글자도 안 바꿨다. 전부 read-only · 지표별 fail-soft(쿼리 실패 시 0).
 */
import type { D1Database } from '@cloudflare/workers-types'
import { COMMISSION_DEFAULTS } from '../../shared/constants/policy'
import { FEE_VAT_ACCOUNT } from '../../shared/fee-vat'

export interface MonthlyAccounting {
  month: string
  defaultRate: number
  sales: { n: number; gmv: number; commission: number }
  refunds: { n: number; refunded: number }
  payouts: Array<{ payee_type: string; n: number; total: number }>
  wht: { n: number; gross: number; withholding: number; net: number }
  /** 🧾 2026-11-25 수수료 부가세 예수금(원장 `platform:vat_payable` 순증, 사용월 기준). 유어딜 수익 아님 — 부가세 신고 때 낸다. */
  feeVat?: number
}

/** 지난달(KST) 'YYYY-MM'. 순수. */
export function previousKstMonthKey(nowMs: number = Date.now()): string {
  const k = new Date(nowMs + 9 * 3600_000)
  k.setUTCDate(1)
  k.setUTCMonth(k.getUTCMonth() - 1)
  return `${k.getUTCFullYear()}-${String(k.getUTCMonth() + 1).padStart(2, '0')}`
}

export async function computeMonthlyAccounting(DB: D1Database, month: string): Promise<MonthlyAccounting> {
  const [yStr, mStr] = month.split('-')
  const year = Number(yStr)
  const monthNum = Number(mStr)
  const defaultRate = COMMISSION_DEFAULTS.PLATFORM_FEE_PCT

  // ① 매출(GMV) + 플랫폼 수수료 수익 — settlement/export-csv 와 동일 공식.
  // ⚠️ .first() 는 T|null — 집계라 실제론 항상 행이 오지만, null 이면 0 기본값(타입·안전 동시 보장).
  const sales = (await DB.prepare(`
    SELECT COUNT(*) AS n,
           COALESCE(SUM(o.total_amount), 0) AS gmv,
           COALESCE(SUM(ROUND(o.total_amount * COALESCE(o.commission_rate, s.commission_rate, ?) / 100)), 0) AS commission
      FROM orders o
      LEFT JOIN sellers s ON o.seller_id = s.id
     WHERE o.status IN ('DONE', 'PAID', 'DELIVERED')
       AND strftime('%Y-%m', datetime(o.created_at, '+9 hours')) = ?
  `).bind(defaultRate, month).first<{ n: number; gmv: number; commission: number }>()
    .catch(() => null)) ?? { n: 0, gmv: 0, commission: 0 }

  // ② 환불/취소 — 환불 발생 월(refunded_at) 기준.
  const refunds = (await DB.prepare(`
    SELECT COUNT(*) AS n, COALESCE(SUM(refunded_amount), 0) AS refunded
      FROM orders
     WHERE COALESCE(refunded_amount, 0) > 0
       AND strftime('%Y-%m', datetime(COALESCE(refunded_at, updated_at, created_at), '+9 hours')) = ?
  `).bind(month).first<{ n: number; refunded: number }>()
    .catch(() => null)) ?? { n: 0, refunded: 0 }

  // ③ 정산 지급(실송금 sent) — payee 유형별. = 매입세금계산서(역발행) 발행 대상.
  const payouts = await DB.prepare(`
    SELECT payee_type, COUNT(*) AS n, COALESCE(SUM(amount), 0) AS total
      FROM payouts
     WHERE status = 'sent'
       AND strftime('%Y-%m', datetime(sent_at, '+9 hours')) = ?
     GROUP BY payee_type
  `).bind(month).all<{ payee_type: string; n: number; total: number }>()
    .catch(() => ({ results: [] as Array<{ payee_type: string; n: number; total: number }> }))

  // ④ 원천징수 — tax_withholding_log (지급월 기준).
  const wht = (await DB.prepare(`
    SELECT COUNT(*) AS n,
           COALESCE(SUM(gross_amount), 0) AS gross,
           COALESCE(SUM(withholding_amount), 0) AS withholding,
           COALESCE(SUM(net_amount), 0) AS net
      FROM tax_withholding_log
     WHERE payout_year = ? AND payout_month = ?
  `).bind(year, monthNum).first<{ n: number; gross: number; withholding: number; net: number }>()
    .catch(() => null)) ?? { n: 0, gross: 0, withholding: 0, net: 0 }
  // 🧾 2026-11-18 인플루언서 현금 지급의 원천징수(별도 표 — `utils/influencer-withholding-log.ts`)를 같은 달 합계에 더한다.
  const whtInf = (await DB.prepare(`
    SELECT COUNT(*) AS n, COALESCE(SUM(gross_amount), 0) AS gross,
           COALESCE(SUM(withholding_amount), 0) AS withholding, COALESCE(SUM(net_amount), 0) AS net
      FROM influencer_withholding_log WHERE payout_year = ? AND payout_month = ?
  `).bind(year, monthNum).first<{ n: number; gross: number; withholding: number; net: number }>().catch(() => null))
  if (whtInf) { wht.n += Number(whtInf.n) || 0; wht.gross += Number(whtInf.gross) || 0; wht.withholding += Number(whtInf.withholding) || 0; wht.net += Number(whtInf.net) || 0 }
  // 🧾 2026-11-25 개인 에이전시에게 지급하며 뗀 3.3% 도 같은 달 합계에 — 종전엔 `agency_share_payouts` 에만 남아 이 요약에서 빠졌다(표가 없으면 0).
  const whtAg = (await DB.prepare(`
    SELECT COUNT(*) AS n, COALESCE(SUM(gross_amount), 0) AS gross,
           COALESCE(SUM(withholding_amount), 0) AS withholding, COALESCE(SUM(net_amount), 0) AS net
      FROM agency_share_payouts
     WHERE status = 'paid' AND withholding_amount > 0 AND strftime('%Y-%m', datetime(paid_at, '+9 hours')) = ?
  `).bind(month).first<{ n: number; gross: number; withholding: number; net: number }>().catch(() => null))
  if (whtAg) { wht.n += Number(whtAg.n) || 0; wht.gross += Number(whtAg.gross) || 0; wht.withholding += Number(whtAg.withholding) || 0; wht.net += Number(whtAg.net) || 0 }
  // ⑤ 수수료 부가세 예수금 — 적립(credit) − 사용 취소로 되돌린 것(debit). 표가 없거나 실패하면 0.
  const vatRow = await DB.prepare(`
    SELECT COALESCE(SUM(CASE WHEN credit_account = ? THEN amount ELSE 0 END), 0)
         - COALESCE(SUM(CASE WHEN debit_account = ? THEN amount ELSE 0 END), 0) AS v
      FROM ledger_entries
     WHERE (credit_account = ? OR debit_account = ?)
       AND strftime('%Y-%m', datetime(created_at, '+9 hours')) = ?
  `).bind(FEE_VAT_ACCOUNT, FEE_VAT_ACCOUNT, FEE_VAT_ACCOUNT, FEE_VAT_ACCOUNT, month).first<{ v: number }>().catch(() => null)
  const feeVat = Math.max(0, Math.round(Number(vatRow?.v) || 0))
  return { month, defaultRate, sales, refunds, payouts: payouts.results || [], wht, feeVat }
}

const won = (n: number) => `${Math.round(Number(n) || 0).toLocaleString('ko-KR')}원`

/** 순수 — 월 마감 알림 한 장. 원천세 신고·납부 기한(다음 달 10일)을 같이 적는다. */
export interface MonthlyCloseExtras {
  /** 🧾 수수료 세금계산서 초안(정발행 — `fee-tax-invoice.ts`). */
  feeInvoices?: { drafts: number; missingBizNo: number; autoSent?: number; autoFailed?: number }
  /** 🪪 지난달 원천징수한 개인 소득자 수 · 그중 주민번호 미등록 수(간이지급명세서 — 이번 달 말일까지). */
  simplified?: { payees: number; missingId: number; due: string }
  /** 분기 첫 달이면 지난 분기 판매대행 명세 제출 기한(YYYY-MM-DD). */
  salesAgencyDue?: string | null
}

export function monthlyCloseMessage(a: MonthlyAccounting, unsent: { n: number; total: number }, extras: MonthlyCloseExtras = {}): { title: string; message: string } {
  const [y, m] = a.month.split('-').map(Number)
  const payTotal = a.payouts.reduce((s, p) => s + (Number(p.total) || 0), 0)
  const due = new Date(Date.UTC(y, m, 10)) // 다음 달 10일
  const dueLabel = `${due.getUTCMonth() + 1}월 10일`
  const parts = [
    `매출 ${won(a.sales.gmv)}(${a.sales.n}건)`,
    `수수료 수익 ${won(a.sales.commission)}`,
    `환불 ${won(a.refunds.refunded)}`,
    `지급 완료 ${won(payTotal)}`,
    `원천징수 ${won(a.wht.withholding)}${a.wht.withholding > 0 ? ` — 원천세 신고·납부 ${dueLabel}까지` : ''}`,
  ]
  if ((a.feeVat ?? 0) > 0) parts.push(`수수료 부가세(예수금) ${won(a.feeVat ?? 0)} — 부가세 신고 때 납부`)
  if (extras.feeInvoices && extras.feeInvoices.drafts > 0) {
    const fi = extras.feeInvoices
    parts.push(fi.autoSent !== undefined
      ? `매장 수수료 세금계산서 ${fi.drafts}장 중 팝빌 자동 발행 ${fi.autoSent}장${fi.autoFailed ? ` · ⚠️ 실패 ${fi.autoFailed}장(${dueLabel}까지 처리)` : ''}`
      : `매장 수수료 세금계산서 ${fi.drafts}장 준비됨 — ${dueLabel}까지 발행${fi.missingBizNo > 0 ? `(⚠️ 사업자번호 없는 매장 ${fi.missingBizNo}곳)` : ''}`)
  }
  if (extras.simplified && extras.simplified.payees > 0) {
    const [, sm, sd] = extras.simplified.due.split('-').map(Number)
    parts.push(`간이지급명세서(사업소득) ${extras.simplified.payees}명 — ${sm}월 ${sd}일까지 제출${extras.simplified.missingId > 0 ? ` · ⚠️ 주민번호 미등록 ${extras.simplified.missingId}명` : ''}`)
  }
  if (extras.salesAgencyDue) {
    const [, dm, dd] = extras.salesAgencyDue.split('-').map(Number)
    parts.push(`지난 분기 판매대행 명세 국세청 제출 ${dm}월 ${dd}일까지`)
  }
  if (unsent.n > 0) parts.push(`⚠️ 승인됐는데 아직 안 보낸 정산 ${unsent.n}건 ${won(unsent.total)}`)
  return { title: `🧾 ${y}년 ${m}월 회계 마감 요약 — 세무사용 CSV 준비됨`, message: parts.join(' · ') }
}

/**
 * 매월 1일(KST) — 지난달 회계 요약을 어드민 알림으로 보낸다(대표 2026-11-25 *"최대한 자동화하자"*).
 * 숫자는 세무사용 CSV 와 같은 `computeMonthlyAccounting`. 같은 달 두 번 보내지 않는다(UNIQUE + INSERT OR IGNORE).
 * 돈을 옮기지 않는다 — 읽고 알리기만.
 */
export async function sendMonthlyCloseSummary(DB: D1Database, nowMs: number = Date.now(), env?: { POPBILL_LINK_ID?: string; POPBILL_SECRET_KEY?: string }): Promise<{ sent: boolean; month: string }> {
  const month = previousKstMonthKey(nowMs)
  await DB.prepare(`CREATE TABLE IF NOT EXISTS monthly_close_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    month TEXT NOT NULL,
    payload TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`).run()
  await DB.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_monthly_close_reports_month ON monthly_close_reports(month)').run()
  const acc = await computeMonthlyAccounting(DB, month)
  const unsent = (await DB.prepare(
    "SELECT COUNT(*) AS n, COALESCE(SUM(amount), 0) AS total FROM payouts WHERE status = 'approved'",
  ).first<{ n: number; total: number }>().catch(() => null)) ?? { n: 0, total: 0 }
  // 선점이 먼저 — 알림은 선점에 성공한 쪽만(재실행해도 한 장).
  const ins = await DB.prepare('INSERT OR IGNORE INTO monthly_close_reports (month, payload) VALUES (?, ?)')
    .bind(month, JSON.stringify({ ...acc, unsent })).run()
  if (!ins.meta?.changes) return { sent: false, month }
  // 🧾 2026-11-25 같은 날 매장 수수료 세금계산서 초안을 만들고(정발행), 분기 첫 달이면 판매대행 명세 기한을 붙인다.
  const extras: MonthlyCloseExtras = {}
  try {
    const { buildFeeInvoiceDrafts } = await import('./fee-tax-invoice')
    const r = await buildFeeInvoiceDrafts(DB, month)
    extras.feeInvoices = { drafts: r.drafts, missingBizNo: r.missingBizNo }
    // 🧾 팝빌 자동 발행 — 자격이 있고 `fee_invoice_auto_send = 'true'` 일 때만(기본 꺼짐). 실패분은 초안으로 남는다.
    const auto = await DB.prepare("SELECT value FROM platform_settings WHERE key = 'fee_invoice_auto_send' LIMIT 1").first<{ value: string }>().catch(() => null)
    if (auto?.value === 'true') {
      const { resolvePopbillCreds } = await import('./popbill-invoice')
      const creds = await resolvePopbillCreds(DB, env)
      if (creds) {
        const { sendFeeInvoicesViaPopbill } = await import('./fee-tax-invoice')
        const s = await sendFeeInvoicesViaPopbill(DB, creds, month)
        extras.feeInvoices.autoSent = s.issued
        extras.feeInvoices.autoFailed = s.failed
      }
    }
  } catch (e) { console.error('[monthly-close] fee invoice drafts failed', e) }
  try {
    const { computeSimplifiedStatement } = await import('./simplified-payment-statement')
    const rows = await computeSimplifiedStatement(DB, undefined, month, false)
    const [sy, sm] = month.split('-').map(Number)
    extras.simplified = { payees: rows.length, missingId: rows.filter((r) => !r.name).length, due: new Date(Date.UTC(sy, sm + 1, 0)).toISOString().slice(0, 10) }
  } catch (e) { console.error('[monthly-close] simplified statement failed', e) }
  const thisMonth = new Date(nowMs + 9 * 3600_000).getUTCMonth() + 1
  if ([1, 4, 7, 10].includes(thisMonth)) {
    const { previousKstQuarter, quarterInfo } = await import('./sales-agency-report')
    extras.salesAgencyDue = quarterInfo(previousKstQuarter(nowMs))?.due ?? null
  }
  const msg = monthlyCloseMessage(acc, { n: Number(unsent.n) || 0, total: Number(unsent.total) || 0 }, extras)
  const { createDashboardNotification } = await import('../../features/notifications/api/dashboard-notifications.routes')
  await createDashboardNotification(DB, 'admin', null, 'monthly_close_report', msg.title, msg.message, '/admin/payouts?tab=annual')
  return { sent: true, month }
}
