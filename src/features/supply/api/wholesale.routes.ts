/**
 * 🏭 2026-06-01 유통스타트 도매몰 — 유통사(셀러) 도매 카탈로그 + B2B 주문 (Phase 2).
 * (docs/design/wholesale-utongstart.md)
 *
 * - GET  /api/wholesale/me           — 내 등급/마진/특별할인 상태
 * - GET  /api/wholesale/catalog      — 등급가로 본 도매 상품 목록 (제조사 신원 비노출)
 * - GET  /api/wholesale/catalog/:id  — 도매 상품 상세 (등급가)
 *
 * ⚠️ 가격은 서버 재계산 (distributor-pricing). supply_price(제조사가)·supplier_id(제조사 신원) 는 응답에 절대 노출 X.
 * 마운트: app.route('/api/wholesale', wholesaleRoutes)
 */
import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { safeError } from '@/worker/utils/safe-error'
import {
  resolveDistributorPrice, marginForGrade, effectiveGrade,
  type GradeMargin, type DistributorGrade,
} from '@/lib/distributor-pricing'
import { confirmTossPayment } from '@/worker/utils/toss-gateway'
import { swallow } from '@/worker/utils/swallow'

const app = new Hono<{ Bindings: Env }>()

// ── B2B 주문 테이블 (선결제). 멱등 ensure. ───────────────────────────────────
const _whEnsured = new WeakSet<object>()
async function ensureOrderTables(DB: D1Database) {
  if (_whEnsured.has(DB)) return
  _whEnsured.add(DB)
  await DB.prepare(`CREATE TABLE IF NOT EXISTS wholesale_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    distributor_seller_id INTEGER NOT NULL,
    toss_order_id TEXT UNIQUE,
    status TEXT NOT NULL DEFAULT 'PENDING',
    grade TEXT,
    subtotal INTEGER NOT NULL DEFAULT 0,
    supply_total INTEGER NOT NULL DEFAULT 0,
    margin_total INTEGER NOT NULL DEFAULT 0,
    payment_key TEXT,
    courier TEXT,
    tracking_number TEXT,
    shipped_at DATETIME,
    created_at DATETIME DEFAULT (datetime('now')),
    paid_at DATETIME
  )`).run().catch(swallow('wholesale:create-orders'))
  await DB.prepare(`CREATE TABLE IF NOT EXISTS wholesale_order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wholesale_order_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    supplier_id INTEGER,
    name TEXT,
    qty INTEGER NOT NULL DEFAULT 1,
    base_supply_price INTEGER NOT NULL DEFAULT 0,
    distributor_unit_price INTEGER NOT NULL DEFAULT 0,
    line_total INTEGER NOT NULL DEFAULT 0
  )`).run().catch(swallow('wholesale:create-items'))
  await DB.prepare(`CREATE INDEX IF NOT EXISTS idx_wholesale_orders_seller ON wholesale_orders(distributor_seller_id, created_at DESC)`).run().catch(swallow('wholesale:idx1'))
  await DB.prepare(`CREATE INDEX IF NOT EXISTS idx_wholesale_items_order ON wholesale_order_items(wholesale_order_id)`).run().catch(swallow('wholesale:idx2'))
  await DB.prepare(`CREATE INDEX IF NOT EXISTS idx_wholesale_items_supplier ON wholesale_order_items(supplier_id)`).run().catch(swallow('wholesale:idx3'))
}

// ── 셀러(유통사) JWT → seller_id ──────────────────────────────────────────────
async function sellerIdFrom(authorization: string | undefined, jwtSecret: string): Promise<number | null> {
  if (!authorization?.startsWith('Bearer ')) return null
  try {
    const { verify } = await import('hono/jwt')
    const payload = await verify(authorization.substring(7), jwtSecret, 'HS256') as { seller_id?: number }
    return payload.seller_id ?? null
  } catch {
    return null
  }
}

interface SellerGradeRow {
  distributor_grade: string | null
  special_discount_until: string | null
}

