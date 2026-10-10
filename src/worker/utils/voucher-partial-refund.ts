/**
 * 🎟️ 이용권 **일부 환불** 실행 (2026-09-28 대표 *"일부 환불 가능하게 해줘"*).
 *
 * 설계(왜 금액이 아니라 장수인가)는 `shared/partial-voucher-refund.ts` 머리말에 있다.
 * 여기는 그 계획대로 **돈을 움직이고 이용권을 회수하는** 자리다.
 *
 * ## 🔴 머니 경로 — 이 파일이 지키는 것
 *  1. **claim-before-credit**: `refunded_amount` 를 CAS 로 **먼저** 올리고 그 다음에 토스를 부른다.
 *     동시 요청 둘이 같은 잔액을 읽고 각자 환불하는 일을 막는다(머니 룰 #1). 토스가 거절하면
 *     예약을 되돌린다 — 안 되돌리면 실패한 환불이 잔액만 갉아먹는다.
 *  2. **환불한 장만 회수**: `clawbackVoucherSettlementOnRefund` 에 **voucher id 목록**을 넘긴다.
 *     주문 전체를 넘기면 손님이 그대로 들고 있는 이용권까지 무효가 된다(환불이 아니라 몰수).
 *  3. **게이트**: `voucher_partial_refund_enabled`(platform_settings, 기본 OFF). 켜기 전에는
 *     `cancel_qty` 요청이 403 이고 나머지 경로는 **byte-동일**하게 돈다.
 *
 * ## ⚠️ 이 변경이 **안 하는** 것 (알고 남긴다)
 *  어필리에이트·영입자 커미션은 **주문 단위 전액 역전** 헬퍼밖에 없어서, 부분 환불에 그대로
 *  부르면 손님이 **가지고 있는 장의 커미션까지** 회수된다(과다 역전 — 남의 돈을 뺏는 쪽 오류).
 *  그래서 부르지 않는다. 결과적으로 무른 장의 커미션(매출의 2% 안팎)이 남는다 —
 *  **적게 회수하는 쪽**의 오류이고, 플랫폼이 감수한다. 비례 역전은 별건이다(핸드오프에 기록).
 *  🔄 2026-10-10: **인플루언서 추천·중개사 몫·어필리에이트**는 이제 회수된다 — `clawbackVoucherSettlementOnRefund`
 *  가 무른 장마다 바우처 단위 SSOT(`clawbackVoucherCommission`, 장수 비례)를 부른다. 위 문단이 남는 것은
 *  주문 단위 헬퍼뿐인 **영입자(store_intro)** 커미션이다.
 */
import type { Context } from 'hono'
import type { Env } from '../types/env'
import { planPartialVoucherRefund, type PartialVoucherPlan } from '../../shared/partial-voucher-refund'
import { clawbackVoucherSettlementOnRefund } from './voucher-settlement-clawback'
import { tossCancelPayment } from './toss-payments'
import { swallow } from './swallow'
import { notifyOrderCancelled } from './order-cancel-notify'

interface OrderLike {
  id: number | string
  order_number: string
  user_id: number | string
  seller_id?: number | string | null
  total_amount?: number | null
  refunded_amount?: number | null
  payment_method?: string | null
}

/** 게이트 — 기본 OFF. 켜기 전에는 이 기능이 존재하지 않는 것과 같다. */
export async function isVoucherPartialRefundEnabled(DB: D1Database): Promise<boolean> {
  const row = await DB.prepare("SELECT value FROM platform_settings WHERE key = 'voucher_partial_refund_enabled' LIMIT 1")
    .first<{ value: string }>().catch(() => null)
  return String(row?.value ?? 'false') === 'true'
}

/**
 * `cancel_qty` 요청이면 처리하고 Response 를 돌려준다.
 * **null 을 돌려주면 호출부는 종전 경로를 그대로 탄다** — 장수 요청이 아니거나,
 * 남은 것을 전부 무르는 경우(= 주문 전체 취소라 `refundOrderFully` 가 받아야 한다).
 */
