/**
 * 🛡️ 2026-05-19: 어드민 — 원천징수 + 지급조서 export.
 *
 *   소득세법 §164, 165 — 지급자(법인) 는 매년 1월말까지 지급조서 국세청 제출 의무.
 *
 *   GET  /admin/withholding/summary?year=2026     — 연도별 셀러별 누계
 *   GET  /admin/withholding/csv?year=2026         — 지급조서 CSV (홈택스 업로드 형식)
 *   POST /admin/withholding/mark-reported         — 제출 완료 마킹 (reported_at)
 *
 *   인증: adminApp.use('*', requireAdmin()) 가 처리.
 */
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { Env } from '@/worker/types/env'

export const adminWithholdingRoutes = new Hono<{ Bindings: Env }>()

interface SellerSummary {
  seller_id: number
  seller_name: string
  seller_email: string
  business_number: string | null
  total_gross: number
  total_withheld: number
  total_net: number
  payout_count: number
  reportable: number       // 0/1 — 300만원 초과 시 1
  last_payout_at: string | null
}

// 1. 연도별 셀러 누계 — 어드민 대시보드 표.
adminWithholdingRoutes.get('/withholding/summary', cors(), async (c) => {
  try {
    const year = Number(c.req.query('year')) || new Date().getFullYear()
    const rows = await c.env.DB.prepare(
      `SELECT
         t.seller_id,
         s.name as seller_name,
         s.email as seller_email,
         s.business_number,
         COALESCE(SUM(t.gross_amount), 0) as total_gross,
         COALESCE(SUM(t.withholding_amount), 0) as total_withheld,
         COALESCE(SUM(t.net_amount), 0) as total_net,
         COUNT(*) as payout_count,
         MAX(t.reportable) as reportable,
         MAX(t.created_at) as last_payout_at
       FROM tax_withholding_log t
       JOIN sellers s ON s.id = t.seller_id
       WHERE t.payout_year = ?
       GROUP BY t.seller_id
       ORDER BY total_gross DESC`
    ).bind(year).all<SellerSummary>().catch(() => ({ results: [] }))

    // KPI 전체.
    const totals = await c.env.DB.prepare(
      `SELECT
         COALESCE(SUM(gross_amount), 0) as gross,
         COALESCE(SUM(withholding_amount), 0) as withheld,
         COUNT(DISTINCT seller_id) as sellers,
         SUM(CASE WHEN reportable=1 THEN 1 ELSE 0 END) as reportable_rows,
         SUM(CASE WHEN reported_at IS NOT NULL THEN 1 ELSE 0 END) as reported_rows,
         COUNT(*) as total_rows
       FROM tax_withholding_log
       WHERE payout_year = ?`
    ).bind(year).first<{
      gross: number; withheld: number; sellers: number;
      reportable_rows: number; reported_rows: number; total_rows: number;
    }>().catch(() => ({ gross: 0, withheld: 0, sellers: 0, reportable_rows: 0, reported_rows: 0, total_rows: 0 }))

    return c.json({
      success: true,
      data: {
        year,
        sellers: rows.results || [],
        totals: {
          total_gross: totals?.gross || 0,
          total_withheld: totals?.withheld || 0,
          unique_sellers: totals?.sellers || 0,
          reportable_count: totals?.reportable_rows || 0,
          reported_count: totals?.reported_rows || 0,
          total_rows: totals?.total_rows || 0,
        },
      },
    })
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500)
  }
})

// 2. 지급조서 CSV — 홈택스 업로드 형식.
//   국세청 e-국세청 "기타소득 지급명세서" 양식 (간소화):
//     성명 / 주민등록번호 / 지급일 / 지급액 / 원천징수액 / 비고
//   ※ 주민등록번호는 sellers 에 별도 컬럼 추가 필요. 현재는 business_number 또는 email 로 대체.
adminWithholdingRoutes.get('/withholding/csv', cors(), async (c) => {
  try {
    const year = Number(c.req.query('year')) || new Date().getFullYear()
    const reportableOnly = c.req.query('reportable_only') === '1'

    let sql = `SELECT
         t.id, t.seller_id, s.name as seller_name, s.email,
         s.business_number, s.phone,
         t.payout_year, t.payout_month, t.gross_amount,
         t.withholding_rate, t.withholding_amount, t.net_amount,
         t.source_type, t.source_id, t.ytd_gross_amount, t.reportable,
         t.reported_at, t.created_at
       FROM tax_withholding_log t
       JOIN sellers s ON s.id = t.seller_id
       WHERE t.payout_year = ?`
    const params: unknown[] = [year]
    if (reportableOnly) { sql += ' AND t.reportable = 1' }
    sql += ' ORDER BY t.seller_id, t.created_at'

    const rows = await c.env.DB.prepare(sql).bind(...params).all<{
      id: number; seller_id: number; seller_name: string; email: string;
      business_number: string | null; phone: string | null;
      payout_year: number; payout_month: number; gross_amount: number;
      withholding_rate: number; withholding_amount: number; net_amount: number;
      source_type: string; source_id: string | null;
      ytd_gross_amount: number; reportable: number;
      reported_at: string | null; created_at: string;
    }>().catch(() => ({ results: [] }))

    // CSV (UTF-8 BOM + Excel 호환).
    const BOM = '﻿'
    const headers = [
      '로그ID', '셀러ID', '성명', '이메일', '사업자번호', '휴대폰',
      '지급연도', '지급월', '지급액(gross)', '원천징수율(%)', '원천징수액',
      '실수령액(net)', '소스타입', '소스ID',
      '연누계지급액(YTD)', '300만초과여부', '국세청제출일', '기록일시',
    ]
    const escape = (v: unknown) => {
      const s = v === null || v === undefined ? '' : String(v)
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : s
    }
    const lines = [headers.map(escape).join(',')]
    for (const r of (rows.results || [])) {
      lines.push([
        r.id, r.seller_id, r.seller_name, r.email,
        r.business_number || '', r.phone || '',
        r.payout_year, r.payout_month, r.gross_amount,
        r.withholding_rate, r.withholding_amount, r.net_amount,
        r.source_type, r.source_id || '',
        r.ytd_gross_amount, r.reportable ? 'Y' : 'N',
        r.reported_at || '', r.created_at,
      ].map(escape).join(','))
    }

    const csv = BOM + lines.join('\n')
    const filename = `withholding-${year}${reportableOnly ? '-reportable' : ''}.csv`
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500)
  }
})

// 3. 국세청 제출 완료 마킹 — 어드민이 홈택스 업로드 후 호출.
adminWithholdingRoutes.post('/withholding/mark-reported', cors(), async (c) => {
  try {
    type Body = { year?: number; ids?: number[] }
    const body = await c.req.json<Body>().catch(() => ({} as Body))
    const year = Number(body?.year)
    const ids = Array.isArray(body?.ids) ? body.ids.map(Number).filter(Number.isFinite) : []
    if (!year && ids.length === 0) {
      return c.json({ success: false, error: 'year 또는 ids 필요' }, 400)
    }

    let result
    if (ids.length > 0) {
      const placeholders = ids.map(() => '?').join(',')
      result = await c.env.DB.prepare(
        `UPDATE tax_withholding_log SET reported_at = datetime('now') WHERE id IN (${placeholders})`
      ).bind(...ids).run()
    } else {
      result = await c.env.DB.prepare(
        `UPDATE tax_withholding_log SET reported_at = datetime('now')
         WHERE payout_year = ? AND reportable = 1 AND reported_at IS NULL`
      ).bind(year).run()
    }

    return c.json({ success: true, data: { updated: result.meta.changes || 0 } })
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500)
  }
})