async function loadGradeTable(DB: D1Database): Promise<GradeMargin[]> {
  const { results } = await DB.prepare(
    'SELECT grade, margin_pct, is_special FROM distributor_grades WHERE active = 1'
  ).all<{ grade: string; margin_pct: number; is_special: number }>().catch(() => ({ results: [] as { grade: string; margin_pct: number; is_special: number }[] }))
  return (results || []).map(r => ({ grade: r.grade, margin_pct: r.margin_pct, is_special: !!r.is_special }))
}

async function loadSellerGrade(DB: D1Database, sellerId: number): Promise<SellerGradeRow> {
  const row = await DB.prepare(
    'SELECT distributor_grade, special_discount_until FROM sellers WHERE id = ?'
  ).bind(sellerId).first<SellerGradeRow>().catch(() => null)
  return row ?? { distributor_grade: null, special_discount_until: null }
}

// ── GET /me ───────────────────────────────────────────────────────────────────
app.get('/me', async (c) => {
  const sellerId = await sellerIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  try {
    const sg = await loadSellerGrade(c.env.DB, sellerId)
    const table = await loadGradeTable(c.env.DB)
    const grade = effectiveGrade({ grade: sg.distributor_grade, specialUntil: sg.special_discount_until })
    const marginPct = marginForGrade(grade, table)
    return c.json({
      success: true,
      grade,
      assigned_grade: sg.distributor_grade,
      margin_pct: marginPct,
      special_active: grade === 'SPECIAL',
      special_discount_until: sg.special_discount_until,
    })
  } catch (err) {
    return safeError(c, err, '등급 조회 중 오류가 발생했습니다', '[wholesale]')
  }
})

// ── GET /catalog ────────────────────────────────────────────────────────────
app.get('/catalog', async (c) => {
  const sellerId = await sellerIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const { DB } = c.env
  const page = Math.max(1, parseInt(c.req.query('page') || '1', 10))
  const limit = Math.min(parseInt(c.req.query('limit') || '24', 10), 100)
  const offset = (page - 1) * limit
  const search = c.req.query('search') || ''
  const category = c.req.query('category') || ''

  try {
    const hasCol = await DB.prepare(
      "SELECT COUNT(*) as c FROM pragma_table_info('products') WHERE name='is_supply_product'"
    ).first<{ c: number }>().catch(() => null)
    if (!hasCol || hasCol.c === 0) {
      return c.json({ success: true, items: [], total: 0, page, limit, has_more: false, grade: 'D' })
    }

    const sg = await loadSellerGrade(DB, sellerId)
    const table = await loadGradeTable(DB)
    const grade: DistributorGrade = effectiveGrade({ grade: sg.distributor_grade, specialUntil: sg.special_discount_until })

    // 도매 가능 = 제조사 공급상품(공급자 직등록 원본). supply_source_id IS NULL = 원본(셀러 복제본 제외).
    let where = "p.is_supply_product = 1 AND p.is_active = 1 AND p.supply_source_id IS NULL AND COALESCE(p.supply_price,0) > 0"
    const params: (string | number)[] = []
    if (search) { where += ' AND p.name LIKE ?'; params.push(`%${search}%`) }
    if (category) { where += ' AND p.category = ?'; params.push(category) }

    const rows = await DB.prepare(`
      SELECT p.id, p.name, p.description, p.image_url, p.category, p.stock,
             COALESCE(p.supply_price, 0) AS supply_price
      FROM products p
      WHERE ${where}
      ORDER BY COALESCE(p.sold_count,0) DESC, p.created_at DESC
      LIMIT ? OFFSET ?
    `).bind(...params, limit, offset).all<{
      id: number; name: string; description: string | null; image_url: string | null;
      category: string | null; stock: number; supply_price: number
    }>()

    const totalRow = await DB.prepare(`SELECT COUNT(*) AS c FROM products p WHERE ${where}`)
      .bind(...params).first<{ c: number }>().catch(() => ({ c: 0 }))
    const total = totalRow?.c ?? 0

    // ⚠️ supply_price/supplier_id 비노출 — 등급가만 반환.
    const items = (rows.results || []).map(r => {
      const { price } = resolveDistributorPrice({
        baseSupplyPrice: r.supply_price, grade: sg.distributor_grade,
        specialUntil: sg.special_discount_until, table,
      })
      return {
        id: r.id, name: r.name, description: r.description, image_url: r.image_url,
        category: r.category, stock: r.stock, distributor_price: price,
      }
    })

    return c.json({ success: true, items, total, page, limit, has_more: offset + items.length < total, grade })
  } catch (err) {
    return safeError(c, err, '카탈로그 조회 중 오류가 발생했습니다', '[wholesale]')
  }
})

