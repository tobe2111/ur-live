/** 🏭 distributor-admin: 상품 내보내기(등급별 공급가) + 상품별 마진 override (byte-identical 분해). */
import type { Hono } from 'hono'
import { safeError } from '@/worker/utils/safe-error'
import { writeAuditLog } from '@/worker/middleware/admin-security'
import { ensureSupplyVisibilitySchema } from '../supply-visibility'
import { buildXlsx, xlsxResponse } from '../xlsx'
import { distributorPriceFromRetail, marginForGrade, type GradeMargin } from '@/lib/distributor-pricing'
import type { Env } from './helpers'

export function registerProductsPricingRoutes(app: Hono<{ Bindings: Env }>) {
  // GET /products/export — 상품정보 엑셀(CSV) 다운로드 (등급별 공급가 A/B/C 컬럼 — 유통채널 제안용)
  app.get('/products/export', async (c) => {
    try {
      await ensureSupplyVisibilitySchema(c.env.DB)
      const gradesRes = await c.env.DB.prepare('SELECT grade, margin_pct, is_special FROM distributor_grades WHERE active = 1')
        .all<{ grade: string; margin_pct: number; is_special: number }>().catch(() => ({ results: [] as { grade: string; margin_pct: number; is_special: number }[] }))
      const table: GradeMargin[] = (gradesRes.results || []).map(r => ({ grade: r.grade, margin_pct: r.margin_pct, is_special: !!r.is_special }))
      const rows = await c.env.DB.prepare(`
        SELECT p.id, p.name, p.category, p.stock, p.barcode, COALESCE(p.supply_visibility,'ALL') AS supply_visibility,
               COALESCE(p.supply_price,0) AS supply_price, COALESCE(p.price,0) AS retail_price, p.supply_margin_override_pct AS margin_override, sup.business_name AS supplier_name
        FROM products p LEFT JOIN suppliers sup ON sup.id = p.supplier_id
        WHERE p.is_supply_product = 1 AND p.supply_source_id IS NULL
        ORDER BY p.created_at DESC LIMIT 10000
      `).all<{ id: number; name: string; category: string | null; stock: number; barcode: string | null; supply_visibility: string; supply_price: number; retail_price: number; margin_override: number | null; supplier_name: string | null }>()
      const out = (rows.results || []).map(r => {
        // 상품별 마진 override(고정) 설정 시 등급 무관 동일가 — A/B/C 컬럼 모두 override 가로 표기.
        const ovSet = r.margin_override != null && Number.isFinite(Number(r.margin_override)) && Number(r.margin_override) >= 0
        const effMargin = (g: string) => (ovSet ? Number(r.margin_override) : marginForGrade(g, table))
        // 🆕 2026-06-16 신모델: 공급가 = max(원가, 판매가×(1−보장마진%)).
        return [
          r.id, r.name, r.supplier_name || '', r.category || '', r.stock, r.barcode || '', r.supply_visibility, r.supply_price,
          distributorPriceFromRetail(r.retail_price, r.supply_price, effMargin('A')),
          distributorPriceFromRetail(r.retail_price, r.supply_price, effMargin('B')),
          distributorPriceFromRetail(r.retail_price, r.supply_price, effMargin('C')),
          ovSet ? `${Number(r.margin_override)}%` : '',
        ]
      })
      const headers = ['product_id', '상품명', '제조사', '카테고리', '재고', '바코드', '공급범위', '제조사공급가', 'A등급가', 'B등급가', 'C등급가', '상품별마진override']
      return xlsxResponse(buildXlsx(headers, out), `supply-products-${new Date().toISOString().slice(0, 10)}.xlsx`)
    } catch (err) {
      return safeError(c, err, '상품 내보내기 중 오류가 발생했습니다', '[distributor-admin]')
    }
  })

  // PATCH /products/:id/margin-override — 상품별 등급마진 override 설정/해제 (관리자, 사용자 확정 2026-06-04)
  //   body: { margin_pct: number|null }. null/빈값 = 해제(등급별 마진 복귀). 설정 시 등급 무관 동일가.
  //   ⚠️ 가격(구매자 결제액) 직결 — wholesale.routes 의 서버 재계산이 같은 컬럼을 읽어 일괄 반영.
  app.patch('/products/:id/margin-override', async (c) => {
    try {
      await ensureSupplyVisibilitySchema(c.env.DB)
      const id = Number(c.req.param('id'))
      if (!Number.isFinite(id) || id <= 0) return c.json({ success: false, error: '잘못된 상품 ID' }, 400)
      const body = await c.req.json<{ margin_pct?: number | string | null }>().catch(() => ({} as { margin_pct?: number | string | null }))
      let val: number | null = null
      if (body.margin_pct != null && String(body.margin_pct).trim() !== '') {
        const m = Number(body.margin_pct)
        if (!Number.isFinite(m) || m < 0 || m > 500) return c.json({ success: false, error: '마진율은 0~500(%) 사이여야 합니다' }, 400)
        val = Math.round(m * 100) / 100
      }
      // 공급상품 원본(supplier 직등록)만 대상 — 셀러 복제본/일반상품 제외.
      //   변경 전 override 값도 함께 캡처 (감사로그 before).
      const prod = await c.env.DB.prepare(
        "SELECT id, supply_margin_override_pct FROM products WHERE id = ? AND is_supply_product = 1 AND supply_source_id IS NULL"
      ).bind(id).first<{ id: number; supply_margin_override_pct: number | null }>().catch(() => null)
      if (!prod) return c.json({ success: false, error: '공급상품을 찾을 수 없습니다' }, 404)
      await c.env.DB.prepare(
        "UPDATE products SET supply_margin_override_pct = ?, updated_at = datetime('now') WHERE id = ?"
      ).bind(val, id).run()
      await writeAuditLog(c, {
        action: 'wholesale_margin_override_change',
        targetType: 'product',
        targetId: String(id),
        before: { supply_margin_override_pct: prod.supply_margin_override_pct ?? null },
        after: { supply_margin_override_pct: val },
      }).catch(() => { /* audit 실패해도 성공 처리 */ })
      return c.json({ success: true, product_id: id, margin_override_pct: val })
    } catch (err) {
      return safeError(c, err, '상품별 마진 설정 중 오류가 발생했습니다', '[distributor-admin]')
    }
  })
}
