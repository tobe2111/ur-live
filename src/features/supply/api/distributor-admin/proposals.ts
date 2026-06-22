/** 🏭 distributor-admin: 상품제안 (어드민 → 유통사) (byte-identical 분해). */
import type { Hono } from 'hono'
import { safeError } from '@/worker/utils/safe-error'
import { ensureProposals, type Env } from './helpers'

export function registerProposalsRoutes(app: Hono<{ Bindings: Env }>) {
  // POST /proposals — 제안 생성
  app.post('/proposals', async (c) => {
    try {
      await ensureProposals(c.env.DB)
      const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
      const sellerId = Number(body.distributor_seller_id)
      const productId = Number(body.product_id)
      const note = typeof body.note === 'string' ? body.note.slice(0, 200) : null
      if (!Number.isFinite(sellerId) || sellerId <= 0 || !Number.isFinite(productId) || productId <= 0) {
        return c.json({ success: false, error: '유통사와 상품을 선택해주세요' }, 400)
      }
      // 상품이 도매 상품인지 확인.
      const prod = await c.env.DB.prepare(
        "SELECT 1 FROM products WHERE id = ? AND is_supply_product = 1 AND supply_source_id IS NULL"
      ).bind(productId).first()
      if (!prod) return c.json({ success: false, error: '도매 상품이 아닙니다' }, 400)
      await c.env.DB.prepare(
        "INSERT INTO wholesale_proposals (distributor_seller_id, product_id, note, status) VALUES (?, ?, ?, 'active')"
      ).bind(sellerId, productId, note).run()
      return c.json({ success: true })
    } catch (err) {
      return safeError(c, err, '제안 생성 중 오류가 발생했습니다', '[distributor-admin]')
    }
  })

  // GET /proposals?seller_id= — 제안 목록
  app.get('/proposals', async (c) => {
    try {
      await ensureProposals(c.env.DB)
      const sellerId = Number(c.req.query('seller_id'))
      const binds: unknown[] = []
      let where = "wp.status = 'active'"
      if (Number.isFinite(sellerId) && sellerId > 0) { where += ' AND wp.distributor_seller_id = ?'; binds.push(sellerId) }
      const { results } = await c.env.DB.prepare(`
        SELECT wp.id, wp.distributor_seller_id, wp.note, wp.created_at, p.name AS product_name, p.id AS product_id
        FROM wholesale_proposals wp JOIN products p ON p.id = wp.product_id
        WHERE ${where} ORDER BY wp.created_at DESC LIMIT 200
      `).bind(...binds).all()
      return c.json({ success: true, proposals: results ?? [] })
    } catch (err) {
      return safeError(c, err, '제안 조회 중 오류가 발생했습니다', '[distributor-admin]')
    }
  })

  // DELETE /proposals/:id — 제안 철회
  app.delete('/proposals/:id', async (c) => {
    try {
      await ensureProposals(c.env.DB)
      const id = Number(c.req.param('id'))
      if (!Number.isFinite(id) || id <= 0) return c.json({ success: false, error: '잘못된 ID' }, 400)
      await c.env.DB.prepare("UPDATE wholesale_proposals SET status = 'withdrawn' WHERE id = ?").bind(id).run()
      return c.json({ success: true })
    } catch (err) {
      return safeError(c, err, '제안 철회 중 오류가 발생했습니다', '[distributor-admin]')
    }
  })
}
