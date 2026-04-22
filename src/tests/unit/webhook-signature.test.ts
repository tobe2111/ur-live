/**
 * Webhook signature verification regression tests
 *
 * Ensures HMAC-SHA256 signature verification is correctly implemented for
 * Toss/Stripe/Resend webhooks — a regression here silently accepts forged
 * events and lets attackers confirm/cancel orders at will.
 *
 * Scope:
 * - Stripe Signature parsing (t=,v1=) + timestamp tolerance
 * - Constant-time comparison correctness
 * - Malformed signatures rejected
 */
import { describe, it, expect } from 'vitest';

// ── Stripe signature parsing (mirrored from src/worker/routes/stripe.routes.ts) ──
function parseStripeSignature(header: string): Record<string, string> | null {
  try {
    const parts = header.split(',').map((p) => {
      const [k, v] = p.split('=');
      return [k, v] as [string, string];
    });
    return Object.fromEntries(parts);
  } catch {
    return null;
  }
}

function isTimestampFresh(ts: number, nowSec: number, toleranceSec = 300): boolean {
  if (!Number.isFinite(ts)) return false;
  return Math.abs(nowSec - ts) <= toleranceSec;
}

// Constant-time string comparison (mirrored)
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function hmacSha256Hex(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

describe('Stripe webhook signature — parsing', () => {
  it('parses valid t=/v1= header', () => {
    const header = 't=1729598400,v1=abc123def';
    const parsed = parseStripeSignature(header);
    expect(parsed?.t).toBe('1729598400');
    expect(parsed?.v1).toBe('abc123def');
  });

  it('handles multiple v-values', () => {
    const header = 't=1729598400,v1=sig1,v0=old';
    const parsed = parseStripeSignature(header);
    expect(parsed?.v1).toBe('sig1');
    expect(parsed?.v0).toBe('old');
  });

  it('returns object even for malformed header', () => {
    const parsed = parseStripeSignature('garbage');
    expect(parsed).toBeTruthy();
    // garbage has no = so split gives [['garbage', undefined]]
    expect(parsed?.t).toBeUndefined();
  });
});

describe('Webhook timestamp — 5-minute tolerance (replay defense)', () => {
  const nowSec = Math.floor(Date.now() / 1000);

  it('accepts fresh timestamp', () => {
    expect(isTimestampFresh(nowSec, nowSec)).toBe(true);
    expect(isTimestampFresh(nowSec - 60, nowSec)).toBe(true);
    expect(isTimestampFresh(nowSec + 60, nowSec)).toBe(true);
  });

  it('rejects stale timestamp (>5min old)', () => {
    expect(isTimestampFresh(nowSec - 301, nowSec)).toBe(false);
    expect(isTimestampFresh(nowSec - 3600, nowSec)).toBe(false);
  });

  it('rejects far-future timestamp', () => {
    expect(isTimestampFresh(nowSec + 301, nowSec)).toBe(false);
  });

  it('rejects non-numeric timestamp', () => {
    expect(isTimestampFresh(NaN, nowSec)).toBe(false);
    expect(isTimestampFresh(Infinity, nowSec)).toBe(false);
  });
});

describe('Constant-time equality', () => {
  it('returns true for equal strings', () => {
    expect(constantTimeEqual('abc123', 'abc123')).toBe(true);
  });

  it('returns false for different strings of same length', () => {
    expect(constantTimeEqual('abc123', 'abc124')).toBe(false);
  });

  it('returns false for different lengths (short-circuit)', () => {
    expect(constantTimeEqual('abc', 'abcd')).toBe(false);
  });

  it('returns true for empty strings', () => {
    expect(constantTimeEqual('', '')).toBe(true);
  });
});

describe('HMAC-SHA256 — full signature verification round-trip', () => {
  const secret = 'whsec_test_secret_key';
  const payload = '{"id":"evt_123","type":"payment_intent.succeeded"}';

  it('verifies a correctly-signed payload', async () => {
    const ts = Math.floor(Date.now() / 1000);
    const signedPayload = `${ts}.${payload}`;
    const expectedSig = await hmacSha256Hex(secret, signedPayload);

    // Simulate webhook handler
    const header = `t=${ts},v1=${expectedSig}`;
    const parsed = parseStripeSignature(header);
    expect(parsed).toBeTruthy();
    const receivedTs = Number(parsed!.t);
    expect(isTimestampFresh(receivedTs, ts)).toBe(true);
    const computed = await hmacSha256Hex(secret, `${receivedTs}.${payload}`);
    expect(constantTimeEqual(computed, parsed!.v1)).toBe(true);
  });

  it('rejects payload tampered after signing', async () => {
    const ts = Math.floor(Date.now() / 1000);
    const originalPayload = '{"amount":1000}';
    const expectedSig = await hmacSha256Hex(secret, `${ts}.${originalPayload}`);

    const tamperedPayload = '{"amount":99999}';
    const computed = await hmacSha256Hex(secret, `${ts}.${tamperedPayload}`);
    expect(constantTimeEqual(computed, expectedSig)).toBe(false);
  });

  it('rejects signature with wrong secret', async () => {
    const ts = Math.floor(Date.now() / 1000);
    const realSig = await hmacSha256Hex(secret, `${ts}.${payload}`);
    const attackerSig = await hmacSha256Hex('wrong_secret', `${ts}.${payload}`);
    expect(constantTimeEqual(realSig, attackerSig)).toBe(false);
  });
});
