// Cloudflare Worker용 결제 에러 처리 유틸리티

export interface CheckoutPayload {
  orderId: string
  amount: number
  products: Array<{
    productId: string
    quantity: number
    // ✅ BUG #7 FIX: price_snapshot must be passed from the caller (checked-out cart item)
    // so the DB record captures the real price at purchase time.
    price_snapshot: number
  }>
  paymentKey: string
  userId: string
}

export interface CheckoutResult {
  success: boolean
  orderId?: string
  error?: string
}

/**
 * 재고 확인
 */
export async function validateStock(
  db: D1Database,
  products: Array<{ productId: string; quantity: number }>
): Promise<{ valid: boolean; error?: string }> {
  for (const item of products) {
    const result = await db
      .prepare('SELECT stock FROM products WHERE id = ?')
      .bind(item.productId)
      .first<{ stock: number }>()

    if (!result) {
      return {
        valid: false,
        error: `상품을 찾을 수 없습니다: ${item.productId}`,
      }
    }

    if (result.stock < item.quantity) {
      return {
        valid: false,
        error: `재고가 부족합니다: ${item.productId} (재고: ${result.stock}, 주문: ${item.quantity})`,
      }
    }
  }

  return { valid: true }
}

/**
 * 중복 주문 확인
 */
export async function validateDuplicateOrder(
  db: D1Database,
  orderId: string
): Promise<{ valid: boolean; error?: string }> {
  const existing = await db
    .prepare('SELECT id FROM orders WHERE id = ?')
    .bind(orderId)
    .first()

  if (existing) {
    return {
      valid: false,
      error: '이미 처리된 주문입니다.',
    }
  }

  return { valid: true }
}

/**
 * 주문 롤백 (에러 발생 시)
 */
export async function rollbackOrder(
  db: D1Database,
  orderId: string
): Promise<void> {
  try {
    // 재고 복구
    await db
      .prepare(
        `
        UPDATE products p
        SET stock = stock + (
          SELECT quantity 
          FROM order_items oi 
          WHERE oi.order_id = ? AND oi.product_id = p.id
        )
        WHERE id IN (SELECT product_id FROM order_items WHERE order_id = ?)
      `
      )
      .bind(orderId, orderId)
      .run()

    // 주문 상태 업데이트
    await db
      .prepare('UPDATE orders SET status = ? WHERE id = ?')
      .bind('cancelled', orderId)
      .run()

    console.log(`✅ 주문 롤백 완료: ${orderId}`)
  } catch (error) {
    console.error(`❌ 주문 롤백 실패: ${orderId}`, error)
  }
}

/**
 * Toss Payments 결제 승인 (모의)
 */
export async function confirmTossPayment(
  paymentKey: string,
  orderId: string,
  amount: number
): Promise<{ success: boolean; error?: string }> {
  try {
    // 실제로는 Toss API 호출
    // const response = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
    //   method: 'POST',
    //   headers: {
    //     'Authorization': `Basic ${btoa(TOSS_SECRET_KEY + ':')}`,
    //     'Content-Type': 'application/json',
    //   },
    //   body: JSON.stringify({ paymentKey, orderId, amount }),
    // })

    // 현재는 성공으로 간주
    console.log(`✅ Toss 결제 승인: ${orderId}, ${amount}원`)
    return { success: true }
  } catch (error) {
    console.error('❌ Toss 결제 승인 실패:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '결제 승인 실패',
    }
  }
}

/**
 * 통합 결제 처리 로직
 */
export async function processCheckout(
  db: D1Database,
  payload: CheckoutPayload
): Promise<CheckoutResult> {
  const { orderId, amount, products, paymentKey, userId } = payload

  try {
    // 1. 재고 확인
    const stockValidation = await validateStock(db, products)
    if (!stockValidation.valid) {
      return { success: false, error: stockValidation.error }
    }

    // 2. 중복 주문 확인
    const duplicateValidation = await validateDuplicateOrder(db, orderId)
    if (!duplicateValidation.valid) {
      return { success: false, error: duplicateValidation.error }
    }

    // 3. Toss 결제 승인
    const paymentResult = await confirmTossPayment(paymentKey, orderId, amount)
    if (!paymentResult.success) {
      return { success: false, error: paymentResult.error }
    }

    // 4. DB 트랜잭션 (재고 차감 + 주문 생성)
    await db.batch([
      // 재고 차감
      ...products.map((item) =>
        db
          .prepare('UPDATE products SET stock = stock - ? WHERE id = ?')
          .bind(item.quantity, item.productId)
      ),
      // 주문 생성
      db
        .prepare(
          'INSERT INTO orders (id, user_id, amount, status, payment_key, created_at) VALUES (?, ?, ?, ?, ?, datetime("now"))'
        )
        .bind(orderId, userId, amount, 'paid', paymentKey),
      // 주문 아이템 생성
      ...products.map((item) =>
        db
          .prepare(
            'INSERT INTO order_items (order_id, product_id, quantity, price_snapshot) VALUES (?, ?, ?, ?)'
          )
          // ✅ BUG #7 FIX: Use the price_snapshot from the payload instead of
          // hardcoding 0, which caused all order history to show ₩0 per item.
          .bind(orderId, item.productId, item.quantity, item.price_snapshot ?? 0)
      ),
    ])

    console.log(`✅ 주문 처리 완료: ${orderId}`)
    return { success: true, orderId }
  } catch (error) {
    // 에러 발생 시 롤백
    console.error('❌ 주문 처리 실패:', error)
    await rollbackOrder(db, orderId)

    return {
      success: false,
      error: error instanceof Error ? error.message : '주문 처리 중 오류가 발생했습니다',
    }
  }
}
