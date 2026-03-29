/**
 * Rate Limiting Middleware (D1-based sliding window)
 *
 * Usage:
 *   app.use('/api/seller/login', rateLimit({ action: 'login', max: 5, windowSec: 300 }))
 */

import { Context, Next } from 'hono';

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

export function rateLimit(opts: RateLimitOptions) {
  return async (c: Context, next: Next) => {
    const db: D1Database | undefined = (c.env as Record<string, unknown>).DB as D1Database | undefined;
    if (!db) return next(); // skip if no DB

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
    } catch {
      // Rate limit DB error must not block the request — fail open
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
