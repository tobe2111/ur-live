// ============================================================
// Payment Routes
// POST /api/payments/confirm          - Confirm payment (client redirect)
// POST /api/payments/webhook          - Toss webhook (server-side)
// POST /api/payments/checkout-session - Create checkout session
// ============================================================
import { Hono } from 'hono';
import { z } from 'zod';
import { OrderRepository } from '../repositories/order.repository';
import { authMiddleware } from '../middleware/auth.middleware';
import { webhookRouter } from './webhook.routes';
import { TOSS_PAYMENT_URL } from '../../shared/constants';
const paymentsRouter = new Hono();
// ---- Webhook (PUBLIC - no auth needed, signature-protected) ----
paymentsRouter.route('/webhook', webhookRouter);
// ---- Confirm (requires auth) ----
paymentsRouter.use('/confirm', authMiddleware);
paymentsRouter.use('/checkout-session', authMiddleware);
const confirmSchema = z.object({
    paymentKey: z.string(),
    orderId: z.string(), // our order_number
    amount: z.number().positive(),
});
/**
 * POST /api/payments/confirm
 * Called after client-side Toss widget completes payment
 * Confirms with Toss API and updates order status
 */
paymentsRouter.post('/confirm', async (c) => {
    try {
        const userId = c.get('user').id;
        const body = await c.req.json();
        const parsed = confirmSchema.safeParse(body);
        if (!parsed.success) {
            return c.json({ success: false, error: 'Invalid request' }, 400);
        }
        const { paymentKey, orderId: orderNumber, amount } = parsed.data;
        const orderRepo = new OrderRepository(c.env.DB);
        const orders = await orderRepo.findByOrderNumber(orderNumber);
        if (orders.length === 0) {
            return c.json({ success: false, error: '주문을 찾을 수 없습니다' }, 404);
        }
        // Security: verify user owns these orders
        const unauthorized = orders.find(o => o.user_id !== userId);
        if (unauthorized) {
            return c.json({ success: false, error: 'Forbidden' }, 403);
        }
        // Verify total amount matches
        const totalAmount = orders.reduce((sum, o) => sum + o.total_amount, 0);
        if (totalAmount !== amount) {
            console.error('[PAYMENTS] Amount mismatch:', { expected: totalAmount, received: amount });
            return c.json({ success: false, error: '결제 금액이 일치하지 않습니다' }, 400);
        }
        // Call Toss Payments API to confirm
        const tossSecretKey = c.env.TOSS_SECRET_KEY;
        if (!tossSecretKey) {
            return c.json({ success: false, error: 'Payment configuration error' }, 500);
        }
        const tossResponse = await fetch(`${TOSS_PAYMENT_URL}/payments/confirm`, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${btoa(tossSecretKey + ':')}`,
                'Content-Type': 'application/json',
                'Idempotency-Key': orderNumber, // Toss idempotency
            },
            body: JSON.stringify({
                paymentKey,
                orderId: orderNumber,
                amount,
            }),
        });
        if (!tossResponse.ok) {
            const tossError = await tossResponse.json();
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
        const tossData = await tossResponse.json();
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
        return c.json({ success: true, data: { orders: updatedOrders, payment: tossData } });
    }
    catch (err) {
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
        const userId = c.get('user').id;
        const { order_number } = await c.req.json();
        if (!order_number) {
            return c.json({ success: false, error: 'order_number is required' }, 400);
        }
        const orderRepo = new OrderRepository(c.env.DB);
        const orders = await orderRepo.findByOrderNumber(order_number);
        if (orders.length === 0) {
            return c.json({ success: false, error: '주문을 찾을 수 없습니다' }, 404);
        }
        const unauthorized = orders.find(o => o.user_id !== userId);
        if (unauthorized) {
            return c.json({ success: false, error: 'Forbidden' }, 403);
        }
        const totalAmount = orders.reduce((sum, o) => sum + o.total_amount, 0);
        const sellerNames = [...new Set(orders.map(o => o.seller_id))].join(', ');
        const firstItem = orders[0]?.items?.[0];
        const orderName = firstItem
            ? `${firstItem.product_name}${orders.reduce((sum, o) => sum + (o.items?.length ?? 0), 0) > 1 ? ` 외 ${orders.reduce((sum, o) => sum + (o.items?.length ?? 0), 0) - 1}건` : ''}`
            : '마켓플레이스 주문';
        return c.json({
            success: true,
            data: {
                order_number,
                orders,
                total_amount: totalAmount,
                order_name: orderName,
                toss_client_key: c.env.TOSS_CLIENT_KEY ?? 'test_ck_placeholder',
                customer_name: orders[0]?.shipping_name ?? '',
                customer_phone: orders[0]?.shipping_phone ?? '',
            },
        });
    }
    catch (err) {
        console.error('[PAYMENTS] Checkout session error:', err);
        return c.json({ success: false, error: 'Failed to create checkout session' }, 500);
    }
});
export { paymentsRouter };
