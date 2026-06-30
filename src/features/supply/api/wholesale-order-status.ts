/**
 * 🏭 2026-06-27 (대표 — B2B 도매주문 상태머신): wholesale_orders.status 의 canonical 상태 + 허용 전이 SSOT.
 *
 *   기존엔 status 가 free-form TEXT 라 여기저기 ad-hoc UPDATE 로 전이 — 오타/유효하지 않은 전이가 조용히 써질
 *   위험 + DONE/CANCELLED 같은 고아 상태(아무도 안 씀)가 UI 에만 존재. 이 모듈이 전이를 한 곳에서 관리하고,
 *   check-wholesale-order-status.mjs 가드가 정의 밖 상태 write 를 차단한다.
 *
 *   라이프사이클: PENDING → PAID → (ACCEPTED) → SHIPPED → DONE
 *                              ├→ REJECTED  (제조사 거절, 예치금 환불)
 *                              ├→ CANCELLED (판매사 발송 전 취소, 예치금 환불)
 *                              └→ PARTIAL_REFUNDED / REFUNDED (라인/전액 환불)
 *                 PENDING → EXPIRED / FAILED (미결제 만료/실패)
 */
import type { Env } from '@/worker/types/env'
import { swallow } from '@/worker/utils/swallow'
import { cancelTossPayment } from '@/worker/utils/toss-gateway'
import { ensureDepositSchema, refundDeposit, recordDepositTxn, hasDepositRefundTxn } from './wholesale-deposit-core'
import { reverseSupplierOnWholesaleRefund, holdWholesaleSettlements } from './wholesale-settlement'
import { createDashboardNotification } from '@/features/notifications/api/dashboard-notifications.routes'

export const WHOLESALE_ORDER_STATUSES = [
  'PENDING', 'PAID', 'ACCEPTED', 'SHIPPED', 'DONE',
  'REJECTED', 'CANCELLED', 'PARTIAL_REFUNDED', 'REFUNDED', 'FAILED', 'EXPIRED', 'ON_CREDIT',
] as const
export type WholesaleOrderStatus = typeof WHOLESALE_ORDER_STATUSES[number]

/**
 * "활성(매출·정산·목록에 잡히는)" 도매주문 상태 — PENDING(미결제)/거절/취소/환불/실패/만료 제외.
 *   매출집계·거래내역·세금·제조사 발송목록·환불가능 판정의 **표준 집합**. 새 상태 추가 시 여기만 갱신하면
 *   모든 소비처가 일관 반영(2026-06-27 ACCEPTED/DONE 누락으로 매출·발송목록에서 주문이 빠지던 클래스 방지).
 */
export const ACTIVE_WHOLESALE_STATUSES = ['PAID', 'ACCEPTED', 'SHIPPED', 'PARTIAL_REFUNDED', 'DONE'] as const

/** SQL `IN (...)` 절 빌더 — `status IN (${sqlStatusList(ACTIVE_WHOLESALE_STATUSES)})`. 리터럴만(인젝션 무관). */
export const sqlStatusList = (statuses: readonly string[]): string => statuses.map(s => `'${s}'`).join(',')

/** 허용 전이 (from → 가능한 to). terminal(DONE/REJECTED/CANCELLED/REFUNDED/FAILED/EXPIRED)은 키 없음. */
export const WHOLESALE_TRANSITIONS: Record<string, WholesaleOrderStatus[]> = {
  PENDING: ['PAID', 'EXPIRED', 'FAILED'],
  PAID: ['ACCEPTED', 'SHIPPED', 'REJECTED', 'CANCELLED', 'PARTIAL_REFUNDED', 'REFUNDED'],
  ACCEPTED: ['SHIPPED', 'REJECTED', 'CANCELLED', 'PARTIAL_REFUNDED', 'REFUNDED'],
  SHIPPED: ['DONE', 'PARTIAL_REFUNDED', 'REFUNDED'],
  PARTIAL_REFUNDED: ['SHIPPED', 'DONE', 'REFUNDED'],
  ON_CREDIT: ['PAID', 'SHIPPED', 'CANCELLED', 'REFUNDED'],
}

/**
 * 원자적 상태 전이(CAS). `allowedPrev` 중 하나일 때만 `to` 로 전이. extraSetSql 은 추가 SET 절(raw, 예:
 * `, accepted_at=datetime('now')`). 전이 성공(=이 호출이 winner) 여부 반환 → side-effect 단일실행 게이트.
 */
export async function transitionWholesaleOrder(
  DB: D1Database,
  orderId: number,
  to: WholesaleOrderStatus,
  allowedPrev: string[],
  extraSetSql = '',
): Promise<boolean> {
  if (!allowedPrev.length) return false
  const ph = allowedPrev.map(() => '?').join(',')
  const res = await DB.prepare(
    `UPDATE wholesale_orders SET status = ?, updated_at = datetime('now')${extraSetSql} WHERE id = ? AND status IN (${ph})`
  ).bind(to, orderId, ...allowedPrev).run().catch(() => null)
  return !!res && ((res.meta?.changes ?? 0) > 0)
}

export interface WholesaleRefundResult {
  ok: boolean
  already?: boolean
  refundAmount?: number
  error?: string
  code?: string
  httpStatus?: number
}

/**
 * 전액 환불 + 종결상태(CANCELLED/REJECTED/REFUNDED) 전이 — 판매사 발송전취소·제조사 거절·어드민 강제환불 공유.
 *   예치금 주문: refundDeposit + 원장(order_id 멱등). 레거시 Toss 주문: cancelTossPayment(실패 시 롤백).
 *   라인 전부 REFUNDED + 정산 역전(reverseSupplierOnWholesaleRefund) + 재고복원(신규 환불 라인만) + 바이어 알림.
 *   `allowedPrev` 로 호출 맥락별 게이트(예: 취소=발송 전이므로 ['PAID','ACCEPTED']).
 */