// ── GET /catalog/:id ──────────────────────────────────────────────────────────
app.get('/catalog/:id', async (c) => {
  const sellerId = await sellerIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const { DB } = c.env
  const id = Number(c.req.param('id'))
  if (!Number.isFinite(id) || id <= 0) return c.json({ success: false, error: '잘못된 상품 ID' }, 400)
  try {
    const r = await DB.prepare(`
      SELECT p.id, p.name, p.description, p.image_url, p.category, p.stock,
             COALESCE(p.supply_price,0) AS supply_price
      FROM products p
      WHERE p.id = ? AND p.is_supply_product = 1 AND p.is_active = 1
        AND p.supply_source_id IS NULL AND COALESCE(p.supply_price,0) > 0
    `).bind(id).first<{
      id: number; name: string; description: string | null; image_url: string | null;
      category: string | null; stock: number; supply_price: number
    }>()
    if (!r) return c.json({ success: false, error: '상품을 찾을 수 없습니다' }, 404)

    const sg = await loadSellerGrade(DB, sellerId)
    const table = await loadGradeTable(DB)
    const { price, grade } = resolveDistributorPrice({
      baseSupplyPrice: r.supply_price, grade: sg.distributor_grade,
      specialUntil: sg.special_discount_until, table,
    })
    return c.json({
      success: true,
      item: {
        id: r.id, name: r.name, description: r.description, image_url: r.image_url,
        category: r.category, stock: r.stock, distributor_price: price,
      },
      grade,
    })
  } catch (err) {
    return safeError(c, err, '상품 조회 중 오류가 발생했습니다', '[wholesale]')
  }
})

