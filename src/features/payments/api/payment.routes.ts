/**
 * Payment API Routes (Feature Module)
 *
 * Endpoints:
 * - POST /api/payments/rollback - 결제 취소/환불
 *
 * NOTE: POST /api/payments/confirm 은 paymentsRouter (worker/routes/payment.routes.ts)에서 처리.
 *       여기서는 /rollback 만 담당합니다.
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import {
  requireAuth,
  getCurrentUser
} from '@/worker/middleware/auth';
import { ALLOWED_ORIGINS } from '@/shared/constants';
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
import { QueryBuilder } from '@/worker/utils/database';

type Bindings = {
  DB: D1Database;
  JWT_SECRET: string;
  FIREBASE_PROJECT_ID: string;
  FIREBASE_PRIVATE_KEY: string;
  FIREBASE_CLIENT_EMAIL: string;
  TOSS_SECRET_KEY?: string;
};

interface OrderRow {
  id: string;
  user_id: string;
  order_number: string;
  total_amount: number;
  status: string;
  payment_key: string | null;
  toss_payment_key: string | null;
  payment_method: string | null;
  cancel_reason: string | null;
  shipping_address: string | null;
  created_at: string;
  updated_at: string;
}

interface TossPaymentErrorResponse {
  code?: string;
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
  origin: [...ALLOWED_ORIGINS],
  credentials: true,
}));

/**
 * Firebase UID → DB user_id 변환 헬퍼
 * 새 스키마(001_initial.sql)에서는 users.id = Firebase UID (TEXT)
 */
async function getUserDbId(db: D1Database, firebaseUid: string): Promise<string | null> {
  try {
    const row = await db
      .prepare('SELECT id FROM users WHERE firebase_uid = ? LIMIT 1')
      .bind(firebaseUid)
      .first<{ id: string | number }>();
    if (row?.id != null) return String(row.id);
  } catch {
    // firebase_uid 컬럼이 없는 경우 (새 스키마) → Firebase UID 직접 사용
  }
  return firebaseUid;
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
  const body: { cancelReason: string; cancelAmount?: number } = { cancelReason };
  if (cancelAmount !== undefined) {
    body.cancelAmount = cancelAmount;
  }

  const response = await fetch(
    `https://api.tosspayments.com/v1/payments/${encodeURIComponent(paymentKey)}/cancel`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(secretKey + ':')}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `cancel-${paymentKey}-${Date.now()}`,
      },
      body: JSON.stringify(body),
    }
  );

  if (!response.ok) {
    const error = await response.json() as TossPaymentErrorResponse;
    throw new Error(error.message || 'Toss payment cancellation failed');
  }

  return await response.json() as TossPaymentResponse;
}

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
    const userId = await getUserDbId(db, String(user.id));

    if (!userId) {
      return c.json(notFoundResponse('User'), 404);
    }

    // paymentKey 또는 toss_payment_key로 주문 조회
    const order = await new QueryBuilder()
      .select(['o.*'])
      .from('orders o')
      .where('(o.payment_key = ? OR o.toss_payment_key = ?)', paymentKey)
      .where('o.user_id = ?', userId)
      .execute<OrderRow>(db);

    if (order.length === 0) {
      return c.json(notFoundResponse('Order'), 404);
    }

    const orderData = order[0];

    // 이미 취소된 주문인지 확인
    if (['CANCELLED', 'REFUNDED'].includes(orderData.status)) {
      return c.json(badRequestResponse('Order already cancelled'), 400);
    }

    // 취소 불가능한 상태인지 확인
    if (['DELIVERED'].includes(orderData.status)) {
      return c.json(badRequestResponse('Cannot cancel delivered order'), 400);
    }

    // Toss Payments API 호출
    const tossSecretKey = c.env.TOSS_SECRET_KEY;
    if (!tossSecretKey) {
      console.error('[Payment] TOSS_SECRET_KEY is not configured');
      return c.json(internalServerErrorResponse('Payment service not configured'), 500);
    }

    const tossPayment = await cancelTossPayment(
      paymentKey,
      cancelReason,
      cancelAmount,
      tossSecretKey
    );

    // 주문 상태 업데이트
    await db.prepare(
      'UPDATE orders SET status = ?, cancel_reason = ?, updated_at = ? WHERE id = ?'
    ).bind('CANCELLED', cancelReason, new Date().toISOString(), orderData.id).run();

    // order_items 재고 복구
    const items = await db.prepare(
      'SELECT product_id, quantity FROM order_items WHERE order_id = ? AND status != ?'
    ).bind(String(orderData.id), 'CANCELLED').all<{ product_id: string; quantity: number }>();

    if (items.results.length > 0) {
      for (const item of items.results) {
        await db.prepare(
          'UPDATE products SET stock_quantity = stock_quantity + ? WHERE id = ?'
        ).bind(item.quantity, item.product_id).run();
      }
      await db.prepare('UPDATE order_items SET status = ? WHERE order_id = ?')
        .bind('CANCELLED', String(orderData.id)).run();
    }

    // 업데이트된 주문 조회
    const updatedOrderRows = await new QueryBuilder()
      .select(['o.*'])
      .from('orders o')
      .where('o.id = ?', orderData.id)
      .execute<OrderRow>(db);

    return c.json(successResponse({
      payment: tossPayment,
      order: updatedOrderRows[0]
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
