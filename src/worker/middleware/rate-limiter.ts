import type { Context, Next } from 'hono';

/**
 * 전역 Rate Limiter — 인메모리 (KV write 0)
 *
 * 변경 이유: 기존 KV 기반 구현이 모든 /api/* 요청마다 KV.put()을 호출해
 * Cloudflare KV 무료 한도(1,000 writes/일)를 수 시간 만에 소진.
 *
 * 인메모리 방식의 특성:
 * - Cloudflare Worker isolate 단위로 동작 (요청 간 상태 공유 가능)
 * - isolate 재시작 시 카운터 초기화 (DDoS 방어에는 충분)
 * - 인증 브루트포스 방어는 개별 라우트의 D1 기반 rateLimit()이 담당
 */

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  message?: string;
  keyPrefix?: string;
}

interface Counter {
  count: number;
  resetTime: number;
}

// isolate 전역 카운터 맵 — KV write 없음
const memStore = new Map<string, Counter>();

// 5분마다 만료된 항목 정리 (메모리 누수 방지)
let lastCleanup = Date.now();
function maybeCleanup() {
  const now = Date.now();
  if (now - lastCleanup < 5 * 60 * 1000) return;
  lastCleanup = now;
  for (const [k, v] of memStore) {
    if (now > v.resetTime) memStore.delete(k);
  }
}

export const RATE_LIMIT_TIERS = {
  PUBLIC:        { windowMs: 60_000, maxRequests: 200 },
  AUTHENTICATED: { windowMs: 60_000, maxRequests: 400 },
  PREMIUM:       { windowMs: 60_000, maxRequests: 300 },
} as const;

export function detectUserTier(c: Context): keyof typeof RATE_LIMIT_TIERS {
  const authHeader = c.req.header('authorization');
  if (!authHeader) return 'PUBLIC';
  try {
    const payloadB64 = authHeader.replace(/^Bearer\s+/i, '').split('.')[1];
    if (payloadB64) {
      const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));
      if (payload?.role === 'admin' || payload?.role === 'seller') return 'PREMIUM';
    }
  } catch { /* 파싱 실패 시 일반 인증 티어 */ }
  return 'AUTHENTICATED';
}

export function rateLimiter(config: RateLimitConfig) {
  return async (c: Context, next: Next) => {
    maybeCleanup();

    const ip = c.req.header('cf-connecting-ip') || 'unknown';
    const key = `${config.keyPrefix || 'rl'}:${ip}`;
    const now = Date.now();

    let entry = memStore.get(key);
    if (!entry || now > entry.resetTime) {
      entry = { count: 1, resetTime: now + config.windowMs };
      memStore.set(key, entry);
    } else {
      entry.count += 1;
    }

    c.header('X-RateLimit-Limit', String(config.maxRequests));
    c.header('X-RateLimit-Remaining', String(Math.max(0, config.maxRequests - entry.count)));
    c.header('X-RateLimit-Reset', String(entry.resetTime));

    if (entry.count > config.maxRequests) {
      const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
      c.header('Retry-After', String(retryAfter));
      return c.json({
        error: 'RATE_LIMIT_EXCEEDED',
        message: config.message || 'Too many requests, please try again later.',
        retryAfter,
      }, 429);
    }

    return next();
  };
}

export function dynamicRateLimiter() {
  return async (c: Context, next: Next) => {
    const tier = detectUserTier(c);
    return rateLimiter({
      ...RATE_LIMIT_TIERS[tier],
      keyPrefix: `rl_${tier.toLowerCase()}`,
    })(c, next);
  };
}

export const rateLimitMiddleware = dynamicRateLimiter();
