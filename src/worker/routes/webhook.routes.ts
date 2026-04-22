// ============================================================
// Toss Payments Webhook Handler
// POST /api/payments/webhook
//
// Security: HMAC-SHA256 signature verification
// Idempotency: webhook_events table prevents duplicate processing
// Always returns 200 OK to prevent Toss retry storms
// ============================================================

import { Hono } from 'hono';
import type { D1Database } from '@cloudflare/workers-types';
import type { Env } from '../types/env';
import { OrderRepository } from '../repositories/order.repository';
import { WebhookEventRepository } from '../repositories/webhook.repository';
import type { TossWebhookPayload } from '../../shared/types';
import { arrayBufferToHex } from '../../shared/utils';
import { sendAlert } from '../utils/alerts';

// ============================================================
// Order Notification Helper
// ============================================================

/**
 * Send an order status notification.
 *
 * Currently dispatches a Discord embed when DISCORD_WEBHOOK_URL is configured
 * in env.  Alimtalk (KakaoTalk) sending is wired via src/lib/aligo.ts but
 * requires ALIGO_API_KEY / ALIGO_USER_ID / ALIGO_SENDER_KEY to be set in env.
 *
 * @param orderRepo  - OrderRepository instance scoped to the current request
 * @param orderNumber - The platform order number (equals tossOrderId)
 * @param event      - 'cancelled' | 'failed'
 * @param env        - Worker Bindings (access to DISCORD_WEBHOOK_URL etc.)
 */
async function sendOrderNotification(
  orderRepo: OrderRepository,
  orderNumber: string,
  event: 'cancelled' | 'failed',
  env: Env
): Promise<void> {
  // Fetch order details so we have user contact info for future Alimtalk sends
  const orders = await orderRepo.findByOrderNumber(orderNumber).catch(() => []);
  const firstOrder = orders[0];

  const contactPhone = firstOrder?.shipping_phone ?? 'N/A';
  const userId = firstOrder?.user_id ?? 'N/A';

  if (import.meta.env.DEV) console.log(`[WEBHOOK] ORDER_NOTIFICATION event=${event}`, {
    orderNumber,
    userId,
    contactPhone: contactPhone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2'), // mask middle digits
    ordersCount: orders.length,
  });

  // Discord notification (configured via DISCORD_WEBHOOK_URL env var)
  const discordUrl = (env as any).DISCORD_WEBHOOK_URL;
  if (discordUrl) {
    const colorMap = { cancelled: 0xFFA500, failed: 0xFF0000 };
    const titleMap = { cancelled: 'Order Cancelled', failed: 'Payment Failed' };

    const embed = {
      title: `🔔 ${titleMap[event]}`,
      color: colorMap[event],
      fields: [
        { name: 'Order Number', value: orderNumber, inline: true },
        { name: 'User ID', value: userId, inline: true },
        { name: 'Orders Affected', value: String(orders.length), inline: true },
        { name: 'Timestamp', value: new Date().toISOString(), inline: false },
      ],
    };

    await fetch(discordUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] }),
    });

    if (import.meta.env.DEV) console.log(`[WEBHOOK] Discord notification sent for ${event} order ${orderNumber}`);
  }
}

const webhookRouter = new Hono<{ Bindings: Env }>();

// v31 FIX: webhook intake rate-limit (per-IP).
// POST / 에만 적용. wildcard '*'는 타 라우터에 영향을 줄 수 있어 피함.
import { rateLimit as _rlForWebhook } from '../middleware/rate-limit';
const webhookIntakeLimiter = _rlForWebhook({ action: 'webhook_intake', max: 100, windowSec: 1 });

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

// Replay-attack defense: reject webhooks older than 30 minutes.
// ✅ FIX (H7): Raised from 5min → 30min to accommodate Toss retry delays
// (Toss retries up to 24h; 30m is the sweet spot between legitimate retries
// and replay protection).
const WEBHOOK_TIMESTAMP_TOLERANCE_SEC = 30 * 60;

function verifyTimestamp(timestampHeader: string | undefined | null): boolean {
  if (!timestampHeader) return false; // require timestamp in production
  const ts = parseInt(timestampHeader, 10);
  if (isNaN(ts)) return false;
  const nowSec = Math.floor(Date.now() / 1000);
  return Math.abs(nowSec - ts) <= WEBHOOK_TIMESTAMP_TOLERANCE_SEC;
}

