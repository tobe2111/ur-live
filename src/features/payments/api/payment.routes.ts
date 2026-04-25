/**
 * Payment API Routes (unified — TD-004)
 *
 * All endpoints:
 * - POST /api/payments/webhook          - Toss 웹훅 (signature-protected, public)
 * - POST /api/payments/confirm          - 결제 승인
 * - POST /api/payments/checkout-session - 결제 세션 생성
 * - POST /api/payments/rollback         - 결제 취소/환불
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { z } from 'zod';
import type { Env } from '@/worker/types/env';
import { OrderRepository } from '@/worker/repositories/order.repository';
import { requireAuth, getCurrentUser, type AuthUser } from '@/worker/middleware/auth';
import { webhookRouter } from '@/worker/routes/webhook.routes';
import { withCircuitBreaker } from '@/worker/utils/circuit-breaker';
import { logInfo, logError } from '@/worker/utils/logger';
import { sendAlert } from '@/worker/utils/alerts';
import { transitionOrderStatus } from '@/worker/utils/state-machine';
import { QueryBuilder } from '@/worker/utils/database';
import { TOSS_PAYMENT_URL, ALLOWED_ORIGINS } from '@/shared/constants';
import {
  validateRequiredString,
  validateNumber,
  ValidationError,
} from '@/worker/utils/validation';
import {
  successResponse,
  notFoundResponse,
  badRequestResponse,
  validationErrorResponse,
  unauthorizedResponse,
  internalServerErrorResponse,
} from '@/worker/utils/response';
import { sendSellerAlimtalk } from '@/features/alimtalk/send';
import { buildOrderConfirmMessage } from '@/features/alimtalk/aligo';
import { calculateMultiTierCommission } from '@/features/referral/api/referral-tree.routes';

type AuthVariables = { user: AuthUser };

// Toss error code → 사용자 친화 메시지 맵 (v15-3)
const TOSS_ERROR_MESSAGES: Record<string, string> = {
  'REJECT_CARD_COMPANY': '카드사에서 결제를 거부했습니다. 다른 카드로 시도해주세요.',
  'INVALID_CARD_EXPIRATION': '카드 유효기간이 올바르지 않습니다.',
  'INVALID_CARD_INSTALLMENT_PLAN': '할부 개월 수가 올바르지 않습니다.',
  'EXCEED_MAX_DAILY_PAYMENT_COUNT': '일일 결제 한도를 초과했습니다.',
  'EXCEED_MAX_AUTH_COUNT': '인증 횟수를 초과했습니다. 잠시 후 다시 시도해주세요.',
  'INSUFFICIENT_BALANCE': '잔액이 부족합니다.',
  'INVALID_PIN': '비밀번호가 올바르지 않습니다.',
  'ALREADY_PROCESSED_PAYMENT': '이미 처리된 결제입니다.',
  'INVALID_PASSWORD': '카드 비밀번호가 올바르지 않습니다.',
  'NOT_ENOUGH_BALANCE_FOR_INSTALLMENT': '할부에 필요한 잔액이 부족합니다.',
  'EXPIRED_CARD': '만료된 카드입니다.',
  'INVALID_CARD_NUMBER': '카드 번호가 올바르지 않습니다.',
  'CARD_PROCESSING_ERROR': '카드 처리 중 오류가 발생했습니다.',
  'UNAUTHORIZED_PAYMENT': '인증되지 않은 결제입니다.',
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
  refundReceiveAccount?: {
    bank: string;
    accountNumber: string;
    holderName: string;
  };
}

const confirmSchema = z.object({
  paymentKey: z.string().min(1),
  orderId: z.string().min(6).max(64).regex(/^[a-zA-Z0-9\-_]+$/, 'Invalid orderId format'),
  amount: z.number().int().positive(),
});

export const paymentRoutes = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

paymentRoutes.use('*', cors({
  origin: [...ALLOWED_ORIGINS],
  credentials: true,
}));

// ── Webhook (PUBLIC — signature-protected) ─────────────────────────────────
paymentRoutes.route('/webhook', webhookRouter);

// ── Auth for protected endpoints ───────────────────────────────────────────
paymentRoutes.use('/confirm', requireAuth());
paymentRoutes.use('/checkout-session', requireAuth());

// ── Firebase UID → DB integer user_id helper ──────────────────────────────
async function getUserDbId(db: D1Database, rawId: string): Promise<string> {
  const numId = parseInt(rawId);
  if (!isNaN(numId) && String(numId) === rawId) return rawId;
  try {
    const row = await db
      .prepare('SELECT id FROM users WHERE firebase_uid = ? LIMIT 1')
      .bind(rawId)
      .first<{ id: string | number }>();
    if (row?.id != null) return String(row.id);
  } catch {
    // firebase_uid 컬럼이 없는 경우 → rawId 직접 사용
  }
  return rawId;
}

/**
 * POST /api/payments/confirm
 * Called after client-side Toss widget completes payment.
 */
