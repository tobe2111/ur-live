/** 🏭 distributor-admin: OEM/ODM 신청 관리 (제조사 매칭/상태) (byte-identical 분해). */
import type { Hono } from 'hono'
import { safeError } from '@/worker/utils/safe-error'
import { ensureOemSchema, normalizeOemStatus } from '../oem-requests'
import type { Env } from './helpers'

export function registerOemRoutes(app: Hono<{ Bindings: Env }>) {
  // ── OEM/ODM 신청 관리 (어드민) — 제조사 매칭/상태 관리 ─────────────────────────

  // GET /oem-requests?status= — 신청 목록
  app.get('/oem-requests', async (c) => {
    try {
      await ensureOemSchema(c.env.DB)
      const status = normalizeOemStatus(c.req.query('status'))
      const binds: unknown[] = []
      let where = '1=1'
      if (status) { where += ' AND r.status = ?'; binds.push(status) }
      const { results } = await c.env.DB.prepare(`
        SELECT r.id, r.distributor_seller_id, r.kind, r.product_name, r.category, r.target_qty, r.target_price,
               r.note, r.status, r.admin_memo, r.matched_supplier_id, r.created_at, r.updated_at,
               s.business_name AS distributor_business_name, s.name AS distributor_name, s.username,
               sup.business_name AS matched_supplier_name
        FROM oem_requests r
        LEFT JOIN sellers s ON s.id = r.distributor_seller_id
        LEFT JOIN suppliers sup ON sup.id = r.matched_supplier_id
        WHERE ${where} ORDER BY r.created_at DESC LIMIT 200
      `).bind(...binds).all()
      return c.json({ success: true, requests: results ?? [] })
    } catch (err) {
      return safeError(c, err, 'OEM/ODM 신청 조회 중 오류가 발생했습니다', '[distributor-admin]')
    }
  })

  // PATCH /oem-requests/:id — 상태/메모/매칭 제조사 갱신
  app.patch('/oem-requests/:id', async (c) => {
    try {
      await ensureOemSchema(c.env.DB)
      const id = Number(c.req.param('id'))
      if (!Number.isFinite(id) || id <= 0) return c.json({ success: false, error: '잘못된 ID' }, 400)
      const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
      const sets: string[] = []
      const params: (string | number | null)[] = []
      if (body.status !== undefined) {
        const st = normalizeOemStatus(body.status)
        if (!st) return c.json({ success: false, error: '잘못된 상태값입니다' }, 400)
        sets.push('status = ?'); params.push(st)
      }
      if (typeof body.admin_memo === 'string') { sets.push('admin_memo = ?'); params.push(body.admin_memo.slice(0, 2000)) }
      if (body.matched_supplier_id !== undefined) {
        const sup = body.matched_supplier_id === null || body.matched_supplier_id === '' ? null : Number(body.matched_supplier_id)
        if (sup !== null && (!Number.isFinite(sup) || sup <= 0)) return c.json({ success: false, error: '잘못된 제조사 ID' }, 400)
        if (sup !== null) {
          const exists = await c.env.DB.prepare('SELECT 1 FROM suppliers WHERE id = ?').bind(sup).first()
          if (!exists) return c.json({ success: false, error: '존재하지 않는 제조사입니다' }, 400)
        }
        sets.push('matched_supplier_id = ?'); params.push(sup)
      }
      if (!sets.length) return c.json({ success: false, error: '변경할 내용이 없습니다' }, 400)
      sets.push("updated_at = datetime('now')")
      const res = await c.env.DB.prepare(`UPDATE oem_requests SET ${sets.join(', ')} WHERE id = ?`).bind(...params, id).run()
      if (!res.meta.changes) return c.json({ success: false, error: '신청을 찾을 수 없습니다' }, 404)
      return c.json({ success: true })
    } catch (err) {
      return safeError(c, err, 'OEM/ODM 신청 처리 중 오류가 발생했습니다', '[distributor-admin]')
    }
  })
}
