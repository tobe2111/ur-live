// ============================================================
// Toss Payments Webhook Handler
// POST /api/payments/webhook
//
// Security: HMAC-SHA256 signature verification
// Idempotency: webhook_events table prevents duplicate processing
// Always returns 200 OK to prevent Toss retry storms
// ============================================================

import { Hono } from 'hono';
import type { Env } from '../types/env';
import { OrderRepository } from '../repositories/order.repository';
import { WebhookEventRepository } from '../repositories/webhook.repository';
import type { TossWebhookPayload } from '../../shared/types';
import { arrayBufferToHex } from '../../shared/utils';

const webhookRouter = new Hono<{ Bindings: Env }>();

// ---- HMAC-SHA256 Signature Verification ----
async function verifyTossSignature(
  rawBody: string,
  signatureHeader: string | undefined | null,
  secret: string
): Promise<boolean> {
  if (!signatureHeader) {
    console.warn('[WEBHOOK] Missing Toss-Signature header');
    return false;
  }

  try {
    // Toss sends: "v1=<hmac_hex>"
    const parts = signatureHeader.split('=');
    if (parts.length < 2 || parts[0] !== 'v1') {
      console.warn('[WEBHOOK] Invalid signature format:', signatureHeader);
      return false;
    }
    const receivedHex = parts.slice(1).join('='); // handle = in base64

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    const signature = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(rawBody)
    );
    const computedHex = arrayBufferToHex(signature);

    // Constant-time comparison to prevent timing attacks
    if (receivedHex.length !== computedHex.length) return false;

    let mismatch = 0;
    for (let i = 0; i < receivedHex.length; i++) {
      mismatch |= receivedHex.charCodeAt(i) ^ computedHex.charCodeAt(i);
    }
    return mismatch === 0;
  } catch (err) {
    console.error('[WEBHOOK] Signature verification error:', err);
    return false;
  }
}

