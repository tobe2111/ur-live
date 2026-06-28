/**
 * 🛡️ 2026-06-01 주문 전액 환불 공유 루틴 (머니플로우 감사 후속).
 *
 * 검증된 returns.routes.ts 환불 경로의 헬퍼 조합을 단일 함수로 추출 —
 * 셀러 주문 환불 등 새 시나리오가 같은 (올바른) 로직을 재사용.
 *
 * 포함: Toss 카드취소(또는 딜포인트 환불) + CAS 상태전이(멱등) + 재고복원/디지털 revoke +
 *       추천/affiliate 커미션 역전(올바른 컬럼) + 공급자/영입자 적립 역전.
 *
 * ⚠️ 잠긴 SSOT helper(tossCancelPayment)는 호출만. 상태전이는 transitionOrderStatus CAS 로 멱등.
 */
import { swallow } from './swallow'

export interface RefundOrderResult {
  ok: boolean
  status: 200 | 400 | 402 | 404 | 422
  error?: string
  code?: string
  already?: boolean
  refundAmount?: number
}

interface OrderRow {
  id: number
  order_number: string
  user_id: string
  seller_id: number | null
  status: string
  total_amount: number | null
  amount: number | null
  toss_payment_key: string | null
  payment_key: string | null
  payment_method: string | null
}

const CANCELLABLE = ['PAID', 'DONE', 'PREPARING', 'SHIPPING', 'DELIVERED']

/**
 * 🛡️ 2026-06-26 전액 환불/취소 시 **부가 적립·쿠폰·이용권 역전** (order_id 멱등, 전부 best-effort).
 *
 * 디지털 access revoke · affiliate 적립 역전 · 공급자/영입자/에이전시 매장영입 역전 · 구매자
 * referral_bonus 회수 · 쿠폰 un-use · 이용권 정산 clawback. 전부 order_id/order_number 기준이라
 * 멱등(2회차엔 대상 0). **Toss 취소/상태전이/재고/딜/referral_commissions 는 미포함** — 호출자가 처리.
 *
 * `refundOrderFully` 와 인라인 취소/환불 경로(order.routes.ts)가 같은 대칭 역전을 공유해
 * 한쪽만 고치는 drift 를 막는다(머니 룰 #2).
 */
export async function reverseOrderAncillaryOnRefund(
  DB: D1Database,
  orderId: number,
  orderNumber: string | null,
  reason: string,
): Promise<void> {
  // 디지털 access revoke (물리 재고복원은 호출자 — 여기선 디지털만).
  await DB.prepare("UPDATE digital_product_access SET status = 'revoked' WHERE order_id = ? AND status = 'active'")
    .bind(orderId).run().catch(swallow('order-refund:digital'))

  // affiliate 적립 역전.
  try {
    const aff = await DB.prepare(
      "SELECT referrer_id, commission FROM affiliate_earnings WHERE order_id = ? AND COALESCE(status,'pending') IN ('granted','pending')"
    ).bind(orderId).all<{ referrer_id: string; commission: number }>()
    if (aff.results && aff.results.length > 0) {
      await DB.batch(aff.results.map(r =>
        DB.prepare("UPDATE user_points SET balance = MAX(0, balance - ?), updated_at = datetime('now') WHERE user_id = ?")
          .bind(r.commission, r.referrer_id)
      )).catch(swallow('order-refund:affiliate-points'))
      await DB.prepare("UPDATE affiliate_earnings SET status = 'refunded' WHERE order_id = ? AND COALESCE(status,'pending') IN ('granted','pending')")
        .bind(orderId).run().catch(swallow('order-refund:affiliate-status'))
    }
    await DB.prepare("UPDATE affiliate_earnings SET status = 'refunded' WHERE order_id = ? AND COALESCE(status,'pending') = 'holding'")
      .bind(orderId).run().catch(swallow('order-refund:affiliate-holding'))
  } catch { /* table may not exist */ }

  // 공급자(B2B) + 영입자 + 에이전시 매장영입 적립 역전.
  try {
    const { reverseSupplierOnRefund } = await import('../../features/supply/api/supply-settlement')
    await reverseSupplierOnRefund(DB, orderId, 'order_refund')
  } catch { /* 비공급 주문 — best-effort */ }
  try {
    const { reverseInfluencerStoreIntroOnRefund } = await import('./influencer-store-intro-commission')
    await reverseInfluencerStoreIntroOnRefund(DB, orderId, 'order_refund')
  } catch { /* best-effort */ }
  try {
    const { reverseAgencyStoreIntroOnRefund } = await import('./agency-store-intro-commission')
    await reverseAgencyStoreIntroOnRefund(DB, orderId, 'order_refund')
  } catch { /* best-effort */ }
  // 구매자 referral_bonus 포인트 회수.
  try {
    const { reverseReferralBonusOnRefund } = await import('../../features/group-buy/api/helpers')
    if (orderNumber) await reverseReferralBonusOnRefund(DB, String(orderNumber))
  } catch { /* best-effort */ }

  // 쿠폰 사용 복원 — coupon_uses 삭제 + used_count 감소(재사용 가능).
  try {
    const cu = await DB.prepare('SELECT coupon_id FROM coupon_uses WHERE order_id = ?')
      .bind(orderId).all<{ coupon_id: number }>().catch(() => ({ results: [] as Array<{ coupon_id: number }> }))
    for (const row of (cu?.results ?? [])) {
      await DB.prepare('UPDATE coupons SET used_count = MAX(0, used_count - 1) WHERE id = ?')
        .bind(row.coupon_id).run().catch(swallow('order-refund:coupon-count'))
    }
    await DB.prepare('DELETE FROM coupon_uses WHERE order_id = ?')
      .bind(orderId).run().catch(swallow('order-refund:coupon-uses'))
  } catch { /* best-effort — coupon_uses 부재 등 */ }

  // 이용권 정산 clawback (무효화 + 매장 정산 회수).
  try {
    const { clawbackVoucherSettlementOnRefund } = await import('./voucher-settlement-clawback')
    await clawbackVoucherSettlementOnRefund(DB, orderId, `order_refund:${reason}`)
  } catch { /* best-effort — 이용권 없는 주문 등 */ }
}

