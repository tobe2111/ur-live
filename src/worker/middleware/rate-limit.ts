/**
 * Rate Limiting Middleware (D1-based sliding window)
 *
 * Usage:
 *   app.use('/api/seller/login', rateLimit({ action: 'login', max: 5, windowSec: 300 }))
 */

import { Context, Next } from 'hono';
import { logError } from '../utils/logger';

export interface RateLimitOptions {
  action: string;
  max: number;        // max requests per window
  windowSec: number;  // window size in seconds
  keyFn?: (c: Context) => string; // custom key extractor
}

function defaultKey(c: Context, action: string): string {
  const ip = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown';
  return `${action}:${ip}`;
}

// Sensitive auth actions that must fail CLOSED when the rate-limit store is
// unavailable. Failing open here would let an attacker brute-force credentials
// simply by forcing DB errors, so we return 429 instead.
const AUTH_SENSITIVE_ACTIONS = new Set<string>([
  'login',
  'register',
  'signup',
  'password-reset',
  'password_reset',
  'reset-password',
  'otp',
  'verify',
  'verify-code',
]);

function isAuthSensitive(action: string): boolean {
  const a = action.toLowerCase();
  if (AUTH_SENSITIVE_ACTIONS.has(a)) return true;
  // Heuristic: catch variants like 'seller-login', 'admin-login', 'kakao-login', etc.
  return (
    a.includes('login') ||
    a.includes('register') ||
    a.includes('signup') ||
    a.includes('password') ||
    a.includes('otp') ||
    a.includes('verify')
  );
}

export function rateLimit(opts: RateLimitOptions) {
  return async (c: Context, next: Next) => {
    const db: D1Database | undefined = (c.env as Record<string, unknown>).DB as D1Database | undefined;
    const authSensitive = isAuthSensitive(opts.action);

    if (!db) {
      // No DB binding: for auth-sensitive actions we fail CLOSED
      if (authSensitive) {
        return c.json(
          { success: false, error: '요청을 처리할 수 없습니다. 잠시 후 다시 시도해주세요.' },
          429
        );
      }
      return next(); // non-sensitive: skip
    }

    const key = opts.keyFn ? opts.keyFn(c) : defaultKey(c, opts.action);
    const now = Math.floor(Date.now() / 1000);
    const windowStart = now - (now % opts.windowSec); // align to window boundary

    try {
      // Upsert: insert or increment count for this window
      await db.prepare(`
        INSERT INTO rate_limit_attempts (key, action, window_start, count)
        VALUES (?, ?, ?, 1)
        ON CONFLICT(key, action, window_start)
        DO UPDATE SET count = count + 1
      `).bind(key, opts.action, windowStart).run();

      const row = await db.prepare(`
        SELECT count FROM rate_limit_attempts
        WHERE key = ? AND action = ? AND window_start = ?
      `).bind(key, opts.action, windowStart).first<{ count: number }>();

      const count = row?.count ?? 1;

      if (count > opts.max) {
        const retryAfter = windowStart + opts.windowSec - now;
        c.header('Retry-After', String(retryAfter));
        c.header('X-RateLimit-Limit', String(opts.max));
        c.header('X-RateLimit-Remaining', '0');
        return c.json({ success: false, error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' }, 429);
      }

      c.header('X-RateLimit-Limit', String(opts.max));
      c.header('X-RateLimit-Remaining', String(Math.max(0, opts.max - count)));
    } catch (err) {
      logError('rate-limit.db.error', { action: opts.action, error: (err as Error)?.message });
      // Auth-sensitive: fail CLOSED to prevent brute-force when the store is down.
      // Non-sensitive: fail open to avoid breaking unrelated traffic.
      if (authSensitive) {
        c.header('Retry-After', '60');
        return c.json(
          { success: false, error: '요청을 처리할 수 없습니다. 잠시 후 다시 시도해주세요.' },
          429
        );
      }
    }

    return next();
  };
}

/**
 * Cleanup old rate limit records (call periodically, e.g. from a scheduled worker)
 */
export async function cleanupRateLimits(db: D1Database, olderThanSec = 3600): Promise<void> {
  const cutoff = Math.floor(Date.now() / 1000) - olderThanSec;
  await db.prepare('DELETE FROM rate_limit_attempts WHERE window_start < ?').bind(cutoff).run();
}
