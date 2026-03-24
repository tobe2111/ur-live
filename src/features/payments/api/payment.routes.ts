/**
 * Payment API Routes (Refactored)
 * 
 * Endpoints:
 * - POST /api/payments/confirm - 결제 승인
 * - POST /api/payments/rollback - 결제 취소/환불
 * 
 * Refactored: 2026-03-09
 * - Using validation utilities
 * - Using response formatters
 * - Using database helpers
 * - Using auth middleware
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { 
  requireAuth, 
  getCurrentUser 
} from '@/worker/middleware/auth';
import {
  validateRequiredString,
  validateNumber,
  ValidationError
} from '@/worker/utils/validation';
import {
  successResponse,
  notFoundResponse,
  badRequestResponse,
  validationErrorResponse,
  unauthorizedResponse,
  internalServerErrorResponse
} from '@/worker/utils/response';
import { createDbHelper, QueryBuilder } from '@/worker/utils/database';

type Bindings = {
  DB: D1Database;
  JWT_SECRET: string;
  FIREBASE_PROJECT_ID: string;
  FIREBASE_PRIVATE_KEY: string;
  FIREBASE_CLIENT_EMAIL: string;
  TOSS_SECRET_KEY?: string;
};

interface PaymentConfirmRequest {
  paymentKey: string;
  orderId: string;
  amount: number;
}

// ── DB row types ─────────────────────────────────────────────────────────────

interface OrderRow {
  id: number;
  user_id: number;
  order_number: string;
  total_price: number;
  status: string;
  payment_key: string | null;
  payment_method: string | null;
  cancel_reason: string | null;
  shipping_address: string | null;
  created_at: string;
  updated_at: string;
}

interface TossPaymentErrorResponse {
  message?: string;
  [key: string]: unknown;
}

interface TossPaymentResponse {
  method?: string;
  [key: string]: unknown;
}

interface PaymentRollbackRequest {
  paymentKey: string;
  cancelReason: string;
  cancelAmount?: number;
}

export const paymentRoutes = new Hono<{ Bindings: Bindings }>();

// CORS 설정
paymentRoutes.use('*', cors({
  origin: ['https://live.ur-team.com', 'http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
}));

/**
 * 사용자 DB ID 가져오기 (Helper)
 */
async function getUserDbId(db: D1Database, firebaseUid: string): Promise<number | null> {
  const dbHelper = createDbHelper(db);
  const user = await dbHelper.findOne<{ id: number }>('users', { firebase_uid: firebaseUid });
  return user?.id || null;
}

/**
 * Toss Payments API 호출 (결제 승인)
 */
async function confirmTossPayment(
  paymentKey: string,
  orderId: string,
  amount: number,
  secretKey: string
): Promise<TossPaymentResponse> {
  try {
    const response = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(secretKey + ':')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ paymentKey, orderId, amount })
    });

    if (!response.ok) {
      const error = await response.json() as TossPaymentErrorResponse;
      throw new Error(error.message || 'Toss payment confirmation failed');
    }

    return await response.json() as TossPaymentResponse;
  } catch (error: unknown) {
    console.error('[Payment] Toss confirmation error:', error);
    throw error;
  }
}

/**
 * Toss Payments API 호출 (결제 취소)
 */
async function cancelTossPayment(
  paymentKey: string,
  cancelReason: string,
  cancelAmount: number | undefined,
  secretKey: string
): Promise<TossPaymentResponse> {
  try {
    const body: { cancelReason: string; cancelAmount?: number } = { cancelReason };
    if (cancelAmount !== undefined) {
      body.cancelAmount = cancelAmount;
    }

    const response = await fetch(
      `https://api.tosspayments.com/v1/payments/${paymentKey}/cancel`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(secretKey + ':')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      }
    );

    if (!response.ok) {
      const error = await response.json() as TossPaymentErrorResponse;
      throw new Error(error.message || 'Toss payment cancellation failed');
    }

    return await response.json() as TossPaymentResponse;
  } catch (error: unknown) {
    console.error('[Payment] Toss cancellation error:', error);
    throw error;
  }
}

/**
 * POST /api/payments/confirm
 * 결제 승인
 */
