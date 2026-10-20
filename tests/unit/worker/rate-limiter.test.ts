/**
 * Unit Tests — rate-limiter.ts
 *
 * Coverage:
 *   - rateLimiter(): window/maxRequests enforcement, headers, 429 response
 *   - detectUserTier(): PUBLIC / AUTHENTICATED / PREMIUM classification
 *   - dynamicRateLimiter(): returns a callable middleware
 *   - RATE_LIMIT_TIERS constant values
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  rateLimiter,
  detectUserTier,
  dynamicRateLimiter,
  RATE_LIMIT_TIERS,
} from '@/worker/middleware/rate-limiter';

// ── Hono Context mock helpers ────────────────────────────────────────────────

function mockCtx(headers: Record<string, string> = {}, ip?: string) {
  const responseHeaders: Record<string, string> = {};
  return {
    req: {
      header: (h: string) => {
        if (h === 'cf-connecting-ip') return ip ?? headers['cf-connecting-ip'];
        return headers[h];
      },
    },
    header: vi.fn((k: string, v: string) => { responseHeaders[k] = v; }),
    json: vi.fn((body: unknown, status: number) => ({ body, status })),
    _responseHeaders: responseHeaders,
  } as any;
}

const mockNext = () => vi.fn().mockResolvedValue(undefined);

// ── rateLimiter ──────────────────────────────────────────────────────────────

describe('rateLimiter()', () => {
  // Use unique IP per test group to avoid counter bleed-over between tests
  let ip: string;
  let reqCount = 0;

  beforeEach(() => {
    ip = `10.0.${reqCount}.${reqCount}`;
    reqCount++;
  });

  it('calls next() and sets X-RateLimit-* headers when under the limit', async () => {
    const mw = rateLimiter({ windowMs: 60_000, maxRequests: 10 });
    const ctx = mockCtx({}, ip);
    const next = mockNext();

    await mw(ctx, next);

    expect(next).toHaveBeenCalledOnce();
    expect(ctx.header).toHaveBeenCalledWith('X-RateLimit-Limit', '10');
    expect(ctx.header).toHaveBeenCalledWith('X-RateLimit-Remaining', expect.any(String));
    expect(ctx.header).toHaveBeenCalledWith('X-RateLimit-Reset', expect.any(String));
  });

  it('returns 429 when requests exceed maxRequests', async () => {
    const max = 3;
    const mw = rateLimiter({ windowMs: 60_000, maxRequests: max });
    const next = mockNext();

    // Exhaust the limit
    for (let i = 0; i < max; i++) {
      await mw(mockCtx({}, ip), next);
    }

    // Next call exceeds limit
    const ctx = mockCtx({}, ip);
    const result = await mw(ctx, next) as any;

    expect(result.status).toBe(429);
    expect(result.body.error).toBe('RATE_LIMIT_EXCEEDED');
    expect(typeof result.body.retryAfter).toBe('number');
  });

  it('does NOT call next() when returning 429', async () => {
    const max = 1;
    const mw = rateLimiter({ windowMs: 60_000, maxRequests: max });
    const next = mockNext();

    await mw(mockCtx({}, ip), next); // first request — OK
    await mw(mockCtx({}, ip), next); // second request — 429

    // next should only have been called once
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('sets Retry-After header on 429', async () => {
    const max = 1;
    const mw = rateLimiter({ windowMs: 60_000, maxRequests: max });

    await mw(mockCtx({}, ip), mockNext()); // consume limit
    const ctx = mockCtx({}, ip);
    await mw(ctx, mockNext());

    const retryAfterCall = (ctx.header as ReturnType<typeof vi.fn>).mock.calls.find(
      ([k]: [string]) => k === 'Retry-After',
    );
    expect(retryAfterCall).toBeDefined();
  });

  it('resets the counter after the window expires', async () => {
    vi.useFakeTimers();
    const windowMs = 5_000;
    const max = 2;
    const mw = rateLimiter({ windowMs, maxRequests: max });
    const next = mockNext();

    // Hit the limit
    await mw(mockCtx({}, ip), next);
    await mw(mockCtx({}, ip), next);

    vi.advanceTimersByTime(windowMs + 1);

    // Should be reset — new window, first request
    const ctx = mockCtx({}, ip);
    await mw(ctx, next);

    // next called 3 times: 2 before limit, 1 after reset
    expect(next).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });

  it('uses default message when no custom message provided', async () => {
    const max = 1;
    const mw = rateLimiter({ windowMs: 60_000, maxRequests: max });
    await mw(mockCtx({}, ip), mockNext());
    const result = await mw(mockCtx({}, ip), mockNext()) as any;
    expect(result.body.message).toMatch(/too many requests/i);
  });

  it('uses custom message when provided', async () => {
    const max = 1;
    const mw = rateLimiter({ windowMs: 60_000, maxRequests: max, message: 'Custom limit msg' });
    await mw(mockCtx({}, ip), mockNext());
    const result = await mw(mockCtx({}, ip), mockNext()) as any;
    expect(result.body.message).toBe('Custom limit msg');
  });

  it('X-RateLimit-Remaining is 0 when at the limit', async () => {
    const max = 2;
    const mw = rateLimiter({ windowMs: 60_000, maxRequests: max });

    for (let i = 0; i < max; i++) {
      await mw(mockCtx({}, ip), mockNext());
    }

    const ctx = mockCtx({}, ip);
    await mw(ctx, mockNext());

    const remainingCall = (ctx.header as ReturnType<typeof vi.fn>).mock.calls.find(
      ([k]: [string]) => k === 'X-RateLimit-Remaining',
    );
    expect(remainingCall?.[1]).toBe('0');
  });

  it('uses keyPrefix to separate counters', async () => {
    const max = 1;
    const mwA = rateLimiter({ windowMs: 60_000, maxRequests: max, keyPrefix: 'prefix_a' });
    const mwB = rateLimiter({ windowMs: 60_000, maxRequests: max, keyPrefix: 'prefix_b' });
    const next = mockNext();

    // Use same IP but different prefixes — each should have its own counter
    await mwA(mockCtx({}, ip), next);
    const resultB = await mwB(mockCtx({}, ip), next);

    // mwB was only hit once, so next should have been called for both
    expect(next).toHaveBeenCalledTimes(2);
  });
});

// ── detectUserTier ───────────────────────────────────────────────────────────

describe('detectUserTier()', () => {
  it('returns PUBLIC when Authorization header is absent', () => {
    const ctx = mockCtx();
    expect(detectUserTier(ctx)).toBe('PUBLIC');
  });

  it('returns AUTHENTICATED when Bearer token has no role field', () => {
    // Payload: { sub: "user-1" }
    const payload = btoa(JSON.stringify({ sub: 'user-1' }));
    const token = `header.${payload}.sig`;
    const ctx = mockCtx({ authorization: `Bearer ${token}` });
    expect(detectUserTier(ctx)).toBe('AUTHENTICATED');
  });

  it('returns PREMIUM when token payload has role=admin', () => {
    const payload = btoa(JSON.stringify({ sub: 'u1', role: 'admin' }));
    const token = `header.${payload}.sig`;
    const ctx = mockCtx({ authorization: `Bearer ${token}` });
    expect(detectUserTier(ctx)).toBe('PREMIUM');
  });

  it('returns PREMIUM when token payload has role=seller', () => {
    const payload = btoa(JSON.stringify({ sub: 'u2', role: 'seller' }));
    const token = `header.${payload}.sig`;
    const ctx = mockCtx({ authorization: `Bearer ${token}` });
    expect(detectUserTier(ctx)).toBe('PREMIUM');
  });

  it('returns AUTHENTICATED (no throw) when token is malformed', () => {
    const ctx = mockCtx({ authorization: 'Bearer notavalidjwt' });
    expect(() => detectUserTier(ctx)).not.toThrow();
    expect(detectUserTier(ctx)).toBe('AUTHENTICATED');
  });

  it('returns AUTHENTICATED when payload section is invalid base64', () => {
    const ctx = mockCtx({ authorization: 'Bearer header.!!!.sig' });
    expect(detectUserTier(ctx)).toBe('AUTHENTICATED');
  });

  it('returns AUTHENTICATED when token has only one segment (no payload)', () => {
    const ctx = mockCtx({ authorization: 'Bearer onlyone' });
    expect(detectUserTier(ctx)).toBe('AUTHENTICATED');
  });

  it('is case-insensitive for the Bearer prefix', () => {
    const payload = btoa(JSON.stringify({ role: 'admin' }));
    const token = `header.${payload}.sig`;
    const ctx = mockCtx({ authorization: `bearer ${token}` });
    expect(detectUserTier(ctx)).toBe('PREMIUM');
  });
});

// ── dynamicRateLimiter ───────────────────────────────────────────────────────

describe('dynamicRateLimiter()', () => {
  it('returns a function (middleware factory result is callable)', () => {
    const mw = dynamicRateLimiter();
    expect(typeof mw).toBe('function');
  });

  it('returned middleware is async (returns a Promise when called)', () => {
    const mw = dynamicRateLimiter();
    const ctx = mockCtx({}, '192.0.2.1');
    const result = mw(ctx, mockNext());
    expect(result instanceof Promise).toBe(true);
  });

  it('applies PUBLIC tier limits for unauthenticated requests', async () => {
    const mw = dynamicRateLimiter();
    const ip = '198.51.100.1';
    const ctx = mockCtx({}, ip);
    await mw(ctx, mockNext());
    // X-RateLimit-Limit should equal PUBLIC maxRequests
    const limitCall = (ctx.header as ReturnType<typeof vi.fn>).mock.calls.find(
      ([k]: [string]) => k === 'X-RateLimit-Limit',
    );
    expect(limitCall?.[1]).toBe(String(RATE_LIMIT_TIERS.PUBLIC.maxRequests));
  });

  it('applies PREMIUM tier limits for admin tokens', async () => {
    const mw = dynamicRateLimiter();
    const ip = '198.51.100.2';
    const payload = btoa(JSON.stringify({ role: 'admin' }));
    const ctx = mockCtx({ authorization: `Bearer header.${payload}.sig` }, ip);
    await mw(ctx, mockNext());
    const limitCall = (ctx.header as ReturnType<typeof vi.fn>).mock.calls.find(
      ([k]: [string]) => k === 'X-RateLimit-Limit',
    );
    expect(limitCall?.[1]).toBe(String(RATE_LIMIT_TIERS.PREMIUM.maxRequests));
  });
});

// ── RATE_LIMIT_TIERS ─────────────────────────────────────────────────────────

describe('RATE_LIMIT_TIERS constants', () => {
  it('PUBLIC has lower maxRequests than AUTHENTICATED', () => {
    expect(RATE_LIMIT_TIERS.PUBLIC.maxRequests).toBeLessThan(RATE_LIMIT_TIERS.AUTHENTICATED.maxRequests);
  });

  it('all tiers have a positive windowMs', () => {
    for (const tier of Object.values(RATE_LIMIT_TIERS)) {
      expect(tier.windowMs).toBeGreaterThan(0);
    }
  });

  it('all tiers have a positive maxRequests', () => {
    for (const tier of Object.values(RATE_LIMIT_TIERS)) {
      expect(tier.maxRequests).toBeGreaterThan(0);
    }
  });
});
