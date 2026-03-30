import { TOSS_PAYMENT_URL } from '../../shared/constants';

// Cloudflare Worker용 환불 처리 유틸리티
//
// ⚠️ 참고: 실제 주문 취소는 worker/routes/order.routes.ts → tossCancelPayment() 경로로 처리됩니다.
// 이 파일의 함수들은 현재 직접 import되지 않지만, 재고 복구/환불 기록 등
// 유틸리티 함수로 유지합니다.

export interface RefundPayload {
  orderId: string
  reason: string
  refundAmount?: number
  secretKey: string
}

export interface RefundResult {
  success: boolean
  refundId?: string
  error?: string
}

/**
 * Toss Payments 환불 요청
 */
export async function requestTossRefund(
  paymentKey: string,
  reason: string,
  secretKey: string,
  cancelAmount?: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const body: Record<string, unknown> = { cancelReason: reason }
    if (cancelAmount !== undefined && cancelAmount > 0) {
      body.cancelAmount = cancelAmount
    }

    const response = await fetch(`${TOSS_PAYMENT_URL}/payments/${encodeURIComponent(paymentKey)}/cancel`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(secretKey + ':')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({ message: 'Unknown Toss error' })) as { message?: string }
      return { success: false, error: errBody.message || `Toss API error: ${response.status}` }
    }

    console.log(`✅ Toss 환불 요청 성공: ${paymentKey}`)
    return { success: true }
  } catch (error) {
    console.error('❌ Toss 환불 요청 실패:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '환불 요청 실패',
    }
  }
}

/**
 * 재고 복구
 */
export async function restoreStock(
  db: D1Database,
  orderId: string
): Promise<void> {
  const items = await db
    .prepare('SELECT product_id, quantity FROM order_items WHERE order_id = ?')
    .bind(orderId)
    .all<{ product_id: string; quantity: number }>()

  if (items.results) {
    await db.batch(
      items.results.map((item) =>
        db
          .prepare('UPDATE products SET stock = stock + ? WHERE id = ?')
          .bind(item.quantity, item.product_id)
      )
    )

    console.log(`✅ 재고 복구 완료: ${orderId}`)
  }
}

/**
 * 환불 내역 기록
 */
export async function recordRefundHistory(
  db: D1Database,
  orderId: string,
  amount: number,
  reason: string
): Promise<void> {
  await db
    .prepare(
      'INSERT INTO refund_history (order_id, amount, reason, refunded_at) VALUES (?, ?, ?, datetime("now"))'
    )
    .bind(orderId, amount, reason)
    .run()

  console.log(`✅ 환불 내역 기록: ${orderId}`)
}

/**
 * 통합 환불 처리 로직
 */
export async function processRefund(
  db: D1Database,
  payload: RefundPayload
): Promise<RefundResult> {
  const { orderId, reason, refundAmount, secretKey } = payload

  try {
    // 1. 주문 조회
    const order = await db
      .prepare('SELECT * FROM orders WHERE id = ?')
      .bind(orderId)
      .first<{ id: string; amount: number; total_amount: number; payment_key: string; toss_payment_key: string; status: string }>()

    if (!order) {
      return { success: false, error: '주문을 찾을 수 없습니다.' }
    }

    const status = order.status.toUpperCase()

    if (status === 'REFUNDED') {
      return { success: false, error: '이미 환불된 주문입니다.' }
    }

    if (status === 'CANCELLED') {
      return { success: false, error: '취소된 주문입니다.' }
    }

    // 2. Toss 환불 요청
    const paymentKey = order.toss_payment_key || order.payment_key
    if (!paymentKey) {
      return { success: false, error: '결제 키를 찾을 수 없습니다.' }
    }

    const refundResult = await requestTossRefund(paymentKey, reason, secretKey, refundAmount)
    if (!refundResult.success) {
      return { success: false, error: refundResult.error }
    }

    // 3. 재고 복구
    await restoreStock(db, orderId)

    // 4. 주문 상태 업데이트 (DB constraint는 uppercase)
    await db
      .prepare('UPDATE orders SET status = ?, refund_status = ?, refunded_at = datetime("now"), updated_at = datetime("now") WHERE id = ?')
      .bind('REFUNDED', 'completed', orderId)
      .run()

    // 5. 환불 내역 기록
    const orderAmount = order.total_amount ?? order.amount ?? 0
    await recordRefundHistory(db, orderId, refundAmount || orderAmount, reason)

    console.log(`✅ 환불 처리 완료: ${orderId}`)
    return { success: true, refundId: orderId }
  } catch (error) {
    console.error('❌ 환불 처리 실패:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '환불 처리 중 오류가 발생했습니다',
    }
  }
}
