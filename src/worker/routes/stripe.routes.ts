// ============================================================
// Stripe Payment Routes (Global Region)
// POST /api/payment/stripe/create-intent  - Create PaymentIntent
// ============================================================

import { Hono } from 'hono';
import type { Env } from '../types/env';
import { swallow } from '../utils/swallow';
import { createDashboardNotification } from '../../features/notifications/api/dashboard-notifications.routes';

const stripeRouter = new Hono<{ Bindings: Env }>();

/**
 * POST /api/payment/stripe/create-intent
 * Creates a Stripe PaymentIntent and returns the clientSecret.
 * Called by StripeCheckout.tsx before rendering the PaymentElement.
 */
stripeRouter.post('/create-intent', async (c) => {
  try {
    const stripeSecretKey = c.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      return c.json(
        { success: false, error: 'Stripe is not configured on this server' },
        503
      );
    }

    const body = await c.req.json<{
      amount: number;       // Amount in smallest currency unit (cents for USD)
      currency?: string;    // ISO 4217, default 'usd'
      metadata?: Record<string, string>;
    }>();

    const { amount, currency = 'usd', metadata = {} } = body;

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return c.json({ success: false, error: 'Invalid amount' }, 400);
    }

    // Call Stripe API to create a PaymentIntent
    const formBody = new URLSearchParams();
    formBody.append('amount', String(Math.round(amount)));
    formBody.append('currency', currency);
    formBody.append('automatic_payment_methods[enabled]', 'true');
    for (const [key, value] of Object.entries(metadata)) {
      formBody.append(`metadata[${key}]`, String(value));
    }

    // 🛡️ Idempotency 보장 — 클라이언트가 빠르게 2번 눌러도 동일 PaymentIntent 재사용
    const clientIdempotencyKey = c.req.header('Idempotency-Key');
    const idempotencyKey = clientIdempotencyKey || crypto.randomUUID();

    // 🛡️ 타임아웃 — Stripe 느리면 10초 후 중단 (유저 대기 방지)
    const stripeResponse = await fetch('https://api.stripe.com/v1/payment_intents', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeSecretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Idempotency-Key': idempotencyKey,
      },
      body: formBody.toString(),
      signal: AbortSignal.timeout(10_000),
    });

    if (!stripeResponse.ok) {
      const stripeError = await stripeResponse.json() as { error?: { message?: string } };
      const message = stripeError?.error?.message ?? 'Failed to create payment intent';
      console.error('[Stripe] PaymentIntent creation failed:', stripeError);
      return c.json({ success: false, error: message }, 400);
    }

    const paymentIntent = await stripeResponse.json() as {
      id: string;
      client_secret: string;
      status: string;
    };

    return c.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (err: any) {
    console.error('[Stripe] create-intent error:', err);
    return c.json(
      { success: false, error: err?.message ?? 'Internal server error' },
      500
    );
  }
});

/**
 * POST /api/payment/stripe/webhook
 * Stripe webhook — payment_intent.succeeded / payment_intent.payment_failed 등 처리.
 *
 * 🛡️ 2026-04-22: 이전엔 webhook handler 가 전혀 없어서 결제 확정 처리 불가.
 * Client 가 Stripe 에서 결제 성공해도 서버 order.status 업데이트 안 됨.
 *
 * 서명 검증: Stripe-Signature 헤더 (t=timestamp,v1=hmac).
 * 환경 변수: STRIPE_WEBHOOK_SECRET (Stripe Dashboard 에서 발급).
 */
