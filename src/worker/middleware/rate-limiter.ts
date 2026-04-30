import type { Context, Next } from 'hono';

/**
 * ✅ Rate Limiter Middleware
 * 
 * Week 5 Day 4 - Rate Limiting & Global Error Handler
 * 
 * 목적:
 * - DDoS 공격 차단
 * - API 남용 방지
 * - Cloudflare Workers 무료 티어 유지
 * 
 * 전략:
 * - IP 기반 Rate Limiting
 * - Sliding Window 알고리즘
 * - KV를 사용한 카운터 저장
 */

interface RateLimitConfig {
  windowMs: number;      // 시간 창 (밀리초)
  maxRequests: number;   // 최대 요청 수
  message?: string;      // 제한 시 메시지
  keyPrefix?: string;    // KV 키 접두사
}

interface RateLimitInfo {
  count: number;
  resetTime: number;
}

/**
 * Action names (keyPrefix substrings) that must fail CLOSED if the rate
 * limiter itself errors out. Brute-force against /login etc. could otherwise
 * slip through whenever KV has a blip.
 */
const AUTH_SENSITIVE_ACTIONS = [
  'login',
  'register',
  'signup',
  'password_reset',
  'forgot_password',
  'admin_login',
  'seller_login',
  'agency_login',
  'kakao_login',
  'otp',
  'verify',
];

function isAuthSensitiveAction(keyPrefix: string | undefined): boolean {
  if (!keyPrefix) return false;
  const lower = keyPrefix.toLowerCase();
  return AUTH_SENSITIVE_ACTIONS.some((a) => lower.includes(a));
}

/**
 * Rate Limit 티어 정의
 */
export const RATE_LIMIT_TIERS = {
  // Tier 1: 일반 사용자 (비인증)
  PUBLIC: {
    windowMs: 60 * 1000,      // 1분
    maxRequests: 60,           // 분당 60 requests
  },
  
  // Tier 2: 인증된 사용자
  AUTHENTICATED: {
    windowMs: 60 * 1000,      // 1분
    maxRequests: 120,          // 분당 120 requests
  },
  
  // Tier 3: Admin/Seller
  PREMIUM: {
    windowMs: 60 * 1000,      // 1분
    maxRequests: 300,          // 분당 300 requests
  },
} as const;

/**
 * Rate Limiter 미들웨어 생성
 */
