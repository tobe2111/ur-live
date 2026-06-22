/** 🏭 distributor-admin: 수량 구간 할인(volume tier) 조회/일괄설정 (byte-identical 분해). */
import type { Hono } from 'hono'
import { safeError } from '@/worker/utils/safe-error'
import { ensureSupplyVisibilitySchema } from '../supply-visibility'
import type { Env } from './helpers'

export function registerQtyTiersRoutes(app: Hono<{ Bindings: Env }>) {
  // GET/PUT /products/:id/qty-tiers — 수량 구간 할인(volume tier) 조회/일괄설정 (관리자, 2026-06-04)
  //   tier = 등급가 위에 "min_qty 이상 구매 시 discount_pct% 추가 할인". 전체 교체(replace).
  //   ⚠️ 결제액 직결 — wholesale.routes /orders 가 같은 tier 를 읽어 authoritative 단가 재계산.
  app.get('/products/:id/qty-tiers', async (c) => {
    try {
      await ensureSupplyVisibilitySchema(c.env.DB)
      const id = Number(c.req.param('id'))
      if (!Number.isFinite(id) || id <= 0) return c.json({ success: false, error: '잘못된 상품 ID' }, 400)
      const { results } = await c.env.DB.prepare(
        'SELECT min_qty, discount_pct FROM product_qty_tiers WHERE product_id = ? ORDER BY min_qty ASC'
      ).bind(id).all<{ min_qty: number; discount_pct: number }>()
      return c.json({ success: true, tiers: results || [] })
    } catch (err) {
      return safeError(c, err, '수량 구간 조회 중 오류가 발생했습니다', '[distributor-admin]')
    }
  })

  app.put('/products/:id/qty-tiers', async (c) => {
    try {
      await ensureSupplyVisibilitySchema(c.env.DB)
      const id = Number(c.req.param('id'))
      if (!Number.isFinite(id) || id <= 0) return c.json({ success: false, error: '잘못된 상품 ID' }, 400)
      const prod = await c.env.DB.prepare(
        "SELECT id FROM products WHERE id = ? AND is_supply_product = 1 AND supply_source_id IS NULL"
      ).bind(id).first<{ id: number }>().catch(() => null)
      if (!prod) return c.json({ success: false, error: '공급상품을 찾을 수 없습니다' }, 404)

      const body = await c.req.json<{ tiers?: Array<{ min_qty?: number; discount_pct?: number }> }>().catch(() => ({} as { tiers?: Array<{ min_qty?: number; discount_pct?: number }> }))
      const raw = Array.isArray(body.tiers) ? body.tiers : []
      // 정규화 + 검증: min_qty>=1, discount 0~90, min_qty 중복 제거(마지막 우선).
      const dedup = new Map<number, number>()
      for (const t of raw) {
        const mq = Math.floor(Number(t.min_qty))
        const dp = Number(t.discount_pct)
        if (!Number.isFinite(mq) || mq < 1 || mq > 1000000) return c.json({ success: false, error: '최소 수량은 1 이상이어야 합니다' }, 400)
        if (!Number.isFinite(dp) || dp <= 0 || dp > 90) return c.json({ success: false, error: '할인율은 0 초과 90 이하(%)여야 합니다' }, 400)
        dedup.set(mq, Math.round(dp * 100) / 100)
      }
      // 전체 교체.
      await c.env.DB.prepare('DELETE FROM product_qty_tiers WHERE product_id = ?').bind(id).run()
      const entries = [...dedup.entries()].sort((a, b) => a[0] - b[0])
      if (entries.length) {
        const stmts = entries.map(([mq, dp]) =>
          c.env.DB.prepare('INSERT INTO product_qty_tiers (product_id, min_qty, discount_pct) VALUES (?, ?, ?)').bind(id, mq, dp))
        await c.env.DB.batch(stmts)
      }
      return c.json({ success: true, product_id: id, tiers: entries.map(([min_qty, discount_pct]) => ({ min_qty, discount_pct })) })
    } catch (err) {
      return safeError(c, err, '수량 구간 설정 중 오류가 발생했습니다', '[distributor-admin]')
    }
  })
}
