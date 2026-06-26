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
import { swallow } from '@/worker/utils/swallow'
import { requireSupplier } from '@/worker/middleware/auth'
import { cancelTossPayment } from '@/worker/utils/toss-gateway'
import { reverseSupplierOnWholesaleRefund } from './wholesale-settlement'
import { ensureDepositSchema, refundDeposit, recordDepositTxn } from './wholesale-deposit-core'
import { parseCsv } from './supply-csv'
import { buildXlsx, xlsxResponse } from './xlsx'
import { createDashboardNotification } from '@/features/notifications/api/dashboard-notifications.routes'

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
      WHERE i.supplier_id = ? AND o.status IN ('PAID','SHIPPED','PARTIAL_REFUNDED')
      ORDER BY o.created_at DESC LIMIT 200
    `).bind(sid).all()
    return c.json({ success: true, items: results ?? [] })
  } catch (err) {
    return safeError(c, err, '도매 주문 조회 중 오류가 발생했습니다', '[wholesale-supplier]')
  }
})

// ── GET /orders/export — 발송대기 주문 라인 CSV (주문 많을 경우 엑셀 다운) ─────────
app.get('/orders/export', async (c) => {
  const sid = supplierId(c)
  if (!sid) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const { DB } = c.env
  try {
    const onlyToShip = c.req.query('status') !== 'all'
    const statusWhere = onlyToShip ? "AND i.line_status = 'PENDING'" : ''
    const { results } = await DB.prepare(`
      SELECT i.id AS item_id, i.wholesale_order_id, i.name, i.qty, i.base_supply_price,
             (i.base_supply_price * i.qty) AS settle_amount, i.line_status,
             o.ship_to_name, o.ship_to_phone, o.ship_to_address, o.ship_to_postal, o.paid_at
      FROM wholesale_order_items i
      JOIN wholesale_orders o ON o.id = i.wholesale_order_id
      WHERE i.supplier_id = ? AND o.status IN ('PAID','SHIPPED','PARTIAL_REFUNDED') ${statusWhere}
      ORDER BY o.created_at DESC LIMIT 5000
    `).bind(sid).all<Record<string, unknown>>()
    const headers = ['item_id', 'order_id', '상품명', '수량', '공급가', '정산금액', '상태', '받는분', '연락처', '주소', '우편번호', '결제일', 'courier', 'tracking_number']
    const rows: (string | number | null | undefined)[][] = (results || []).map(r => [
      Number(r.item_id), Number(r.wholesale_order_id), String(r.name ?? ''), Number(r.qty),
      Number(r.base_supply_price), Number(r.settle_amount), String(r.line_status ?? ''),
      String(r.ship_to_name ?? ''), String(r.ship_to_phone ?? ''), String(r.ship_to_address ?? ''),
      String(r.ship_to_postal ?? ''), String(r.paid_at ?? ''), '', '',
    ])
    return xlsxResponse(buildXlsx(headers, rows), `wholesale-orders-${new Date().toISOString().slice(0, 10)}.xlsx`)
  } catch (err) {
    return safeError(c, err, '주문 내보내기 중 오류가 발생했습니다', '[wholesale-supplier]')
  }
})

// ── POST /tracking/bulk — 송장 일괄 업로드 (CSV: item_id, courier, tracking_number) ──
app.post('/tracking/bulk', async (c) => {
  const sid = supplierId(c)
  if (!sid) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const { DB } = c.env
  try {
    const body = await c.req.json<{ csv?: string }>().catch(() => ({} as { csv?: string }))
    if (!body.csv || typeof body.csv !== 'string') return c.json({ success: false, error: 'CSV 데이터가 없습니다' }, 400)
    const rows = parseCsv(body.csv, 5000)
    if (!rows.length) return c.json({ success: false, error: '처리할 행이 없습니다' }, 400)

    const results: { item_id: number; status: 'ok' | 'skip' | 'error'; reason?: string }[] = []
    // 입력 정규화 + item_id → {courier, tracking} (중복 시 마지막 우선).
    const want = new Map<number, { courier: string; tracking: string }>()
    for (const r of rows) {
      const itemId = Number(r.item_id || r['item_id'])
      const courier = String(r.courier || '').trim().slice(0, 40)
      const tracking = String(r.tracking_number || r.tracking || '').trim().slice(0, 60)
      if (!Number.isFinite(itemId) || itemId <= 0) { results.push({ item_id: itemId || 0, status: 'error', reason: 'item_id 오류' }); continue }
      if (!courier || !tracking) { results.push({ item_id: itemId, status: 'skip', reason: '택배사/운송장 누락' }); continue }
      want.set(itemId, { courier, tracking })
    }

    // 🛡️ 내 라인 일괄 조회 (IN 청크 — SQLite 변수 한도 999 회피). 행별 SELECT 제거.
    const ids = [...want.keys()]
    const owned = new Map<number, { wholesale_order_id: number; line_status: string }>()
    for (let i = 0; i < ids.length; i += 400) {
      const chunk = ids.slice(i, i + 400)
      const ph = chunk.map(() => '?').join(',')
      const { results: found } = await DB.prepare(
        `SELECT id, wholesale_order_id, line_status FROM wholesale_order_items WHERE supplier_id = ? AND id IN (${ph})`
      ).bind(sid, ...chunk).all<{ id: number; wholesale_order_id: number; line_status: string }>()
      for (const l of found || []) owned.set(l.id, { wholesale_order_id: l.wholesale_order_id, line_status: l.line_status })
    }

    // UPDATE statement 모아 batch 청크 실행.
    const stmts: D1PreparedStatement[] = []
    const affectedOrders = new Set<number>()
    for (const [itemId, v] of want) {
      const line = owned.get(itemId)
      if (!line) { results.push({ item_id: itemId, status: 'error', reason: '내 주문 라인 아님' }); continue }
      if (line.line_status === 'REFUNDED') { results.push({ item_id: itemId, status: 'skip', reason: '환불된 라인' }); continue }
      stmts.push(DB.prepare(
        "UPDATE wholesale_order_items SET courier=?, tracking_number=?, shipped_at=datetime('now'), line_status='SHIPPED' WHERE id=? AND supplier_id=?"
      ).bind(v.courier, v.tracking, itemId, sid))
      affectedOrders.add(line.wholesale_order_id)
      results.push({ item_id: itemId, status: 'ok' })
    }
    for (let i = 0; i < stmts.length; i += 100) await DB.batch(stmts.slice(i, i + 100))

    // 영향 주문 중 미발송 라인이 없는 것 → SHIPPED (한 문장, 청크).
    const oids = [...affectedOrders]
    for (let i = 0; i < oids.length; i += 400) {
      const chunk = oids.slice(i, i + 400)
      const ph = chunk.map(() => '?').join(',')
      await DB.prepare(
        `UPDATE wholesale_orders SET status='SHIPPED', shipped_at=datetime('now')
         WHERE id IN (${ph}) AND status='PAID'
           AND NOT EXISTS (SELECT 1 FROM wholesale_order_items wi WHERE wi.wholesale_order_id = wholesale_orders.id AND wi.line_status != 'SHIPPED')`
      ).bind(...chunk).run().catch(swallow('supplier:ship-all-order-status'))
    }

    // 🔔 2026-06-26 (알림 누락 보강): CSV 일괄 송장 업로드도 영향 주문별로 판매사(바이어)에게 발송 알림.
    //   기존엔 ship-all 단일 엔드포인트만 통지 → CSV 경로로 발송하면 바이어가 영영 몰랐음. fail-soft.
    if (oids.length > 0) {
      const buyers = await DB.prepare(
        `SELECT id, distributor_seller_id FROM wholesale_orders WHERE id IN (${oids.map(() => '?').join(',')})`
      ).bind(...oids).all<{ id: number; distributor_seller_id: number | null }>().catch(() => ({ results: [] as Array<{ id: number; distributor_seller_id: number | null }> }))
      for (const b of buyers.results || []) {
        if (!b.distributor_seller_id) continue
        createDashboardNotification(
          DB, 'seller', String(b.distributor_seller_id), 'wholesale_shipped',
          '도매 주문 발송 시작', `주문 #${b.id} 상품이 발송되었습니다.`, '/wholesale/dashboard',
        ).catch(swallow('wholesale-supplier:notify-ship-bulk'))
      }
    }
    const ok = results.filter(r => r.status === 'ok').length
    return c.json({ success: true, summary: { total: results.length, ok, skipped: results.filter(r => r.status === 'skip').length, failed: results.filter(r => r.status === 'error').length }, results })
  } catch (err) {
    return safeError(c, err, '송장 일괄 업로드 중 오류가 발생했습니다', '[wholesale-supplier]')
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

    // 소유권: 내 supplier_id 라인만. (distributor_seller_id 는 발송 알림용.)
    const line = await DB.prepare(
      `SELECT wi.id, wi.wholesale_order_id, wo.distributor_seller_id
         FROM wholesale_order_items wi
         JOIN wholesale_orders wo ON wo.id = wi.wholesale_order_id
        WHERE wi.id = ? AND wi.supplier_id = ?`
    ).bind(itemId, sid).first<{ id: number; wholesale_order_id: number; distributor_seller_id: number | null }>()
    if (!line) return c.json({ success: false, error: '항목을 찾을 수 없습니다' }, 404)

    // 🛡️ 2026-06-25 (전수조사): line_status='PENDING' CAS — 가드 없으면 REFUNDED 라인이 SHIPPED 로 되살아나거나
    //   동시 발송이 서로의 송장 덮어씀. ship-all(아래)은 이미 PENDING 가드 — 이 단건만 누락이었음.
    const shipUpd = await DB.prepare(
      "UPDATE wholesale_order_items SET courier=?, tracking_number=?, shipped_at=datetime('now'), line_status='SHIPPED' WHERE id=? AND supplier_id=? AND line_status='PENDING'"
    ).bind(courier, tracking, itemId, sid).run()
    if ((shipUpd.meta?.changes ?? 0) === 0) return c.json({ success: true, already: true })

    // 주문의 모든 라인이 발송완료면 주문 상태도 SHIPPED.
    const pending = await DB.prepare(
      "SELECT COUNT(*) AS c FROM wholesale_order_items WHERE wholesale_order_id = ? AND line_status != 'SHIPPED'"
    ).bind(line.wholesale_order_id).first<{ c: number }>()
    if ((pending?.c ?? 0) === 0) {
      await DB.prepare("UPDATE wholesale_orders SET status='SHIPPED', shipped_at=datetime('now') WHERE id=? AND status='PAID'")
        .bind(line.wholesale_order_id).run()
    }
    // 🔔 2026-06-26 (알림 누락 보강): 단건 송장 입력도 판매사(바이어)에게 발송 알림 — 기존엔 ship-all 만 통지했음.
    if (line.distributor_seller_id) {
      createDashboardNotification(
        DB, 'seller', String(line.distributor_seller_id), 'wholesale_shipped',
        '도매 주문 발송 시작', `주문 #${line.wholesale_order_id} 상품이 발송되었습니다. (${courier} ${tracking})`, '/wholesale/dashboard',
      ).catch(swallow('wholesale-supplier:notify-ship-single'))
    }
    return c.json({ success: true })
  } catch (err) {
    return safeError(c, err, '송장 입력 중 오류가 발생했습니다', '[wholesale-supplier]')
  }
})

