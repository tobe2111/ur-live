/**
 * 🏭 2026-06-01 유통스타트 도매몰 — 제조사(공급자) 도매 주문 처리 (Phase 3).
 * (docs/design/wholesale-utongstart.md)
 *
 * - GET  /api/supplier/wholesale/orders          — 내 상품이 포함된 도매 주문 라인(결제완료) + 배송지
 * - POST /api/supplier/wholesale/items/:id/ship   — 송장 입력(택배사/운송장) → 라인 발송완료
 * - POST /api/supplier/wholesale/orders/:id/refund — 반품 승인 → Toss 전액취소 + 재고복원 (제조사 C/S)
 *
 * 인증: requireSupplier(). supplier_id = c.get('user').id.
 * ⚠️ 환불은 잠긴 cancelTossPayment helper 호출만 (직접 fetch 금지 룰 준수).
 */
import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { safeError } from '@/worker/utils/safe-error'
import { requireSupplier } from '@/worker/middleware/auth'
import { cancelTossPayment } from '@/worker/utils/toss-gateway'
import { reverseSupplierOnWholesaleRefund } from './wholesale-settlement'

const app = new Hono<{ Bindings: Env }>()
app.use('*', requireSupplier())

function supplierId(c: { get: (k: string) => unknown }): number | null {
  const user = c.get('user') as { id?: string | number } | undefined
  const id = Number(user?.id)
  return Number.isFinite(id) && id > 0 ? id : null
}

// ── GET /orders — 내 상품이 들어간 결제완료 주문 라인 ──────────────────────────
app.get('/orders', async (c) => {
  const sid = supplierId(c)
  if (!sid) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const { DB } = c.env
  try {
    const { results } = await DB.prepare(`
      SELECT i.id AS item_id, i.wholesale_order_id, i.name, i.qty, i.base_supply_price,
             (i.base_supply_price * i.qty) AS settle_amount,
             i.courier, i.tracking_number, i.shipped_at, i.line_status,
             o.status AS order_status, o.created_at, o.paid_at,
             o.ship_to_name, o.ship_to_phone, o.ship_to_address, o.ship_to_postal
      FROM wholesale_order_items i
      JOIN wholesale_orders o ON o.id = i.wholesale_order_id
      WHERE i.supplier_id = ? AND o.status IN ('PAID','SHIPPED')
      ORDER BY o.created_at DESC LIMIT 200
    `).bind(sid).all()
    return c.json({ success: true, items: results ?? [] })
  } catch (err) {
    return safeError(c, err, '도매 주문 조회 중 오류가 발생했습니다', '[wholesale-supplier]')
  }
})

// ── POST /items/:id/ship — 송장 입력 ──────────────────────────────────────────
app.post('/items/:id/ship', async (c) => {
  const sid = supplierId(c)
  if (!sid) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const { DB } = c.env
  const itemId = Number(c.req.param('id'))
  if (!Number.isFinite(itemId) || itemId <= 0) return c.json({ success: false, error: '잘못된 항목 ID' }, 400)
  try {
    const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
    const courier = String(body.courier || '').trim().slice(0, 40)
    const tracking = String(body.tracking_number || '').trim().slice(0, 60)
    if (!courier || !tracking) return c.json({ success: false, error: '택배사와 운송장 번호를 입력해주세요' }, 400)

    // 소유권: 내 supplier_id 라인만.
    const line = await DB.prepare(
      'SELECT id, wholesale_order_id FROM wholesale_order_items WHERE id = ? AND supplier_id = ?'
    ).bind(itemId, sid).first<{ id: number; wholesale_order_id: number }>()
    if (!line) return c.json({ success: false, error: '항목을 찾을 수 없습니다' }, 404)

    await DB.prepare(
      "UPDATE wholesale_order_items SET courier=?, tracking_number=?, shipped_at=datetime('now'), line_status='SHIPPED' WHERE id=?"
    ).bind(courier, tracking, itemId).run()

    // 주문의 모든 라인이 발송완료면 주문 상태도 SHIPPED.
    const pending = await DB.prepare(
      "SELECT COUNT(*) AS c FROM wholesale_order_items WHERE wholesale_order_id = ? AND line_status != 'SHIPPED'"
    ).bind(line.wholesale_order_id).first<{ c: number }>()
    if ((pending?.c ?? 0) === 0) {
      await DB.prepare("UPDATE wholesale_orders SET status='SHIPPED', shipped_at=datetime('now') WHERE id=? AND status='PAID'")
        .bind(line.wholesale_order_id).run()
    }
    return c.json({ success: true })
  } catch (err) {
    return safeError(c, err, '송장 입력 중 오류가 발생했습니다', '[wholesale-supplier]')
  }
})

