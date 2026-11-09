/**
 * 🔐 2026-11-09 [UNLOCK] — 결제 웹훅 본문을 믿지 않고 Toss 에 다시 묻는다(`docs/locks/toss/2026-11-09-webhook-toss-lookup.md`).
 *
 * V2 결제 웹훅엔 서명이 없어 누구나 그 본문을 보낼 수 있다 — 주문번호·금액은 주문자 본인이 알므로 금액 대조만으로는
 * 위조를 못 막는다. Toss 조회 결과가 **DONE · 같은 주문번호 · 같은 금액**일 때만 확정 가능으로 본다.
 * 조회 실패(네트워크·키 없음)도 불가 — 정상 결제는 `/confirm` 동기 경로가 이미 확정했고, Toss 는 웹훅을 재시도한다.
 *
 * @returns 확정에 쓸 paymentKey(검증됨) 또는 null(확정하지 말 것)
 */
import type { D1Database } from '@cloudflare/workers-types'
import { getTossPayment } from './toss-gateway'
import { captureException } from './sentry'
import { swallow } from './swallow'

export async function verifyWebhookPaymentWithToss(input: {
  DB?: D1Database
  env?: { TOSS_SECRET_KEY?: string }
  orderNumber: string
  paymentKey: string
  totalAmount: unknown
}): Promise<string | null> {
  const { DB, env, orderNumber, totalAmount } = input
  let key = input.paymentKey
  if (!key && DB) {
    // 입금 알림(DEPOSIT_CALLBACK)은 본문에 paymentKey 가 없을 수 있다 — 결제 시작 때 저장한 키로 조회.
    const row = await DB.prepare('SELECT toss_payment_key AS k FROM orders WHERE order_number = ? AND toss_payment_key IS NOT NULL LIMIT 1')
      .bind(orderNumber).first<{ k: string }>().catch(() => null)
    key = row?.k || ''
  }
  const looked = await getTossPayment({ env: env ?? {}, paymentKey: key })
  const want = totalAmount == null ? looked.totalAmount : Number(totalAmount)
  if (looked.ok && looked.status === 'DONE' && looked.orderId === orderNumber && looked.totalAmount === want) return key
  console.error('[WEBHOOK] ❌ TOSS_LOOKUP_MISMATCH — refusing to confirm', { orderNumber, ok: looked.ok, code: looked.code, status: looked.status })
  captureException(new Error('WEBHOOK_TOSS_LOOKUP_MISMATCH'), {
    tags: { area: 'webhook', kind: 'toss_lookup_mismatch', severity: 'critical' },
    extra: { orderNumber, ok: looked.ok, code: looked.code, status: looked.status },
  }).catch(swallow('webhook:sentry-lookup'))
  return null
}