// ── POST /orders — B2B 주문 생성(PENDING) + Toss 결제 파라미터 반환 ────────────
app.post('/orders', async (c) => {
  const sellerId = await sellerIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const { DB } = c.env
  try {
    await ensureOrderTables(DB)
    const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
    const rawItems = Array.isArray(body.items) ? body.items : []
    if (!rawItems.length) return c.json({ success: false, error: '주문 항목이 없습니다' }, 400)

    // product_id → qty 합산 + 검증
    const reqMap = new Map<number, number>()
    for (const it of rawItems as Array<{ product_id?: unknown; qty?: unknown }>) {
      const pid = Number(it.product_id)
      const qty = Math.floor(Number(it.qty))
      if (!Number.isFinite(pid) || pid <= 0 || !Number.isFinite(qty) || qty <= 0 || qty > 100000) {
        return c.json({ success: false, error: '주문 수량이 올바르지 않습니다' }, 400)
      }
      reqMap.set(pid, (reqMap.get(pid) || 0) + qty)
    }

    const sg = await loadSellerGrade(DB, sellerId)
    const table = await loadGradeTable(DB)
    const ids = [...reqMap.keys()]
    const placeholders = ids.map(() => '?').join(',')
    const prods = await DB.prepare(`
      SELECT id, name, supplier_id, stock, COALESCE(supply_price,0) AS supply_price
      FROM products
      WHERE id IN (${placeholders}) AND is_supply_product = 1 AND is_active = 1
        AND supply_source_id IS NULL AND COALESCE(supply_price,0) > 0
    `).bind(...ids).all<{ id: number; name: string; supplier_id: number | null; stock: number | null; supply_price: number }>()
    const found = prods.results || []
    if (found.length !== ids.length) {
      return c.json({ success: false, error: '주문할 수 없는 상품이 포함되어 있습니다' }, 400)
    }

    let subtotal = 0, supplyTotal = 0
    const lines: Array<{ product_id: number; supplier_id: number | null; name: string; qty: number; base: number; unit: number; line_total: number }> = []
    for (const p of found) {
      const qty = reqMap.get(p.id) || 0
      if (p.stock != null && p.stock < qty) {
        return c.json({ success: false, error: `재고가 부족합니다: ${p.name}` }, 400)
      }
      const { price } = resolveDistributorPrice({
        baseSupplyPrice: p.supply_price, grade: sg.distributor_grade,
        specialUntil: sg.special_discount_until, table,
      })
      const lineTotal = price * qty
      subtotal += lineTotal
      supplyTotal += p.supply_price * qty
      lines.push({ product_id: p.id, supplier_id: p.supplier_id, name: p.name, qty, base: p.supply_price, unit: price, line_total: lineTotal })
    }
    if (subtotal <= 0) return c.json({ success: false, error: '결제 금액이 올바르지 않습니다' }, 400)

    const grade = effectiveGrade({ grade: sg.distributor_grade, specialUntil: sg.special_discount_until })
    const tossOrderId = `WHS-${sellerId}-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    const ins = await DB.prepare(`
      INSERT INTO wholesale_orders (distributor_seller_id, toss_order_id, status, grade, subtotal, supply_total, margin_total)
      VALUES (?, ?, 'PENDING', ?, ?, ?, ?)
    `).bind(sellerId, tossOrderId, grade, subtotal, supplyTotal, subtotal - supplyTotal).run()
    const orderId = Number(ins.meta?.last_row_id)

    for (const l of lines) {
      await DB.prepare(`
        INSERT INTO wholesale_order_items (wholesale_order_id, product_id, supplier_id, name, qty, base_supply_price, distributor_unit_price, line_total)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(orderId, l.product_id, l.supplier_id ?? null, l.name, l.qty, l.base, l.unit, l.line_total).run()
    }

    const orderName = lines.length === 1
      ? lines[0].name.slice(0, 90)
      : `${lines[0].name.slice(0, 40)} 외 ${lines.length - 1}건`

    return c.json({ success: true, order_id: orderId, toss_order_id: tossOrderId, amount: subtotal, order_name: orderName })
  } catch (err) {
    return safeError(c, err, '주문 생성 중 오류가 발생했습니다', '[wholesale]')
  }
})