// ── POST /orders/:id/refund — 반품 승인(전액 환불) ────────────────────────────
app.post('/orders/:id/refund', async (c) => {
  const sid = supplierId(c)
  if (!sid) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const { DB } = c.env
  const orderId = Number(c.req.param('id'))
  if (!Number.isFinite(orderId) || orderId <= 0) return c.json({ success: false, error: '잘못된 주문 ID' }, 400)
  try {
    const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
    const reason = String(body.reason || '판매자 반품 승인').slice(0, 100)

    // 내 상품이 포함된 주문만 환불 처리 가능.
    const owns = await DB.prepare(
      'SELECT 1 FROM wholesale_order_items WHERE wholesale_order_id = ? AND supplier_id = ? LIMIT 1'
    ).bind(orderId, sid).first()
    if (!owns) return c.json({ success: false, error: '권한이 없습니다' }, 403)

    const order = await DB.prepare(
      'SELECT id, status, payment_key, subtotal FROM wholesale_orders WHERE id = ?'
    ).bind(orderId).first<{ id: number; status: string; payment_key: string | null; subtotal: number }>()
    if (!order) return c.json({ success: false, error: '주문을 찾을 수 없습니다' }, 404)
    if (order.status === 'REFUNDED') return c.json({ success: true, already: true })
    if (!['PAID', 'SHIPPED'].includes(order.status) || !order.payment_key) {
      return c.json({ success: false, error: '환불할 수 없는 주문 상태입니다' }, 400)
    }

    // CAS claim — 동시 환불 차단.
    const claim = await DB.prepare(
      "UPDATE wholesale_orders SET status='REFUNDING' WHERE id=? AND status IN ('PAID','SHIPPED')"
    ).bind(orderId).run()
    if ((claim.meta?.changes ?? 0) === 0) return c.json({ success: true, already: true })

    // Toss 전액 취소 — 잠긴 SSOT helper.
    const res = await cancelTossPayment({
      env: c.env, paymentKey: order.payment_key, cancelReason: reason,
      idempotencyKey: `whs-refund-${orderId}`,
    })
    if (!res.ok) {
      // 롤백 — 환불 실패 시 원상태로.
      await DB.prepare("UPDATE wholesale_orders SET status='PAID' WHERE id=? AND status='REFUNDING'").bind(orderId).run()
      return c.json({ success: false, error: res.message || '환불 처리에 실패했습니다', code: res.code }, 402)
    }

    await DB.prepare("UPDATE wholesale_orders SET status='REFUNDED' WHERE id=?").bind(orderId).run()

    // 제조사 정산 적립 역전 (pending/available, fail-soft).
    try { await reverseSupplierOnWholesaleRefund(DB, orderId, reason) } catch { /* best-effort */ }

    // 재고 복원.
    const items = await DB.prepare('SELECT product_id, qty FROM wholesale_order_items WHERE wholesale_order_id = ?')
      .bind(orderId).all<{ product_id: number; qty: number }>().catch(() => ({ results: [] as { product_id: number; qty: number }[] }))
    for (const it of items.results || []) {
      await DB.prepare(
        "UPDATE products SET stock = COALESCE(stock,0) + ?, sold_count = MAX(0, COALESCE(sold_count,0) - ?), updated_at = datetime('now') WHERE id = ?"
      ).bind(it.qty, it.qty, it.product_id).run().catch(() => { /* best-effort */ })
    }
    return c.json({ success: true })
  } catch (err) {
    return safeError(c, err, '환불 처리 중 오류가 발생했습니다', '[wholesale-supplier]')
  }
})

export { app as wholesaleSupplierRoutes }
