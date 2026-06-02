/**
 * 🏭 2026-06-01 유통스타트 도매몰 — 어드민 유통사 등급/마진 설정 API.
 * (docs/design/wholesale-utongstart.md, Phase 1b)
 *
 * - GET   /api/admin/distributor/grades              — 등급별 마진율 목록
 * - PUT   /api/admin/distributor/grades/:grade       — 등급 마진율/라벨/활성 수정
 * - GET   /api/admin/distributor/distributors?search= — 유통사(셀러) 검색 + 배정현황
 * - PATCH /api/admin/distributor/distributors/:id     — 유통사 등급 배정 + 특별할인 기간
 *
 * ⚠️ 도매몰 한정: distributor_grade 는 도매 카탈로그 가격 계산에서만 읽힘 — 일반 셀러 동작 불변.
 * 마운트: app.route('/api/admin/distributor', distributorAdminRoutes)
 */
import { Hono } from 'hono'
import { safeError } from '@/worker/utils/safe-error'
import type { Env } from '@/worker/types/env'
import { requireAdmin } from '@/worker/middleware/auth'
import { swallow } from '@/worker/utils/swallow'

const app = new Hono<{ Bindings: Env }>()
app.use('*', requireAdmin())

const ASSIGNABLE = ['A', 'B', 'C', 'D', 'OEM'] // SPECIAL 은 직접 배정 X — 특별할인 기간으로만 적용

const _ensured = new WeakSet<object>()
async function ensureGrades(db: D1Database) {
  if (_ensured.has(db)) return
  _ensured.add(db)
  await db.prepare(`CREATE TABLE IF NOT EXISTS distributor_grades (
    grade TEXT PRIMARY KEY,
    label TEXT,
    margin_pct REAL NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_special INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    updated_at DATETIME DEFAULT (datetime('now'))
  )`).run().catch(swallow('distributor-admin:create-table'))
  await db.prepare(`INSERT OR IGNORE INTO distributor_grades (grade, label, margin_pct, sort_order, is_special) VALUES
    ('A','A등급',10,1,0),('B','B등급',15,2,0),('C','C등급',20,3,0),
    ('D','D등급(기본)',25,4,0),('OEM','OEM',8,5,0),('SPECIAL','특별할인(기간한정)',0,9,1)`)
    .run().catch(swallow('distributor-admin:seed'))
}

// ── GET /grades ──────────────────────────────────────────────────────────────
app.get('/grades', async (c) => {
  try {
    await ensureGrades(c.env.DB)
    const { results } = await c.env.DB.prepare(
      `SELECT grade, label, margin_pct, sort_order, is_special, active, updated_at
       FROM distributor_grades ORDER BY sort_order ASC`
    ).all()
    return c.json({ success: true, grades: results ?? [] })
  } catch (err) {
    return safeError(c, err, '등급 조회 중 오류가 발생했습니다', '[distributor-admin]')
  }
})

// ── PUT /grades/:grade ───────────────────────────────────────────────────────
app.put('/grades/:grade', async (c) => {
  try {
    await ensureGrades(c.env.DB)
    const grade = c.req.param('grade').toUpperCase()
    const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
    const margin = Number(body.margin_pct)
    if (!Number.isFinite(margin) || margin < 0 || margin > 100) {
      return c.json({ success: false, error: '마진율은 0~100% 사이여야 합니다' }, 400)
    }
    const label = typeof body.label === 'string' ? body.label.slice(0, 40) : null
    const active = body.active === false ? 0 : 1
    const res = await c.env.DB.prepare(
      `UPDATE distributor_grades SET margin_pct=?, label=COALESCE(?,label), active=?, updated_at=datetime('now') WHERE grade=?`
    ).bind(margin, label, active, grade).run()
    if (!res.meta.changes) return c.json({ success: false, error: '존재하지 않는 등급입니다' }, 404)
    return c.json({ success: true })
  } catch (err) {
    return safeError(c, err, '등급 수정 중 오류가 발생했습니다', '[distributor-admin]')
  }
})

// ── GET /distributors?search=&assigned=1 ─────────────────────────────────────
app.get('/distributors', async (c) => {
  try {
    const search = (c.req.query('search') || '').trim().slice(0, 60)
    const onlyAssigned = c.req.query('assigned') === '1'
    const binds: unknown[] = []
    let where = '1=1'
    if (onlyAssigned) where += ' AND distributor_grade IS NOT NULL'
    if (search) {
      where += ' AND (username LIKE ? OR name LIKE ? OR business_name LIKE ? OR email LIKE ?)'
      const like = `%${search}%`
      binds.push(like, like, like, like)
    }
    const { results } = await c.env.DB.prepare(
      `SELECT id, username, name, business_name, email, seller_type, distributor_grade, special_discount_until
       FROM sellers WHERE ${where}
       ORDER BY (distributor_grade IS NOT NULL) DESC, id DESC LIMIT 100`
    ).bind(...binds).all()
    return c.json({ success: true, distributors: results ?? [] })
  } catch (err) {
    return safeError(c, err, '유통사 조회 중 오류가 발생했습니다', '[distributor-admin]')
  }
})