export async function refundWholesaleOrderFully(
  env: Env,
  opts: { orderId: number; reason: string; allowedPrev: string[]; finalStatus: 'CANCELLED' | 'REJECTED' | 'REFUNDED'; extraSetSql?: string; notifyTitle?: string },
): Promise<WholesaleRefundResult> {
  const DB = env.DB
  const id = opts.orderId
  const reason = opts.reason
  const order = await DB.prepare(
    'SELECT id, distributor_seller_id, status, payment_key, subtotal, COALESCE(shipping_total,0) AS shipping_total, refunded_amount FROM wholesale_orders WHERE id = ?'
  ).bind(id).first<{ id: number; distributor_seller_id: number; status: string; payment_key: string | null; subtotal: number; shipping_total: number; refunded_amount: number }>()
  if (!order) return { ok: false, error: '주문을 찾을 수 없습니다', httpStatus: 404 }
  if (['REFUNDED', 'CANCELLED', 'REJECTED'].includes(order.status)) return { ok: true, already: true }
  if (!opts.allowedPrev.includes(order.status)) {
    return { ok: false, error: '환불할 수 없는 주문 상태입니다', httpStatus: 400 }
  }
  const remaining = Math.max(0, (order.subtotal || 0) + (order.shipping_total || 0) - (order.refunded_amount || 0))
  if (remaining <= 0 && order.payment_key) return { ok: false, error: '환불할 잔액이 없습니다', httpStatus: 400 }
  const isDeposit = order.payment_key === 'deposit' || !order.payment_key

  // CAS claim — allowedPrev → finalStatus (멱등: changes=0 이면 이미 처리됨).
  const ph = opts.allowedPrev.map(() => '?').join(',')
  const claim = await DB.prepare(
    `UPDATE wholesale_orders SET status=?, refunded_amount = subtotal + COALESCE(shipping_total,0), updated_at = datetime('now')${opts.extraSetSql || ''} WHERE id = ? AND status IN (${ph})`
  ).bind(opts.finalStatus, id, ...opts.allowedPrev).run().catch(() => ({ meta: { changes: 0 } }))
  if (((claim as { meta?: { changes?: number } }).meta?.changes ?? 0) === 0) return { ok: true, already: true }

  // 🛡️ 2026-06-28 (잔여 P1): 환불 확정 직후 정산 보류 — 매숙/지급이 역전과 겹치지 않게.
  await holdWholesaleSettlements(DB, id)

  if (isDeposit) {
    if (remaining > 0) {
      await ensureDepositSchema(DB)
      const already = await hasDepositRefundTxn(DB, id)
      if (!already) {
        const bal = await refundDeposit(DB, order.distributor_seller_id, remaining)
        await recordDepositTxn(DB, order.distributor_seller_id, 'refund', remaining, bal, String(id), `${opts.notifyTitle || '환불'} #${id} (${reason})`)
      }
    }
  } else {
    const res = await cancelTossPayment({
      env, paymentKey: order.payment_key as string, cancelReason: reason,
      cancelAmount: remaining, idempotencyKey: `whs-${opts.finalStatus.toLowerCase()}-${id}`,
    })
    if (!res.ok) {
      // 롤백 — 종결상태 claim 되돌림.
      await DB.prepare(`UPDATE wholesale_orders SET status='PAID', refunded_amount=? WHERE id=? AND status=?`)
        .bind(order.refunded_amount || 0, id, opts.finalStatus).run().catch(swallow('wholesale-refund-full:rollback'))
      return { ok: false, error: res.message || '환불 처리에 실패했습니다', code: res.code, httpStatus: 402 }
    }
  }

  // 라인 전부 REFUNDED + 정산 역전 + 재고복원(신규 환불 라인만 — 이중복원 방지).
  const newLines = await DB.prepare(
    "SELECT product_id, qty FROM wholesale_order_items WHERE wholesale_order_id = ? AND line_status != 'REFUNDED'"
  ).bind(id).all<{ product_id: number; qty: number }>().catch(() => ({ results: [] as { product_id: number; qty: number }[] }))
  await DB.prepare("UPDATE wholesale_order_items SET line_status='REFUNDED' WHERE wholesale_order_id = ? AND line_status != 'REFUNDED'").bind(id).run().catch(swallow('wholesale-refund-full:lines'))
  try { await reverseSupplierOnWholesaleRefund(DB, id, reason) } catch { /* best-effort */ }
  for (const l of newLines.results || []) {
    await DB.prepare(
      "UPDATE products SET stock = COALESCE(stock,0) + ?, sold_count = MAX(0, COALESCE(sold_count,0) - ?), updated_at = datetime('now') WHERE id = ? AND stock IS NOT NULL"
    ).bind(l.qty, l.qty, l.product_id).run().catch(swallow('wholesale-refund-full:stock'))
  }
  if (order.distributor_seller_id) {
    createDashboardNotification(
      DB, 'seller', String(order.distributor_seller_id), 'wholesale_refunded',
      opts.notifyTitle || '도매 주문 환불', `주문 #${id} ${remaining.toLocaleString('ko-KR')}원이 환불되었습니다. (${reason})`, '/wholesale/orders',
    ).catch(swallow('wholesale-refund-full:notify'))
  }
  return { ok: true, refundAmount: remaining }
}
