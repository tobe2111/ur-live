/**
 * 🏭 2026-06-26 도매 환불 공유 헬퍼 — 제조사(공급자) 라인 스코프 환불의 단일 구현(SSOT).
 *
 * 배경(전수조사 상태머신 P1): 클레임 승인 환불이 distributor-admin 의 '전액·전 라인' 엔드포인트만
 *   가리켜, 다제조사 주문에서 한 라인만 클레임해도 전액 환불 + 무관 제조사 정산까지 회수됐다.
 *   제조사 본인 반품 승인(wholesale-supplier `/orders/:id/refund`)은 이미 라인 스코프로 올바르게
 *   동작 중이었는데, 그 로직이 라우트 핸들러 안에만 있어 클레임 경로가 재사용할 수 없었다.
 *   → 그 로직을 그대로 이 헬퍼로 추출(behavior-preserving)해 제조사 라우트 + 클레임 승인 양쪽에서 호출.
 *
 * 멱등/정합: 라인 status CAS(REFUNDED 전환 + changes 검사)로 동시/중복 환불 차단, deposit/Toss
 *   분기, `reverseSupplierOnWholesaleRefund(supplierId, productIds)` 스코프 역전(과다 클로백 방지),
 *   전량환불 도달 시 배송비 gap 1회 추가 환불(과다환불 불가). 결제 helper(cancelTossPayment)만 호출.
 */
import type { Env } from '@/worker/types/env'
import { swallow } from '@/worker/utils/swallow'
import { cancelTossPayment } from '@/worker/utils/toss-gateway'
import { reverseSupplierOnWholesaleRefund, holdWholesaleSettlements, reconcileWholesaleHolds } from './wholesale-settlement'
import { ACTIVE_WHOLESALE_STATUSES } from './wholesale-order-status'
import { ensureOrderTables } from './wholesale-helpers'
import { ensureDepositSchema, refundDeposit, recordDepositTxn } from './wholesale-deposit-core'
import { createDashboardNotification } from '@/features/notifications/api/dashboard-notifications.routes'

export interface WholesaleRefundResult {
  ok: boolean
  already?: boolean
  refundAmount?: number
  orderStatus?: string
  error?: string
  code?: string
  httpStatus?: number
}

/**
 * 한 제조사(supplierId)의 미환불 라인을 (선택적으로 itemIds 로 좁혀) 환불한다.
 * - itemIds 미지정: 그 제조사의 모든 미환불 라인.
 * - itemIds 지정: 그 제조사 라인 중 해당 항목만(소유권은 supplier_id 매칭이 보장).
 */