export async function tryVoucherPartialRefund<E extends { Bindings: Env }>(
  c: Context<E>,
  order: OrderLike,
  cancelQty: number | undefined,
  reason: string,
): Promise<Response | null> {
  if (cancelQty === undefined) return null
  const DB = c.env.DB
  const orderId = Number(order.id)

  if (!(await isVoucherPartialRefundEnabled(DB))) {
    return c.json(
      { success: false, error: '이용권 일부 환불은 아직 준비 중입니다', code: 'VOUCHER_PARTIAL_REFUND_DISABLED' },
      403,
    )
  }

  const vres = await DB.prepare('SELECT id, status, applied_price FROM vouchers WHERE order_id = ?')
    .bind(orderId)
    .all<{ id: number; status: string; applied_price: number | null }>()
    .catch(() => ({ results: [] as Array<{ id: number; status: string; applied_price: number | null }> }))

  const plan: PartialVoucherPlan = planPartialVoucherRefund({
    vouchers: vres.results ?? [],
    requestedQty: Number(cancelQty),
    orderTotal: Number(order.total_amount ?? 0),
    alreadyRefunded: Number(order.refunded_amount ?? 0),
  })

  if (!plan.ok) return c.json({ success: false, error: plan.error, code: plan.code }, 400)
  // 남은 것을 전부 무르면 그건 부분이 아니라 전체 취소다 — 전액 경로가 커미션·쿠폰까지 대칭 역전한다.
  if (plan.isFull) return null
  if (plan.amount <= 0) {
    return c.json({ success: false, error: '환불할 금액이 없습니다', code: 'NOTHING_TO_REFUND' }, 400)
  }

  // ── ① 먼저 잔액을 선점한다(CAS). 토스보다 **앞**이어야 한다. ──
  const reserve = await DB.prepare(
    "UPDATE orders SET refunded_amount = COALESCE(refunded_amount,0) + ?, updated_at = datetime('now') WHERE id = ? AND COALESCE(refunded_amount,0) + ? <= total_amount",
  ).bind(plan.amount, orderId, plan.amount).run().catch(() => null)
  if (!reserve || (reserve.meta?.changes ?? 0) === 0) {
    return c.json({ success: false, error: '취소 가능 금액을 초과하거나 이미 처리 중입니다' }, 409)
  }
  const rollback = async (tag: string) => {
    await DB.prepare(
      'UPDATE orders SET refunded_amount = MAX(0, COALESCE(refunded_amount,0) - ?) WHERE id = ?',
    ).bind(plan.amount, orderId).run().catch(swallow(`voucher-partial:rollback-${tag}`))
  }

  // ── ② 돈을 돌려준다 — 딜 결제면 딜로, 카드면 토스 부분취소로. ──
  if (String(order.payment_method ?? '') === 'deal_points') {
    try {
      const { refundDealPoints } = await import('./point-buckets')
      await refundDealPoints(DB, {
        userId: String(order.user_id),
        amount: plan.amount,
        ref: [order.order_number, String(orderId)],
        type: 'refund',
        description: `[환불] 이용권 ${plan.voucherIds.length}장 (order:${order.order_number})`,
      })
    } catch (e) {
      await rollback('deal')
      console.error('[voucher-partial] deal refund failed', e)
      return c.json({ success: false, error: '딜 환급에 실패했습니다. 잠시 후 다시 시도해 주세요' }, 502)
    }
  } else {
    // 🔑 결제키는 두 칸을 **둘 다** 본다. 이용권 카드 주문은 `payment_key` 에만 들어 있어서
    //   `toss_payment_key` 만 보던 종전 경로가 422 로 막혀 있었다(`refundOrderFully` 는 폴백 보유).
    const pay = await DB.prepare('SELECT toss_payment_key, payment_key FROM orders WHERE id = ?')
      .bind(orderId).first<{ toss_payment_key: string | null; payment_key: string | null }>().catch(() => null)
    const paymentKey = pay?.toss_payment_key || pay?.payment_key
    if (!paymentKey) {
      await rollback('nokey')
      return c.json({ success: false, error: '결제 키를 찾을 수 없습니다. 고객센터에 문의해 주세요.', code: 'PAYMENT_KEY_MISSING' }, 422)
    }
    const secret = c.env.TOSS_SECRET_KEY
    if (!secret) {
      await rollback('nosecret')
      return c.json({ success: false, error: 'Payment service unavailable' }, 503)
    }
    const toss = await tossCancelPayment(paymentKey, secret, reason, plan.amount)
    if (!toss.success) {
      await rollback('toss')
      return c.json({ success: false, error: `결제 취소 실패: ${toss.message}`, code: toss.code }, 422)
    }
  }

  // ── ③ 무른 장만 회수한다. 돈은 이미 나갔으므로 여기서 실패해도 환불을 되돌리지 않는다
  //      (되돌리면 손님은 돈도 못 받고 이용권도 잃는다). 실패는 크게 남긴다. ──
  let voided = 0
  try {
    const r = await clawbackVoucherSettlementOnRefund(DB, orderId, `voucher_partial:${reason}`, plan.voucherIds)
    voided = r.voided + r.reclaimedPending + r.clawbackOwed
  } catch (e) {
    console.error('[voucher-partial] clawback failed — 환불은 나갔는데 이용권이 살아 있다', { orderId, voucherIds: plan.voucherIds, e })
  }

  // ── ④ 혼합결제(카드+딜)의 딜 사용분을 **무른 비율만큼** 돌려준다. ──
  try {
    const dealUsed = Math.max(0, Math.round(Number((order as { deal_used?: number }).deal_used ?? 0)))
    const total = Math.max(1, Math.round(Number(order.total_amount ?? 0)))
    if (dealUsed > 0 && String(order.payment_method ?? '') !== 'deal_points') {
      const back = Math.min(dealUsed, Math.round(dealUsed * (plan.amount / total)))
      if (back > 0) {
        const { refundDealPoints } = await import('./point-buckets')
        await refundDealPoints(DB, {
          userId: String(order.user_id),
          amount: back,
          ref: [String(orderId), order.order_number],
          type: 'refund',
          description: `[환불] 혼합결제 딜분 (order:${order.order_number})`,
        })
      }
    }
  } catch (e) {
    console.error('[voucher-partial] mixed deal refund failed', e)
  }

  await notifyOrderCancelled(
    DB, order, '이용권 일부 환불',
    `${plan.voucherIds.length}장 · ${plan.amount.toLocaleString('ko-KR')}원 환불`,
  )

  return c.json({
    success: true,
    message: `이용권 ${plan.voucherIds.length}장이 환불되었습니다`,
    data: {
      order_id: orderId,
      refunded_qty: plan.voucherIds.length,
      voided_vouchers: voided,
      cancel_amount: plan.amount,
      cancelled_at: new Date().toISOString(),
    },
  })
}
