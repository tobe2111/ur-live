/**
 * Agency Monthly Invoice Generation Cron (M6)
 *
 * 매월 1일 01:00 UTC (= KST 10:00) 실행.
 * 자동 정산 cron (월요일 00:00) 완료 후, 전월 정산 데이터로 송장 발행.
 *
 * 흐름:
 * 1. 활성 에이전시 + 전월 매출 정보 조회
 * 2. 각 에이전시별 invoice_number 생성: INV-YYYY-MM-{agency_id}-NNN
 * 3. HTML 본문 렌더링 (자체 템플릿)
 * 4. agency_settlement_invoices INSERT (UNIQUE agency+month — 멱등)
 * 5. R2 binding 있으면 R2 업로드 (있으면 r2_key 기록)
 * 6. 에이전시 알림 발송 (다운로드 링크)
 *
 * 멱등: ON CONFLICT DO NOTHING — 같은 (agency,month) 재실행해도 변화 없음.
 *
 * 참조: docs/AGENCY_BACKSTAGE_LEARNING.md (I), migrations/0219
 */

import type { Env } from '../types/env'
import { swallow } from '../utils/swallow'
interface BackupEnvLike extends Env {
  BACKUP_BUCKET?: any  // R2Bucket — 옵션
}

interface AgencyRow {
  id: number
  name: string
  email: string
  commission_rate: number | null
  bank_name: string | null
  bank_account: string | null
  account_holder: string | null
}

interface MonthlyTotals {
  total_orders: number
  total_amount: number
}

const TAX_RATE = 0.033  // 3.3% (소득세 + 지방세)

export async function handleAgencyMonthlyInvoices(env: BackupEnvLike): Promise<{
  generated: number
  skipped: number
  r2_uploaded: number
  errors: number
}> {
  const DB = env.DB
  let generated = 0
  let skipped = 0
  let r2Uploaded = 0
  let errors = 0

  // 전월 (UTC 기준)
  const now = new Date()
  const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
  const monthStr = `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, '0')}`
  const monthStartIso = prev.toISOString()
  const monthEndIso = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()

  let agencies: AgencyRow[] = []
  try {
    const r = await DB.prepare(`
      SELECT id, name, email, commission_rate, bank_name, bank_account, account_holder
      FROM agencies
      WHERE status IN ('active','approved')
    `).all<AgencyRow>()
    agencies = r.results || []
  } catch (e) {
    console.warn('[cron:agency-monthly-invoices] migration not applied or query failed:', e)
    return { generated: 0, skipped: 0, r2_uploaded: 0, errors: 1 }
  }

  for (const agency of agencies) {
    try {
      // 이미 발급된 송장 확인 (멱등)
      const existing = await DB.prepare(
        'SELECT id FROM agency_settlement_invoices WHERE agency_id = ? AND month = ? LIMIT 1'
      ).bind(agency.id, monthStr).first().catch(() => null)

      if (existing) {
        skipped++
        continue
      }

      // 전월 매출 집계
      const totals = await DB.prepare(`
        SELECT
          COUNT(DISTINCT o.id) AS total_orders,
          COALESCE(SUM(o.total_amount), 0) AS total_amount
        FROM orders o
        INNER JOIN agency_sellers ag ON ag.seller_id = o.seller_id
        WHERE ag.agency_id = ?
          AND o.status IN ('PAID','DONE')
          AND o.created_at >= ? AND o.created_at < ?
      `).bind(agency.id, monthStartIso, monthEndIso).first<MonthlyTotals>()

      const orders = totals?.total_orders ?? 0
      const amount = totals?.total_amount ?? 0
      // 🛡️ 2026-05-21: 정책 중앙화 — COMMISSION_DEFAULTS.AGENCY_OWN_RATE
      const { COMMISSION_DEFAULTS } = await import('../../shared/constants/policy')
      const rate = agency.commission_rate ?? COMMISSION_DEFAULTS.AGENCY_OWN_RATE
      const commission = Math.round(amount * rate / 100)
      const tax = Math.round(commission * TAX_RATE)
      const net = commission - tax

      // 매출 0인 에이전시는 건너뛰기 (송장 발행 안 함)
      if (amount === 0) {
        skipped++
        continue
      }

      // 발행번호: INV-2026-04-{agency_id}-001
      const invoiceNumber = `INV-${monthStr}-${agency.id}-${String(generated + 1).padStart(3, '0')}`

      // HTML 렌더링
      const html = renderInvoiceHTML({
        invoiceNumber,
        month: monthStr,
        agency,
        orders,
        amount,
        rate,
        commission,
        tax,
        net,
      })

      // INSERT
      const result = await DB.prepare(`
        INSERT INTO agency_settlement_invoices
          (agency_id, month, invoice_number, total_orders, total_amount,
           commission_rate, commission_amount, tax_amount, net_amount,
           html_content, status, generated_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'issued', 'cron', datetime('now'))
        ON CONFLICT (agency_id, month) DO NOTHING
      `).bind(
        agency.id, monthStr, invoiceNumber, orders, amount,
        rate, commission, tax, net,
        html,
      ).run()

      if ((result.meta.changes ?? 0) === 0) {
        skipped++
        continue
      }

      // R2 업로드 (옵션)
      if (env.BACKUP_BUCKET) {
        try {
          const r2Key = `invoices/${monthStr}/${invoiceNumber}.html`
          await env.BACKUP_BUCKET.put(r2Key, html, {
            httpMetadata: { contentType: 'text/html; charset=utf-8' },
          })
          await DB.prepare(
            'UPDATE agency_settlement_invoices SET r2_key = ? WHERE invoice_number = ?'
          ).bind(r2Key, invoiceNumber).run()
          r2Uploaded++
        } catch (e) {
          console.error(`[cron:invoices] R2 upload failed for ${invoiceNumber}:`, e)
        }
      }

      // 에이전시 알림
      await DB.prepare(`
        INSERT INTO agency_notifications (agency_id, type, title, message, link, created_at)
        VALUES (?, 'invoice_issued', '월 정산 명세서 발행', ?, '/agency/settlements', datetime('now'))
      `).bind(
        agency.id,
        `${monthStr} 정산: 매출 ${Number(amount ?? 0).toLocaleString('ko-KR')}원, 수수료 ${Number(commission ?? 0).toLocaleString('ko-KR')}원 (세금 ${Number(tax ?? 0).toLocaleString('ko-KR')}원, 실수령 ${Number(net ?? 0).toLocaleString('ko-KR')}원)`
      ).run().catch(swallow('cron:invoice-notify'))

      generated++
    } catch (e) {
      errors++
      console.error(`[cron:agency-monthly-invoices] agency=${agency.id} failed:`, e)
    }
  }

  return { generated, skipped, r2_uploaded: r2Uploaded, errors }
}