// ---- Main Webhook Endpoint ----
webhookRouter.post('/', webhookIntakeLimiter, async (c) => {
  const startTime = Date.now();

  // Always return 200 to prevent Toss retries
  // Process errors internally

  let webhookEventId: string | null = null;
  const orderRepo = new OrderRepository(c.env.DB);
  const webhookRepo = new WebhookEventRepository(c.env.DB);

  try {
    // 1. Read raw body — must happen before any other logic
    const rawBody = await c.req.text();

    // 2. Verify signature FIRST — reject before any DB access
    const isProduction = c.env.ENVIRONMENT === 'production';
    const webhookSecret = c.env.TOSS_WEBHOOK_SECRET;
    if (isProduction || (webhookSecret && webhookSecret.length > 0)) {
      if (!webhookSecret) {
        console.error('[WEBHOOK] ❌ TOSS_WEBHOOK_SECRET not configured in production');
        // ✅ FIX (Cron C4): Return 200 (not 401) so Toss does not enter a retry storm
        // for a misconfiguration that Toss retries cannot fix. Alert via Discord so
        // ops can set the secret. The webhook event is NOT processed.
        const discordUrl = (c.env as any).DISCORD_WEBHOOK_URL;
        if (discordUrl) {
          await fetch(discordUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              content: '🚨 TOSS_WEBHOOK_SECRET not configured — webhook delivery dropped. Set the secret immediately.',
            }),
            signal: AbortSignal.timeout(5000),
          }).catch(() => {});
        }
        return c.json({ success: false, error: 'webhook_secret_not_configured', processed: false }, 200);
      }
      const signatureHeader = c.req.header('Toss-Signature');
      const isValid = await verifyTossSignature(rawBody, signatureHeader, webhookSecret);
      if (!isValid) {
        console.error('[WEBHOOK] ❌ INVALID_SIGNATURE', {
          ip: c.req.header('CF-Connecting-IP'),
        });
        // Return 401 so Toss retries legitimate deliveries whose signatures failed transiently
        return c.json({ received: false, status: 'rejected', error: 'invalid_signature' }, 401);
      }

      // 3. Timestamp verification (replay attack defense) — BEFORE any logic
      const timestampHeader = c.req.header('Toss-Timestamp');
      if (!verifyTimestamp(timestampHeader)) {
        console.error('[WEBHOOK] ❌ INVALID_TIMESTAMP — possible replay attack', {
          timestamp: timestampHeader,
          ip: c.req.header('CF-Connecting-IP'),
        });
        // Return 401 — do not silently accept possibly-replayed requests
        return c.json({ received: false, status: 'rejected', error: 'invalid_timestamp' }, 401);
      }
    } else {
      console.warn('[WEBHOOK] ⚠️ Signature/timestamp verification skipped (non-production, no secret configured)');
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

    if (import.meta.env.DEV) {
      console.log('[WEBHOOK] RECEIVED', {
        eventType,
        tossOrderId,
        paymentKey: paymentKey ? paymentKey.slice(0, 8) + '...' : null,
        status: data.status,
        amount: data.totalAmount,
      });
    }

    // 4. Idempotency check - prevent duplicate processing
    const alreadyProcessed = await webhookRepo.isAlreadyProcessed(eventType, tossOrderId);
    if (alreadyProcessed) {
      if (import.meta.env.DEV) console.log('[WEBHOOK] DUPLICATE_SKIPPED', { eventType, tossOrderId });
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
    switch (eventType as string) {
      case 'payment.confirmed':
        await handlePaymentConfirmed(orderRepo, data, tossOrderId, paymentKey);
        break;

      case 'payment.cancelled':
        await handlePaymentCancelled(orderRepo, data, tossOrderId, c.env, c.env.DB);
        break;

      case 'payment.failed':
        await handlePaymentFailed(orderRepo, data, tossOrderId, c.env);
        break;

      case 'payment.virtual_account_issued':
        await handleVirtualAccountIssued(orderRepo, data, tossOrderId);
        break;

      case 'payment.virtual_account_deposited':
        await handleVirtualAccountDeposited(orderRepo, data, tossOrderId, paymentKey);
        break;

      case 'payment.partial_canceled':
        // Reuse cancel logic for partial cancels. Downstream amount tracking
        // lives in the refund flow; this webhook only records the event.
        await handlePaymentCancelled(orderRepo, data, tossOrderId, c.env, c.env.DB);
        break;

      case 'refund_completed':
        // Main refund is already handled via the /cancel route. Just audit.
        if (import.meta.env.DEV) console.log('[Webhook] refund_completed:', tossOrderId);
        await webhookRepo.markSkipped(webhookEventId, 'refund_completed_already_handled');
        return c.json({ received: true, status: 'audited' }, 200);

      case 'dispute_raised':
        // CRITICAL — alert ops immediately so manual action can be taken.
        await sendAlert(c.env, {
          severity: 'critical',
          title: '결제 분쟁 발생',
          message: `주문 ${tossOrderId}에 분쟁 제기됨`,
          context: { orderNumber: tossOrderId, paymentKey, payload },
        }).catch(() => {});
        await webhookRepo.markSkipped(webhookEventId, 'dispute_requires_manual_handling');
        return c.json({ received: true, status: 'dispute_alerted' }, 200);

      default:
        // Unknown event — alert for investigation.
        if (import.meta.env.DEV) console.log('[WEBHOOK] UNHANDLED_EVENT_TYPE', { eventType });
        await sendAlert(c.env, {
          severity: 'warn',
          title: `알 수 없는 Toss 이벤트: ${eventType}`,
          message: `${tossOrderId}에 대한 미지원 이벤트 수신`,
          context: { eventType, orderNumber: tossOrderId },
        }).catch(() => {});
        await webhookRepo.markSkipped(webhookEventId, `unknown_event:${eventType}`);
        return c.json({ received: true, status: 'unhandled' }, 200);
    }

    // 7. Mark as processed
    await webhookRepo.markProcessed(webhookEventId);

    const elapsed = Date.now() - startTime;
    if (import.meta.env.DEV) console.log('[WEBHOOK] PROCESSED_SUCCESS', {
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

  // v24 FIX: UPDATE orders + UPDATE order_items를 D1 batch로 묶어 atomic 처리.
  // 기존 updateStatus + 루프 reduceStock은 중간 실패 시 orders=DONE이지만
  // order_items는 PENDING 상태가 남는 불일치 발생 가능.
  const result = await orderRepo.confirmPaymentAtomic(orderNumber, {
    toss_payment_key: paymentKey,
    toss_order_id: orderNumber,
    payment_method: data.method,
    paid_at: data.approvedAt ?? new Date().toISOString(),
  });

  console.log('[WEBHOOK] PAYMENT_CONFIRMED_COMPLETE', {
    orderNumber,
    ordersUpdated: result.confirmed,
  });
}

/**
 * payment.cancelled - Payment was cancelled
 * Restore stock for all orders
 */
async function handlePaymentCancelled(
  orderRepo: OrderRepository,
  data: TossWebhookPayload['data'],
  orderNumber: string,
  env: Env,
  DB: D1Database
): Promise<void> {
  console.log('[WEBHOOK] PAYMENT_CANCELLED', {
    orderNumber,
    cancelReason: data.failureMessage,
  });

  const orders = await orderRepo.findByOrderNumber(orderNumber);

  // ✅ SECURITY FIX (Payment C3): Reject cancel transition from paid/shipping/delivered.
  // A cancel webhook should only apply to orders that never completed payment
  // (PENDING / AWAITING_PAYMENT). Orders already PAID/DONE/SHIPPING/DELIVERED must
  // go through the refund API — otherwise an attacker who can forge a cancel
  // webhook could reverse status + restore stock while keeping the goods.
  const paidTerminalStatuses = ['PAID', 'DONE', 'SHIPPING', 'DELIVERED'];
  const hasPaidOrder = orders.some(o =>
    paidTerminalStatuses.includes((o.status || '').toUpperCase())
  );
  if (hasPaidOrder) {
    console.warn('[WEBHOOK] CANCEL_REJECTED_PAID_ORDER', {
      orderNumber,
      statuses: orders.map(o => o.status),
    });
    return; // skip — do not update status or restore stock
  }

  // ✅ CONCURRENCY FIX (Cron C2): atomically CAS each order to CANCELLED to prevent
  // double stock-restore (webhook + scheduled-cleanup may race). Only restore
  // stock for orders that actually transitioned in THIS call.
  const cancelledAt = data.cancelledAt ?? new Date().toISOString();
  const cancelReason = data.failureMessage ?? 'Payment cancelled';
  for (const order of orders) {
    const casResult = await DB.prepare(
      `UPDATE orders
       SET status = 'CANCELLED', cancelled_at = ?, cancel_reason = ?, updated_at = datetime('now')
       WHERE id = ?
         AND status NOT IN ('CANCELLED', 'REFUNDED', 'FAILED')`
    ).bind(cancelledAt, cancelReason, order.id).run();

    if ((casResult.meta?.changes ?? 0) === 0) {
      // Already cancelled/refunded/failed by another path — skip stock restore
      console.log('[WEBHOOK] STOCK_RESTORE_SKIPPED_ALREADY_TRANSITIONED', {
        orderId: order.id,
      });
      continue;
    }

    // Only restore stock when we actually transitioned the status
    await orderRepo.restoreStock(order.id);
    console.log('[WEBHOOK] STOCK_RESTORED', { orderId: order.id, sellerId: order.seller_id });
  }

  // ✅ SECURITY FIX (Payment C7): Reverse any referral commissions granted for
  // these orders so a cancel/refund cannot leave the inviter with free deals.
  // Best-effort — tables may not exist in every environment.
  try {
    for (const order of orders) {
      const orderId = order.id;
      await DB.prepare(`
        UPDATE referral_commissions
        SET status = 'withdrawn', withdrawn_at = datetime('now')
        WHERE order_id = ? AND status = 'granted'
      `).bind(orderId).run().catch(() => {});
      // Debit the deal_balance (best-effort — column may not exist)
      const commissions = await DB.prepare(
        "SELECT user_id, amount FROM referral_commissions WHERE order_id = ? AND status = 'withdrawn'"
      ).bind(orderId).all<{ user_id: string; amount: number }>().catch(() => ({ results: [] as Array<{ user_id: string; amount: number }> }));
      for (const co of (commissions.results || [])) {
        await DB.prepare(
          'UPDATE user_points SET balance = MAX(0, balance - ?) WHERE user_id = ?'
        ).bind(co.amount, co.user_id).run().catch(() => {});
      }
    }
  } catch (e) {
    console.warn('[WEBHOOK] Commission reversal skipped:', e);
  }

  // v26 FIX: 결제 취소 시 coupon_uses 복원 (쿠폰 재사용 가능하게)
  try {
    const { restoreCouponsForOrders } = await import('@/features/coupons/api/coupons.routes');
    const restored = await restoreCouponsForOrders(DB, orders.map(o => o.id));
    if (restored > 0) {
      console.log('[WEBHOOK] COUPON_RESTORED', { orderNumber, restored });
    }
  } catch (e) {
    console.warn('[WEBHOOK] Coupon restore skipped:', e);
  }

  // Send order cancellation notification
  await sendOrderNotification(orderRepo, orderNumber, 'cancelled', env)
    .catch(err => console.error('[WEBHOOK] Notification failed:', err));
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
  orderNumber: string,
  env: Env
): Promise<void> {
  console.log('[WEBHOOK] PAYMENT_FAILED', {
    orderNumber,
    failureCode: data.failureCode,
    failureMessage: data.failureMessage,
  });

  // ✅ SCHEMA FIX: Removed webhook_processed_at / webhook_event_id (not in schema)
  await orderRepo.updateStatus(orderNumber, 'FAILED', {
    cancel_reason: `${data.failureCode ?? 'UNKNOWN'}: ${data.failureMessage ?? 'Payment failed'}`,
  });

  // Restore stock — reserveStock() was called at order creation (PENDING).
  const failedOrders = await orderRepo.findByOrderNumber(orderNumber);
  for (const order of failedOrders) {
    await orderRepo.restoreStock(order.id);
    console.log('[WEBHOOK] STOCK_RESTORED_ON_FAILURE', { orderId: order.id });
  }

  await sendOrderNotification(orderRepo, orderNumber, 'failed', env)
    .catch(err => console.error('[WEBHOOK] Notification failed:', err));
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

  // ✅ SCHEMA FIX: Removed webhook_processed_at / webhook_event_id (not in schema)
  await orderRepo.updateStatus(orderNumber, 'AWAITING_PAYMENT', {
    toss_order_id: orderNumber,
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
