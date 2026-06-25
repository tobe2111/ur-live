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
  // 🛡️ 2026-04-30 보안: CF-Connecting-IP 만 신뢰. X-Forwarded-For 는 클라이언트
  //   위조 가능 (각 요청마다 다른 값 보내면 rate limit 우회 가능). Cloudflare Worker
  //   환경에선 CF edge 가 CF-Connecting-IP 를 항상 세팅하므로 fallback 불필요.
  //   non-CF 환경 (로컬 dev) 에선 'unknown' 으로 통일 → 모든 dev 요청이 단일 버킷 공유.
  const ip = c.req.header('CF-Connecting-IP') || 'unknown';
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
      console.error('[rate-limit] DB error', { action: opts.action, err });
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

/**
 * 🛡️ 2026-06-24: 인증 성공 후 해당 IP 의 rate-limit 카운터를 비움.
 *
 * 왜 필요한가: rateLimit() 미들웨어는 핸들러보다 먼저 돌아 성공/실패를 구분 못 하고
 *   "모든" 로그인 시도를 카운트한다. 그래서 본인(관리자)이 5분 안에 5번 로그인하면
 *   전부 성공이어도 IP 한도(admin_login max:5)에 걸려 "요청이 너무 많습니다" 로 잠긴다.
 *   → 핸들러가 진짜 성공한 지점에서 이 함수를 호출해 카운터를 비우면, 정상 사용자는
 *   자기 성공 로그인으로는 절대 안 잠긴다. 실패 시도는 성공 지점 도달 전 반환되어
 *   카운터에 그대로 남으므로 brute-force(연속 실패) 방어는 불변.
 *
 * defaultKey 와 동일한 키 규칙(action:CF-Connecting-IP). best-effort — 실패해도 로그인 무영향.
 * 임계경로 지연을 피하려면 호출부에서 c.executionCtx.waitUntil() 로 fire-and-forget 권장.
 */
export async function resetRateLimit(c: Context, action: string): Promise<void> {
  const db: D1Database | undefined = (c.env as Record<string, unknown>).DB as D1Database | undefined;
  if (!db) return;
  const key = defaultKey(c, action);
  try {
    await db.prepare('DELETE FROM rate_limit_attempts WHERE key = ? AND action = ?')
      .bind(key, action).run();
  } catch (err) {
    if (typeof console !== 'undefined') console.warn('[rate-limit] reset failed (non-fatal)', { action, err });
  }
}