// ── HTML 템플릿 ──────────────────────────────────
interface RenderArgs {
  invoiceNumber: string
  month: string
  agency: AgencyRow
  orders: number
  amount: number
  rate: number
  commission: number
  tax: number
  net: number
}

function renderInvoiceHTML(a: RenderArgs): string {
  const formatNum = (n: number) => Number(n ?? 0).toLocaleString('ko-KR')
  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>정산 명세서 ${a.invoiceNumber}</title>
<style>
  body { font-family: 'Malgun Gothic', sans-serif; max-width: 800px; margin: 40px auto; color: #222; padding: 20px; }
  .hdr { display: flex; justify-content: space-between; border-bottom: 3px solid #2563eb; padding-bottom: 16px; margin-bottom: 24px; }
  .logo { font-size: 28px; font-weight: 800; color: #2563eb; }
  .meta { text-align: right; color: #666; font-size: 13px; }
  h1 { font-size: 22px; margin: 24px 0 12px; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0; }
  th, td { border: 1px solid #ddd; padding: 10px; text-align: left; font-size: 13px; }
  th { background: #f3f4f6; font-weight: 700; }
  .right { text-align: right; }
  .total { background: #eff6ff; font-weight: 800; }
  .net { background: #d1fae5; font-size: 16px; font-weight: 800; color: #047857; }
  .small { color: #888; font-size: 11px; line-height: 1.6; margin-top: 24px; }
  .bank { background: #f9fafb; padding: 12px; border-radius: 8px; margin: 16px 0; font-size: 13px; }
</style>
</head>
<body>
  <div class="hdr">
    <div>
      <div class="logo">유어딜</div>
      <div style="font-size:13px; color:#666; margin-top:4px;">UrDeal Live Commerce</div>
    </div>
    <div class="meta">
      <div><strong>송장번호:</strong> ${a.invoiceNumber}</div>
      <div><strong>발행월:</strong> ${a.month}</div>
      <div><strong>발행일:</strong> ${new Date().toISOString().slice(0, 10)}</div>
    </div>
  </div>

  <h1>📋 정산 명세서</h1>

  <h2 style="font-size:15px; margin-top:24px;">에이전시 정보</h2>
  <table>
    <tr><th>에이전시명</th><td>${a.agency.name}</td></tr>
    <tr><th>이메일</th><td>${a.agency.email}</td></tr>
    <tr><th>대상 월</th><td>${a.month}</td></tr>
  </table>

  <h2 style="font-size:15px; margin-top:24px;">매출 요약</h2>
  <table>
    <tr><th width="60%">항목</th><th width="40%" class="right">금액 (원)</th></tr>
    <tr><td>총 주문 수</td><td class="right">${formatNum(a.orders)} 건</td></tr>
    <tr><td>총 매출액</td><td class="right">${formatNum(a.amount)}</td></tr>
    <tr><td>수수료율</td><td class="right">${a.rate}%</td></tr>
    <tr class="total"><td>수수료 (총 매출 × ${a.rate}%)</td><td class="right">${formatNum(a.commission)}</td></tr>
    <tr><td>세금 차감 (소득세 3% + 지방세 0.3% = 3.3%)</td><td class="right">- ${formatNum(a.tax)}</td></tr>
    <tr class="net"><td>실수령액</td><td class="right">${formatNum(a.net)}</td></tr>
  </table>

  ${a.agency.bank_name ? `
  <div class="bank">
    <strong>입금 계좌:</strong> ${a.agency.bank_name} ${a.agency.bank_account || ''} (예금주: ${a.agency.account_holder || a.agency.name})
  </div>` : '<div class="bank" style="color:#dc2626;"><strong>⚠️ 정산 계좌 미등록</strong> — /agency/profile 에서 등록 필요</div>'}

  <p class="small">
    본 송장은 ${a.month} 매출 (PAID/DONE 상태) 기준 자동 산출됩니다.<br />
    환불/취소 처리된 주문은 다음 월 송장에서 차감됩니다.<br />
    정산 관련 문의: support@ur-team.com<br />
    <br />
    ⚠️ 본 명세서는 시스템 자동 발행이며, 세금계산서가 아닙니다. 별도 발행이 필요한 경우 어드민에 요청해주세요.
  </p>
</body>
</html>`
}