// ---- Main Webhook Endpoint ----
webhookRouter.post('/', async (c) => {
  const startTime = Date.now();

  // Always return 200 to prevent Toss retries
  // Process errors internally

  let webhookEventId: string | null = null;
  const orderRepo = new OrderRepository(c.env.DB);
  const webhookRepo = new WebhookEventRepository(c.env.DB);

  try {
    // 1. Read raw body for signature verification
    const rawBody = await c.req.text();

    // 2. Verify signature (skip in development if no secret set)
    const webhookSecret = c.env.TOSS_WEBHOOK_SECRET;
    if (webhookSecret && webhookSecret !== 'dev_skip') {
      const signatureHeader = c.req.header('Toss-Signature');
      const isValid = await verifyTossSignature(rawBody, signatureHeader, webhookSecret);
      if (!isValid) {
        console.error('[WEBHOOK] ❌ INVALID_SIGNATURE - possible spoofed request', {
          ip: c.req.header('CF-Connecting-IP'),
          userAgent: c.req.header('User-Agent'),
        });
        // Return 200 even for invalid signature (Toss should not retry invalid sigs)
        return c.json({ received: true, status: 'rejected' }, 200);
      }
    } else {
      console.warn('[WEBHOOK] ⚠️ Signature verification skipped (development mode)');
    }

    // 3. Parse payload
    let payload: TossWebhookPayload;
    try {
      payload = JSON.parse(rawBody) as TossWebhookPayload;
    } catch {
      console.error('[WEBHOOK] Failed to parse payload');
      return c.json({ received: true, status: 'parse_error' }, 200);
    }

    const { eventType, data } = payload;
    const tossOrderId = data.orderId;   // This is our order_number
    const paymentKey = data.paymentKey;

    console.log('[WEBHOOK] RECEIVED', {
      eventType,
      tossOrderId,
      paymentKey: paymentKey?.slice(0, 20) + '...',
      status: data.status,
      amount: data.totalAmount,
    });

    // 4. Idempotency check - prevent duplicate processing
    const alreadyProcessed = await webhookRepo.isAlreadyProcessed(eventType, tossOrderId);
    if (alreadyProcessed) {
      console.log('[WEBHOOK] DUPLICATE_SKIPPED', { eventType, tossOrderId });
      return c.json({ received: true, status: 'duplicate_skipped' }, 200);
    }

    // 5. Record the event first (for audit trail)
    webhookEventId = await webhookRepo.record(
      eventType,
      payload,
      tossOrderId,
      tossOrderId  // order_number equals tossOrderId in Toss flow
    );

    // 6. Process by event type
    switch (eventType) {
      case 'payment.confirmed':
        await handlePaymentConfirmed(orderRepo, data, tossOrderId, paymentKey);
        break;

      case 'payment.cancelled':
        await handlePaymentCancelled(orderRepo, data, tossOrderId);
        break;

      case 'payment.failed':
        await handlePaymentFailed(orderRepo, data, tossOrderId);
        break;

      case 'payment.virtual_account_issued':
        await handleVirtualAccountIssued(orderRepo, data, tossOrderId);
        break;

      case 'payment.virtual_account_deposited':
        await handleVirtualAccountDeposited(orderRepo, data, tossOrderId, paymentKey);
        break;

      default:
        console.log('[WEBHOOK] UNHANDLED_EVENT_TYPE', { eventType });
        await webhookRepo.markSkipped(webhookEventId);
        return c.json({ received: true, status: 'unhandled' }, 200);
    }

    // 7. Mark as processed
    await webhookRepo.markProcessed(webhookEventId);

    const elapsed = Date.now() - startTime;
    console.log('[WEBHOOK] PROCESSED_SUCCESS', {
      eventType,
      tossOrderId,
      elapsed_ms: elapsed,
    });

    return c.json({ received: true, status: 'processed' }, 200);

  } catch (err) {
    // CRITICAL: Always return 200 even on errors
    // Log the error but don't let Toss retry (which could cause duplicate charges)
    const error = err instanceof Error ? err.message : String(err);
    console.error('[WEBHOOK] PROCESSING_ERROR', {
      error,
      webhookEventId,
      elapsed_ms: Date.now() - startTime,
    });

    if (webhookEventId) {
      try {
        const webhookRepo2 = new WebhookEventRepository(c.env.DB);
        await webhookRepo2.markFailed(webhookEventId, error);
      } catch (innerErr) {
        console.error('[WEBHOOK] Failed to mark event as failed:', innerErr);
      }
    }

    return c.json({ received: true, status: 'error' }, 200);
  }
});

// ============================================================
// Event Handlers
// ============================================================

/**
 * payment.confirmed - Toss confirmed the payment
 * Update all orders with this order_number to DONE/PAID
 */
async function handlePaymentConfirmed(
  orderRepo: OrderRepository,
  data: TossWebhookPayload['data'],
  orderNumber: string,
  paymentKey: string
): Promise<void> {
  console.log('[WEBHOOK] PAYMENT_CONFIRMED', {
    orderNumber,
    amount: data.totalAmount,
    method: data.method,
  });

  // Check idempotency: already PAID/DONE?
  const alreadyDone = await orderRepo.isAlreadyProcessed(orderNumber, 'DONE');
  const alreadyPaid = await orderRepo.isAlreadyProcessed(orderNumber, 'PAID');
  if (alreadyDone || alreadyPaid) {
    console.log('[WEBHOOK] ORDER_ALREADY_CONFIRMED', { orderNumber });
    return;
  }

  // Update all orders with this order_number (multi-seller)
  await orderRepo.updateStatus(orderNumber, 'DONE', {
    toss_payment_key: paymentKey,
    toss_order_id: orderNumber,
    payment_method: data.method,
    paid_at: data.approvedAt ?? new Date().toISOString(),
    webhook_processed_at: new Date().toISOString(),
    webhook_event_id: `payment.confirmed:${orderNumber}`,
  });

  // Find all orders to reduce stock
  const orders = await orderRepo.findByOrderNumber(orderNumber);
  for (const order of orders) {
    await orderRepo.reduceStock(order.id);
    console.log('[WEBHOOK] STOCK_REDUCED', { orderId: order.id, sellerId: order.seller_id });
  }

  console.log('[WEBHOOK] PAYMENT_CONFIRMED_COMPLETE', {
    orderNumber,
    ordersUpdated: orders.length,
  });
}