paymentRoutes.post('/confirm', requireAuth(), async (c) => {
  try {
    const user = getCurrentUser(c);
    if (!user) {
      return c.json(unauthorizedResponse(), 401);
    }

    const body = await c.req.json<PaymentConfirmRequest>();

    // Validation
    const paymentKey = validateRequiredString(body.paymentKey, 'paymentKey', { minLength: 1 });
    const orderId = validateRequiredString(body.orderId, 'orderId', { minLength: 1 });
    const amount = validateNumber(body.amount, 'amount', { min: 0, integer: true });

    const db = c.env.DB;
    const dbHelper = createDbHelper(db);
    const userId = await getUserDbId(db, String(user.id));
    
    if (!userId) {
      return c.json(notFoundResponse('User'), 404);
    }

    // orderId로 주문 조회
    // ✅ BUG #10 FIX: Query by order_number string column instead of parsing a numeric id.
    // ✅ BUG #11 FIX: The `orders` table schema does NOT have a `product_id` column —
    // that column lives in `order_items`.  Joining `products` on `o.product_id`
    // causes a runtime SQL error and always returns 0 rows (→ 404).
    // Fix: remove the broken JOIN; the amount field in the schema is `total_price`.
    const order = await new QueryBuilder()
      .select(['o.*'])
      .from('orders o')
      .where('o.order_number = ?', orderId)
      .where('o.user_id = ?', userId)
      .execute<OrderRow>(db);

    if (order.length === 0) {
      return c.json(notFoundResponse('Order'), 404);
    }

    const orderData = order[0];

    // 금액 검증
    // ✅ BUG #11 FIX: schema column is `total_price`, not `total_amount`
    if (orderData.total_price !== amount) {
      return c.json(badRequestResponse('Amount mismatch'), 400);
    }

    // 이미 결제 완료된 주문인지 확인
    const completedStatuses = ['confirmed', 'shipped', 'delivered'];
    if (completedStatuses.includes(orderData.status)) {
      return c.json(badRequestResponse('Order already confirmed'), 400);
    }

    // Toss Payments API 호출
    const tossSecretKey = c.env.TOSS_SECRET_KEY || 'test_sk_fake_secret_key';
    const tossPayment = await confirmTossPayment(paymentKey, orderId, amount, tossSecretKey);

    // 주문 상태 업데이트
    await dbHelper.update(
      'orders',
      {
        status: 'confirmed',
        payment_key: paymentKey,
        payment_method: tossPayment.method || 'card',
        updated_at: new Date().toISOString()
      },
      { id: orderData.id }
    );

    // 업데이트된 주문 조회
    // ✅ BUG #11 FIX: remove broken JOIN on non-existent orders.product_id
    // ✅ BUG #3 FIX: Map total_price (DB column) to total_amount (API field)
    const updatedOrderRows = await new QueryBuilder()
      .select([
        'o.id',
        'o.user_id',
        'o.total_price',
        'o.status',
        'o.payment_key',
        'o.payment_method',
        'o.shipping_address',
        'o.created_at',
        'o.updated_at'
      ])
      .from('orders o')
      .where('o.id = ?', orderData.id)
      .execute<OrderRow>(db);

    const updatedOrder = updatedOrderRows[0];
    // ✅ Map DB column (total_price) to API field (total_amount)
    const mappedOrder = {
      ...updatedOrder,
      total_amount: updatedOrder.total_price,
    };

    return c.json(successResponse({
      payment: tossPayment,
      order: mappedOrder
    }, 'Payment confirmed successfully'));

  } catch (error: unknown) {
    console.error('[Payment] Confirmation error:', error);

    if (error instanceof ValidationError) {
      return c.json(validationErrorResponse(error.message, error.field), 422);
    }

    return c.json(internalServerErrorResponse(
      (error as Error).message || 'Payment confirmation failed'
    ), 500);
  }
});

/**
 * POST /api/payments/rollback
 * 결제 취소/환불
 */
paymentRoutes.post('/rollback', requireAuth(), async (c) => {
  try {
    const user = getCurrentUser(c);
    if (!user) {
      return c.json(unauthorizedResponse(), 401);
    }

    const body = await c.req.json<PaymentRollbackRequest>();

    // Validation
    const paymentKey = validateRequiredString(body.paymentKey, 'paymentKey', { minLength: 1 });
    const cancelReason = validateRequiredString(body.cancelReason, 'cancelReason', { minLength: 1 });
    const cancelAmount = body.cancelAmount !== undefined
      ? validateNumber(body.cancelAmount, 'cancelAmount', { min: 0, integer: true })
      : undefined;

    const db = c.env.DB;
    const dbHelper = createDbHelper(db);
    const userId = await getUserDbId(db, String(user.id));
    
    if (!userId) {
      return c.json(notFoundResponse('User'), 404);
    }

    // paymentKey로 주문 조회
    // ✅ BUG #11 FIX: remove broken JOIN on non-existent orders.product_id
    const order = await new QueryBuilder()
      .select(['o.*'])
      .from('orders o')
      .where('o.payment_key = ?', paymentKey)
      .where('o.user_id = ?', userId)
      .execute<OrderRow>(db);

    if (order.length === 0) {
      return c.json(notFoundResponse('Order'), 404);
    }

    const orderData = order[0];

    // 이미 취소된 주문인지 확인
    if (orderData.status === 'cancelled') {
      return c.json(badRequestResponse('Order already cancelled'), 400);
    }

    // 취소 불가능한 상태인지 확인
    if (orderData.status === 'delivered') {
      return c.json(badRequestResponse('Cannot cancel delivered order'), 400);
    }

    // Toss Payments API 호출
    const tossSecretKey = c.env.TOSS_SECRET_KEY || 'test_sk_fake_secret_key';
    const tossPayment = await cancelTossPayment(
      paymentKey,
      cancelReason,
      cancelAmount,
      tossSecretKey
    );

    // 주문 상태 업데이트
    await dbHelper.update(
      'orders',
      {
        status: 'cancelled',
        cancel_reason: cancelReason,
        updated_at: new Date().toISOString()
      },
      { id: orderData.id }
    );

    // 업데이트된 주문 조회
    // ✅ BUG #11 FIX: remove broken JOIN on non-existent orders.product_id
    const updatedOrder = await new QueryBuilder()
      .select([
        'o.id',
        'o.user_id',
        'o.total_price',
        'o.status',
        'o.payment_key',
        'o.payment_method',
        'o.cancel_reason',
        'o.shipping_address',
        'o.created_at',
        'o.updated_at'
      ])
      .from('orders o')
      .where('o.id = ?', orderData.id)
      .execute(db);

    return c.json(successResponse({
      payment: tossPayment,
      order: updatedOrder[0]
    }, 'Payment cancelled successfully'));

  } catch (error: unknown) {
    console.error('[Payment] Rollback error:', error);

    if (error instanceof ValidationError) {
      return c.json(validationErrorResponse(error.message, error.field), 422);
    }

    return c.json(internalServerErrorResponse(
      (error as Error).message || 'Payment rollback failed'
    ), 500);
  }
});
