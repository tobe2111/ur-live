/** 🏭 distributor-admin: 세금계산서/거래명세서 발행 (내부 + 바로빌 국세청) (byte-identical 분해). */
import type { Hono } from 'hono'
import { safeError } from '@/worker/utils/safe-error'
import { rateLimit } from '@/worker/middleware/rate-limit'
import { swallow } from '@/worker/utils/swallow'
import { ensureTaxDocSchema, splitVat, renderTaxDocHtml, type TaxDocRow } from '../tax-documents'
import { isBarobillConfigured, issueBarobillTaxInvoice, type BarobillEnv } from '@/services/barobill'
import type { Env } from './helpers'

export function registerTaxDocumentsRoutes(app: Hono<{ Bindings: Env }>) {
  // ── 세금계산서/거래명세서 발행 (내부 발행 + 인쇄용 문서) ───────────────────────

  // POST /tax-documents/issue — 해당 월 집계로 발행 기록 생성 (멱등 upsert)
  //   body: { month: 'YYYY-MM', doc_type?: 'tax_invoice'|'transaction_statement' }
  app.post('/tax-documents/issue', async (c) => {
    try {
      await ensureTaxDocSchema(c.env.DB)
      const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
      const month = String(body.month || '').slice(0, 7)
      if (!/^\d{4}-\d{2}$/.test(month)) return c.json({ success: false, error: '월 형식 오류 (YYYY-MM)' }, 400)
      const docType = body.doc_type === 'transaction_statement' ? 'transaction_statement' : 'tax_invoice'

      // 매출(유통스타트→판매사): 판매사별 순매출(subtotal − 환불액) 합. 부분/전액 환불분 차감.
      const byDist = await c.env.DB.prepare(`
        SELECT o.distributor_seller_id AS seller_id, s.business_name, s.name,
               COUNT(*) AS order_count, COALESCE(SUM(MAX(0, o.subtotal - COALESCE(o.refunded_amount,0))),0) AS total
        FROM wholesale_orders o LEFT JOIN sellers s ON s.id = o.distributor_seller_id
        WHERE o.status IN ('PAID','SHIPPED','PARTIAL_REFUNDED') AND strftime('%Y-%m', COALESCE(o.paid_at, o.created_at)) = ?
        GROUP BY o.distributor_seller_id
      `).bind(month).all<{ seller_id: number; business_name: string | null; name: string | null; order_count: number; total: number }>().catch(() => ({ results: [] }))

      // 매입(제조사→유통스타트): 제조사별 base_supply_price 합 (환불된 라인 제외).
      const bySup = await c.env.DB.prepare(`
        SELECT i.supplier_id, sup.business_name,
               COUNT(DISTINCT i.wholesale_order_id) AS order_count, COALESCE(SUM(i.base_supply_price * i.qty),0) AS total
        FROM wholesale_order_items i JOIN wholesale_orders o ON o.id = i.wholesale_order_id
        LEFT JOIN suppliers sup ON sup.id = i.supplier_id
        WHERE o.status IN ('PAID','SHIPPED','PARTIAL_REFUNDED') AND strftime('%Y-%m', COALESCE(o.paid_at, o.created_at)) = ?
          AND i.supplier_id IS NOT NULL AND i.line_status != 'REFUNDED'
        GROUP BY i.supplier_id
      `).bind(month).all<{ supplier_id: number; business_name: string | null; order_count: number; total: number }>().catch(() => ({ results: [] }))

      let issued = 0
      for (const r of byDist.results || []) {
        if (!r.total) continue
        const { supply, vat, total } = splitVat(r.total)
        // supplier_id=0 sentinel — SQLite UNIQUE 는 NULL 을 서로 다르게 취급해 dedup 실패하므로 0 사용.
        const res = await c.env.DB.prepare(`
          INSERT INTO tax_documents (doc_type, direction, period_month, distributor_seller_id, supplier_id, party_name, supply_amount, vat_amount, total_amount, order_count, status, issued_at)
          VALUES (?, 'sales', ?, ?, 0, ?, ?, ?, ?, ?, 'issued', datetime('now'))
          ON CONFLICT(doc_type, direction, period_month, distributor_seller_id, supplier_id)
          DO UPDATE SET supply_amount=excluded.supply_amount, vat_amount=excluded.vat_amount, total_amount=excluded.total_amount, order_count=excluded.order_count, status='issued', issued_at=datetime('now')
        `).bind(docType, month, r.seller_id, r.business_name || r.name || `판매사#${r.seller_id}`, supply, vat, total, r.order_count).run().catch(() => null)
        if (res) issued++
      }
      for (const r of bySup.results || []) {
        if (!r.total) continue
        const { supply, vat, total } = splitVat(r.total)
        // distributor_seller_id=0 sentinel (위와 동일 이유).
        const res = await c.env.DB.prepare(`
          INSERT INTO tax_documents (doc_type, direction, period_month, distributor_seller_id, supplier_id, party_name, supply_amount, vat_amount, total_amount, order_count, status, issued_at)
          VALUES (?, 'purchase', ?, 0, ?, ?, ?, ?, ?, ?, 'issued', datetime('now'))
          ON CONFLICT(doc_type, direction, period_month, distributor_seller_id, supplier_id)
          DO UPDATE SET supply_amount=excluded.supply_amount, vat_amount=excluded.vat_amount, total_amount=excluded.total_amount, order_count=excluded.order_count, status='issued', issued_at=datetime('now')
        `).bind(docType, month, r.supplier_id, r.business_name || `제조사#${r.supplier_id}`, supply, vat, total, r.order_count).run().catch(() => null)
        if (res) issued++
      }
      return c.json({ success: true, issued, month, doc_type: docType })
    } catch (err) {
      return safeError(c, err, '세금계산서 발행 중 오류가 발생했습니다', '[distributor-admin]')
    }
  })

  // GET /tax-documents?month=&direction=&doc_type= — 발행 목록
  app.get('/tax-documents', async (c) => {
    try {
      await ensureTaxDocSchema(c.env.DB)
      const binds: unknown[] = []
      let where = '1=1'
      const month = (c.req.query('month') || '').slice(0, 7)
      if (/^\d{4}-\d{2}$/.test(month)) { where += ' AND period_month = ?'; binds.push(month) }
      const direction = c.req.query('direction')
      if (direction === 'sales' || direction === 'purchase') { where += ' AND direction = ?'; binds.push(direction) }
      const docType = c.req.query('doc_type')
      if (docType === 'tax_invoice' || docType === 'transaction_statement') { where += ' AND doc_type = ?'; binds.push(docType) }
      const { results } = await c.env.DB.prepare(
        `SELECT * FROM tax_documents WHERE ${where} ORDER BY period_month DESC, direction, total_amount DESC LIMIT 500`
      ).bind(...binds).all()
      return c.json({ success: true, documents: results ?? [] })
    } catch (err) {
      return safeError(c, err, '세금계산서 조회 중 오류가 발생했습니다', '[distributor-admin]')
    }
  })

  // GET /tax-documents/:id/html — 인쇄용 문서 (세금계산서/거래명세서)
  app.get('/tax-documents/:id/html', async (c) => {
    try {
      await ensureTaxDocSchema(c.env.DB)
      const id = Number(c.req.param('id'))
      if (!Number.isFinite(id) || id <= 0) return c.text('잘못된 ID', 400)
      const doc = await c.env.DB.prepare('SELECT * FROM tax_documents WHERE id = ?').bind(id).first<TaxDocRow>()
      if (!doc) return c.text('문서를 찾을 수 없습니다', 404)
      return c.html(renderTaxDocHtml(doc))
    } catch (err) {
      return safeError(c, err, '문서 생성 중 오류가 발생했습니다', '[distributor-admin]')
    }
  })

  // POST /tax-documents/:id/issue-nts — 바로빌 전자세금계산서 발행 (국세청)
  //   매출(sales=유통스타트→판매사) 방향만. 발행자=유통스타트(바로빌 계정), 공급받는자=판매사.
  //   매입(제조사→유통스타트)은 제조사가 발행하는 것이라 플랫폼 계정으로 발행 불가(역발행 별도).
  //   자격증명(BAROBILL_*) 또는 플랫폼 사업자정보 미설정 시 actionable 에러(fail-soft).
  app.post('/tax-documents/:id/issue-nts', rateLimit({ action: 'admin-nts-issue', max: 30, windowSec: 60 }), async (c) => {
    try {
      await ensureTaxDocSchema(c.env.DB)
      const id = Number(c.req.param('id'))
      if (!Number.isFinite(id) || id <= 0) return c.json({ success: false, error: '잘못된 ID' }, 400)
      const doc = await c.env.DB.prepare('SELECT * FROM tax_documents WHERE id = ?').bind(id).first<TaxDocRow & {
        direction: string; distributor_seller_id: number | null; supply_amount: number; vat_amount: number; total_amount: number; nts_confirm_num: string | null
      }>()
      if (!doc) return c.json({ success: false, error: '문서를 찾을 수 없습니다' }, 404)
      if (doc.nts_confirm_num) return c.json({ success: true, already: true, nts_confirm_num: doc.nts_confirm_num })
      if (doc.direction !== 'sales') {
        return c.json({ success: false, error: '매입(제조사→유통스타트) 세금계산서는 제조사가 발행합니다. 플랫폼 발행은 매출 방향만 가능합니다' }, 400)
      }
      if (!isBarobillConfigured(c.env as unknown as BarobillEnv)) {
        return c.json({ success: false, error: '전자세금계산서 발급사(바로빌) 자격증명 미설정 — Cloudflare 환경변수 BAROBILL_TEST_API_KEY/BAROBILL_PROD_API_KEY 등록 필요', needs_config: true }, 503)
      }

      // 플랫폼(유통스타트) 사업자정보 — platform_settings.
      const ps = await c.env.DB.prepare(
        "SELECT key, value FROM platform_settings WHERE key IN ('company_business_number','company_name','company_ceo','company_address','company_biz_type','company_biz_class','company_email','company_tel')"
      ).all<{ key: string; value: string }>().catch(() => ({ results: [] as { key: string; value: string }[] }))
      const ps_map: Record<string, string> = {}
      for (const r of ps.results || []) ps_map[r.key] = r.value
      if (!ps_map.company_business_number || !ps_map.company_name) {
        return c.json({ success: false, error: '플랫폼 사업자정보 미설정 — platform_settings(company_business_number/company_name/company_ceo/company_address) 등록 필요', needs_config: true }, 503)
      }

      // 공급받는자(판매사).
      const seller = await c.env.DB.prepare(
        'SELECT business_number, business_name, name, email, phone FROM sellers WHERE id = ?'
      ).bind(doc.distributor_seller_id).first<{ business_number: string | null; business_name: string | null; name: string | null; email: string | null; phone: string | null }>()
      if (!seller) return c.json({ success: false, error: '판매사 정보를 찾을 수 없습니다' }, 404)

      let result: { success: boolean; ntsConfirmNumber?: string; invoiceKey?: string; message?: string }
      try {
        result = await issueBarobillTaxInvoice(c.env as unknown as BarobillEnv, {
          supplierBusinessNumber: ps_map.company_business_number,
          supplierBusinessName: ps_map.company_name,
          supplierCEO: ps_map.company_ceo || ps_map.company_name,
          supplierAddress: ps_map.company_address || '',
          supplierBusinessType: ps_map.company_biz_type,
          supplierBusinessCategory: ps_map.company_biz_class,
          supplierEmail: ps_map.company_email,
          supplierTel: ps_map.company_tel,
          buyerBusinessNumber: seller.business_number || undefined,
          buyerBusinessName: seller.business_name || seller.name || `판매사#${doc.distributor_seller_id}`,
          buyerEmail: seller.email || undefined,
          buyerTel: seller.phone || undefined,
          writeDate: `${doc.period_month}-01`,
          purposeType: '02', // 청구
          taxType: '01', // 과세
          items: [{ name: `${doc.period_month} 도매 거래 합계`, quantity: 1, unitPrice: doc.supply_amount, supplyPrice: doc.supply_amount, taxAmount: doc.vat_amount }],
          totalSupplyPrice: doc.supply_amount,
          totalTaxAmount: doc.vat_amount,
          totalAmount: doc.total_amount,
          memo: `유통스타트 도매 ${doc.period_month}`,
        })
      } catch (e) {
        await c.env.DB.prepare("UPDATE tax_documents SET external_status='failed' WHERE id=?").bind(id).run().catch(swallow('distributor-admin:tax-mark-failed'))
        return safeError(c, e, '전자세금계산서 발행 실패', '[distributor-admin]', 503)
      }
      if (!result.success) {
        await c.env.DB.prepare("UPDATE tax_documents SET external_status='failed' WHERE id=?").bind(id).run().catch(swallow('distributor-admin:tax-mark-failed'))
        return c.json({ success: false, error: result.message || '전자세금계산서 발행 실패' }, 502)
      }
      await c.env.DB.prepare(
        "UPDATE tax_documents SET nts_confirm_num=?, invoice_key=?, external_status='issued', status='issued', issued_at=datetime('now') WHERE id=?"
      ).bind(result.ntsConfirmNumber || null, result.invoiceKey || null, id).run()
      return c.json({ success: true, nts_confirm_num: result.ntsConfirmNumber, invoice_key: result.invoiceKey })
    } catch (err) {
      return safeError(c, err, '전자세금계산서 발행 중 오류가 발생했습니다', '[distributor-admin]')
    }
  })

  // PATCH /tax-documents/:id — 상태 변경 (issued/void)
  app.patch('/tax-documents/:id', async (c) => {
    try {
      await ensureTaxDocSchema(c.env.DB)
      const id = Number(c.req.param('id'))
      if (!Number.isFinite(id) || id <= 0) return c.json({ success: false, error: '잘못된 ID' }, 400)
      const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
      const status = String(body.status || '')
      if (!['issued', 'void', 'draft'].includes(status)) return c.json({ success: false, error: '잘못된 상태값' }, 400)
      const res = await c.env.DB.prepare(
        "UPDATE tax_documents SET status = ?, issued_at = CASE WHEN ?='issued' THEN datetime('now') ELSE issued_at END WHERE id = ?"
      ).bind(status, status, id).run()
      if (!res.meta.changes) return c.json({ success: false, error: '문서를 찾을 수 없습니다' }, 404)
      return c.json({ success: true })
    } catch (err) {
      return safeError(c, err, '문서 상태 변경 중 오류가 발생했습니다', '[distributor-admin]')
    }
  })
}
