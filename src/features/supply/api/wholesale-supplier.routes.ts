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
import { refundWholesaleSupplierLines } from './wholesale-refund'
import { ensureOrderTables } from './wholesale-helpers'
import { transitionWholesaleOrder, ACTIVE_WHOLESALE_STATUSES, sqlStatusList } from './wholesale-order-status'
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
    await ensureOrderTables(DB) // 📦 드랍십 라인 컬럼(option_label/ship_to_*) 보장(콜드 isolate — 이 read 는 ensure 안 거침).
    const { results } = await DB.prepare(`
      SELECT i.id AS item_id, i.wholesale_order_id, i.name, i.qty, i.base_supply_price,
             (i.base_supply_price * i.qty) AS settle_amount,
             i.courier, i.tracking_number, i.shipped_at, i.line_status,
             i.option_label, i.ext_order_no, i.ship_to_message,
             o.status AS order_status, o.created_at, o.paid_at,
             -- 📦 드랍십: 라인별 받는사람 우선, 없으면 주문(판매사) 배송지 폴백.
             COALESCE(i.ship_to_name, o.ship_to_name) AS ship_to_name,
             COALESCE(i.ship_to_phone, o.ship_to_phone) AS ship_to_phone,
             COALESCE(i.ship_to_address, o.ship_to_address) AS ship_to_address,
             COALESCE(i.ship_to_postal, o.ship_to_postal) AS ship_to_postal
      FROM wholesale_order_items i
      JOIN wholesale_orders o ON o.id = i.wholesale_order_id
      WHERE i.supplier_id = ? AND o.status IN (${sqlStatusList(ACTIVE_WHOLESALE_STATUSES)})
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
    await ensureOrderTables(DB) // 📦 드랍십 라인 컬럼 보장(콜드 isolate).
    const onlyToShip = c.req.query('status') !== 'all'
    const statusWhere = onlyToShip ? "AND i.line_status = 'PENDING'" : ''
    const { results } = await DB.prepare(`
      SELECT i.id AS item_id, i.wholesale_order_id, i.name, i.qty, i.base_supply_price,
             (i.base_supply_price * i.qty) AS settle_amount, i.line_status,
             i.option_label, i.ext_order_no, i.ship_to_message,
             COALESCE(i.ship_to_name, o.ship_to_name) AS ship_to_name,
             COALESCE(i.ship_to_phone, o.ship_to_phone) AS ship_to_phone,
             COALESCE(i.ship_to_address, o.ship_to_address) AS ship_to_address,
             COALESCE(i.ship_to_postal, o.ship_to_postal) AS ship_to_postal, o.paid_at
      FROM wholesale_order_items i
      JOIN wholesale_orders o ON o.id = i.wholesale_order_id
      WHERE i.supplier_id = ? AND o.status IN (${sqlStatusList(ACTIVE_WHOLESALE_STATUSES)}) ${statusWhere}
      ORDER BY o.created_at DESC LIMIT 5000
    `).bind(sid).all<Record<string, unknown>>()
    // 📦 드랍십 발송용 — 받는분/주소/옵션/배송메시지 포함(제조사가 각 받는사람에게 직배).
    const headers = ['item_id', 'order_id', '주문번호', '상품명', '옵션', '수량', '공급가', '정산금액', '상태', '받는분', '연락처', '주소', '우편번호', '배송메시지', '결제일', 'courier', 'tracking_number']
    const rows: (string | number | null | undefined)[][] = (results || []).map(r => [
      Number(r.item_id), Number(r.wholesale_order_id), String(r.ext_order_no ?? ''), String(r.name ?? ''), String(r.option_label ?? ''), Number(r.qty),
      Number(r.base_supply_price), Number(r.settle_amount), String(r.line_status ?? ''),
      String(r.ship_to_name ?? ''), String(r.ship_to_phone ?? ''), String(r.ship_to_address ?? ''),
      String(r.ship_to_postal ?? ''), String(r.ship_to_message ?? ''), String(r.paid_at ?? ''), '', '',
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
        // 🛡️ 2026-06-28: line_status='PENDING' 가드 추가 — 사전 SELECT(위)와 batch UPDATE 사이에 라인이 REFUNDED 로
        //   바뀌어도 되살아나지 않게(단건 ship/ship-all 과 동일 가드). REFUNDED/SHIPPED 라인은 changes=0 으로 멱등 skip.
        "UPDATE wholesale_order_items SET courier=?, tracking_number=?, shipped_at=datetime('now'), line_status='SHIPPED' WHERE id=? AND supplier_id=? AND line_status='PENDING'"
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
         WHERE id IN (${ph}) AND status IN ('PAID','ACCEPTED','PARTIAL_REFUNDED')
           AND NOT EXISTS (SELECT 1 FROM wholesale_order_items wi WHERE wi.wholesale_order_id = wholesale_orders.id AND wi.line_status NOT IN ('SHIPPED','REFUNDED'))`
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
          '도매 주문 발송 시작', `주문 #${b.id} 상품이 발송되었습니다.`, '/wholesale/orders',
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
      "SELECT COUNT(*) AS c FROM wholesale_order_items WHERE wholesale_order_id = ? AND line_status NOT IN ('SHIPPED','REFUNDED')"
    ).bind(line.wholesale_order_id).first<{ c: number }>()
    if ((pending?.c ?? 0) === 0) {
      await DB.prepare("UPDATE wholesale_orders SET status='SHIPPED', shipped_at=datetime('now') WHERE id=? AND status IN ('PAID','ACCEPTED','PARTIAL_REFUNDED')")
        .bind(line.wholesale_order_id).run()
    }
    // 🔔 2026-06-26 (알림 누락 보강): 단건 송장 입력도 판매사(바이어)에게 발송 알림 — 기존엔 ship-all 만 통지했음.
    if (line.distributor_seller_id) {
      createDashboardNotification(
        DB, 'seller', String(line.distributor_seller_id), 'wholesale_shipped',
        '도매 주문 발송 시작', `주문 #${line.wholesale_order_id} 상품이 발송되었습니다. (${courier} ${tracking})`, '/wholesale/orders',
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
    if (!['PAID', 'ACCEPTED', 'SHIPPED', 'PARTIAL_REFUNDED'].includes(order.status)) {
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
      "SELECT COUNT(*) AS c FROM wholesale_order_items WHERE wholesale_order_id = ? AND line_status NOT IN ('SHIPPED','REFUNDED')"
    ).bind(orderId).first<{ c: number }>()
    if ((pending?.c ?? 0) === 0) {
      await DB.prepare("UPDATE wholesale_orders SET status='SHIPPED', shipped_at=datetime('now') WHERE id=? AND status IN ('PAID','ACCEPTED','PARTIAL_REFUNDED')")
        .bind(orderId).run()
    }

    // 🔔 2026-06-17 (알림 루프 보강): 판매사(바이어)에게 배송 시작 알림 — 기존엔 제조사만 신규주문 알림을 받고
    //   발송 시 바이어 통지가 없었음. fail-soft(알림 실패가 발송 처리를 막지 않음).
    if (order.distributor_seller_id) {
      createDashboardNotification(
        DB, 'seller', String(order.distributor_seller_id), 'wholesale_shipped',
        '도매 주문 발송 시작', `주문 #${orderId} 상품이 발송되었습니다. (${courier} ${tracking})`, '/wholesale/orders',
      ).catch(swallow('wholesale-supplier:notify-ship'))
    }
    return c.json({ success: true, shipped })
  } catch (err) {
    return safeError(c, err, '일괄 발송 중 오류가 발생했습니다', '[wholesale-supplier]')
  }
})

