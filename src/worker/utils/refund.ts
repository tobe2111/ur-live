// Cloudflare Worker용 환불 처리 유틸리티

export interface RefundPayload {
  orderId: string
  reason: string
  refundAmount?: number
}

export interface RefundResult {
  success: boolean
  refundId?: string
  error?: string
}

/**
 * Toss Payments 환불 요청 (모의)
 */
export async function requestTossRefund(
  paymentKey: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // 실제로는 Toss API 호출
    // const response = await fetch(`https://api.tosspayments.com/v1/payments/${paymentKey}/cancel`, {
    //   method: 'POST',
    //   headers: {
    //     'Authorization': `Basic ${btoa(TOSS_SECRET_KEY + ':')}`,
    //     'Content-Type': 'application/json',
    //   },
    //   body: JSON.stringify({ cancelReason: reason }),
    // })

    // 현재는 성공으로 간주
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
  const { orderId, reason, refundAmount } = payload

  try {
    // 1. 주문 조회
    const order = await db
      .prepare('SELECT * FROM orders WHERE id = ?')
      .bind(orderId)
      .first<{ id: string; amount: number; payment_key: string; status: string }>()

    if (!order) {
      return { success: false, error: '주문을 찾을 수 없습니다.' }
    }

    if (order.status === 'refunded') {
      return { success: false, error: '이미 환불된 주문입니다.' }
    }

    if (order.status === 'cancelled') {
      return { success: false, error: '취소된 주문입니다.' }
    }

    // 2. Toss 환불 요청
    const refundResult = await requestTossRefund(order.payment_key, reason)
    if (!refundResult.success) {
      return { success: false, error: refundResult.error }
    }

    // 3. 재고 복구
    await restoreStock(db, orderId)

    // 4. 주문 상태 업데이트
    await db
      .prepare('UPDATE orders SET status = ?, updated_at = datetime("now") WHERE id = ?')
      .bind('refunded', orderId)
      .run()

    // 5. 환불 내역 기록
    await recordRefundHistory(db, orderId, refundAmount || order.amount, reason)

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
