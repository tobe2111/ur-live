/**
 * 🛡️ 2026-05-24: toss-gateway.cancelTossPayment() 의 thin wrapper.
 *
 * 이전 (2026-05-18): 자체 구현 (재시도 / 실패 기록 / idempotency).
 * 현재: 모두 toss-gateway 로 위임. API 호환성 유지 (call site 0 변경).
 *
 * 호출처: stay-bookings cancel / admin refund / 일반 주문 환불 / appointments / gifts /
 *        group-buy seller / toss-refund-retry cron.
 *
 * ⚠️ Toss V2 docs 잠금 (2026-05-24): 이 파일은 직접 수정 금지. 변경 필요 시 사용자에게 문의.
 *    실제 구현 변경은 src/worker/utils/toss-gateway.ts:cancelTossPayment() 에서.
 */
import { cancelTossPayment } from './toss-gateway'

type TossEnv = { TOSS_SECRET_KEY?: string; DB?: D1Database }

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
  options: {
    reason: string
    amount?: number
    idempotencyKey: string
    /** 가상계좌 환불 계좌 (입금 완료 후 취소 시 필수). V2 docs 추가. */
    refundReceiveAccount?: { bank?: string; bankCode?: string; accountNumber: string; holderName: string }
    /** 면세 부분 취소 금액 (복합과세 상점). V2 docs 추가. */
    taxFreeAmount?: number
  },
): Promise<RefundResult> {
  const result = await cancelTossPayment({
    env,
    paymentKey,
    cancelReason: options.reason,
    cancelAmount: options.amount,
    refundReceiveAccount: options.refundReceiveAccount,
    taxFreeAmount: options.taxFreeAmount,
    idempotencyKey: options.idempotencyKey,
  })
  if (result.ok) {
    return {
      ok: true,
      cancel_amount: Number(result.lastCancel?.cancelAmount) || options.amount,
      transaction_key: result.lastCancel?.transactionKey,
      http_status: result.http_status,
    }
  }
  return {
    ok: false,
    error_code: result.code,
    error_message: result.message,
    http_status: result.http_status,
  }
}