// ── POST /orders/:id/accept — 제조사 주문 수락 (PAID → ACCEPTED) ──────────────
//   2026-06-27 (대표 — 제조사 확인 단계): 내 라인이 있는 주문을 '수락'해 발송대기로. 수락 없이 바로
//   발송도 허용(ship 가 PAID/ACCEPTED 둘 다)이라, 수락은 명시적 acknowledgement + 바이어 통지용.
app.post('/orders/:id/accept', async (c) => {
  const sid = supplierId(c)
  if (!sid) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const { DB } = c.env
  const orderId = Number(c.req.param('id'))
  if (!Number.isFinite(orderId) || orderId <= 0) return c.json({ success: false, error: '잘못된 주문 ID' }, 400)
  try {
    await ensureOrderTables(DB) // accepted_at 등 신규 컬럼 보장(콜드 isolate — 이 라우트는 wholesale.routes ensure 를 안 거침).
    const own = await DB.prepare(
      "SELECT wo.id, wo.status, wo.distributor_seller_id FROM wholesale_orders wo JOIN wholesale_order_items wi ON wi.wholesale_order_id = wo.id WHERE wo.id = ? AND wi.supplier_id = ? LIMIT 1"
    ).bind(orderId, sid).first<{ id: number; status: string; distributor_seller_id: number | null }>()
    if (!own) return c.json({ success: false, error: '주문을 찾을 수 없습니다' }, 404)
    if (own.status === 'ACCEPTED') return c.json({ success: true, already: true })
    const ok = await transitionWholesaleOrder(DB, orderId, 'ACCEPTED', ['PAID'], ", accepted_at=datetime('now')")
    if (!ok) return c.json({ success: false, error: '수락할 수 없는 주문 상태입니다' }, 400)
    if (own.distributor_seller_id) {
      createDashboardNotification(
        DB, 'seller', String(own.distributor_seller_id), 'wholesale_accepted',
        '도매 주문 수락됨', `주문 #${orderId} 을(를) 제조사가 수락했습니다. 곧 발송됩니다.`, '/wholesale/orders',
      ).catch(swallow('wholesale-supplier:notify-accept'))
    }
    return c.json({ success: true })
  } catch (err) {
    return safeError(c, err, '주문 수락 중 오류가 발생했습니다', '[wholesale-supplier]')
  }
})

