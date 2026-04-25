import { TOSS_PAYMENT_URL } from '../../shared/constants';
import { logError } from './logger';

// Cloudflare Worker용 결제 처리 유틸리티
//
// ⚠️ 참고: 실제 결제 승인은 features/payments/api/payment.routes.ts → confirmTossPayment() 경로로 처리됩니다.
// 이 파일의 함수들은 현재 직접 import되지 않지만, 재고 확인/중복 주문 확인 등
// 유틸리티 함수로 유지합니다.

export interface CheckoutPayload {
  orderId: string
  amount: number
  products: Array<{
    productId: string
    quantity: number
    price_snapshot: number
  }>
  paymentKey: string
  userId: string
  secretKey: string
}

export interface CheckoutResult {
  success: boolean
  orderId?: string
  error?: string
}

/**
 * 재고 확인
 * ✅ PERF: Single IN query instead of N+1 SELECTs. One D1 request regardless of
 * cart size. Returns first validation error encountered to match prior behavior.
 */
export async function validateStock(
  db: D1Database,
  products: Array<{ productId: string; quantity: number }>
): Promise<{ valid: boolean; error?: string }> {
  if (products.length === 0) return { valid: true }

  const ids = products.map(p => p.productId)
  const placeholders = ids.map(() => '?').join(',')
  const { results = [] } = await db
    .prepare(`SELECT id, stock FROM products WHERE id IN (${placeholders})`)
    .bind(...ids)
    .all<{ id: string | number; stock: number }>()

  const stockMap = new Map<string, number>(
    results.map(r => [String(r.id), Number(r.stock)])
  )

  for (const item of products) {
    const stock = stockMap.get(String(item.productId))
    if (stock === undefined) {
      return {
        valid: false,
        error: `상품을 찾을 수 없습니다: ${item.productId}`,
      }
    }
    if (stock < item.quantity) {
      return {
        valid: false,
        error: `재고가 부족합니다: ${item.productId} (재고: ${stock}, 주문: ${item.quantity})`,
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
  // ✅ SCHEMA FIX: orders.id is INTEGER AUTOINCREMENT; callers pass the
  // client-generated order_number string as the "orderId" parameter here.
  const existing = await db
    .prepare('SELECT id FROM orders WHERE order_number = ?')
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
    // ✅ SCHEMA FIX: orderId here is the order_number string. Look up the
    // integer id first, then use it to join order_items.
    const row = await db
      .prepare('SELECT id FROM orders WHERE order_number = ?')
      .bind(orderId)
      .first<{ id: number }>()

    if (!row) return

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
      .bind(row.id, row.id)
      .run()

    // 주문 상태 업데이트 — state machine로 원자적 전환 (이미 CANCELLED/REFUNDED이면 no-op)
    const { transitionOrderStatus } = await import('./state-machine')
    await transitionOrderStatus(db, row.id, 'CANCELLED', {
      extraSets: { cancel_reason: '주문 롤백 (checkout 실패)' },
    })

    // Order rollback completed
  } catch (error) {
    logError('checkout.order.rollback_failed', { orderId, error: (error as Error)?.message })
  }
}

/**
 * Toss Payments 결제 승인
 */
export async function confirmTossPayment(
  paymentKey: string,
  orderId: string,
  amount: number,
  secretKey: string
): Promise<{ success: boolean; error?: string; code?: string }> {
  try {
    const response = await fetch(`${TOSS_PAYMENT_URL}/payments/confirm`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(secretKey + ':')}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': orderId,
      },
      body: JSON.stringify({ paymentKey, orderId, amount }),
      signal: AbortSignal.timeout(15000),
    })

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({ code: 'UNKNOWN', message: 'Unknown Toss error' })) as { code?: string; message?: string }
      return {
        success: false,
        error: errBody.message || `Toss API error: ${response.status}`,
        code: errBody.code,
      }
    }

    return { success: true }
  } catch (error) {
    const isTimeout = error instanceof DOMException && error.name === 'AbortError'
    return {
      success: false,
      error: isTimeout ? '결제 승인 타임아웃' : (error instanceof Error ? error.message : '결제 승인 실패'),
      code: isTimeout ? 'TIMEOUT' : 'NETWORK_ERROR',
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
  const { orderId, amount, products, paymentKey, userId, secretKey } = payload

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
    const paymentResult = await confirmTossPayment(paymentKey, orderId, amount, secretKey)
    if (!paymentResult.success) {
      return { success: false, error: paymentResult.error }
    }

    // 4. DB 트랜잭션 (재고 차감 + 주문 생성)
    // ✅ SCHEMA FIX: orders.id is INTEGER AUTOINCREMENT — do not pass id.
    //    Use order_number to link. order_items requires NOT NULL product_name.
    //    order_items column is `price` (not `price_snapshot`).

    // Fetch product names + authoritative prices (required NOT NULL column on order_items)
    // 🛡️ 2026-04-22: price 는 반드시 DB 에서 가져와서 스냅샷. client 값 신뢰 금지.
    const productIds = products.map(p => p.productId)
    const phs = productIds.map(() => '?').join(',')
    const { results: productRows = [] } = await db
      .prepare(`SELECT id, name, price FROM products WHERE id IN (${phs})`)
      .bind(...productIds)
      .all<{ id: string | number; name: string; price: number }>()
    const nameMap = new Map<string, string>(
      productRows.map(p => [String(p.id), String(p.name ?? '')])
    )
    const priceMap = new Map<string, number>(
      productRows.map(p => [String(p.id), Number(p.price ?? 0)])
    )

    // Step A: Insert order (id auto-generated). Use order_number for linking.
    const orderNumber = orderId
    const orderInsert = await db
      .prepare(
        'INSERT INTO orders (order_number, user_id, total_amount, status, payment_key, toss_payment_key, created_at) VALUES (?, ?, ?, ?, ?, ?, datetime("now"))'
      )
      .bind(orderNumber, userId, amount, 'PAID', paymentKey, paymentKey)
      .run()

    const newOrderId = orderInsert.meta.last_row_id as number

    // Step B: Batch remaining (stock deduction + order_items insert)
    // ✅ CONCURRENCY: guard on `stock >= qty` so two concurrent checkouts for
    // the same product can't oversell.  D1 batch() is atomic — if any guarded
    // UPDATE reports meta.changes === 0 we must roll back, but the batch
    // itself will not partially apply.
    const stockStmts = products.map((item) =>
      db
        .prepare('UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?')
        .bind(item.quantity, item.productId, item.quantity)
    );
    const stockResults = await db.batch(stockStmts);
    for (let i = 0; i < stockResults.length; i++) {
      if ((stockResults[i]?.meta?.changes ?? 0) === 0) {
        // Undo partial changes via rollbackOrder
        await rollbackOrder(db, orderId);
        throw new Error(`재고가 부족합니다 (상품 ID: ${products[i].productId})`);
      }
    }

    await db.batch([
      // 주문 아이템 생성 (schema: order_id, product_id, product_name [NOT NULL], quantity, price)
      // 🛡️ price 는 server-side priceMap 에서 가져옴 (client price_snapshot 무시)
      ...products.map((item) =>
        db
          .prepare(
            'INSERT INTO order_items (order_id, product_id, product_name, quantity, price) VALUES (?, ?, ?, ?, ?)'
          )
          .bind(
            newOrderId,
            item.productId,
            nameMap.get(String(item.productId)) ?? `Product ${item.productId}`,
            item.quantity,
            priceMap.get(String(item.productId)) ?? 0
          )
      ),
    ])

    // Checkout completed
    return { success: true, orderId: String(newOrderId) }
  } catch (error) {
    // 에러 발생 시 롤백
    logError('checkout.process.failed', { error: (error as Error)?.message })
    await rollbackOrder(db, orderId)

    return {
      success: false,
      error: error instanceof Error ? error.message : '주문 처리 중 오류가 발생했습니다',
    }
  }
}
