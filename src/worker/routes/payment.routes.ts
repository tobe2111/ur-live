// ============================================================
// Payment Routes
// POST /api/payments/confirm          - Confirm payment (client redirect)
// POST /api/payments/webhook          - Toss webhook (server-side)
// POST /api/payments/checkout-session - Create checkout session
// ============================================================

import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../types/env';
import { OrderRepository } from '../repositories/order.repository';
import { requireAuth, type AuthUser } from '../middleware/auth';
import { webhookRouter } from './webhook.routes';
import { TOSS_PAYMENT_URL } from '../../shared/constants';
import { sendSellerAlimtalk } from '../../features/alimtalk/send';
import { buildOrderConfirmMessage } from '../../features/alimtalk/aligo';
import { withCircuitBreaker } from '../utils/circuit-breaker';
import { logInfo, logError, logWarn } from '../utils/logger';

// AuthVariables compatible with auth.ts AuthUser
type AuthVariables = { user: AuthUser };

const paymentsRouter = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

// ---- Webhook (PUBLIC - no auth needed, signature-protected) ----
paymentsRouter.route('/webhook', webhookRouter);

// Apply Firebase+JWT auth to protected endpoints
paymentsRouter.use('/confirm', requireAuth());
paymentsRouter.use('/checkout-session', requireAuth());

const confirmSchema = z.object({
  paymentKey: z.string().min(1),
  orderId: z.string().min(6).max(64).regex(/^[a-zA-Z0-9\-_]+$/, 'Invalid orderId format'),
  amount: z.number().int().positive(),
});

/**
 * POST /api/payments/confirm
 * Called after client-side Toss widget completes payment.
 * 토스페이먼츠 결제 승인 API를 호출하여 결제를 확정합니다.
 *
 * 플로우:
 * 1. orderId로 DB 주문 조회 + 소유자 검증
 * 2. DB 저장 금액과 클라이언트 금액 비교 (금액 변조 방지)
 * 3. 토스 결제 승인 API 호출 (Idempotency-Key = paymentKey)
 * 4. 주문 상태 DONE 전환 + 재고 차감
 */