paymentRoutes.post('/confirm', async (c) => {
  try {
    const userId = await getUserDbId(c.env.DB, String(c.get('user').id));

    const body = await c.req.json();
    const parsed = confirmSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ success: false, error: 'Invalid request', details: parsed.error.flatten() }, 400);
    }

    const { paymentKey, orderId: orderNumber, amount } = parsed.data;

    const orderRepo = new OrderRepository(c.env.DB);
    const orders = await orderRepo.findByOrderNumber(orderNumber);

    if (orders.length === 0) {
      return c.json({ success: false, error: '주문을 찾을 수 없습니다' }, 404);
    }

    const alreadyDone = orders.every(o => o.status === 'DONE' || o.status === 'PAID');
    if (alreadyDone) {
      return c.json({ success: true, data: { orders } });
    }

    const forbidden = orders.filter(o =>
      ['CANCELLED', 'REFUNDED', 'FAILED'].includes((o.status || '').toUpperCase())
    );
    if (forbidden.length > 0) {
      return c.json({ success: false, error: '이미 취소/환불된 주문입니다.' }, 409);
    }

    const unauthorized = orders.find(o => String(o.user_id) !== String(userId));
    if (unauthorized) {
      logError('payments.confirm.user_mismatch', { authUserId: userId, orderUserId: unauthorized.user_id });
      return c.json({ success: false, error: 'Forbidden' }, 403);
    }

    const totalAmount = orders.reduce((sum, o) => sum + o.total_amount, 0);
    if (totalAmount !== amount) {
      logError('payments.confirm.amount_mismatch', { expected: totalAmount, received: amount, orderNumber });
      return c.json({ success: false, error: '결제 금액이 일치하지 않습니다' }, 400);
    }

    const tossSecretKey = c.env.TOSS_SECRET_KEY;
    if (!tossSecretKey) {
      return c.json({ success: false, error: 'Payment configuration error' }, 500);
    }

    logInfo('toss.confirm.start', { orderId: orderNumber, amount: totalAmount });
    let tossResponse: Response;
    try {
      tossResponse = await withCircuitBreaker(
        { name: 'toss-confirm', maxFailures: 10, resetTimeoutMs: 60_000 },
        () => fetch(`${TOSS_PAYMENT_URL}/payments/confirm`, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${btoa(tossSecretKey + ':')}`,
            'Content-Type': 'application/json',
            'Idempotency-Key': paymentKey,
          },
          body: JSON.stringify({ paymentKey, orderId: orderNumber, amount: totalAmount }),
        }),
      );
    } catch (e) {
      logError('toss.confirm.circuit_open', { orderId: orderNumber, error: (e as Error).message });
      return c.json({
        success: false,
        error: 'Toss 결제 시스템이 일시 중단됐습니다. 잠시 후 다시 시도해주세요.',
        code: 'CIRCUIT_OPEN',
      }, 503);
    }

    if (!tossResponse.ok) {
      const tossError = await tossResponse.json() as { code?: string; message?: string };
      if (tossError.code === 'ALREADY_PROCESSED_PAYMENT') {
        await orderRepo.updateStatus(orderNumber, 'DONE', {
          toss_payment_key: paymentKey,
          toss_order_id: orderNumber,
        });
        const updatedOrders = await orderRepo.findByOrderNumber(orderNumber);
        return c.json({ success: true, data: { orders: updatedOrders } });
      }
      const errorMessage = tossError.code
        ? (TOSS_ERROR_MESSAGES[tossError.code] || tossError.message || '결제 처리 중 오류가 발생했습니다.')
        : '결제 처리 중 오류가 발생했습니다.';
      return c.json({ success: false, error: errorMessage, code: tossError.code }, 400);
    }

    const tossData = await tossResponse.json() as {
      paymentKey: string;
      orderId: string;
      totalAmount: number;
      method: string;
      approvedAt: string;
      status: string;
    };

    try {
      await orderRepo.updateStatus(orderNumber, 'DONE', {
        toss_payment_key: tossData.paymentKey,
        toss_order_id: orderNumber,
        payment_method: tossData.method,
        paid_at: tossData.approvedAt,
      });
    } catch (dbErr) {
      logError('toss.confirm.db_update_failed', {
        orderNumber,
        orderIds: orders.map(o => o.id),
        error: (dbErr as Error).message,
      });
      await c.env.DB.prepare(`
        INSERT INTO webhook_events (id, source, event_type, payload, status, order_number, created_at)
        VALUES (?, 'internal', 'payment_update_retry', ?, 'FAILED', ?, datetime('now'))
      `).bind(
        `retry_${orderNumber}_${Date.now()}`,
        JSON.stringify({ paymentKey, orderIds: orders.map(o => o.id), totalAmount }),
        orderNumber,
      ).run().catch(() => {});
      await sendAlert(c.env, {
        severity: 'critical',
        title: 'DB update failed after Toss confirm',
        message: `Order ${orderNumber} paid at Toss but status update failed.`,
        context: { orderNumber, orderIds: orders.map(o => o.id), error: String(dbErr).slice(0, 200) },
      }).catch(() => {});
      return c.json({ success: true, data: { orders, payment: tossData }, warning: 'PAYMENT_CONFIRMED_DB_DEFERRED' });
    }

    for (const order of orders) {
      await orderRepo.reduceStock(order.id);
    }

    const updatedOrders = await orderRepo.findByOrderNumber(orderNumber);

    // 다단계 추천 커미션 (fire-and-forget)
    try {
      for (const order of updatedOrders) {
        const oid = typeof order.id === 'number' ? order.id : parseInt(String(order.id), 10);
        if (oid && order.total_amount) {
          await calculateMultiTierCommission(c.env.DB, oid, order.total_amount, String(userId));
        }
      }
    } catch { /* non-critical */ }

    // 알림톡 (fire-and-forget)
    if (c.env.ALIGO_API_KEY && c.env.ALIGO_USER_ID) {
      for (const order of updatedOrders) {
        if (!order.seller_id || !order.shipping_phone) continue;
        const { subject, message } = buildOrderConfirmMessage({
          orderId: orderNumber,
          buyerName: order.shipping_name ?? '고객',
          buyerPhone: order.shipping_phone,
          productName: order.items?.[0]?.product_name ?? '상품',
          totalAmount: order.total_amount,
          sellerName: order.seller_name ?? '',
        });
        sendSellerAlimtalk({
          DB: c.env.DB,
          aligoApiKey: c.env.ALIGO_API_KEY,
          aligoUserId: c.env.ALIGO_USER_ID,
          aligoSenderKey: c.env.ALIGO_SENDER_KEY ?? '',
          senderPhone: c.env.ALIGO_SENDER_PHONE,
          sellerId: Number(order.seller_id),
          receiver: order.shipping_phone,
          receiverName: order.shipping_name ?? '고객',
          templateCode: c.env.ALIGO_TPL_ORDER_CONFIRM ?? 'TBD',
          subject,
          message,
          orderId: orderNumber,
        }).catch(() => {});
      }
    }

    return c.json({ success: true, data: { orders: updatedOrders, payment: tossData } });
  } catch (err) {
    return c.json({ success: false, error: '결제 처리 중 오류가 발생했습니다' }, 500);
  }
});

/**
 * POST /api/payments/checkout-session
 * Returns checkout info including Toss client key and order details.
 */
paymentRoutes.post('/checkout-session', async (c) => {
  try {
    const dbUserId = await getUserDbId(c.env.DB, String(c.get('user').id));

    const { order_number } = await c.req.json<{ order_number: string }>();
    if (!order_number) {
      return c.json({ success: false, error: 'order_number is required' }, 400);
    }

    const orderRepo = new OrderRepository(c.env.DB);
    const orders = await orderRepo.findByOrderNumber(order_number);

    if (orders.length === 0) {
      return c.json({ success: false, error: '주문을 찾을 수 없습니다' }, 404);
    }
    if (orders.some(o => String(o.user_id) !== String(dbUserId))) {
      return c.json({ success: false, error: 'Forbidden' }, 403);
    }

    const totalAmount = orders.reduce((sum, o) => sum + o.total_amount, 0);
    const firstItem = orders[0]?.items?.[0];
    const totalItems = orders.reduce((sum, o) => sum + (o.items?.length ?? 0), 0);
    const orderName = firstItem
      ? `${firstItem.product_name}${totalItems > 1 ? ` 외 ${totalItems - 1}건` : ''}`
      : '마켓플레이스 주문';

    if (!c.env.TOSS_CLIENT_KEY) {
      return c.json({ success: false, error: 'Payment service not configured' }, 500);
    }

    return c.json({
      success: true,
      data: {
        order_number,
        orders,
        total_amount: totalAmount,
        order_name: orderName,
        toss_client_key: c.env.TOSS_CLIENT_KEY,
        customer_name: orders[0]?.shipping_name ?? '',
        customer_phone: orders[0]?.shipping_phone ?? '',
      },
    });
  } catch (err) {
    return c.json({ success: false, error: 'Failed to create checkout session' }, 500);
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
    const paymentKey = validateRequiredString(body.paymentKey, 'paymentKey', { minLength: 1 });
    const cancelReason = validateRequiredString(body.cancelReason, 'cancelReason', { minLength: 1 });
    const cancelAmount = body.cancelAmount !== undefined
      ? validateNumber(body.cancelAmount, 'cancelAmount', { min: 0, integer: true })
      : undefined;

    const db = c.env.DB;
    const userId = await getUserDbId(db, String(user.id));

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
    const normalizedStatus = ((orderData.status as string) || '').toUpperCase();
    if (['CANCELLED', 'REFUNDED'].includes(normalizedStatus)) {
      return c.json(badRequestResponse('Order already cancelled'), 400);
    }
    if (['DELIVERED'].includes(normalizedStatus)) {
      return c.json(badRequestResponse('Cannot cancel delivered order'), 400);
    }

    // ✅ Cumulative partial-refund guard
    if (cancelAmount !== undefined) {
      try {
        const refunded = await db.prepare(
          'SELECT COALESCE(SUM(refund_amount), 0) AS total FROM order_refunds WHERE order_id = ?'
        ).bind(String(orderData.id)).first<{ total: number }>();
        if (Number(refunded?.total ?? 0) + cancelAmount > Number(orderData.total_amount)) {
          return c.json(badRequestResponse('환불 가능 금액 초과'), 400);
        }
      } catch {
        // order_refunds 테이블 없으면 Toss EXCEED_CANCEL_AMOUNT에 위임
      }
    }

    const tossSecretKey = c.env.TOSS_SECRET_KEY;
    if (!tossSecretKey) {
      return c.json(internalServerErrorResponse('Payment service not configured'), 500);
    }

    const amountKey = cancelAmount !== undefined ? String(cancelAmount) : 'full';
    const tossRes = await fetch(
      `${TOSS_PAYMENT_URL}/payments/${encodeURIComponent(paymentKey)}/cancel`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${btoa(tossSecretKey + ':')}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': `cancel-${paymentKey}-${amountKey}-${Date.now().toString(36)}`,
        },
        body: JSON.stringify({
          cancelReason,
          ...(cancelAmount !== undefined && { cancelAmount }),
          ...(body.refundReceiveAccount && { refundReceiveAccount: body.refundReceiveAccount }),
        }),
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!tossRes.ok) {
      const error = await tossRes.json() as TossPaymentErrorResponse;
      throw new Error(error.message || 'Toss payment cancellation failed');
    }
    const tossPayment = await tossRes.json() as TossPaymentResponse;

    // 환불 기록 저장
    try {
      await db.prepare(`
        CREATE TABLE IF NOT EXISTS order_refunds (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          order_id TEXT NOT NULL,
          refund_amount INTEGER NOT NULL,
          reason TEXT,
          payment_key TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `).run();
      await db.prepare(
        'INSERT INTO order_refunds (order_id, refund_amount, reason, payment_key) VALUES (?, ?, ?, ?)'
      ).bind(String(orderData.id), cancelAmount ?? Number(orderData.total_amount), cancelReason, paymentKey).run();
    } catch { /* non-critical */ }

    const transitioned = await transitionOrderStatus(db, orderData.id, 'CANCELLED', {
      extraSets: { cancel_reason: cancelReason },
    });

    if (transitioned) {
      const items = await db.prepare(
        'SELECT product_id, quantity FROM order_items WHERE order_id = ? AND status != ?'
      ).bind(String(orderData.id), 'CANCELLED').all<{ product_id: string; quantity: number }>();
      for (const item of items.results) {
        await db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?')
          .bind(item.quantity, item.product_id).run();
      }
      await db.prepare('UPDATE order_items SET status = ? WHERE order_id = ?')
        .bind('CANCELLED', String(orderData.id)).run();
    }

    const updatedOrderRows = await new QueryBuilder()
      .select(['o.*'])
      .from('orders o')
      .where('o.id = ?', orderData.id)
      .execute<OrderRow>(db);

    return c.json(successResponse({ payment: tossPayment, order: updatedOrderRows[0] }, 'Payment cancelled successfully'));

  } catch (error: unknown) {
    if (error instanceof ValidationError) {
      return c.json(validationErrorResponse(error.message, error.field), 422);
    }
    return c.json(internalServerErrorResponse(
      (error as Error).message || 'Payment rollback failed'
    ), 500);
  }
});
