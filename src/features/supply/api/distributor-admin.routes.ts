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
import { cancelTossPayment } from '@/worker/utils/toss-gateway'
import { reverseSupplierOnWholesaleRefund } from './wholesale-settlement'
import { ensureSupplyVisibilitySchema, normalizeVisibility } from './supply-visibility'
import { ensureOemSchema, normalizeOemStatus } from './oem-requests'
import { buildXlsx, xlsxResponse } from './xlsx'
import { distributorPrice, marginForGrade, type GradeMargin } from '@/lib/distributor-pricing'
import { ensureTaxDocSchema, splitVat, renderTaxDocHtml, type TaxDocRow } from './tax-documents'
import { isBarobillConfigured, issueBarobillTaxInvoice, type BarobillEnv } from '@/services/barobill'

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
    ('A','A등급',10,1,0),('B','B등급',15,2,0),('C','C등급(기본)',20,3,0),
    ('D','D등급',25,4,0),('OEM','OEM',8,5,0),('SPECIAL','특별할인(기간한정)',0,9,1)`)
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
             COUNT(*) AS order_count, COALESCE(SUM(MAX(0, o.subtotal - COALESCE(o.refunded_amount,0))),0) AS sales_total
      FROM wholesale_orders o LEFT JOIN sellers s ON s.id = o.distributor_seller_id
      WHERE o.status IN ('PAID','SHIPPED','PARTIAL_REFUNDED') AND strftime('%Y-%m', COALESCE(o.paid_at, o.created_at)) = ?
      GROUP BY o.distributor_seller_id ORDER BY sales_total DESC
    `).bind(m).all().catch(() => ({ results: [] }))

    const bySupplier = await c.env.DB.prepare(`
      SELECT i.supplier_id, sup.business_name,
             COALESCE(SUM(i.base_supply_price * i.qty),0) AS purchase_total, COUNT(DISTINCT i.wholesale_order_id) AS order_count
      FROM wholesale_order_items i
      JOIN wholesale_orders o ON o.id = i.wholesale_order_id
      LEFT JOIN suppliers sup ON sup.id = i.supplier_id
      WHERE o.status IN ('PAID','SHIPPED','PARTIAL_REFUNDED') AND strftime('%Y-%m', COALESCE(o.paid_at, o.created_at)) = ?
        AND i.line_status != 'REFUNDED'
      GROUP BY i.supplier_id ORDER BY purchase_total DESC
    `).bind(m).all().catch(() => ({ results: [] }))

    return c.json({ success: true, month: m, by_distributor: byDistributor.results ?? [], by_supplier: bySupplier.results ?? [] })
  } catch (err) {
    return safeError(c, err, '세금 집계 조회 중 오류가 발생했습니다', '[distributor-admin]')
  }
})