export function rateLimiter(config: RateLimitConfig) {
  return async (c: Context, next: Next) => {
    // ✅ BUG #17 FIX: The worker Bindings type exposes `RATE_LIMIT_KV` for rate
    // limiting and `SESSION_KV` for session storage.  The old code read
    // `c.env.SESSION_KV`, which is the wrong namespace.  When `SESSION_KV` is
    // undefined (or the wrong namespace), the guard `if (!kv)` fires, the
    // rate-limiter is silently skipped, and DDoS protection is permanently off.
    // Fix: prefer `RATE_LIMIT_KV`; fall back to `SESSION_KV` for backward-compat.
    const kv = (c.env.RATE_LIMIT_KV || c.env.SESSION_KV) as KVNamespace | undefined;
    
    if (!kv) {
      // Fail CLOSED on auth-sensitive routes: better to 429 a real user
      // than to let the brute-forcer through while KV is unavailable.
      if (isAuthSensitiveAction(config.keyPrefix)) {
        return c.json(
          {
            error: 'RATE_LIMIT_UNAVAILABLE',
            message: '일시적으로 요청이 제한됩니다. 잠시 후 다시 시도해주세요.',
          },
          429,
        );
      }
      console.warn('[Rate Limiter] KV not available, skipping rate limit');
      return next();
    }

    // 🛡️ 2026-04-30: CF-Connecting-IP 만 신뢰 (X-Forwarded-For 는 클라이언트 위조 가능)
    const ip = c.req.header('cf-connecting-ip') || 'unknown';
    
    // KV 키 생성
    const keyPrefix = config.keyPrefix || 'rate_limit';
    const key = `${keyPrefix}:${ip}`;

    try {
      // 현재 시간
      const now = Date.now();
      
      // KV에서 현재 카운터 조회
      const stored = await kv.get<RateLimitInfo>(key, 'json');
      
      let count = 0;
      let resetTime = now + config.windowMs;

      if (stored) {
        // 시간 창이 아직 유효한지 확인
        if (now < stored.resetTime) {
          count = stored.count + 1;
          resetTime = stored.resetTime;
          
          // 제한 초과 확인
          if (count > config.maxRequests) {
            const retryAfter = Math.ceil((resetTime - now) / 1000);
            
            c.header('X-RateLimit-Limit', config.maxRequests.toString());
            c.header('X-RateLimit-Remaining', '0');
            c.header('X-RateLimit-Reset', resetTime.toString());
            c.header('Retry-After', retryAfter.toString());
            
            return c.json({
              error: 'RATE_LIMIT_EXCEEDED',
              message: config.message || 'Too many requests, please try again later.',
              retryAfter,
            }, 429);
          }
        } else {
          // 시간 창 초과 → 카운터 리셋
          count = 1;
          resetTime = now + config.windowMs;
        }
      } else {
        // 첫 요청
        count = 1;
      }

      // KV에 카운터 저장
      await kv.put(
        key,
        JSON.stringify({ count, resetTime } as RateLimitInfo),
        { expirationTtl: Math.ceil(config.windowMs / 1000) + 10 }
      );

      // Rate Limit 헤더 추가
      c.header('X-RateLimit-Limit', config.maxRequests.toString());
      c.header('X-RateLimit-Remaining', Math.max(0, config.maxRequests - count).toString());
      c.header('X-RateLimit-Reset', resetTime.toString());

      return next();
    } catch (error) {
      console.error('[Rate Limiter] Error:', error);
      // Fail CLOSED on auth-sensitive routes (brute-force protection priority).
      // Fail OPEN elsewhere so a transient KV outage doesn't take the site down.
      if (isAuthSensitiveAction(config.keyPrefix)) {
        return c.json(
          {
            error: 'RATE_LIMIT_UNAVAILABLE',
            message: '일시적으로 요청이 제한됩니다. 잠시 후 다시 시도해주세요.',
          },
          429,
        );
      }
      return next();
    }
  };
}

/**
 * 사용자 티어 감지
 */
export function detectUserTier(c: Context): keyof typeof RATE_LIMIT_TIERS {
  const authHeader = c.req.header('authorization');
  
  if (!authHeader) {
    return 'PUBLIC';
  }

  // JWT payload는 base64url 인코딩 — 서명 검증 없이 역할만 빠르게 읽음
  // (실제 서명 검증은 auth 미들웨어에서 수행)
  try {
    const token = authHeader.replace(/^Bearer\s+/i, '');
    const payloadB64 = token.split('.')[1];
    if (payloadB64) {
      const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));
      if (payload?.role === 'admin' || payload?.role === 'seller') {
        return 'PREMIUM';
      }
    }
  } catch {
    // 파싱 실패 시 일반 인증 티어로 처리
  }

  return 'AUTHENTICATED';
}

/**
 * 동적 Rate Limiter (사용자 티어 기반)
 */
export function dynamicRateLimiter() {
  return async (c: Context, next: Next) => {
    const tier = detectUserTier(c);
    const config = RATE_LIMIT_TIERS[tier];
    
    const limiter = rateLimiter({
      ...config,
      message: `Rate limit exceeded for ${tier} tier. Please try again later.`,
      keyPrefix: `rate_limit_${tier.toLowerCase()}`,
    });
    
    return limiter(c, next);
  };
}

/**
 * Default export: Dynamic rate limiter middleware
 */
export const rateLimitMiddleware = dynamicRateLimiter();
