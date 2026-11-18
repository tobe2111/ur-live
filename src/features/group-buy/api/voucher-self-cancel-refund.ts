/**
 * 💸 이용권 셀프 취소의 **돈 돌려주기** — `group-buy-voucher.routes.ts` 에서 추출 (2026-11-18 대표 승인).
 *
 * 고친 것:
 *   ① 딜 결제 취소가 딜만 돌려주고 주문은 PAID·`refunded_amount=0` 그대로였다 ⇒ 이어서 주문 전체 취소를 하면
 *      `total − 0` 이 **한 번 더** 나갔다. 이제 돌려주기 **전에** 주문에 적는다(상한 CAS · `bookVoucherRefundOnOrder`).
 *      못 적으면(이미 다른 길로 환불됨) 이용권을 되돌리고 멈춘다.
 *   ② 딜+카드 혼합결제(부분결제 게이트)는 이용권 값 **전액**을 카드로 취소 요청했다 ⇒ 승인액 초과로 거절되거나
 *      딜 몫이 영영 안 돌아왔다. 이제 `splitPartialRefund` 로 나눠 카드 몫은 토스, 딜 몫은 딜로 돌려준다.
 *   카드 쪽 async + cron 재시도 설계(아래 주석)는 그대로다.
 */
import type { D1Database } from '@cloudflare/workers-types'
import { bookVoucherRefundOnOrder } from '../../../worker/utils/order-refund-guards'
import { splitPartialRefund } from './partial-deal'

export interface SelfCancelVoucher {
  id: number; user_id: string; order_id: number; product_name: string
  payment_method: string | null; payment_key: string | null
}

type Ctx = { waitUntil?: (p: Promise<unknown>) => void } | undefined
type EnvLike = { TOSS_SECRET_KEY?: string; DISCORD_WEBHOOK_URL?: string }

async function refundDeal(DB: D1Database, v: SelfCancelVoucher, amount: number, orderNumber: string | null, desc: string) {
  const { refundDealPoints } = await import('../../../worker/utils/point-buckets')
  await refundDealPoints(DB, { userId: v.user_id, amount, ref: orderNumber, type: 'refund', description: desc })
}

/** 반환 false = 주문 장부가 이미 다 환불돼 있어 이번 취소를 진행하지 않음(호출부가 이용권을 되돌렸다). */
export async function refundSelfCancelledVoucher(
  DB: D1Database, env: EnvLike, ctx: Ctx, v: SelfCancelVoucher, refundAmount: number,
): Promise<boolean> {
  if (!(refundAmount > 0) || !v.order_id) return true
  const order = await DB.prepare('SELECT order_number, total_amount, COALESCE(deal_used, 0) AS deal_used FROM orders WHERE id = ?')
    .bind(v.order_id).first<{ order_number: string | null; total_amount: number; deal_used: number }>()
  if (!(await bookVoucherRefundOnOrder(DB, v.order_id, refundAmount))) {
    await DB.prepare("UPDATE vouchers SET status = 'unused' WHERE id = ? AND status = 'refunded'").bind(v.id).run()
    return false
  }
  const orderNumber = order?.order_number ?? null

  // 딜 결제 — 즉시 지갑 환불 (💸 2026-07-05 버킷: 원거래 무상 차감분 무상 복원 — refundDealPoints SSOT).
  if (v.payment_method === 'deal_points') {
    await refundDeal(DB, v, refundAmount, orderNumber, `구매 취소 환불: ${v.product_name}`)
    // 🏙️ 2026-07-05: 트리거 주문 셀프취소 → 방문 리워드 회수 (멱등 CAS, fail-soft)
    try {
      const { reverseVisitRewardOnRefund } = await import('../../../worker/utils/visit-reward')
      await reverseVisitRewardOnRefund(DB, orderNumber ?? undefined)
    } catch { /* fail-soft */ }
    return true
  }
  if (v.payment_method !== 'toss' && v.payment_method !== 'CARD') return true

  // 혼합결제: 딜 몫은 딜로(즉시), 카드 몫만 토스로.
  const split = splitPartialRefund({ remainingDeal: Number(order?.deal_used ?? 0), refundAmount, orderTotal: Number(order?.total_amount ?? refundAmount) })
  if (split.deal > 0) {
    await DB.prepare('UPDATE orders SET deal_used = MAX(0, COALESCE(deal_used, 0) - ?) WHERE id = ?').bind(split.deal, v.order_id).run()
    await refundDeal(DB, v, split.deal, orderNumber, `구매 취소 환불(딜 사용분): ${v.product_name}`)
  }
  if (!(split.card > 0)) return true
  // 토스 카드 결제 — cancelTossPayment (waitUntil 비동기, 영업일 3~5일).
  //   ⚠️ 이 async+cron 패턴은 의도된 설계: retryable(5xx/PROVIDER) 실패는 gateway 가
  //   toss_refund_failures 에 기록 → toss-refund-retry cron(최대 5회 backoff)이 완성.
  //   → voucher='refunded' 유지가 정답(동기 revert 로 바꾸면 cron 재시도 성공 시 이중환불).
  const job = (async () => {
    const notifyAdmin = async (errorCode: string | undefined, errorMessage: string | undefined, httpStatus?: number, source = '유저 셀프취소') => {
      const { alertTossRefundFailure } = await import('../../../worker/utils/toss-refund-alert')
      await alertTossRefundFailure(env, DB, { source, paymentKey: v.payment_key, voucherId: v.id, amount: split.card, errorCode, errorMessage, httpStatus })
    }
    try {
      if (!v.payment_key) return
      const { tossCancelPayment } = await import('../../../worker/utils/toss-refund')
      const result = await tossCancelPayment(env as unknown as { TOSS_SECRET_KEY?: string; DB?: D1Database }, v.payment_key, {
        reason: `구매 취소(청약철회): ${v.product_name}`, amount: split.card, idempotencyKey: `voucher-${v.id}-refund`,
      })
      // 🚨 non-retryable(4xx) 실패는 cron 이 안 집음 → 어드민 벨/Discord 로 수동환불 알림.
      if (!result.ok) await notifyAdmin(result.error_code, result.error_message, result.http_status)
    } catch (e) {
      try { await notifyAdmin('EXCEPTION', (e as Error)?.message, undefined, '유저 셀프취소(예외)') } catch { /* fail-soft */ }
    }
  })()
  if (ctx?.waitUntil) ctx.waitUntil(job); else await job
  return true
}