// ── POST /orders/:id/reject — 제조사 주문 거절 (발송 전, 내 라인 환불) ──────────
//   2026-06-27 (대표 — 제조사 거절): 발송 전 주문을 거절 → 내 라인 환불(예치금 복원+정산역전+재고복원).
//   단일 제조사 주문이 전액 환불되면 상태를 REJECTED 로(거절 명시). 다중이면 PARTIAL_REFUNDED 유지.
app.post('/orders/:id/reject', async (c) => {
  const sid = supplierId(c)
  if (!sid) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const { DB } = c.env
  const orderId = Number(c.req.param('id'))
  if (!Number.isFinite(orderId) || orderId <= 0) return c.json({ success: false, error: '잘못된 주문 ID' }, 400)
  try {
    await ensureOrderTables(DB) // rejected_at/reject_reason 등 신규 컬럼 보장(콜드 isolate).
    const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
    const reason = String(body.reason || '제조사 거절').slice(0, 100)
    // 발송 전만 거절 가능 — 내 라인 중 SHIPPED 있으면 거절 불가(반품 경로로).
    const shipped = await DB.prepare(
      "SELECT COUNT(*) AS c FROM wholesale_order_items WHERE wholesale_order_id = ? AND supplier_id = ? AND line_status = 'SHIPPED'"
    ).bind(orderId, sid).first<{ c: number }>()
    if ((shipped?.c ?? 0) > 0) return c.json({ success: false, error: '이미 발송된 라인은 거절할 수 없습니다 (반품으로 처리)' }, 400)
    const r = await refundWholesaleSupplierLines(c.env, { orderId, supplierId: sid, reason, notifyBuyer: true })
    if (!r.ok) return c.json({ success: false, error: r.error, code: r.code }, (r.httpStatus as 400 | 402 | 404) || 400)
    if (r.already) return c.json({ success: true, already: true })
    // 전액 환불(단일 제조사)이면 REJECTED 로 명확화 + 사유 기록.
    if (r.orderStatus === 'REFUNDED') {
      await DB.prepare("UPDATE wholesale_orders SET status='REJECTED', rejected_at=datetime('now'), reject_reason=?, updated_at=datetime('now') WHERE id=? AND status='REFUNDED'")
        .bind(reason, orderId).run().catch(swallow('wholesale-supplier:reject-mark'))
    } else {
      await DB.prepare("UPDATE wholesale_orders SET rejected_at=datetime('now'), reject_reason=? WHERE id=?")
        .bind(reason, orderId).run().catch(swallow('wholesale-supplier:reject-stamp'))
    }
    return c.json({ success: true, refunded_amount: r.refundAmount, order_status: r.orderStatus })
  } catch (err) {
    return safeError(c, err, '주문 거절 중 오류가 발생했습니다', '[wholesale-supplier]')
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
    // 🏭 2026-06-26: 라인 스코프 환불 로직은 공유 헬퍼(wholesale-refund.ts)로 추출 — 클레임 승인 경로와
    //   단일 구현 공유(상태머신 P1: 클레임 전액환불·과다 클로백 수정). 동작 byte-동일(behavior-preserving).
    const itemIds = Array.isArray(body.item_ids) ? (body.item_ids as unknown[]).map(Number).filter((n: number) => Number.isFinite(n) && n > 0) : undefined
    const r = await refundWholesaleSupplierLines(c.env, { orderId, supplierId: sid, itemIds, reason })
    if (!r.ok) return c.json({ success: false, error: r.error, code: r.code }, (r.httpStatus as 400 | 402 | 404) || 400)
    if (r.already) return c.json({ success: true, already: true })
    return c.json({ success: true, refunded_amount: r.refundAmount, order_status: r.orderStatus })
  } catch (err) {
    return safeError(c, err, '환불 처리 중 오류가 발생했습니다', '[wholesale-supplier]')
  }
})

export { app as wholesaleSupplierRoutes }
