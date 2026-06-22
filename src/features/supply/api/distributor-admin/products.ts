/** 🏭 distributor-admin: 공급 범위/노출 등급/선정 유통회원/공급가 이력 (byte-identical 분해). */
import type { Hono } from 'hono'
import { safeError } from '@/worker/utils/safe-error'
import { ensureSupplyVisibilitySchema, normalizeVisibility } from '../supply-visibility'
import { getSupplyMeta, setSupplyMeta } from '@/worker/utils/product-supply-meta'
import { ensureGrades, type Env } from './helpers'

export function registerProductsRoutes(app: Hono<{ Bindings: Env }>) {
  // ── 공급 범위(유통채널 선별) 관리 — 스펙: 유통스타트 유통채널 공급 → 유통회원 선정/삭제 ──────

  // PATCH /products/:id/visibility — 상품 공급 범위 설정 (ALL/APPROVED_CHANNEL/UTONGSTART_ONLY)
  app.patch('/products/:id/visibility', async (c) => {
    try {
      await ensureSupplyVisibilitySchema(c.env.DB)
      const id = Number(c.req.param('id'))
      if (!Number.isFinite(id) || id <= 0) return c.json({ success: false, error: '잘못된 상품 ID' }, 400)
      const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
      const vis = normalizeVisibility(body.supply_visibility)
      const res = await c.env.DB.prepare(
        "UPDATE products SET supply_visibility = ?, updated_at = datetime('now') WHERE id = ? AND is_supply_product = 1 AND supply_source_id IS NULL"
      ).bind(vis, id).run()
      if (!res.meta.changes) return c.json({ success: false, error: '도매 상품을 찾을 수 없습니다' }, 404)
      return c.json({ success: true, supply_visibility: vis })
    } catch (err) {
      return safeError(c, err, '공급 범위 설정 중 오류가 발생했습니다', '[distributor-admin]')
    }
  })

  // PATCH /products/:id/visible-grades — 🏷️ 2026-06-18 상품별 '노출 등급' 설정.
  //   visible_grades = 이 상품을 노출할 판매사 등급 집합(CSV). **빈 배열 = 전체 노출(제한 해제, 현행)**.
  //   product_supply_meta(K-V) 에 저장 → 카탈로그/홈/상세/주문/내보내기/미리보기 9개 경로가 gradeExposureWhere 로 강제.
  app.patch('/products/:id/visible-grades', async (c) => {
    try {
      await ensureSupplyVisibilitySchema(c.env.DB)
      await ensureGrades(c.env.DB)
      const id = Number(c.req.param('id'))
      if (!Number.isFinite(id) || id <= 0) return c.json({ success: false, error: '잘못된 상품 ID' }, 400)
      const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
      const raw: unknown[] = Array.isArray(body.visible_grades) ? body.visible_grades : String(body.visible_grades ?? '').split(',')
      const requested = raw.map((g: unknown) => String(g).trim().toUpperCase()).filter(Boolean)
      // 존재하는 활성 등급만 허용(오타/주입 방지). 빈 집합이면 제한 해제(전체 노출).
      const { results: gradeRows } = await c.env.DB.prepare('SELECT grade FROM distributor_grades WHERE active = 1')
        .all<{ grade: string }>().catch(() => ({ results: [] as { grade: string }[] }))
      const valid = new Set((gradeRows || []).map((r) => r.grade.toUpperCase()))
      const grades = [...new Set(requested.filter((g) => valid.has(g)))]
      const prod = await c.env.DB.prepare(
        'SELECT 1 FROM products WHERE id = ? AND is_supply_product = 1 AND supply_source_id IS NULL'
      ).bind(id).first()
      if (!prod) return c.json({ success: false, error: '도매 상품을 찾을 수 없습니다' }, 404)
      await setSupplyMeta(c.env.DB, id, { visible_grades: grades.join(',') })
      return c.json({ success: true, visible_grades: grades })
    } catch (err) {
      return safeError(c, err, '노출 등급 설정 중 오류가 발생했습니다', '[distributor-admin]')
    }
  })

  // GET /product-access?product_id= — 해당 상품에 선정된 유통회원 목록 + 상품 가시성
  app.get('/product-access', async (c) => {
    try {
      await ensureSupplyVisibilitySchema(c.env.DB)
      const productId = Number(c.req.query('product_id'))
      if (!Number.isFinite(productId) || productId <= 0) return c.json({ success: false, error: '상품을 선택해주세요' }, 400)
      const prod = await c.env.DB.prepare(
        "SELECT id, name, COALESCE(supply_visibility,'ALL') AS supply_visibility FROM products WHERE id = ? AND is_supply_product = 1"
      ).bind(productId).first<{ id: number; name: string; supply_visibility: string }>()
      if (!prod) return c.json({ success: false, error: '도매 상품을 찾을 수 없습니다' }, 404)
      const { results } = await c.env.DB.prepare(`
        SELECT pda.id, pda.distributor_seller_id, pda.created_at,
               s.business_name, s.name AS seller_name, s.username, s.distributor_grade
        FROM product_distributor_access pda LEFT JOIN sellers s ON s.id = pda.distributor_seller_id
        WHERE pda.product_id = ? ORDER BY pda.created_at DESC
      `).bind(productId).all()
      // 🏷️ 2026-06-18 등급별 노출 — 현재 visible_grades(상품 메타) + 선택 가능한 전체 등급 목록(체크박스용).
      await ensureGrades(c.env.DB)
      const meta = (await getSupplyMeta(c.env.DB, [productId]).catch(() => undefined))?.get(productId)
      const visibleGrades = String(meta?.visible_grades || '').split(',').map((s) => s.trim()).filter(Boolean)
      const { results: allGrades } = await c.env.DB.prepare(
        'SELECT grade, label FROM distributor_grades WHERE active = 1 ORDER BY sort_order ASC'
      ).all<{ grade: string; label: string | null }>().catch(() => ({ results: [] as { grade: string; label: string | null }[] }))
      return c.json({ success: true, product: prod, visible_grades: visibleGrades, all_grades: allGrades ?? [], distributors: results ?? [] })
    } catch (err) {
      return safeError(c, err, '선정 판매사 조회 중 오류가 발생했습니다', '[distributor-admin]')
    }
  })

  // POST /product-access — 유통회원 선정 (허용목록 추가)
  app.post('/product-access', async (c) => {
    try {
      await ensureSupplyVisibilitySchema(c.env.DB)
      const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
      const productId = Number(body.product_id)
      const sellerId = Number(body.distributor_seller_id)
      if (!Number.isFinite(productId) || productId <= 0 || !Number.isFinite(sellerId) || sellerId <= 0) {
        return c.json({ success: false, error: '상품과 판매사를 선택해주세요' }, 400)
      }
      const prod = await c.env.DB.prepare(
        "SELECT 1 FROM products WHERE id = ? AND is_supply_product = 1 AND supply_source_id IS NULL"
      ).bind(productId).first()
      if (!prod) return c.json({ success: false, error: '도매 상품이 아닙니다' }, 400)
      const seller = await c.env.DB.prepare('SELECT 1 FROM sellers WHERE id = ?').bind(sellerId).first()
      if (!seller) return c.json({ success: false, error: '존재하지 않는 판매사입니다' }, 400)
      const adminId = Number(((c.get as (k: string) => unknown)('user') as { id?: number } | undefined)?.id) || null
      await c.env.DB.prepare(
        'INSERT OR IGNORE INTO product_distributor_access (product_id, distributor_seller_id, granted_by) VALUES (?, ?, ?)'
      ).bind(productId, sellerId, adminId).run()
      return c.json({ success: true })
    } catch (err) {
      return safeError(c, err, '판매사 선정 중 오류가 발생했습니다', '[distributor-admin]')
    }
  })

  // DELETE /product-access/:id — 선정 해제
  app.delete('/product-access/:id', async (c) => {
    try {
      const id = Number(c.req.param('id'))
      if (!Number.isFinite(id) || id <= 0) return c.json({ success: false, error: '잘못된 ID' }, 400)
      await c.env.DB.prepare('DELETE FROM product_distributor_access WHERE id = ?').bind(id).run()
      return c.json({ success: true })
    } catch (err) {
      return safeError(c, err, '선정 해제 중 오류가 발생했습니다', '[distributor-admin]')
    }
  })

  // GET /price-history?product_id= — 공급가 수정 이력 (관리자만 — 스펙: 수정 전 금액 기록)
  app.get('/price-history', async (c) => {
    try {
      await ensureSupplyVisibilitySchema(c.env.DB)
      const productId = Number(c.req.query('product_id'))
      if (!Number.isFinite(productId) || productId <= 0) return c.json({ success: false, error: '상품을 선택해주세요' }, 400)
      const { results } = await c.env.DB.prepare(`
        SELECT id, product_id, supplier_id, old_supply_price, new_supply_price, changed_by, created_at
        FROM supply_price_history WHERE product_id = ? ORDER BY created_at DESC LIMIT 100
      `).bind(productId).all()
      return c.json({ success: true, history: results ?? [] })
    } catch (err) {
      return safeError(c, err, '공급가 이력 조회 중 오류가 발생했습니다', '[distributor-admin]')
    }
  })
}