/**
 * 🏪 매장 **부분 환불**(일부만 쓰고 나머지 돌려주기)의 카드 결제 — 2026-11-18 (대표 승인 "매장 부분환불 카드 결제 고치기").
 *   종전 이 경로는 딜 결제만 돈을 돌려주고 카드 결제는 **아무것도 안 하고** `success:true, refunded:N` 을 냈다
 *   (이용권은 `used`, 손님 카드엔 0원). 이제 카드 몫은 토스 부분취소, 혼합결제의 딜 몫은 딜로 돌려준다.
 *   손님이 계산대 앞에 있으므로 **동기**로 결과를 본다: 4xx(되돌릴 수 없는 거절)면 원상복구하고 실패를 알린다,
 *   5xx·네트워크면 게이트웨이가 재시도 큐(toss-refund-retry)에 넣었으니 "처리 중" 으로 받는다.
 */
export async function refundStorePartialCard(
  DB: D1Database, env: EnvLike,
  p: { voucherId: number; userId: string; orderId: number; paymentKey: string | null; dealUsed: number; orderTotal: number; orderNumber: string | null; amount: number; productName: string },
): Promise<{ ok: true; pending: boolean } | { ok: false; error: string }> {
  const split = splitPartialRefund({ remainingDeal: p.dealUsed, refundAmount: p.amount, orderTotal: p.orderTotal })
  let pending = false
  if (split.card > 0) {
    if (!p.paymentKey) return { ok: false, error: '결제 키를 찾을 수 없어 카드 환불을 할 수 없습니다' }
    const { tossCancelPayment } = await import('../../../worker/utils/toss-refund')
    const r = await tossCancelPayment(env as unknown as { TOSS_SECRET_KEY?: string; DB?: D1Database }, p.paymentKey, {
      reason: `부분 사용 환불: ${p.productName}`, amount: split.card, idempotencyKey: `voucher-${p.voucherId}-partial`,
    })
    if (!r.ok) {
      const status = Number(r.http_status ?? 0)
      if (status >= 400 && status < 500) return { ok: false, error: `카드 환불이 거절됐습니다(${r.error_message || r.error_code || status})` }
      pending = true // 재시도 큐가 마저 한다
    }
  }
  if (split.deal > 0) {
    await DB.prepare('UPDATE orders SET deal_used = MAX(0, COALESCE(deal_used, 0) - ?) WHERE id = ?').bind(split.deal, p.orderId).run()
    const { refundDealPoints } = await import('../../../worker/utils/point-buckets')
    await refundDealPoints(DB, { userId: p.userId, amount: split.deal, ref: p.orderNumber, type: 'refund', description: `부분 환불(딜 사용분): ${p.productName}` })
  }
  return { ok: true, pending }
}