// ── POST /orders/confirm — Toss 승인 + 멱등 PAID 전환 + 재고 차감 ──────────────
app.post('/orders/confirm', async (c) => {
  const sellerId = await sellerIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const { DB } = c.env
  try {
    await ensureOrderTables(DB)
    const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
    const paymentKey = String(body.paymentKey || '')
    const tossOrderId = String(body.orderId || '')
    const amount = Number(body.amount)
    if (!paymentKey || !tossOrderId || !Number.isFinite(amount) || amount <= 0) {
      return c.json({ success: false, error: '결제 정보가 올바르지 않습니다' }, 400)
    }

    const order = await DB.prepare(
      'SELECT id, status, subtotal FROM wholesale_orders WHERE toss_order_id = ? AND distributor_seller_id = ?'
    ).bind(tossOrderId, sellerId).first<{ id: number; status: string; subtotal: number }>()
    if (!order) return c.json({ success: false, error: '주문을 찾을 수 없습니다' }, 404)
    if (order.status === 'PAID') return c.json({ success: true, order_id: order.id, already: true })
    if (order.status !== 'PENDING') return c.json({ success: false, error: '처리할 수 없는 주문 상태입니다' }, 400)

    // 서버 재계산 금액과 일치 검증 (클라이언트 금액 신뢰 X)
    if (Number(order.subtotal) !== Math.round(amount)) {
      return c.json({ success: false, error: '결제 금액이 일치하지 않습니다' }, 400)
    }

    // Toss 승인 — 잠긴 SSOT helper 호출 (직접 fetch 금지 룰 준수).
    const res = await confirmTossPayment({ env: c.env, paymentKey, orderId: tossOrderId, amount: Math.round(amount) })
    if (!res.ok) {
      return c.json({ success: false, error: res.message || '결제 승인에 실패했습니다', code: res.code }, 402)
    }

    // CAS: PENDING → PAID (동시요청 중복 side-effect 차단)
    const claim = await DB.prepare(
      "UPDATE wholesale_orders SET status='PAID', paid_at=datetime('now'), payment_key=? WHERE id=? AND status='PENDING'"
    ).bind(paymentKey, order.id).run()
    if ((claim.meta?.changes ?? 0) === 0) {
      return c.json({ success: true, order_id: order.id, already: true })
    }

    // 재고 차감 (best-effort, 0 미만 방지)
    const items = await DB.prepare('SELECT product_id, qty FROM wholesale_order_items WHERE wholesale_order_id = ?')
      .bind(order.id).all<{ product_id: number; qty: number }>().catch(() => ({ results: [] as { product_id: number; qty: number }[] }))
    for (const it of items.results || []) {
      await DB.prepare(
        "UPDATE products SET stock = MAX(0, COALESCE(stock,0) - ?), sold_count = COALESCE(sold_count,0) + ?, updated_at = datetime('now') WHERE id = ?"
      ).bind(it.qty, it.qty, it.product_id).run().catch(() => { /* best-effort */ })
    }

    return c.json({ success: true, order_id: order.id })
  } catch (err) {
    return safeError(c, err, '결제 확인 중 오류가 발생했습니다', '[wholesale]')
  }
})

// ── GET /orders — 내 도매 주문 목록 ──────────────────────────────────────────
app.get('/orders', async (c) => {
  const sellerId = await sellerIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const { DB } = c.env
  try {
    await ensureOrderTables(DB)
    const { results } = await DB.prepare(`
      SELECT id, toss_order_id, status, grade, subtotal, courier, tracking_number, created_at, paid_at, shipped_at
      FROM wholesale_orders WHERE distributor_seller_id = ?
      ORDER BY created_at DESC LIMIT 100
    `).bind(sellerId).all()
    return c.json({ success: true, orders: results ?? [] })
  } catch (err) {
    return safeError(c, err, '주문 조회 중 오류가 발생했습니다', '[wholesale]')
  }
})

// ── GET /orders/:id — 주문 상세 (본인 소유만) ─────────────────────────────────
app.get('/orders/:id', async (c) => {
  const sellerId = await sellerIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const { DB } = c.env
  const id = Number(c.req.param('id'))
  if (!Number.isFinite(id) || id <= 0) return c.json({ success: false, error: '잘못된 주문 ID' }, 400)
  try {
    await ensureOrderTables(DB)
    const order = await DB.prepare(
      'SELECT id, toss_order_id, status, grade, subtotal, courier, tracking_number, created_at, paid_at, shipped_at FROM wholesale_orders WHERE id = ? AND distributor_seller_id = ?'
    ).bind(id, sellerId).first()
    if (!order) return c.json({ success: false, error: '주문을 찾을 수 없습니다' }, 404)
    const { results } = await DB.prepare(
      'SELECT product_id, name, qty, distributor_unit_price, line_total FROM wholesale_order_items WHERE wholesale_order_id = ?'
    ).bind(id).all()
    return c.json({ success: true, order, items: results ?? [] })
  } catch (err) {
    return safeError(c, err, '주문 조회 중 오류가 발생했습니다', '[wholesale]')
  }
})

export { app as wholesaleRoutes }