export async function refundWholesaleSupplierLines(
  env: Env,
  params: { orderId: number; supplierId: number; itemIds?: number[]; reason: string; notifyBuyer?: boolean },
): Promise<WholesaleRefundResult> {
  const DB = env.DB
  const { orderId, supplierId, reason } = params
  const notifyBuyer = params.notifyBuyer !== false
  await ensureOrderTables(DB) // shipping_refunded 마커 등 신규 컬럼 보장(콜드 isolate 자가치유).

  const order = await DB.prepare(
    'SELECT id, distributor_seller_id, status, payment_key, subtotal, COALESCE(shipping_total,0) AS shipping_total, refunded_amount FROM wholesale_orders WHERE id = ?'
  ).bind(orderId).first<{ id: number; distributor_seller_id: number; status: string; payment_key: string | null; subtotal: number; shipping_total: number; refunded_amount: number }>()
  if (!order) return { ok: false, error: '주문을 찾을 수 없습니다', httpStatus: 404 }
  // 환불 가능한 주문 상태 = 활성 집합(PAID/ACCEPTED/SHIPPED/PARTIAL_REFUNDED/DONE).
  //   2026-06-27: ACCEPTED(수락 후 발송 전 거절·반품)·DONE(구매확정 후 클레임 반품) 누락으로
  //   제조사 거절/클레임 환불이 막히던 것 — ACTIVE_WHOLESALE_STATUSES 로 상태머신과 동기.
  if (!(ACTIVE_WHOLESALE_STATUSES as readonly string[]).includes(order.status) || !order.payment_key) {
    return { ok: false, error: '환불할 수 없는 주문 상태입니다', httpStatus: 400 }
  }
  const isDeposit = order.payment_key === 'deposit'

  // 내 라인 중 아직 환불 안 된 것. (line_status 도 조회 — Toss 실패 시 정확 롤백용)
  const myLines = await DB.prepare(
    "SELECT id, product_id, qty, line_total, line_status FROM wholesale_order_items WHERE wholesale_order_id = ? AND supplier_id = ? AND line_status != 'REFUNDED'"
  ).bind(orderId, supplierId).all<{ id: number; product_id: number; qty: number; line_total: number; line_status: string }>()
  let lines = myLines.results || []
  if (lines.length === 0) return { ok: false, error: '환불할 내 주문 라인이 없습니다', httpStatus: 400 }

  // 라인 선택 환불 — itemIds 지정 시 그 라인만(내 라인의 부분집합으로만 좁힘 — 타인 라인 지정 불가).
  const rawItemIds = Array.isArray(params.itemIds) ? params.itemIds.map(Number).filter((n: number) => Number.isFinite(n) && n > 0) : []
  if (rawItemIds.length > 0) {
    const allow = new Set(rawItemIds)
    lines = lines.filter(l => allow.has(l.id))
    if (lines.length === 0) return { ok: false, error: '선택한 라인이 환불 가능한 내 주문 라인이 아닙니다', httpStatus: 400 }
  }

  const refundAmount = lines.reduce((s, l) => s + (l.line_total || 0), 0)
  if (refundAmount <= 0) return { ok: false, error: '환불 금액이 올바르지 않습니다', httpStatus: 400 }

  // CAS claim — 내 라인을 REFUNDED 로 원자 전환(동시/중복 환불 차단).
  const lineIds = lines.map(l => l.id)
  const ph = lineIds.map(() => '?').join(',')
  const claimUpd = await DB.prepare(
    `UPDATE wholesale_order_items SET line_status='REFUNDED' WHERE id IN (${ph}) AND line_status != 'REFUNDED'`
  ).bind(...lineIds).run()
  if ((claimUpd.meta?.changes ?? 0) === 0) return { ok: true, already: true }

  // 🛡️ 2026-06-28 (잔여 P1): 환불 확정 직후 *이 환불이 역전할 정산만* 보류(스코프 = 아래 reverseSupplier...과 동일:
  //   supplierId + 환불 라인의 product_id) — 매숙/지급(payout)이 역전과 겹치지 않게. 타 제조사/라인 정산은 무영향.
  await holdWholesaleSettlements(DB, orderId, supplierId, lines.map(l => l.product_id))

  if (isDeposit) {
    // 💰 예치금 주문 — Toss 미경유. 판매사 잔액에 내 라인 합계 복원.
    await ensureDepositSchema(DB)
    const bal = await refundDeposit(DB, order.distributor_seller_id, refundAmount)
    await recordDepositTxn(DB, order.distributor_seller_id, 'refund', refundAmount, bal, `${orderId}-sup${supplierId}-L${lineIds.slice().sort((a, b) => a - b).join('_')}`.slice(0, 120), `제조사 환불 #${orderId} (${reason})`)
  } else {
    // 레거시 Toss 주문 — 부분 취소(잠긴 SSOT helper). 제조사+라인집합 stable idempotency-key.
    const res = await cancelTossPayment({
      env, paymentKey: order.payment_key, cancelReason: reason,
      cancelAmount: refundAmount,
      idempotencyKey: `whs-refund-${orderId}-sup${supplierId}-L${lineIds.slice().sort((a, b) => a - b).join('_')}`.slice(0, 100),
    })
    if (!res.ok) {
      // 롤백 — 각 라인을 환불 전 상태(PENDING/SHIPPED)로 정확히 복구.
      const pendingIds = lines.filter(l => l.line_status === 'PENDING').map(l => l.id)
      const shippedIds = lines.filter(l => l.line_status === 'SHIPPED').map(l => l.id)
      if (pendingIds.length) {
        await DB.prepare(`UPDATE wholesale_order_items SET line_status='PENDING' WHERE id IN (${pendingIds.map(() => '?').join(',')}) AND line_status='REFUNDED'`).bind(...pendingIds).run().catch(swallow('wholesale-refund:rollback-pending'))
      }
      if (shippedIds.length) {
        await DB.prepare(`UPDATE wholesale_order_items SET line_status='SHIPPED' WHERE id IN (${shippedIds.map(() => '?').join(',')}) AND line_status='REFUNDED'`).bind(...shippedIds).run().catch(swallow('wholesale-refund:rollback-shipped'))
      }
      // 🛡️ 2026-06-29 (BUG 2A): 라인이 미환불로 롤백됐으므로 위에서 잡은 hold 를 재정렬해 *열린 클레임이 없으면* 해제
      //   → 정당(미환불) 라인 정산이 영구 동결되는 것 방지. 클레임 승인 경유(아직 open)면 reconcile 이 hold 유지.
      await reconcileWholesaleHolds(DB, orderId)
      return { ok: false, error: res.message || '환불 처리에 실패했습니다', code: res.code, httpStatus: 402 }
    }
  }

  // 제조사 정산 역전 (환불한 라인의 상품만 — 과다 클로백 방지, fail-soft).
  try { await reverseSupplierOnWholesaleRefund(DB, orderId, reason, supplierId, lines.map(l => l.product_id)) } catch { /* best-effort */ }

  // 재고 복원 (환불 라인만).
  for (const l of lines) {
    await DB.prepare(
      "UPDATE products SET stock = COALESCE(stock,0) + ?, sold_count = MAX(0, COALESCE(sold_count,0) - ?), updated_at = datetime('now') WHERE id = ?"
    ).bind(l.qty, l.qty, l.product_id).run().catch(swallow('wholesale-refund:stock-restore'))
  }

  // 누적 환불액 + 주문 상태(전체 환불 시 REFUNDED, 아니면 PARTIAL_REFUNDED).
  //   🛡️ 2026-06-28: MIN clamp 로 refunded_amount 가 grand_total(subtotal+배송비) 초과 못 하게(동시 환불 누적 정합).
  await DB.prepare("UPDATE wholesale_orders SET refunded_amount = MIN(subtotal + COALESCE(shipping_total,0), refunded_amount + ?) WHERE id = ?").bind(refundAmount, orderId).run()
  const remain = await DB.prepare(
    "SELECT COUNT(*) AS c FROM wholesale_order_items WHERE wholesale_order_id = ? AND line_status != 'REFUNDED'"
  ).bind(orderId).first<{ c: number }>()
  const newStatus = (remain?.c ?? 0) === 0 ? 'REFUNDED' : 'PARTIAL_REFUNDED'
  await DB.prepare("UPDATE wholesale_orders SET status = ? WHERE id = ?").bind(newStatus, orderId).run()

  // 🛡️ 2026-06-28 (머니 P0 — 배송비 이중환불 차단): 전량환불 도달 시 미회수 배송비를 **원자적 단발** 환불.
  //   기존엔 배송비 gap 을 함수 진입 시점 stale snapshot(order.refunded_amount)으로 계산해, 동시 다라인/다제조사
  //   환불에서 각 호출이 배송비 전액 gap 을 중복 환불(예: ₩12,000 청구에 ₩24,000 환불)했다. 수정: shipping_refunded
  //   마커 CAS(0→1, + 전 라인 환불완료 NOT EXISTS)로 단 하나의 호출만 winner → 정확히 charged shipping_total 1회 환불.
  if (newStatus === 'REFUNDED') {
    const shipTotal = Math.max(0, Math.floor(Number(order.shipping_total) || 0))
    if (shipTotal > 0) {
      const shipClaim = await DB.prepare(
        `UPDATE wholesale_orders SET shipping_refunded = 1, updated_at = datetime('now')
           WHERE id = ? AND COALESCE(shipping_refunded, 0) = 0
             AND NOT EXISTS (SELECT 1 FROM wholesale_order_items WHERE wholesale_order_id = ? AND line_status != 'REFUNDED')`
      ).bind(orderId, orderId).run().catch(() => ({ meta: { changes: 0 } }))
      if (((shipClaim as { meta?: { changes?: number } }).meta?.changes ?? 0) === 1) {
        let shipApplied = false
        if (isDeposit) {
          const bal2 = await refundDeposit(DB, order.distributor_seller_id, shipTotal)
          await recordDepositTxn(DB, order.distributor_seller_id, 'refund', shipTotal, bal2, `${orderId}-ship`.slice(0, 120), `배송비 환불 #${orderId} (전량환불)`).catch(swallow('wholesale-refund:ship-txn'))
          shipApplied = true
        } else if (order.payment_key && order.payment_key !== 'deposit') {
          const shipRes = await cancelTossPayment({ env, paymentKey: order.payment_key, cancelReason: '배송비 환불(전량환불)', cancelAmount: shipTotal, idempotencyKey: `whs-refund-ship-${orderId}`.slice(0, 100) }).catch(() => null)
          shipApplied = !!(shipRes && shipRes.ok)
        }
        if (shipApplied) {
          await DB.prepare("UPDATE wholesale_orders SET refunded_amount = MIN(subtotal + COALESCE(shipping_total,0), refunded_amount + ?) WHERE id = ?").bind(shipTotal, orderId).run().catch(swallow('wholesale-refund:ship-acc'))
        } else {
          // 환불 실패(Toss) — 마커 롤백해 재시도 허용(과다환불 없이 reconcile).
          await DB.prepare("UPDATE wholesale_orders SET shipping_refunded = 0 WHERE id = ? AND shipping_refunded = 1").bind(orderId).run().catch(swallow('wholesale-refund:ship-rollback'))
        }
      }
    }
  }

  // 판매사(바이어)에게 환불 처리 알림 (fail-soft).
  if (notifyBuyer && order.distributor_seller_id) {
    createDashboardNotification(
      DB, 'seller', String(order.distributor_seller_id), 'wholesale_refunded',
      '도매 주문 환불 처리', `주문 #${orderId} ${refundAmount.toLocaleString('ko-KR')}원이 환불되었습니다 (${newStatus === 'REFUNDED' ? '전체' : '부분'} 환불).`, '/wholesale/dashboard',
    ).catch(swallow('wholesale-refund:notify'))
  }

  return { ok: true, refundAmount, orderStatus: newStatus }
}