// ── 도매주문 모니터 (어드민 오버사이트) ───────────────────────────────────────
// GET /orders?status=&search=&page= — 전체 B2B 도매 주문
app.get('/orders', async (c) => {
  try {
    const status = (c.req.query('status') || '').toUpperCase()
    const search = (c.req.query('search') || '').trim().slice(0, 60)
    const page = Math.max(1, parseInt(c.req.query('page') || '1', 10))
    const limit = Math.min(parseInt(c.req.query('limit') || '30', 10), 100)
    const offset = (page - 1) * limit
    const VALID = ['PENDING', 'PAID', 'SHIPPED', 'PARTIAL_REFUNDED', 'REFUNDED', 'FAILED']
    const binds: unknown[] = []
    let where = '1=1'
    if (VALID.includes(status)) { where += ' AND o.status = ?'; binds.push(status) }
    if (search) { where += ' AND (s.business_name LIKE ? OR s.name LIKE ? OR s.username LIKE ?)'; const l = `%${search}%`; binds.push(l, l, l) }
    const { results } = await c.env.DB.prepare(`
      SELECT o.id, o.distributor_seller_id, o.status, o.grade, o.subtotal, o.supply_total, o.margin_total,
             o.refunded_amount, o.created_at, o.paid_at,
             s.business_name, s.name AS seller_name, s.username,
             (SELECT COUNT(*) FROM wholesale_order_items wi WHERE wi.wholesale_order_id = o.id) AS item_count
      FROM wholesale_orders o LEFT JOIN sellers s ON s.id = o.distributor_seller_id
      WHERE ${where} ORDER BY o.created_at DESC LIMIT ? OFFSET ?
    `).bind(...binds, limit, offset).all().catch(() => ({ results: [] }))
    const totalRow = await c.env.DB.prepare(`SELECT COUNT(*) AS c FROM wholesale_orders o LEFT JOIN sellers s ON s.id = o.distributor_seller_id WHERE ${where}`)
      .bind(...binds).first<{ c: number }>().catch(() => ({ c: 0 }))
    return c.json({ success: true, orders: results ?? [], total: totalRow?.c ?? 0, page, limit })
  } catch (err) {
    return safeError(c, err, '도매주문 조회 중 오류가 발생했습니다', '[distributor-admin]')
  }
})

// GET /orders/:id — 주문 상세 (라인별 제조사/금액)
app.get('/orders/:id', async (c) => {
  try {
    const id = Number(c.req.param('id'))
    if (!Number.isFinite(id) || id <= 0) return c.json({ success: false, error: '잘못된 주문 ID' }, 400)
    const order = await c.env.DB.prepare(`
      SELECT o.*, s.business_name, s.name AS seller_name, s.username
      FROM wholesale_orders o LEFT JOIN sellers s ON s.id = o.distributor_seller_id WHERE o.id = ?
    `).bind(id).first()
    if (!order) return c.json({ success: false, error: '주문을 찾을 수 없습니다' }, 404)
    const { results } = await c.env.DB.prepare(`
      SELECT i.product_id, i.name, i.qty, i.base_supply_price, i.distributor_unit_price, i.line_total,
             i.line_status, i.courier, i.tracking_number, i.supplier_id, sup.business_name AS supplier_name
      FROM wholesale_order_items i LEFT JOIN suppliers sup ON sup.id = i.supplier_id
      WHERE i.wholesale_order_id = ?
    `).bind(id).all().catch(() => ({ results: [] }))
    return c.json({ success: true, order, items: results ?? [] })
  } catch (err) {
    return safeError(c, err, '주문 조회 중 오류가 발생했습니다', '[distributor-admin]')
  }
})