// ── POST /orders/:id/ship-all — 합배송: 주문 내 내(제조사) 미발송 라인 전체를 송장 1개로 일괄 발송 ──
//   같은 제조사가 한 주문에 여러 상품 → 박스 하나 → 송장 하나. 라인별 반복 입력 제거.
//   소유권: 내 supplier_id 라인만. SHIPPED/REFUNDED 라인은 건너뜀(멱등).
app.post('/orders/:id/ship-all', async (c) => {
  const sid = supplierId(c)
  if (!sid) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const { DB } = c.env
  const orderId = Number(c.req.param('id'))
  if (!Number.isFinite(orderId) || orderId <= 0) return c.json({ success: false, error: '잘못된 주문 ID' }, 400)
  try {
    const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
    const courier = String(body.courier || '').trim().slice(0, 40)
    const tracking = String(body.tracking_number || '').trim().slice(0, 60)
    if (!courier || !tracking) return c.json({ success: false, error: '택배사와 운송장 번호를 입력해주세요' }, 400)

    // 주문 존재 + 발송 가능 상태 확인.
    const order = await DB.prepare("SELECT id, status, distributor_seller_id FROM wholesale_orders WHERE id = ?")
      .bind(orderId).first<{ id: number; status: string; distributor_seller_id: number }>()
    if (!order) return c.json({ success: false, error: '주문을 찾을 수 없습니다' }, 404)
    if (!['PAID', 'SHIPPED', 'PARTIAL_REFUNDED'].includes(order.status)) {
      return c.json({ success: false, error: '발송할 수 없는 주문 상태입니다' }, 400)
    }

    // 내 미발송(PENDING) 라인 일괄 발송 — 한 문장 원자 처리(소유권 + 상태 가드).
    const upd = await DB.prepare(
      "UPDATE wholesale_order_items SET courier=?, tracking_number=?, shipped_at=datetime('now'), line_status='SHIPPED' WHERE wholesale_order_id=? AND supplier_id=? AND line_status='PENDING'"
    ).bind(courier, tracking, orderId, sid).run()
    const shipped = upd.meta?.changes ?? 0
    if (shipped === 0) return c.json({ success: true, already: true, shipped: 0 })

    // 주문의 모든 라인이 발송완료면 주문 상태도 SHIPPED.
    const pending = await DB.prepare(
      "SELECT COUNT(*) AS c FROM wholesale_order_items WHERE wholesale_order_id = ? AND line_status != 'SHIPPED'"
    ).bind(orderId).first<{ c: number }>()
    if ((pending?.c ?? 0) === 0) {
      await DB.prepare("UPDATE wholesale_orders SET status='SHIPPED', shipped_at=datetime('now') WHERE id=? AND status='PAID'")
        .bind(orderId).run()
    }

    // 🔔 2026-06-17 (알림 루프 보강): 판매사(바이어)에게 배송 시작 알림 — 기존엔 제조사만 신규주문 알림을 받고
    //   발송 시 바이어 통지가 없었음. fail-soft(알림 실패가 발송 처리를 막지 않음).
    if (order.distributor_seller_id) {
      createDashboardNotification(
        DB, 'seller', String(order.distributor_seller_id), 'wholesale_shipped',
        '도매 주문 발송 시작', `주문 #${orderId} 상품이 발송되었습니다. (${courier} ${tracking})`, '/wholesale/dashboard',
      ).catch(swallow('wholesale-supplier:notify-ship'))
    }
    return c.json({ success: true, shipped })
  } catch (err) {
    return safeError(c, err, '일괄 발송 중 오류가 발생했습니다', '[wholesale-supplier]')
  }
})

