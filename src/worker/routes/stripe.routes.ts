// ============================================================
// Stripe Payment Routes (Global Region)
// POST /api/payment/stripe/create-intent  - Create PaymentIntent
// ============================================================

import { Hono } from 'hono';
import type { Env } from '../types/env';

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

export { stripeRouter };