// ── PATCH /distributors/:id ──────────────────────────────────────────────────
app.patch('/distributors/:id', async (c) => {
  try {
    const id = Number(c.req.param('id'))
    if (!Number.isFinite(id) || id <= 0) return c.json({ success: false, error: '잘못된 유통사 ID' }, 400)
    const body = await c.req.json().catch(() => ({} as Record<string, unknown>))

    // 등급: A/B/C/D/OEM 또는 해제(null/'')
    let grade: string | null = null
    if (body.distributor_grade !== null && body.distributor_grade !== '' && body.distributor_grade !== undefined) {
      const g = String(body.distributor_grade).toUpperCase()
      if (!ASSIGNABLE.includes(g)) {
        return c.json({ success: false, error: '등급은 A/B/C/D/OEM 또는 해제만 가능합니다' }, 400)
      }
      grade = g
    }

    // 특별할인 종료일: ISO 또는 null
    let special: string | null = null
    if (body.special_discount_until) {
      const d = new Date(String(body.special_discount_until))
      if (Number.isNaN(d.getTime())) return c.json({ success: false, error: '특별할인 종료일 형식 오류' }, 400)
      special = d.toISOString()
    }

    const res = await c.env.DB.prepare(
      `UPDATE sellers SET distributor_grade=?, special_discount_until=?, updated_at=datetime('now') WHERE id=?`
    ).bind(grade, special, id).run()
    if (!res.meta.changes) return c.json({ success: false, error: '존재하지 않는 유통사입니다' }, 404)
    return c.json({ success: true })
  } catch (err) {
    return safeError(c, err, '유통사 등급 설정 중 오류가 발생했습니다', '[distributor-admin]')
  }
})

// ── 상품제안 (어드민 → 유통사) ────────────────────────────────────────────────
async function ensureProposals(db: D1Database) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS wholesale_proposals (
    id INTEGER PRIMARY KEY AUTOINCREMENT, distributor_seller_id INTEGER NOT NULL, product_id INTEGER NOT NULL,
    note TEXT, status TEXT NOT NULL DEFAULT 'active', created_at DATETIME DEFAULT (datetime('now'))
  )`).run().catch(swallow('distributor-admin:ensure-proposals'))
}

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

// ── GET /tax-summary?month=YYYY-MM — 세금계산서 집계 (1차 수동 발행 참고) ───────
//   유통스타트→유통사 매출(유통사별 매입합) + 제조사→유통스타트 매입(제조사별 정산합).
app.get('/tax-summary', async (c) => {
  try {
    const month = (c.req.query('month') || '').slice(0, 7)
    const m = /^\d{4}-\d{2}$/.test(month) ? month : new Date().toISOString().slice(0, 7)

    const byDistributor = await c.env.DB.prepare(`
      SELECT o.distributor_seller_id AS seller_id, s.business_name, s.name,
             COUNT(*) AS order_count, COALESCE(SUM(o.subtotal),0) AS sales_total
      FROM wholesale_orders o LEFT JOIN sellers s ON s.id = o.distributor_seller_id
      WHERE o.status IN ('PAID','SHIPPED') AND strftime('%Y-%m', COALESCE(o.paid_at, o.created_at)) = ?
      GROUP BY o.distributor_seller_id ORDER BY sales_total DESC
    `).bind(m).all().catch(() => ({ results: [] }))

    const bySupplier = await c.env.DB.prepare(`
      SELECT i.supplier_id, sup.business_name,
             COALESCE(SUM(i.base_supply_price * i.qty),0) AS purchase_total, COUNT(DISTINCT i.wholesale_order_id) AS order_count
      FROM wholesale_order_items i
      JOIN wholesale_orders o ON o.id = i.wholesale_order_id
      LEFT JOIN suppliers sup ON sup.id = i.supplier_id
      WHERE o.status IN ('PAID','SHIPPED') AND strftime('%Y-%m', COALESCE(o.paid_at, o.created_at)) = ?
      GROUP BY i.supplier_id ORDER BY purchase_total DESC
    `).bind(m).all().catch(() => ({ results: [] }))

    return c.json({ success: true, month: m, by_distributor: byDistributor.results ?? [], by_supplier: bySupplier.results ?? [] })
  } catch (err) {
    return safeError(c, err, '세금 집계 조회 중 오류가 발생했습니다', '[distributor-admin]')
  }
})

export { app as distributorAdminRoutes }
