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
    const kv = c.env.SESSION_KV as KVNamespace;
    
    if (!kv) {
      console.warn('[Rate Limiter] KV not available, skipping rate limit');
      return next();
    }

    // IP 주소 추출
    const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';
    
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
      // Rate Limiter 오류 시에도 요청은 통과
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

  // TODO: JWT에서 역할 추출
  // const token = authHeader.replace('Bearer ', '');
  // const decoded = decodeJWT(token);
  // if (decoded.role === 'admin' || decoded.role === 'seller') {
  //   return 'PREMIUM';
  // }
  
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