stripeRouter.post('/webhook', async (c) => {
  const webhookSecret = (c.env as any).STRIPE_WEBHOOK_SECRET as string | undefined;
  if (!webhookSecret) {
    console.error('[Stripe Webhook] STRIPE_WEBHOOK_SECRET not configured');
    return c.json({ received: true }, 200); // Stripe 재시도 방지용 200
  }

  const signature = c.req.header('Stripe-Signature');
  if (!signature) {
    return c.json({ success: false, error: 'Missing Stripe-Signature header' }, 400);
  }

  const rawBody = await c.req.text();

  // 🛡️ 서명 검증 (Stripe 형식: "t=timestamp,v1=hmac")
  try {
    const sigParts = Object.fromEntries(
      signature.split(',').map((part) => {
        const [k, v] = part.split('=');
        return [k, v];
      }),
    );
    const ts = sigParts.t;
    const v1 = sigParts.v1;
    if (!ts || !v1) return c.json({ success: false, error: 'Malformed signature' }, 400);

    // 5분 timestamp tolerance (replay 방어)
    const tsNum = Number(ts);
    if (!Number.isFinite(tsNum) || Math.abs(Math.floor(Date.now() / 1000) - tsNum) > 300) {
      return c.json({ success: false, error: 'Timestamp out of tolerance' }, 400);
    }

    const payload = `${ts}.${rawBody}`;
    const key = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(webhookSecret),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
    );
    const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
    const computed = Array.from(new Uint8Array(mac))
      .map((b) => b.toString(16).padStart(2, '0')).join('');

    // 상수 시간 비교
    if (computed.length !== v1.length) {
      return c.json({ success: false, error: 'Invalid signature' }, 401);
    }
    let diff = 0;
    for (let i = 0; i < computed.length; i++) {
      diff |= computed.charCodeAt(i) ^ v1.charCodeAt(i);
    }
    if (diff !== 0) {
      return c.json({ success: false, error: 'Invalid signature' }, 401);
    }
  } catch (err) {
    console.error('[Stripe Webhook] Signature verification failed:', err);
    return c.json({ success: false, error: 'Signature verification failed' }, 401);
  }

  // 이벤트 파싱
  let event: { id: string; type: string; data: { object: any } };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return c.json({ success: false, error: 'Invalid JSON' }, 400);
  }

  const DB = c.env.DB;
  if (!DB) return c.json({ received: true }, 200);

  // 🛡️ Idempotency — 이미 처리된 event 는 skip
  try {
    await DB.prepare(`
      CREATE TABLE IF NOT EXISTS stripe_webhook_events (
        event_id TEXT PRIMARY KEY,
        event_type TEXT NOT NULL,
        processed_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `).run();
    const existing = await DB.prepare(
      'SELECT event_id FROM stripe_webhook_events WHERE event_id = ?'
    ).bind(event.id).first();
    if (existing) {
      return c.json({ received: true, idempotent: true }, 200);
    }
  } catch {}

  // 이벤트별 처리
  try {
    const obj = event.data.object;
    const metadata = obj.metadata || {};

    if (event.type === 'payment_intent.succeeded') {
      const orderNumber = metadata.orderNumber || metadata.order_number;
      if (orderNumber) {
        await DB.prepare(
          "UPDATE orders SET status = 'PAID', payment_status = 'approved', paid_at = datetime('now'), updated_at = datetime('now') WHERE order_number = ? AND status = 'PENDING'"
        ).bind(orderNumber).run();
      }
    } else if (event.type === 'payment_intent.payment_failed') {
      const orderNumber = metadata.orderNumber || metadata.order_number;
      if (orderNumber) {
        await DB.prepare(
          "UPDATE orders SET status = 'FAILED', payment_status = 'failed', updated_at = datetime('now') WHERE order_number = ?"
        ).bind(orderNumber).run();

        // 🛡️ 2026-04-28: 어드민에 결제 실패 알림 (운영 모니터링)
        createDashboardNotification(DB, 'admin', null, 'payment_failed', '결제 실패', `주문번호: ${orderNumber} (Stripe)`, '/admin/orders').catch(swallow('stripe:notify-payment-failed'));
      }
    }

    // 처리 기록
    await DB.prepare(
      'INSERT INTO stripe_webhook_events (event_id, event_type) VALUES (?, ?)'
    ).bind(event.id, event.type).run().catch(swallow('stripe:webhook-event-log'));
  } catch (err) {
    console.error('[Stripe Webhook] Processing error:', err);
  }

  return c.json({ received: true }, 200);
});

export { stripeRouter };
