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
import { confirmTossPayment, cancelTossPayment } from '@/worker/utils/toss-gateway'
import { swallow } from '@/worker/utils/swallow'
import { rateLimit } from '@/worker/middleware/rate-limit'
import { creditSupplierOnWholesaleOrder } from './wholesale-settlement'
import { ensureSupplyVisibilitySchema, visibilityWhere } from './supply-visibility'

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
    refunded_amount INTEGER NOT NULL DEFAULT 0,
    courier TEXT,
    tracking_number TEXT,
    shipped_at DATETIME,
    ship_to_name TEXT,
    ship_to_phone TEXT,
    ship_to_address TEXT,
    ship_to_postal TEXT,
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
    line_total INTEGER NOT NULL DEFAULT 0,
    courier TEXT,
    tracking_number TEXT,
    shipped_at DATETIME,
    line_status TEXT NOT NULL DEFAULT 'PENDING'
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

// ── GET /home — 도매몰 쇼핑 홈 한 번에 (베스트/신상품/카테고리/추천제안) ──────────
//   🛡️ 2026-06-04: 쇼핑몰형 홈용. 등급가 서버계산 + 가시성 가드 + 제조사 신원 비노출. SSR inject 가능(1 콜).
interface HomeRow { id: number; name: string; image_url: string | null; category: string | null; stock: number; supply_price: number; margin_override?: number | null; dominant_color?: string | null; sold_count?: number }
app.get('/home', async (c) => {
  const sellerId = await sellerIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const { DB } = c.env
  try {
    await ensureSupplyVisibilitySchema(DB)
    const sg = await loadSellerGrade(DB, sellerId)
    const table = await loadGradeTable(DB)
    const grade = effectiveGrade({ grade: sg.distributor_grade, specialUntil: sg.special_discount_until })
    const baseWhere = `p.is_supply_product = 1 AND p.is_active = 1 AND p.supply_source_id IS NULL AND COALESCE(p.supply_price,0) > 0 AND ${visibilityWhere('p')}`
    const cols = `p.id, p.name, p.image_url, p.category, p.stock, COALESCE(p.supply_price,0) AS supply_price, p.supply_margin_override_pct AS margin_override, p.dominant_color, COALESCE(p.sold_count,0) AS sold_count`
    const enrich = (rows: HomeRow[]) => (rows || []).map(r => {
      const { price } = resolveDistributorPrice({ baseSupplyPrice: r.supply_price, grade: sg.distributor_grade, specialUntil: sg.special_discount_until, table, marginOverridePct: r.margin_override })
      return { id: r.id, name: r.name, image_url: r.image_url, category: r.category, stock: r.stock, dominant_color: r.dominant_color ?? null, distributor_price: price }
    })

    const [best, fresh, cats, proposalsRes] = await Promise.all([
      DB.prepare(`SELECT ${cols} FROM products p WHERE ${baseWhere} ORDER BY COALESCE(p.sold_count,0) DESC, p.created_at DESC LIMIT 12`).bind(sellerId).all<HomeRow>().catch(() => ({ results: [] as HomeRow[] })),
      DB.prepare(`SELECT ${cols} FROM products p WHERE ${baseWhere} ORDER BY p.created_at DESC LIMIT 12`).bind(sellerId).all<HomeRow>().catch(() => ({ results: [] as HomeRow[] })),
      DB.prepare(`SELECT p.category AS category, COUNT(*) AS cnt FROM products p WHERE ${baseWhere} AND p.category IS NOT NULL GROUP BY p.category ORDER BY cnt DESC LIMIT 12`).bind(sellerId).all<{ category: string; cnt: number }>().catch(() => ({ results: [] as { category: string; cnt: number }[] })),
      DB.prepare(`
        SELECT ${cols} FROM wholesale_proposals wp JOIN products p ON p.id = wp.product_id
        WHERE wp.status = 'active' AND wp.distributor_seller_id = ? AND ${baseWhere} ORDER BY wp.created_at DESC LIMIT 12
      `).bind(sellerId, sellerId).all<HomeRow>().catch(() => ({ results: [] as HomeRow[] })),
    ])

    return c.json({
      success: true,
      grade,
      best: enrich(best.results || []),
      new: enrich(fresh.results || []),
      proposals: enrich(proposalsRes.results || []),
      categories: (cats.results || []).map(c2 => ({ key: c2.category, count: c2.cnt })),
    })
  } catch (err) {
    return safeError(c, err, '도매몰 홈 조회 중 오류가 발생했습니다', '[wholesale]')
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
      return c.json({ success: true, items: [], total: 0, page, limit, has_more: false, grade: 'C' })
    }

    await ensureSupplyVisibilitySchema(DB)
    const sg = await loadSellerGrade(DB, sellerId)
    const table = await loadGradeTable(DB)
    const grade: DistributorGrade = effectiveGrade({ grade: sg.distributor_grade, specialUntil: sg.special_discount_until })

    // 도매 가능 = 제조사 공급상품(공급자 직등록 원본). supply_source_id IS NULL = 원본(셀러 복제본 제외).
    // + 공급 범위(supply_visibility) 가시성: ALL 이거나 허용목록(선정된 유통회원)에 포함.
    let where = `p.is_supply_product = 1 AND p.is_active = 1 AND p.supply_source_id IS NULL AND COALESCE(p.supply_price,0) > 0 AND ${visibilityWhere('p')}`
    const params: (string | number)[] = [sellerId]
    if (search) { where += ' AND p.name LIKE ?'; params.push(`%${search}%`) }
    if (category) { where += ' AND p.category = ?'; params.push(category) }

    const rows = await DB.prepare(`
      SELECT p.id, p.name, p.description, p.image_url, p.category, p.stock,
             COALESCE(p.supply_price, 0) AS supply_price, p.supply_margin_override_pct AS margin_override
      FROM products p
      WHERE ${where}
      ORDER BY COALESCE(p.sold_count,0) DESC, p.created_at DESC
      LIMIT ? OFFSET ?
    `).bind(...params, limit, offset).all<{
      id: number; name: string; description: string | null; image_url: string | null;
      category: string | null; stock: number; supply_price: number; margin_override: number | null
    }>()

    const totalRow = await DB.prepare(`SELECT COUNT(*) AS c FROM products p WHERE ${where}`)
      .bind(...params).first<{ c: number }>().catch(() => ({ c: 0 }))
    const total = totalRow?.c ?? 0

    // ⚠️ supply_price/supplier_id 비노출 — 등급가만 반환.
    const items = (rows.results || []).map(r => {
      const { price } = resolveDistributorPrice({
        baseSupplyPrice: r.supply_price, grade: sg.distributor_grade,
        specialUntil: sg.special_discount_until, table, marginOverridePct: r.margin_override,
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
    await ensureSupplyVisibilitySchema(DB)
    const r = await DB.prepare(`
      SELECT p.id, p.name, p.description, p.image_url, p.category, p.stock,
             COALESCE(p.supply_price,0) AS supply_price, p.supply_margin_override_pct AS margin_override
      FROM products p
      WHERE p.id = ? AND p.is_supply_product = 1 AND p.is_active = 1
        AND p.supply_source_id IS NULL AND COALESCE(p.supply_price,0) > 0
        AND ${visibilityWhere('p')}
    `).bind(id, sellerId).first<{
      id: number; name: string; description: string | null; image_url: string | null;
      category: string | null; stock: number; supply_price: number; margin_override: number | null
    }>()
    if (!r) return c.json({ success: false, error: '상품을 찾을 수 없습니다' }, 404)

    const sg = await loadSellerGrade(DB, sellerId)
    const table = await loadGradeTable(DB)
    const { price, grade } = resolveDistributorPrice({
      baseSupplyPrice: r.supply_price, grade: sg.distributor_grade,
      specialUntil: sg.special_discount_until, table, marginOverridePct: r.margin_override,
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
app.post('/orders', rateLimit({ action: 'wholesale-order', max: 30, windowSec: 60 }), async (c) => {
  const sellerId = await sellerIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const { DB } = c.env
  try {
    await ensureOrderTables(DB)
    // 만료 정리(best-effort): 이 유통사의 1시간 경과 미결제(PENDING) 주문 = 체크아웃 이탈 → EXPIRED.
    await DB.prepare(
      "UPDATE wholesale_orders SET status='EXPIRED' WHERE distributor_seller_id=? AND status='PENDING' AND created_at < datetime('now','-1 hour')"
    ).bind(sellerId).run().catch(() => { /* best-effort */ })
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

    await ensureSupplyVisibilitySchema(DB)
    const sg = await loadSellerGrade(DB, sellerId)
    const table = await loadGradeTable(DB)
    const ids = [...reqMap.keys()]
    const placeholders = ids.map(() => '?').join(',')
    // 가시성 가드 — 유통사가 볼 수 없는(선정 안 된) 공급상품은 주문 불가.
    const prods = await DB.prepare(`
      SELECT p.id, p.name, p.supplier_id, p.stock, COALESCE(p.supply_price,0) AS supply_price, p.supply_margin_override_pct AS margin_override
      FROM products p
      WHERE p.id IN (${placeholders}) AND p.is_supply_product = 1 AND p.is_active = 1
        AND p.supply_source_id IS NULL AND COALESCE(p.supply_price,0) > 0
        AND ${visibilityWhere('p')}
    `).bind(...ids, sellerId).all<{ id: number; name: string; supplier_id: number | null; stock: number | null; supply_price: number; margin_override: number | null }>()
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
        specialUntil: sg.special_discount_until, table, marginOverridePct: p.margin_override,
      })
      const lineTotal = price * qty
      subtotal += lineTotal
      supplyTotal += p.supply_price * qty
      lines.push({ product_id: p.id, supplier_id: p.supplier_id, name: p.name, qty, base: p.supply_price, unit: price, line_total: lineTotal })
    }
    if (subtotal <= 0) return c.json({ success: false, error: '결제 금액이 올바르지 않습니다' }, 400)

    const grade = effectiveGrade({ grade: sg.distributor_grade, specialUntil: sg.special_discount_until })

    // 배송지 스냅샷 — body 우선, 없으면 셀러 프로필. 제조사(공급자) 직배송에 사용.
    const shipFromProfile = await DB.prepare(
      'SELECT recipient_name, shipping_phone, shipping_address, shipping_postal_code, name FROM sellers WHERE id = ?'
    ).bind(sellerId).first<{ recipient_name: string | null; shipping_phone: string | null; shipping_address: string | null; shipping_postal_code: string | null; name: string | null }>().catch(() => null)
    const ship = (body.shipping || {}) as Record<string, unknown>
    const shipName = String(ship.name || shipFromProfile?.recipient_name || shipFromProfile?.name || '').slice(0, 60) || null
    const shipPhone = String(ship.phone || shipFromProfile?.shipping_phone || '').slice(0, 30) || null
    const shipAddr = String(ship.address || shipFromProfile?.shipping_address || '').slice(0, 300) || null
    const shipPostal = String(ship.postal || shipFromProfile?.shipping_postal_code || '').slice(0, 20) || null

    const tossOrderId = `WHS-${sellerId}-${Date.now()}-${Math.floor(Math.random() * 1000)}`
    const ins = await DB.prepare(`
      INSERT INTO wholesale_orders (distributor_seller_id, toss_order_id, status, grade, subtotal, supply_total, margin_total, ship_to_name, ship_to_phone, ship_to_address, ship_to_postal)
      VALUES (?, ?, 'PENDING', ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(sellerId, tossOrderId, grade, subtotal, supplyTotal, subtotal - supplyTotal, shipName, shipPhone, shipAddr, shipPostal).run()
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
app.post('/orders/confirm', rateLimit({ action: 'wholesale-confirm', max: 30, windowSec: 60 }), async (c) => {
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

    // 재고 원자적 차감 (oversell 가드) — stock NULL(무제한)은 통과, stock<qty 면 실패.
    //   동시 주문이 마지막 재고를 동시에 claim 하는 것을 차단. 실패 시 전액 환불 + 롤백.
    const items = await DB.prepare('SELECT product_id, qty FROM wholesale_order_items WHERE wholesale_order_id = ?')
      .bind(order.id).all<{ product_id: number; qty: number }>().catch(() => ({ results: [] as { product_id: number; qty: number }[] }))
    const lineList = items.results || []
    const decremented: Array<{ product_id: number; qty: number }> = []
    let oversold = false
    for (const it of lineList) {
      const upd = await DB.prepare(
        "UPDATE products SET stock = stock - ?, sold_count = COALESCE(sold_count,0) + ?, updated_at = datetime('now') WHERE id = ? AND (stock IS NULL OR stock >= ?)"
      ).bind(it.qty, it.qty, it.product_id, it.qty).run().catch(() => ({ meta: { changes: 0 } }))
      if ((upd.meta?.changes ?? 0) === 0) { oversold = true; break }
      decremented.push(it)
    }

    if (oversold) {
      // 롤백 — 차감 성공분 복원.
      for (const d of decremented) {
        await DB.prepare(
          "UPDATE products SET stock = stock + ?, sold_count = MAX(0, COALESCE(sold_count,0) - ?), updated_at = datetime('now') WHERE id = ? AND stock IS NOT NULL"
        ).bind(d.qty, d.qty, d.product_id).run().catch(() => { /* best-effort */ })
      }
      // 자동 전액 환불 (이미 승인된 결제) + 주문 실패 처리.
      try {
        await cancelTossPayment({ env: c.env, paymentKey, cancelReason: '재고 부족(동시주문) 자동 환불', idempotencyKey: `whs-oversell-${order.id}` })
      } catch { /* best-effort */ }
      await DB.prepare("UPDATE wholesale_orders SET status='FAILED' WHERE id=?").bind(order.id).run().catch(() => {})
      return c.json({ success: false, error: '재고가 부족하여 자동 환불되었습니다. 다시 시도해주세요.', code: 'OVERSOLD' }, 409)
    }

    // 제조사 정산 적립 (멱등, fail-soft — 정산 실패가 결제완료를 막지 않음).
    try { await creditSupplierOnWholesaleOrder(DB, order.id) } catch { /* best-effort */ }

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

// ── GET /proposals — 나에게 제안된 상품 (등급가 포함) ─────────────────────────
app.get('/proposals', async (c) => {
  const sellerId = await sellerIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const { DB } = c.env
  try {
    await ensureSupplyVisibilitySchema(DB) // supply_margin_override_pct 컬럼 보장 (cold isolate)
    await DB.prepare(`CREATE TABLE IF NOT EXISTS wholesale_proposals (
      id INTEGER PRIMARY KEY AUTOINCREMENT, distributor_seller_id INTEGER NOT NULL, product_id INTEGER NOT NULL,
      note TEXT, status TEXT NOT NULL DEFAULT 'active', created_at DATETIME DEFAULT (datetime('now'))
    )`).run().catch(swallow('wholesale:ensure-proposals'))
    const sg = await loadSellerGrade(DB, sellerId)
    const table = await loadGradeTable(DB)
    const { results } = await DB.prepare(`
      SELECT wp.id, wp.note, wp.created_at, p.id AS product_id, p.name, p.image_url, p.stock,
             COALESCE(p.supply_price,0) AS supply_price, p.supply_margin_override_pct AS margin_override
      FROM wholesale_proposals wp
      JOIN products p ON p.id = wp.product_id
      WHERE wp.distributor_seller_id = ? AND wp.status = 'active'
        AND p.is_active = 1 AND p.is_supply_product = 1
      ORDER BY wp.created_at DESC LIMIT 50
    `).bind(sellerId).all<{ id: number; note: string | null; created_at: string; product_id: number; name: string; image_url: string | null; stock: number; supply_price: number; margin_override: number | null }>()
    const items = (results || []).map(r => {
      const { price } = resolveDistributorPrice({ baseSupplyPrice: r.supply_price, grade: sg.distributor_grade, specialUntil: sg.special_discount_until, table, marginOverridePct: r.margin_override })
      return { id: r.id, note: r.note, product_id: r.product_id, name: r.name, image_url: r.image_url, stock: r.stock, distributor_price: price }
    })
    return c.json({ success: true, proposals: items })
  } catch (err) {
    return safeError(c, err, '제안 조회 중 오류가 발생했습니다', '[wholesale]')
  }
})

// ── GET /statement?from=&to= — 거래내역서 (유통사 매입 내역) ──────────────────
app.get('/statement', async (c) => {
  const sellerId = await sellerIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const { DB } = c.env
  try {
    await ensureOrderTables(DB)
    const from = (c.req.query('from') || '').slice(0, 10)
    const to = (c.req.query('to') || '').slice(0, 10)
    let where = "distributor_seller_id = ? AND status IN ('PAID','SHIPPED','REFUNDED')"
    const binds: unknown[] = [sellerId]
    if (/^\d{4}-\d{2}-\d{2}$/.test(from)) { where += ' AND date(COALESCE(paid_at, created_at)) >= ?'; binds.push(from) }
    if (/^\d{4}-\d{2}-\d{2}$/.test(to)) { where += ' AND date(COALESCE(paid_at, created_at)) <= ?'; binds.push(to) }
    const { results } = await DB.prepare(`
      SELECT id, status, subtotal, grade, paid_at, created_at
      FROM wholesale_orders WHERE ${where} ORDER BY COALESCE(paid_at, created_at) DESC LIMIT 500
    `).bind(...binds).all<{ id: number; status: string; subtotal: number; grade: string | null; paid_at: string | null; created_at: string }>()
    const rows = results || []
    const totalPaid = rows.filter(r => r.status !== 'REFUNDED').reduce((s, r) => s + (r.subtotal || 0), 0)
    const totalRefunded = rows.filter(r => r.status === 'REFUNDED').reduce((s, r) => s + (r.subtotal || 0), 0)
    return c.json({ success: true, orders: rows, summary: { count: rows.length, total_paid: totalPaid, total_refunded: totalRefunded, net: totalPaid - totalRefunded } })
  } catch (err) {
    return safeError(c, err, '거래내역 조회 중 오류가 발생했습니다', '[wholesale]')
  }
})

// ── 엑셀 — 유통사 등급가 카탈로그 다운로드(.xlsx) + 주문 양식(.csv 재업로드용) ─────
import { buildCsv, csvResponse } from './supply-csv'
import { buildXlsx, xlsxResponse } from './xlsx'

// GET /catalog-export — 내 등급가 카탈로그 .xlsx (제조사 신원 비노출 — 등급가만)
app.get('/catalog-export', async (c) => {
  const sellerId = await sellerIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const { DB } = c.env
  try {
    await ensureSupplyVisibilitySchema(DB)
    const sg = await loadSellerGrade(DB, sellerId)
    const table = await loadGradeTable(DB)
    const rows = await DB.prepare(`
      SELECT p.id, p.name, p.category, p.stock, COALESCE(p.supply_price,0) AS supply_price, p.supply_margin_override_pct AS margin_override
      FROM products p
      WHERE p.is_supply_product = 1 AND p.is_active = 1 AND p.supply_source_id IS NULL
        AND COALESCE(p.supply_price,0) > 0 AND ${visibilityWhere('p')}
      ORDER BY p.name LIMIT 10000
    `).bind(sellerId).all<{ id: number; name: string; category: string | null; stock: number; supply_price: number; margin_override: number | null }>()
    const out = (rows.results || []).map(r => {
      const { price, grade } = resolveDistributorPrice({ baseSupplyPrice: r.supply_price, grade: sg.distributor_grade, specialUntil: sg.special_discount_until, table, marginOverridePct: r.margin_override })
      return [r.id, r.name, r.category || '', r.stock, price, grade]
    })
    return xlsxResponse(buildXlsx(['product_id', '상품명', '카테고리', '재고', '공급가(내등급)', '적용등급'], out), `wholesale-catalog-${new Date().toISOString().slice(0, 10)}.xlsx`)
  } catch (err) {
    return safeError(c, err, '카탈로그 내보내기 중 오류가 발생했습니다', '[wholesale]')
  }
})

// GET /order-template — 주문 양식 CSV (product_id, qty 작성 → 업로드)
app.get('/order-template', (c) => {
  return csvResponse(buildCsv(['product_id', '상품명', '주문수량'], [['예: 123', '상품명(참고)', '10']]), 'wholesale-order-template.csv')
})

// ── OEM/ODM 신청 (유통회원) — 스펙: 유통스타트가 제조사 찾기·연결·생산 지원 ──────────
import { ensureOemSchema } from './oem-requests'

// POST /oem-requests — OEM/ODM 신청
app.post('/oem-requests', rateLimit({ action: 'wholesale-oem', max: 20, windowSec: 3600 }), async (c) => {
  const sellerId = await sellerIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const { DB } = c.env
  try {
    await ensureOemSchema(DB)
    const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
    const productName = String(body.product_name || '').trim().slice(0, 200)
    if (!productName) return c.json({ success: false, error: '제품명을 입력해주세요' }, 400)
    const kind = String(body.kind || 'OEM').toUpperCase() === 'ODM' ? 'ODM' : 'OEM'
    const category = body.category ? String(body.category).slice(0, 60) : null
    const note = body.note ? String(body.note).slice(0, 2000) : null
    const targetQty = Number.isFinite(Number(body.target_qty)) ? Math.max(0, Math.floor(Number(body.target_qty))) : null
    const targetPrice = Number.isFinite(Number(body.target_price)) ? Math.max(0, Math.floor(Number(body.target_price))) : null
    const ins = await DB.prepare(
      `INSERT INTO oem_requests (distributor_seller_id, kind, product_name, category, target_qty, target_price, note, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'open')`
    ).bind(sellerId, kind, productName, category, targetQty, targetPrice, note).run()
    return c.json({ success: true, id: Number(ins.meta?.last_row_id), message: 'OEM/ODM 신청이 접수되었습니다. 유통스타트가 제조사를 매칭해 연락드립니다.' }, 201)
  } catch (err) {
    return safeError(c, err, 'OEM/ODM 신청 중 오류가 발생했습니다', '[wholesale]')
  }
})

// GET /oem-requests — 내 신청 목록
app.get('/oem-requests', async (c) => {
  const sellerId = await sellerIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const { DB } = c.env
  try {
    await ensureOemSchema(DB)
    const { results } = await DB.prepare(`
      SELECT r.id, r.kind, r.product_name, r.category, r.target_qty, r.target_price, r.note,
             r.status, r.admin_memo, r.matched_supplier_id, r.created_at, r.updated_at,
             sup.business_name AS matched_supplier_name
      FROM oem_requests r LEFT JOIN suppliers sup ON sup.id = r.matched_supplier_id
      WHERE r.distributor_seller_id = ? ORDER BY r.created_at DESC LIMIT 100
    `).bind(sellerId).all()
    return c.json({ success: true, requests: results ?? [] })
  } catch (err) {
    return safeError(c, err, 'OEM/ODM 신청 조회 중 오류가 발생했습니다', '[wholesale]')
  }
})

export { app as wholesaleRoutes }