/**
 * payment.cancelled - Payment was cancelled
 * Restore stock for all orders
 */
async function handlePaymentCancelled(
  orderRepo: OrderRepository,
  data: TossWebhookPayload['data'],
  orderNumber: string
): Promise<void> {
  console.log('[WEBHOOK] PAYMENT_CANCELLED', {
    orderNumber,
    cancelReason: data.failureMessage,
  });

  const orders = await orderRepo.findByOrderNumber(orderNumber);

  // Update all orders to CANCELLED
  await orderRepo.updateStatus(orderNumber, 'CANCELLED', {
    cancelled_at: data.cancelledAt ?? new Date().toISOString(),
    cancel_reason: data.failureMessage ?? 'Payment cancelled',
    webhook_processed_at: new Date().toISOString(),
    webhook_event_id: `payment.cancelled:${orderNumber}`,
  });

  // Restore stock for each order
  for (const order of orders) {
    // Only restore if order was in a state where stock was reduced
    if (['DONE', 'PAID', 'PREPARING', 'SHIPPING'].includes(order.status)) {
      await orderRepo.restoreStock(order.id);
      console.log('[WEBHOOK] STOCK_RESTORED', { orderId: order.id, sellerId: order.seller_id });
    }
  }

  // TODO: Send cancellation notification (email/push) - Phase 2
  console.log('[WEBHOOK] PAYMENT_CANCELLED_COMPLETE', {
    orderNumber,
    ordersUpdated: orders.length,
  });
}

/**
 * payment.failed - Payment failed
 * Update status to FAILED, notify user
 */
async function handlePaymentFailed(
  orderRepo: OrderRepository,
  data: TossWebhookPayload['data'],
  orderNumber: string
): Promise<void> {
  console.log('[WEBHOOK] PAYMENT_FAILED', {
    orderNumber,
    failureCode: data.failureCode,
    failureMessage: data.failureMessage,
  });

  await orderRepo.updateStatus(orderNumber, 'FAILED', {
    cancel_reason: `${data.failureCode ?? 'UNKNOWN'}: ${data.failureMessage ?? 'Payment failed'}`,
    webhook_processed_at: new Date().toISOString(),
    webhook_event_id: `payment.failed:${orderNumber}`,
  });

  // TODO: Send failure notification (email/push) - Phase 2
  console.log('[WEBHOOK] PAYMENT_FAILED_COMPLETE', { orderNumber });
}

/**
 * payment.virtual_account_issued - Virtual account created, awaiting deposit
 */
async function handleVirtualAccountIssued(
  orderRepo: OrderRepository,
  data: TossWebhookPayload['data'],
  orderNumber: string
): Promise<void> {
  console.log('[WEBHOOK] VIRTUAL_ACCOUNT_ISSUED', { orderNumber });

  await orderRepo.updateStatus(orderNumber, 'AWAITING_PAYMENT', {
    toss_order_id: orderNumber,
    webhook_processed_at: new Date().toISOString(),
    webhook_event_id: `payment.virtual_account_issued:${orderNumber}`,
  });
}

/**
 * payment.virtual_account_deposited - Deposit received for virtual account
 */
async function handleVirtualAccountDeposited(
  orderRepo: OrderRepository,
  data: TossWebhookPayload['data'],
  orderNumber: string,
  paymentKey: string
): Promise<void> {
  console.log('[WEBHOOK] VIRTUAL_ACCOUNT_DEPOSITED', { orderNumber });

  // Same as payment.confirmed
  await handlePaymentConfirmed(orderRepo, data, orderNumber, paymentKey);
}

export { webhookRouter };