/**
 * 주문을 전액 환불한다. 멱등(이미 REFUNDED 면 already:true).
 * @param expectSellerId 지정 시 order.seller_id 와 일치해야 함(IDOR 방지). 미지정 시 호출자가 이미 검증.
 */
export async function refundOrderFully(
  DB: D1Database,
  env: { TOSS_SECRET_KEY?: string },
  orderIdOrNumber: string | number,
  opts: { reason: string; expectSellerId?: string | number },
): Promise<RefundOrderResult> {
  const order = await DB.prepare(
    `SELECT id, order_number, user_id, seller_id, status,
            total_amount, amount, toss_payment_key, payment_key, payment_method
       FROM orders WHERE (id = ? OR order_number = ?) LIMIT 1`
  ).bind(orderIdOrNumber, orderIdOrNumber).first<OrderRow>()

  if (!order) return { ok: false, status: 404, error: '주문을 찾을 수 없습니다' }

  // IDOR — 호출자 소유권 검증.
  if (opts.expectSellerId != null && String(order.seller_id) !== String(opts.expectSellerId)) {
    return { ok: false, status: 404, error: '주문을 찾을 수 없습니다' }
  }

  const status = String(order.status || '').toUpperCase()
  if (status === 'REFUNDED') return { ok: true, status: 200, already: true }
  if (!CANCELLABLE.includes(status)) {
    return { ok: false, status: 400, error: `현재 상태(${status})에서는 환불할 수 없습니다` }
  }

  const amount = Math.max(0, Math.floor(Number(order.total_amount ?? order.amount ?? 0)))
  const paymentKey = order.toss_payment_key || order.payment_key
  const isDeal = order.payment_method === 'deal_points'

  // 1. 카드 결제 → Toss 취소 (실패 시 상태 미변경).
  if (!isDeal) {
    if (!paymentKey) {
      return { ok: false, status: 422, error: '결제 키를 찾을 수 없습니다. 고객센터에 문의해주세요.', code: 'PAYMENT_KEY_MISSING' }
    }
    const { tossCancelPayment } = await import('./toss-payments')
    const res = await tossCancelPayment(paymentKey, env.TOSS_SECRET_KEY as string, opts.reason, amount || undefined)
    if (!res.success) {
      return { ok: false, status: 402, error: res.message || '환불 처리에 실패했습니다', code: res.code }
    }
  }

  // 2. CAS 상태전이 → REFUNDED (멱등 — 이미 전이됐으면 후속 side-effect skip).
  const { transitionOrderStatus } = await import('./state-machine')
  const transitioned = await transitionOrderStatus(DB, Number(order.id), 'REFUNDED', {
    allowedPrev: CANCELLABLE,
    extraSets: { refund_status: 'completed', refunded_at: new Date().toISOString() },
  })
  if (!transitioned) return { ok: true, status: 200, already: true }

  // 3. 딜포인트 결제 → 포인트 환급.
  if (isDeal && amount > 0) {
    await DB.prepare('UPDATE user_points SET balance = balance + ? WHERE user_id = ?')
      .bind(amount, String(order.user_id)).run().catch(swallow('order-refund:deal-points'))
    await DB.prepare(
      "INSERT INTO point_transactions (user_id, type, amount, points_amount, description) VALUES (?, 'refund', ?, ?, ?)"
    ).bind(String(order.user_id), amount, amount, `[환불] 주문 취소 (order:${order.order_number})`).run()
      .catch(swallow('order-refund:deal-tx'))
  }

  // 3b. 💸 2026-06-17 혼합결제(Toss+딜) 의 '딜 사용분' 복원 (적립-역전 대칭, 머니 룰 #2).
  //   전액 딜(isDeal)은 step3 가 처리 → 여기선 카드/Toss 주문의 부분 딜만(중복 방지).
  //   CAS 전이 후라 1회만 실행(멱등). deal_used 컬럼 부재 시 best-effort skip.
  if (!isDeal) {
    try {
      const dealRow = await DB.prepare('SELECT deal_used FROM orders WHERE id = ?')
        .bind(Number(order.id)).first<{ deal_used: number | null }>().catch(() => null)
      const dealUsed = Math.max(0, Math.round(Number(dealRow?.deal_used ?? 0)))
      if (dealUsed > 0) {
        const { adjustUserPoints } = await import('./point-ledger')
        await adjustUserPoints(DB, {
          userId: order.user_id, delta: dealUsed, type: 'refund',
          description: `[환불] 주문 딜 사용분 복원 (order:${order.order_number})`, orderId: order.id,
        })
        // 잔여 딜 원장 0 — 부분반품이 일부 복원했어도 전액환불은 남은 만큼만 복원(위 SELECT) 후 소진.
        await DB.prepare('UPDATE orders SET deal_used = 0 WHERE id = ?').bind(Number(order.id)).run().catch(swallow('order-refund:deal-used-zero'))
      }
    } catch { /* best-effort — deal_used 컬럼 부재 등 */ }
  }

  // 4. 재고 복원(물리상품) + order_items CANCELLED. (디지털 revoke 는 아래 부가역전 헬퍼.)
  try {
    const items = await DB.prepare(`
      SELECT oi.product_id, oi.quantity, p.product_kind
      FROM order_items oi LEFT JOIN products p ON p.id = oi.product_id
      WHERE oi.order_id = ? AND (oi.status IS NULL OR oi.status != 'CANCELLED')
    `).bind(Number(order.id)).all<{ product_id: number; quantity: number; product_kind: string | null }>()
    const phys = (items.results || []).filter(it => !it.product_kind || it.product_kind === 'physical')
    if (phys.length > 0) {
      await DB.batch(phys.map(it => DB.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').bind(it.quantity, it.product_id)))
    }
    await DB.prepare("UPDATE order_items SET status = 'CANCELLED' WHERE order_id = ?")
      .bind(Number(order.id)).run().catch(swallow('order-refund:items'))
  } catch { /* best-effort */ }

  // 5. 추천 커미션 역전 (올바른 컬럼: beneficiary_id / commission_amount).
  try {
    const comm = await DB.prepare(
      "SELECT beneficiary_id, commission_amount FROM referral_commissions WHERE order_id = ? AND status = 'granted'"
    ).bind(Number(order.id)).all<{ beneficiary_id: string; commission_amount: number }>()
    if (comm.results && comm.results.length > 0) {
      await DB.batch(comm.results.map(r =>
        DB.prepare("UPDATE user_points SET balance = MAX(0, balance - ?), updated_at = datetime('now') WHERE user_id = ?")
          .bind(r.commission_amount, r.beneficiary_id)
      )).catch(swallow('order-refund:referral-points'))
      await DB.prepare("UPDATE referral_commissions SET status = 'withdrawn', withdrawn_at = datetime('now') WHERE order_id = ? AND status = 'granted'")
        .bind(Number(order.id)).run().catch(swallow('order-refund:referral-status'))
    }
    // ⏳ 2026-06-15 (T+7 hold): 미성숙(pending=보류, 잔액 미적립) 추천 커미션은 잔액 회수 없이 상태만 닫음 —
    //   성숙 cron 의 주문-status 가드와 이중 안전망. granted clawback 과 달리 user_points 변경 없음.
    await DB.prepare("UPDATE referral_commissions SET status = 'withdrawn', withdrawn_at = datetime('now') WHERE order_id = ? AND status = 'pending'")
      .bind(Number(order.id)).run().catch(swallow('order-refund:referral-pending'))
  } catch { /* table may not exist */ }

  // 6~9b. 부가 적립·쿠폰·이용권·디지털 역전 (공유 헬퍼 — 인라인 취소/환불 경로와 대칭 공유).
  //   affiliate · 공급자/영입자/에이전시 매장영입 · referral_bonus · 쿠폰 un-use · 이용권 clawback ·
  //   디지털 access revoke. 전부 order_id 멱등(CAS 전이 후라 1회만). (referral_commissions 는 step5 인라인.)
  await reverseOrderAncillaryOnRefund(DB, Number(order.id), order.order_number, opts.reason)

  // 8. 누적 환불액 기록.
  await DB.prepare('UPDATE orders SET refunded_amount = COALESCE(refunded_amount, 0) + ? WHERE id = ?')
    .bind(amount, Number(order.id)).run().catch(swallow('order-refund:amount'))

  return { ok: true, status: 200, refundAmount: amount }
}
