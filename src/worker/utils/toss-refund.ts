/**
 * 🛡️ 2026-05-18: 토스페이먼츠 환불 API 헬퍼.
 *
 *   POST https://api.tosspayments.com/v1/payments/{paymentKey}/cancel
 *   Header: Authorization: Basic base64(TOSS_SECRET_KEY:), Idempotency-Key
 *   Body:   { cancelReason, cancelAmount? (부분환불) }
 *
 *   응답 200: cancels: [{ transactionKey, cancelAmount, cancelReason, ... }]
 *   응답 4xx/5xx: { code, message } — 에러 분기.
 *
 *   호출처: stay-bookings cancel / admin refund / 일반 주문 환불.
 *   재시도: 5xx 만 1회 재시도 (2초 후). 4xx 는 즉시 실패 (cardError 등).
 */
type TossEnv = { TOSS_SECRET_KEY?: string }

export interface RefundResult {
  ok: boolean
  cancel_amount?: number
  transaction_key?: string
  error_code?: string
  error_message?: string
  http_status?: number
}

export async function tossCancelPayment(
  env: TossEnv,
  paymentKey: string,
  options: { reason: string; amount?: number; idempotencyKey: string },
): Promise<RefundResult> {
  const secret = env.TOSS_SECRET_KEY
  if (!secret) {
    return { ok: false, error_code: 'NO_SECRET', error_message: 'TOSS_SECRET_KEY 미설정' }
  }
  if (!paymentKey || paymentKey.length < 5) {
    return { ok: false, error_code: 'INVALID_PAYMENT_KEY', error_message: 'paymentKey 형식 오류' }
  }

  const body: { cancelReason: string; cancelAmount?: number } = {
    cancelReason: options.reason.slice(0, 200),
  }
  if (options.amount != null && Number.isFinite(options.amount) && options.amount > 0) {
    body.cancelAmount = Math.floor(options.amount)
  }

  const auth = btoa(`${secret}:`)
  const url = `https://api.tosspayments.com/v1/payments/${encodeURIComponent(paymentKey)}/cancel`

  // 5xx 만 한번 재시도 (2초 후).
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': options.idempotencyKey,
        },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({})) as Record<string, unknown>
      if (res.ok) {
        const cancels = Array.isArray((data as { cancels?: unknown[] }).cancels)
          ? (data as { cancels: Array<{ transactionKey?: string; cancelAmount?: number }> }).cancels
          : []
        const last = cancels[cancels.length - 1]
        return {
          ok: true,
          cancel_amount: Number(last?.cancelAmount) || options.amount,
          transaction_key: last?.transactionKey,
          http_status: res.status,
        }
      }
      // 5xx 재시도, 4xx 즉시 실패.
      if (res.status >= 500 && attempt === 0) {
        await new Promise((r) => setTimeout(r, 2000))
        continue
      }
      return {
        ok: false,
        error_code: String((data as { code?: string }).code || `HTTP_${res.status}`),
        error_message: String((data as { message?: string }).message || `토스 환불 실패 (${res.status})`),
        http_status: res.status,
      }
    } catch (err) {
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 2000))
        continue
      }
      return { ok: false, error_code: 'NETWORK', error_message: (err as Error).message }
    }
  }
  return { ok: false, error_code: 'EXHAUSTED', error_message: '재시도 한도 초과' }
}