// ── POST /orders/:id/refund — 반품 승인(제조사 본인 라인만 부분환불) ──────────
//   다중 제조사 주문에서 호출한 제조사의 라인만 환불 — 다른 제조사 라인 무영향.
app.post('/orders/:id/refund', async (c) => {
  const sid = supplierId(c)
  if (!sid) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const { DB } = c.env
  const orderId = Number(c.req.param('id'))
  if (!Number.isFinite(orderId) || orderId <= 0) return c.json({ success: false, error: '잘못된 주문 ID' }, 400)
  try {
    const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
    const reason = String(body.reason || '판매자 반품 승인').slice(0, 100)

    const order = await DB.prepare(
      'SELECT id, distributor_seller_id, status, payment_key, subtotal, COALESCE(shipping_total,0) AS shipping_total, refunded_amount FROM wholesale_orders WHERE id = ?'
    ).bind(orderId).first<{ id: number; distributor_seller_id: number; status: string; payment_key: string | null; subtotal: number; shipping_total: number; refunded_amount: number }>()
    if (!order) return c.json({ success: false, error: '주문을 찾을 수 없습니다' }, 404)
    if (!['PAID', 'SHIPPED', 'PARTIAL_REFUNDED'].includes(order.status) || !order.payment_key) {
      return c.json({ success: false, error: '환불할 수 없는 주문 상태입니다' }, 400)
    }
    const isDeposit = order.payment_key === 'deposit'

    // 내 라인 중 아직 환불 안 된 것. (line_status 도 조회 — Toss 실패 시 정확 롤백용)
    const myLines = await DB.prepare(
      "SELECT id, product_id, qty, line_total, line_status FROM wholesale_order_items WHERE wholesale_order_id = ? AND supplier_id = ? AND line_status != 'REFUNDED'"
    ).bind(orderId, sid).all<{ id: number; product_id: number; qty: number; line_total: number; line_status: string }>()
    let lines = myLines.results || []
    if (lines.length === 0) return c.json({ success: false, error: '환불할 내 주문 라인이 없습니다' }, 400)

    // 🛡️ 2026-06-12 (라인 선택 환불 — UI 개선): body.item_ids 지정 시 그 라인만 환불.
    //   소유권은 위 supplier_id=sid 쿼리가 보장 — item_ids 는 내 라인의 부분집합으로만 좁힘(타인 라인 지정 불가).
    //   미지정 시 기존 동작(내 전체 라인) 그대로 — additive, 하위호환.
    const rawItemIds = Array.isArray(body.item_ids) ? (body.item_ids as unknown[]).map(Number).filter((n: number) => Number.isFinite(n) && n > 0) : []
    if (rawItemIds.length > 0) {
      const allow = new Set(rawItemIds)
      lines = lines.filter(l => allow.has(l.id))
      if (lines.length === 0) return c.json({ success: false, error: '선택한 라인이 환불 가능한 내 주문 라인이 아닙니다' }, 400)
    }

    const refundAmount = lines.reduce((s, l) => s + (l.line_total || 0), 0)
    if (refundAmount <= 0) return c.json({ success: false, error: '환불 금액이 올바르지 않습니다' }, 400)

    // CAS claim — 내 라인을 REFUNDED 로 원자 전환(동시/중복 환불 차단).
    const lineIds = lines.map(l => l.id)
    const ph = lineIds.map(() => '?').join(',')
    const claim = await DB.prepare(
      `UPDATE wholesale_order_items SET line_status='REFUNDED' WHERE id IN (${ph}) AND line_status != 'REFUNDED'`
    ).bind(...lineIds).run()
    const claimed = claim.meta?.changes ?? 0
    if (claimed === 0) return c.json({ success: true, already: true })

    if (isDeposit) {
      // 💰 예치금 주문 — Toss 미경유. 판매사 잔액에 내 라인 합계 복원.
      //   라인-status CAS(위)가 이미 멱등 — claimed>0 인 이 thread 만 복원하므로 이중복원 없음.
      //   ref_id 는 주문-제조사-claim 단위로 기록(부분환불 추적). 실패해도 자금은 복원되도록 best-effort.
      await ensureDepositSchema(DB)
      const bal = await refundDeposit(DB, order.distributor_seller_id, refundAmount)
      // ref 에 라인 집합 포함 — 같은 주문의 연속 부분환불(라인 선택)이 원장에서 구분되도록.
      await recordDepositTxn(DB, order.distributor_seller_id, 'refund', refundAmount, bal, `${orderId}-sup${sid}-L${lineIds.slice().sort((a, b) => a - b).join('_')}`.slice(0, 120), `제조사 환불 #${orderId} (${reason})`)
    } else {
      // 레거시 Toss 주문 — 부분 취소(잠긴 SSOT helper). 제조사별 stable idempotency-key.
      // 🛡️ 2026-06-12: 멱등키에 라인 집합 포함 — 라인 선택 환불 도입으로 같은 주문에서
      //   부분환불이 2회+ 발생 가능. 키가 주문 고정이면 2번째 취소가 Toss dedupe 로 무시됨(미환불 사고).
      //   같은 라인 집합 재시도는 같은 키(정렬) → 기존 retry-dedupe 의미는 보존.
      const res = await cancelTossPayment({
        env: c.env, paymentKey: order.payment_key, cancelReason: reason,
        cancelAmount: refundAmount,
        idempotencyKey: `whs-refund-${orderId}-sup${sid}-L${lineIds.slice().sort((a, b) => a - b).join('_')}`.slice(0, 100),
      })
      if (!res.ok) {
        // 롤백 — 각 라인을 환불 전 상태(PENDING/SHIPPED)로 정확히 복구. PENDING 라인이 SHIPPED 로 둔갑하던 버그 fix.
        const pendingIds = lines.filter(l => l.line_status === 'PENDING').map(l => l.id)
        const shippedIds = lines.filter(l => l.line_status === 'SHIPPED').map(l => l.id)
        if (pendingIds.length) {
          await DB.prepare(`UPDATE wholesale_order_items SET line_status='PENDING' WHERE id IN (${pendingIds.map(() => '?').join(',')}) AND line_status='REFUNDED'`).bind(...pendingIds).run().catch(swallow('wholesale-supplier:refund-rollback-pending'))
        }
        if (shippedIds.length) {
          await DB.prepare(`UPDATE wholesale_order_items SET line_status='SHIPPED' WHERE id IN (${shippedIds.map(() => '?').join(',')}) AND line_status='REFUNDED'`).bind(...shippedIds).run().catch(swallow('wholesale-supplier:refund-rollback-shipped'))
        }
        return c.json({ success: false, error: res.message || '환불 처리에 실패했습니다', code: res.code }, 402)
      }
    }

    // 제조사 정산 역전 (환불한 라인의 상품만 — 일부 라인 환불 시 과다 클로백 방지, fail-soft).
    try { await reverseSupplierOnWholesaleRefund(DB, orderId, reason, sid, lines.map(l => l.product_id)) } catch { /* best-effort */ }

    // 재고 복원 (내 라인만).
    for (const l of lines) {
      await DB.prepare(
        "UPDATE products SET stock = COALESCE(stock,0) + ?, sold_count = MAX(0, COALESCE(sold_count,0) - ?), updated_at = datetime('now') WHERE id = ?"
      ).bind(l.qty, l.qty, l.product_id).run().catch(swallow('wholesale-supplier:refund-stock-restore'))
    }

    // 누적 환불액 + 주문 상태(전체 환불 시 REFUNDED, 아니면 PARTIAL_REFUNDED).
    await DB.prepare("UPDATE wholesale_orders SET refunded_amount = refunded_amount + ? WHERE id = ?").bind(refundAmount, orderId).run()
    const remain = await DB.prepare(
      "SELECT COUNT(*) AS c FROM wholesale_order_items WHERE wholesale_order_id = ? AND line_status != 'REFUNDED'"
    ).bind(orderId).first<{ c: number }>()
    const newStatus = (remain?.c ?? 0) === 0 ? 'REFUNDED' : 'PARTIAL_REFUNDED'
    await DB.prepare("UPDATE wholesale_orders SET status = ? WHERE id = ?").bind(newStatus, orderId).run()

    // 🛡️ 2026-06-25 (전수조사 머니버그): 바이어는 chargeTotal = subtotal + shipping_total 을 결제했는데,
    //   라인 환불은 line_total(상품 소계)만 복원 → 전량환불(REFUNDED)에도 배송비 미환불 = 바이어 손해.
    //   전량환불 도달 시 미회수 잔액(=배송비)을 1회 추가 환불. gap 계산이라 절대 과다환불 없음.
    //   라인-status CAS 로 remain===0 은 단 한 thread 만 도달 → 멱등(이중 shipping 환불 불가).
    if (newStatus === 'REFUNDED') {
      const totalCharge = (order.subtotal || 0) + (order.shipping_total || 0)
      const refundedSoFar = (order.refunded_amount || 0) + refundAmount
      const shippingRefund = Math.max(0, totalCharge - refundedSoFar)
      if (shippingRefund > 0) {
        // 🛡️ 2026-06-25 (전수조사 보강): Toss 취소 실패 시 refunded_amount 를 올리면 안 됨(돈 안 갔는데 '전액환불'
        //   기록) → 라인환불과 동일하게 성공 시에만 누적. deposit 은 로컬write라 항상 적용.
        let shipApplied = false
        if (isDeposit) {
          const bal2 = await refundDeposit(DB, order.distributor_seller_id, shippingRefund)
          await recordDepositTxn(DB, order.distributor_seller_id, 'refund', shippingRefund, bal2, `${orderId}-ship`.slice(0, 120), `배송비 환불 #${orderId} (전량환불)`).catch(swallow('wholesale-supplier:refund-ship-txn'))
          shipApplied = true
        } else if (order.payment_key && order.payment_key !== 'deposit') {
          const shipRes = await cancelTossPayment({ env: c.env, paymentKey: order.payment_key, cancelReason: '배송비 환불(전량환불)', cancelAmount: shippingRefund, idempotencyKey: `whs-refund-ship-${orderId}`.slice(0, 100) }).catch(() => null)
          shipApplied = !!(shipRes && shipRes.ok) // 실패 시 미누적 → reconcile/재시도 여지
        }
        if (shipApplied) {
          await DB.prepare("UPDATE wholesale_orders SET refunded_amount = refunded_amount + ? WHERE id = ?").bind(shippingRefund, orderId).run().catch(swallow('wholesale-supplier:refund-ship-acc'))
        }
      }
    }

    // 🔔 2026-06-17 (알림 완성도): 판매사(바이어)에게 환불 처리 알림 — 입금확인/발송/출금/클레임엔 알림이
    //   있었으나 제조사 직접 환불(반품 승인)만 바이어 통지가 없던 누락 보강. fail-soft.
    if (order.distributor_seller_id) {
      createDashboardNotification(
        DB, 'seller', String(order.distributor_seller_id), 'wholesale_refunded',
        '도매 주문 환불 처리', `주문 #${orderId} ${refundAmount.toLocaleString('ko-KR')}원이 환불되었습니다 (${newStatus === 'REFUNDED' ? '전체' : '부분'} 환불).`, '/wholesale/dashboard',
      ).catch(swallow('wholesale-supplier:notify-refund'))
    }
    return c.json({ success: true, refunded_amount: refundAmount, order_status: newStatus })
  } catch (err) {
    return safeError(c, err, '환불 처리 중 오류가 발생했습니다', '[wholesale-supplier]')
  }
})

export { app as wholesaleSupplierRoutes }