// POST /orders/:id/refund — 어드민 강제 전액 환불 (분쟁/멈춘 주문 개입)
app.post('/orders/:id/refund', async (c) => {
  try {
    const id = Number(c.req.param('id'))
    if (!Number.isFinite(id) || id <= 0) return c.json({ success: false, error: '잘못된 주문 ID' }, 400)
    const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
    const reason = String(body.reason || '관리자 환불').slice(0, 100)

    const order = await c.env.DB.prepare(
      'SELECT id, status, payment_key, subtotal, refunded_amount FROM wholesale_orders WHERE id = ?'
    ).bind(id).first<{ id: number; status: string; payment_key: string | null; subtotal: number; refunded_amount: number }>()
    if (!order) return c.json({ success: false, error: '주문을 찾을 수 없습니다' }, 404)
    if (order.status === 'REFUNDED') return c.json({ success: true, already: true })
    if (!['PAID', 'SHIPPED', 'PARTIAL_REFUNDED'].includes(order.status) || !order.payment_key) {
      return c.json({ success: false, error: '환불할 수 없는 주문 상태입니다' }, 400)
    }
    // 남은 환불 가능액 = subtotal - 이미 환불액.
    const remaining = Math.max(0, (order.subtotal || 0) - (order.refunded_amount || 0))
    if (remaining <= 0) return c.json({ success: false, error: '환불할 잔액이 없습니다' }, 400)

    // CAS claim.
    const claim = await c.env.DB.prepare(
      "UPDATE wholesale_orders SET status='REFUNDED', refunded_amount = subtotal WHERE id = ? AND status IN ('PAID','SHIPPED','PARTIAL_REFUNDED')"
    ).bind(id).run()
    if ((claim.meta?.changes ?? 0) === 0) return c.json({ success: true, already: true })

    const res = await cancelTossPayment({
      env: c.env, paymentKey: order.payment_key, cancelReason: reason,
      cancelAmount: remaining, idempotencyKey: `whs-admin-refund-${id}`,
    })
    if (!res.ok) {
      // 롤백.
      await c.env.DB.prepare("UPDATE wholesale_orders SET status='PAID', refunded_amount=? WHERE id=? AND status='REFUNDED'")
        .bind(order.refunded_amount || 0, id).run().catch(() => {})
      return c.json({ success: false, error: res.message || '환불 처리에 실패했습니다', code: res.code }, 402)
    }

    // 남은 모든 라인 REFUNDED + 정산 역전(전체) + 재고복원.
    await c.env.DB.prepare("UPDATE wholesale_order_items SET line_status='REFUNDED' WHERE wholesale_order_id = ? AND line_status != 'REFUNDED'").bind(id).run().catch(() => {})
    try { await reverseSupplierOnWholesaleRefund(c.env.DB, id, reason) } catch { /* best-effort */ }
    const lines = await c.env.DB.prepare("SELECT product_id, qty FROM wholesale_order_items WHERE wholesale_order_id = ?")
      .bind(id).all<{ product_id: number; qty: number }>().catch(() => ({ results: [] as { product_id: number; qty: number }[] }))
    for (const l of lines.results || []) {
      await c.env.DB.prepare(
        "UPDATE products SET stock = COALESCE(stock,0) + ?, sold_count = MAX(0, COALESCE(sold_count,0) - ?), updated_at = datetime('now') WHERE id = ? AND stock IS NOT NULL"
      ).bind(l.qty, l.qty, l.product_id).run().catch(() => {})
    }
    return c.json({ success: true, refunded_amount: remaining })
  } catch (err) {
    return safeError(c, err, '환불 처리 중 오류가 발생했습니다', '[distributor-admin]')
  }
})

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
    return c.json({ success: true, product: prod, distributors: results ?? [] })
  } catch (err) {
    return safeError(c, err, '선정 유통회원 조회 중 오류가 발생했습니다', '[distributor-admin]')
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
      return c.json({ success: false, error: '상품과 유통회원을 선택해주세요' }, 400)
    }
    const prod = await c.env.DB.prepare(
      "SELECT 1 FROM products WHERE id = ? AND is_supply_product = 1 AND supply_source_id IS NULL"
    ).bind(productId).first()
    if (!prod) return c.json({ success: false, error: '도매 상품이 아닙니다' }, 400)
    const seller = await c.env.DB.prepare('SELECT 1 FROM sellers WHERE id = ?').bind(sellerId).first()
    if (!seller) return c.json({ success: false, error: '존재하지 않는 유통회원입니다' }, 400)
    const adminId = Number(((c.get as (k: string) => unknown)('user') as { id?: number } | undefined)?.id) || null
    await c.env.DB.prepare(
      'INSERT OR IGNORE INTO product_distributor_access (product_id, distributor_seller_id, granted_by) VALUES (?, ?, ?)'
    ).bind(productId, sellerId, adminId).run()
    return c.json({ success: true })
  } catch (err) {
    return safeError(c, err, '유통회원 선정 중 오류가 발생했습니다', '[distributor-admin]')
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

// GET /products/export — 상품정보 엑셀(CSV) 다운로드 (등급별 공급가 A/B/C 컬럼 — 유통채널 제안용)
app.get('/products/export', async (c) => {
  try {
    await ensureSupplyVisibilitySchema(c.env.DB)
    const gradesRes = await c.env.DB.prepare('SELECT grade, margin_pct, is_special FROM distributor_grades WHERE active = 1')
      .all<{ grade: string; margin_pct: number; is_special: number }>().catch(() => ({ results: [] as { grade: string; margin_pct: number; is_special: number }[] }))
    const table: GradeMargin[] = (gradesRes.results || []).map(r => ({ grade: r.grade, margin_pct: r.margin_pct, is_special: !!r.is_special }))
    const rows = await c.env.DB.prepare(`
      SELECT p.id, p.name, p.category, p.stock, p.barcode, COALESCE(p.supply_visibility,'ALL') AS supply_visibility,
             COALESCE(p.supply_price,0) AS supply_price, sup.business_name AS supplier_name
      FROM products p LEFT JOIN suppliers sup ON sup.id = p.supplier_id
      WHERE p.is_supply_product = 1 AND p.supply_source_id IS NULL
      ORDER BY p.created_at DESC LIMIT 10000
    `).all<{ id: number; name: string; category: string | null; stock: number; barcode: string | null; supply_visibility: string; supply_price: number; supplier_name: string | null }>()
    const out = (rows.results || []).map(r => ([
      r.id, r.name, r.supplier_name || '', r.category || '', r.stock, r.barcode || '', r.supply_visibility, r.supply_price,
      distributorPrice(r.supply_price, marginForGrade('A', table)),
      distributorPrice(r.supply_price, marginForGrade('B', table)),
      distributorPrice(r.supply_price, marginForGrade('C', table)),
    ]))
    const headers = ['product_id', '상품명', '제조사', '카테고리', '재고', '바코드', '공급범위', '제조사공급가', 'A등급가', 'B등급가', 'C등급가']
    return xlsxResponse(buildXlsx(headers, out), `supply-products-${new Date().toISOString().slice(0, 10)}.xlsx`)
  } catch (err) {
    return safeError(c, err, '상품 내보내기 중 오류가 발생했습니다', '[distributor-admin]')
  }
})

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

    // 매출(유통스타트→유통사): 유통사별 순매출(subtotal − 환불액) 합. 부분/전액 환불분 차감.
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
      `).bind(docType, month, r.seller_id, r.business_name || r.name || `유통사#${r.seller_id}`, supply, vat, total, r.order_count).run().catch(() => null)
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
//   매출(sales=유통스타트→유통사) 방향만. 발행자=유통스타트(바로빌 계정), 공급받는자=유통사.
//   매입(제조사→유통스타트)은 제조사가 발행하는 것이라 플랫폼 계정으로 발행 불가(역발행 별도).
//   자격증명(BAROBILL_*) 또는 플랫폼 사업자정보 미설정 시 actionable 에러(fail-soft).
app.post('/tax-documents/:id/issue-nts', async (c) => {
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

    // 공급받는자(유통사).
    const seller = await c.env.DB.prepare(
      'SELECT business_number, business_name, name, email, phone FROM sellers WHERE id = ?'
    ).bind(doc.distributor_seller_id).first<{ business_number: string | null; business_name: string | null; name: string | null; email: string | null; phone: string | null }>()
    if (!seller) return c.json({ success: false, error: '유통사 정보를 찾을 수 없습니다' }, 404)

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
        buyerBusinessName: seller.business_name || seller.name || `유통사#${doc.distributor_seller_id}`,
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
      await c.env.DB.prepare("UPDATE tax_documents SET external_status='failed' WHERE id=?").bind(id).run().catch(() => {})
      return c.json({ success: false, error: e instanceof Error ? e.message : '전자세금계산서 발행 실패' }, 502)
    }
    if (!result.success) {
      await c.env.DB.prepare("UPDATE tax_documents SET external_status='failed' WHERE id=?").bind(id).run().catch(() => {})
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

export { app as distributorAdminRoutes }
