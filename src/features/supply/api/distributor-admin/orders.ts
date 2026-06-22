/** 🏭 distributor-admin: 세금집계 + 도매주문 모니터 + 관리자 환불 (byte-identical 분해). */
import type { Hono } from 'hono'
import { safeError } from '@/worker/utils/safe-error'
import { rateLimit } from '@/worker/middleware/rate-limit'
import { swallow } from '@/worker/utils/swallow'
import { cancelTossPayment } from '@/worker/utils/toss-gateway'
import { reverseSupplierOnWholesaleRefund } from '../wholesale-settlement'
import { ensureDepositSchema, refundDeposit, recordDepositTxn, hasDepositRefundTxn } from '../wholesale-deposit-core'
import { createDashboardNotification } from '@/features/notifications/api/dashboard-notifications.routes'
import type { Env } from './helpers'

export function registerOrdersRoutes(app: Hono<{ Bindings: Env }>) {
  // ── GET /tax-summary?month=YYYY-MM — 세금계산서 집계 (1차 수동 발행 참고) ───────
  //   유통스타트→판매사 매출(판매사별 매입합) + 제조사→유통스타트 매입(제조사별 정산합).
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
      const VALID = ['PENDING', 'PAID', 'ON_CREDIT', 'SHIPPED', 'PARTIAL_REFUNDED', 'REFUNDED', 'FAILED']
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
  app.post('/orders/:id/refund', rateLimit({ action: 'admin-wholesale-refund', max: 20, windowSec: 60 }), async (c) => {
    try {
      const id = Number(c.req.param('id'))
      if (!Number.isFinite(id) || id <= 0) return c.json({ success: false, error: '잘못된 주문 ID' }, 400)
      const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
      const reason = String(body.reason || '관리자 환불').slice(0, 100)

      const order = await c.env.DB.prepare(
        'SELECT id, distributor_seller_id, status, payment_key, subtotal, COALESCE(shipping_total,0) AS shipping_total, refunded_amount FROM wholesale_orders WHERE id = ?'
      ).bind(id).first<{ id: number; distributor_seller_id: number; status: string; payment_key: string | null; subtotal: number; shipping_total: number; refunded_amount: number }>()
      if (!order) return c.json({ success: false, error: '주문을 찾을 수 없습니다' }, 404)
      if (order.status === 'REFUNDED') return c.json({ success: true, already: true })
      if (!['PAID', 'SHIPPED', 'PARTIAL_REFUNDED'].includes(order.status) || !order.payment_key) {
        return c.json({ success: false, error: '환불할 수 없는 주문 상태입니다' }, 400)
      }
      // 남은 환불 가능액 = (상품합 + 배송비) - 이미 환불액. (감사 🔴#2: 청구액=subtotal+shipping 전액 환불)
      const remaining = Math.max(0, (order.subtotal || 0) + (order.shipping_total || 0) - (order.refunded_amount || 0))
      if (remaining <= 0) return c.json({ success: false, error: '환불할 잔액이 없습니다' }, 400)
      const isDeposit = order.payment_key === 'deposit'

      // CAS claim — PAID/SHIPPED/PARTIAL_REFUNDED → REFUNDED. changes=0 이면 이미 처리됨(멱등).
      const claim = await c.env.DB.prepare(
        "UPDATE wholesale_orders SET status='REFUNDED', refunded_amount = subtotal + COALESCE(shipping_total,0) WHERE id = ? AND status IN ('PAID','SHIPPED','PARTIAL_REFUNDED')"
      ).bind(id).run()
      if ((claim.meta?.changes ?? 0) === 0) return c.json({ success: true, already: true })

      if (isDeposit) {
        // 💰 예치금 주문 — Toss 미경유. 잔액 복원(원자 +) + refund 원장(ref_id=order.id 멱등 가드).
        await ensureDepositSchema(c.env.DB)
        const already = await hasDepositRefundTxn(c.env.DB, id)
        if (!already) {
          const bal = await refundDeposit(c.env.DB, order.distributor_seller_id, remaining)
          await recordDepositTxn(c.env.DB, order.distributor_seller_id, 'refund', remaining, bal, String(id), `관리자 환불 #${id} (${reason})`)
        }
      } else {
        // 레거시 Toss 주문 — 기존 cancelTossPayment 경로 유지.
        const res = await cancelTossPayment({
          env: c.env, paymentKey: order.payment_key, cancelReason: reason,
          cancelAmount: remaining, idempotencyKey: `whs-admin-refund-${id}`,
        })
        if (!res.ok) {
          // 롤백.
          await c.env.DB.prepare("UPDATE wholesale_orders SET status='PAID', refunded_amount=? WHERE id=? AND status='REFUNDED'")
            .bind(order.refunded_amount || 0, id).run().catch(swallow('admin:refund-rollback'))
          return c.json({ success: false, error: res.message || '환불 처리에 실패했습니다', code: res.code }, 402)
        }
      }

      // 남은 모든 라인 REFUNDED + 정산 역전(전체) + 재고복원.
      //   ⚠️ 재고는 '이번에 새로 환불되는 라인'만 복원 — 제조사가 이미 부분환불해 재고 복원된 라인을
      //   중복 복원하지 않도록(이중 복원 버그 방지). UPDATE 전에 미환불 라인을 먼저 캡처.
      const newLines = await c.env.DB.prepare(
        "SELECT product_id, qty FROM wholesale_order_items WHERE wholesale_order_id = ? AND line_status != 'REFUNDED'"
      ).bind(id).all<{ product_id: number; qty: number }>().catch(() => ({ results: [] as { product_id: number; qty: number }[] }))
      await c.env.DB.prepare("UPDATE wholesale_order_items SET line_status='REFUNDED' WHERE wholesale_order_id = ? AND line_status != 'REFUNDED'").bind(id).run().catch(swallow('admin:refund-line-update'))
      try { await reverseSupplierOnWholesaleRefund(c.env.DB, id, reason) } catch { /* best-effort */ }
      for (const l of newLines.results || []) {
        await c.env.DB.prepare(
          "UPDATE products SET stock = COALESCE(stock,0) + ?, sold_count = MAX(0, COALESCE(sold_count,0) - ?), updated_at = datetime('now') WHERE id = ? AND stock IS NOT NULL"
        ).bind(l.qty, l.qty, l.product_id).run().catch(swallow('admin:refund-stock-restore'))
      }
      // 🔔 2026-06-17 (알림 완성도): 직접 어드민 환불 시 바이어 통지 — 클레임 경유 환불은 클레임 알림이 있으나
      //   어드민이 직접 환불하는 경로는 바이어 통지가 없던 누락 보강. fail-soft.
      if (order.distributor_seller_id) {
        createDashboardNotification(
          c.env.DB, 'seller', String(order.distributor_seller_id), 'wholesale_refunded',
          '도매 주문 환불', `주문 #${id} ${remaining.toLocaleString('ko-KR')}원이 환불되었습니다. (${reason})`, '/wholesale/dashboard',
        ).catch(swallow('distributor-admin:notify-refund'))
      }
      return c.json({ success: true, refunded_amount: remaining })
    } catch (err) {
      return safeError(c, err, '환불 처리 중 오류가 발생했습니다', '[distributor-admin]')
    }
  })
}
