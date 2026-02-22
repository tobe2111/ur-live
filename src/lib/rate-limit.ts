/**
 * Rate Limiting Middleware
 * 
 * Cloudflare Workers에서 KV를 사용한 Rate Limiting 구현
 * IP 기반 + 사용자 ID 기반 제한 지원
 */

interface RateLimitConfig {
  windowMs: number;      // 시간 윈도우 (밀리초)
  maxRequests: number;   // 최대 요청 수
  keyPrefix?: string;    // 키 접두사
  skipSuccessfulRequests?: boolean;  // 성공 요청 제외 여부
}

/**
 * Rate Limit 미들웨어 생성
 */
export function createRateLimiter(config: RateLimitConfig) {
  const {
    windowMs,
    maxRequests,
    keyPrefix = 'ratelimit',
    skipSuccessfulRequests = false
  } = config;

  return async (c: any, next: any) => {
    const { RATE_LIMIT_KV } = c.env;
    
    if (!RATE_LIMIT_KV) {
      // KV가 없으면 제한 없이 통과
      console.warn('[Rate Limit] RATE_LIMIT_KV not configured');
      return next();
    }

    // 키 생성: IP 주소 우선, 없으면 사용자 ID
    const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';
    const userId = c.get('userId'); // requireAuth 미들웨어에서 설정된 userId
    const identifier = userId ? `user:${userId}` : `ip:${ip}`;
    const key = `${keyPrefix}:${identifier}`;

    // 현재 요청 수 조회
    const currentCount = await RATE_LIMIT_KV.get(key);
    const count = currentCount ? parseInt(currentCount) : 0;

    if (count >= maxRequests) {
      // 제한 초과
      const retryAfter = Math.ceil(windowMs / 1000);
      return c.json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: `너무 많은 요청이 발생했습니다. ${retryAfter}초 후에 다시 시도해주세요.`,
          retryAfter
        }
      }, 429, {
        'Retry-After': retryAfter.toString(),
        'X-RateLimit-Limit': maxRequests.toString(),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': new Date(Date.now() + windowMs).toISOString()
      });
    }

    // 요청 실행
    await next();

    // 성공 요청만 카운트하는 경우, 응답 상태 확인
    if (skipSuccessfulRequests && c.res.status >= 400) {
      return;
    }

    // 카운터 증가
    const newCount = count + 1;
    const ttl = Math.ceil(windowMs / 1000);
    await RATE_LIMIT_KV.put(key, newCount.toString(), { expirationTtl: ttl });

    // Rate limit 정보를 헤더에 추가
    c.res.headers.set('X-RateLimit-Limit', maxRequests.toString());
    c.res.headers.set('X-RateLimit-Remaining', Math.max(0, maxRequests - newCount).toString());
    c.res.headers.set('X-RateLimit-Reset', new Date(Date.now() + windowMs).toISOString());
  };
}

/**
 * 미리 정의된 Rate Limit 프리셋
 */
export const rateLimitPresets = {
  // 로그인: 1분에 5회
  login: createRateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 5,
    keyPrefix: 'auth:login'
  }),

  // 회원가입: 1시간에 3회
  register: createRateLimiter({
    windowMs: 60 * 60 * 1000,
    maxRequests: 3,
    keyPrefix: 'auth:register'
  }),

  // 결제: 1분에 10회
  payment: createRateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 10,
    keyPrefix: 'payment',
    skipSuccessfulRequests: true // 실패한 결제만 카운트
  }),

  // 환불: 1시간에 3회
  refund: createRateLimiter({
    windowMs: 60 * 60 * 1000,
    maxRequests: 3,
    keyPrefix: 'refund'
  }),

  // 리뷰 작성: 1시간에 10회
  review: createRateLimiter({
    windowMs: 60 * 60 * 1000,
    maxRequests: 10,
    keyPrefix: 'review'
  }),

  // 관리자 API: 1분에 100회
  admin: createRateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 100,
    keyPrefix: 'admin'
  }),

  // 채팅: 1분에 30회
  chat: createRateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 30,
    keyPrefix: 'chat'
  }),

  // 일반 API: 1분에 60회
  general: createRateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 60,
    keyPrefix: 'api'
  })
};