paymentsRouter.post('/confirm', async (c) => {
  try {
    const rawId = String(c.get('user').id);
    // 숫자 ID면 바로 사용 (세션 쿠키), 아니면 firebase_uid로 DB 조회
    let userId = rawId;
    const numId = parseInt(rawId);
    if (isNaN(numId) || String(numId) !== rawId) {
      try {
        const row = await c.env.DB.prepare('SELECT id FROM users WHERE firebase_uid = ? LIMIT 1')
          .bind(rawId).first<{ id: string | number }>();
        if (row?.id != null) userId = String(row.id);
      } catch {
        // firebase_uid 컬럼 없는 스키마 → 그대로 사용
      }
    }

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

    // 이미 결제 완료된 주문인 경우 중복 승인 방지
    const alreadyDone = orders.every(o => o.status === 'DONE' || o.status === 'PAID');
    if (alreadyDone) {
      return c.json({ success: true, data: { orders } });
    }

    // ✅ SECURITY FIX (Payment C4): Reject confirm when any order is already
    // cancelled/refunded/failed. Without this guard an attacker who cancelled
    // an order could still re-confirm it on Toss after the fact and bypass
    // the refund path.
    const forbidden = orders.filter(o =>
      ['CANCELLED', 'REFUNDED', 'FAILED'].includes((o.status || '').toUpperCase())
    );
    if (forbidden.length > 0) {
      return c.json({ success: false, error: '이미 취소/환불된 주문입니다.' }, 409);
    }

    // Security: verify user owns these orders (타입 안전 비교: DB는 INTEGER, auth는 STRING)
    const unauthorized = orders.find(o => String(o.user_id) !== String(userId));
    if (unauthorized) {
      console.error('[PAYMENTS] User mismatch:', { authUserId: userId, orderUserId: unauthorized.user_id });
      return c.json({ success: false, error: 'Forbidden' }, 403);
    }

    // DB에 저장된 금액으로 검증 (금액 변조 방지)
    const totalAmount = orders.reduce((sum, o) => sum + o.total_amount, 0);
    if (totalAmount !== amount) {
      console.error('[PAYMENTS] Amount mismatch:', { expected: totalAmount, received: amount, orderNumber });
      return c.json({ success: false, error: '결제 금액이 일치하지 않습니다' }, 400);
    }

    // Call Toss Payments API to confirm
    const tossSecretKey = c.env.TOSS_SECRET_KEY;
    if (!tossSecretKey) {
      return c.json({ success: false, error: 'Payment configuration error' }, 500);
    }

    // Idempotency-Key: paymentKey 기반으로 설정 (동일 결제의 중복 승인 요청 방지)
    // ⚠️ 결제는 critical path — fallback 없이, 회로가 열리면 명확한 사용자 메시지와 함께 거부.
    logInfo('toss.confirm.start', { orderId: orderNumber, amount: totalAmount, endpoint: '/api/payments/confirm' });
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
          body: JSON.stringify({
            paymentKey,
            orderId: orderNumber,
            amount: totalAmount,  // DB 검증된 금액 사용
          }),
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
      console.error('[PAYMENTS] Toss confirmation failed:', tossError);

      if (tossError.code === 'ALREADY_PROCESSED_PAYMENT') {
        // Already confirmed - update order and return success
        await orderRepo.updateStatus(orderNumber, 'DONE', {
          toss_payment_key: paymentKey,
          toss_order_id: orderNumber,
        });
        const updatedOrders = await orderRepo.findByOrderNumber(orderNumber);
        return c.json({ success: true, data: { orders: updatedOrders } });
      }

      return c.json({
        success: false,
        error: tossError.message ?? '결제 확인에 실패했습니다',
        code: tossError.code,
      }, 400);
    }

    const tossData = await tossResponse.json() as {
      paymentKey: string;
      orderId: string;
      totalAmount: number;
      method: string;
      approvedAt: string;
      status: string;
    };

    // 토스 응답의 금액도 한 번 더 검증
    if (tossData.totalAmount !== totalAmount) {
      console.error('[PAYMENTS] Toss amount mismatch after confirm:', {
        toss: tossData.totalAmount,
        db: totalAmount,
        orderNumber,
      });
    }

    // Update all orders to DONE
    await orderRepo.updateStatus(orderNumber, 'DONE', {
      toss_payment_key: tossData.paymentKey,
      toss_order_id: orderNumber,
      payment_method: tossData.method,
      paid_at: tossData.approvedAt,
    });

    // Reduce stock
    for (const order of orders) {
      await orderRepo.reduceStock(order.id);
    }

    const updatedOrders = await orderRepo.findByOrderNumber(orderNumber);

    console.log('[PAYMENTS] CONFIRMED', {
      orderNumber,
      amount,
      method: tossData.method,
      ordersCount: updatedOrders.length,
    });

    // ── 다단계 추천 커미션 계산 (fire-and-forget) ──────────────────────────
    // 결제 완료 후 구매자의 추천 트리를 확인하여 상위 추천인에게 커미션 지급
    try {
      const { calculateMultiTierCommission } = await import('../../features/referral/api/referral-tree.routes');
      for (const order of updatedOrders) {
        const oid = typeof order.id === 'number' ? order.id : parseInt(String(order.id), 10);
        if (oid && order.total_amount) {
          await calculateMultiTierCommission(c.env.DB, oid, order.total_amount, String(userId));
        }
      }
    } catch { /* referral commission is non-critical — silent fail */ }

    // ── 알림톡 자동 발송 (주문 완료) ──────────────────────────────────────
    // 실패해도 결제 응답에 영향 없도록 fire-and-forget
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
        }).catch(e => console.warn('[Alimtalk] 주문완료 발송 실패:', e));
      }
    }

    return c.json({ success: true, data: { orders: updatedOrders, payment: tossData } });

  } catch (err) {
    console.error('[PAYMENTS] Confirm error:', err);
    return c.json({ success: false, error: '결제 처리 중 오류가 발생했습니다' }, 500);
  }
});

/**
 * POST /api/payments/checkout-session
 * Returns checkout info including Toss client key and order details
 */
paymentsRouter.post('/checkout-session', async (c) => {
  try {
    // ✅ IDOR FIX: Resolve Firebase UID → DB integer id (same pattern as /confirm).
    // Previously compared o.user_id (INTEGER) to raw rawId (STRING) directly.
    const rawId = String(c.get('user').id);
    let dbUserId = rawId;
    const numId = parseInt(rawId);
    if (isNaN(numId) || String(numId) !== rawId) {
      try {
        const row = await c.env.DB.prepare('SELECT id FROM users WHERE firebase_uid = ? LIMIT 1')
          .bind(rawId).first<{ id: string | number }>();
        if (row?.id != null) dbUserId = String(row.id);
        else return c.json({ success: false, error: 'Unauthorized' }, 401);
      } catch {
        // fallback: keep raw id
      }
    }

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
    const sellerNames = [...new Set(orders.map(o => o.seller_id))].join(', ');
    const firstItem = orders[0]?.items?.[0];
    const orderName = firstItem
      ? `${firstItem.product_name}${orders.reduce((sum, o) => sum + (o.items?.length ?? 0), 0) > 1 ? ` 외 ${orders.reduce((sum, o) => sum + (o.items?.length ?? 0), 0) - 1}건` : ''}`
      : '마켓플레이스 주문';

    if (!c.env.TOSS_CLIENT_KEY) {
      console.error('[PAYMENTS] TOSS_CLIENT_KEY is not configured');
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
    console.error('[PAYMENTS] Checkout session error:', err);
    return c.json({ success: false, error: 'Failed to create checkout session' }, 500);
  }
});

export { paymentsRouter };
