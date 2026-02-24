/**
 * Rate Limiting Middleware for Cloudflare Workers
 * 
 * Cloudflare Workers 환경에 최적화된 Rate Limiting 구현
 * - KV 스토리지를 사용한 분산 Rate Limiting
 * - IP 기반 요청 제한
 * - 유연한 제한 정책 설정
 */

import { Context, Next } from 'hono'

export interface RateLimitConfig {
  /** 시간 윈도우 (초 단위) */
  windowMs: number
  /** 시간 윈도우 내 최대 요청 수 */
  maxRequests: number
  /** Rate limit 초과 시 메시지 */
  message?: string
  /** 특정 경로에만 적용할지 여부 */
  pathPattern?: RegExp
  /** 제외할 IP 주소 목록 (화이트리스트) */
  skipIps?: string[]
  /** 유저 타입별 제한 (인증된 사용자는 더 높은 제한) */
  authenticatedMultiplier?: number
}

interface RateLimitRecord {
  count: number
  resetTime: number
}

/**
 * 클라이언트 IP 주소 추출
 */
function getClientIp(c: Context): string {
  // Cloudflare는 실제 클라이언트 IP를 CF-Connecting-IP 헤더에 저장
  const cfConnectingIp = c.req.header('CF-Connecting-IP')
  if (cfConnectingIp) return cfConnectingIp

  // 대체 헤더들
  const xForwardedFor = c.req.header('X-Forwarded-For')
  if (xForwardedFor) {
    const ips = xForwardedFor.split(',')
    return ips[0].trim()
  }

  const xRealIp = c.req.header('X-Real-IP')
  if (xRealIp) return xRealIp

  // 최후의 대체 방법
  return 'unknown'
}

/**
 * Rate Limiting 키 생성
 */
function generateKey(ip: string, path: string): string {
  return `ratelimit:${ip}:${path}`
}

/**
 * In-memory fallback (KV 없을 때)
 * 주의: Workers는 상태를 유지하지 않으므로 이는 단일 인스턴스에만 유효
 */
const inMemoryStore = new Map<string, RateLimitRecord>()

/**
 * KV 기반 Rate Limiter
 */
async function checkRateLimit(
  c: Context,
  ip: string,
  config: RateLimitConfig
): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
  const path = new URL(c.req.url).pathname
  const key = generateKey(ip, path)
  const now = Date.now()
  const windowMs = config.windowMs * 1000 // 초를 밀리초로 변환

  // 인증된 사용자에게 더 높은 제한 적용
  const user = c.get('user')
  const maxRequests = user && config.authenticatedMultiplier
    ? config.maxRequests * config.authenticatedMultiplier
    : config.maxRequests

  try {
    // KV 스토리지 사용 시도
    const kv = c.env?.RATE_LIMIT_KV
    
    if (kv) {
      // KV에서 현재 기록 가져오기
      const recordStr = await kv.get(key)
      let record: RateLimitRecord

      if (recordStr) {
        record = JSON.parse(recordStr)
        
        // 윈도우가 만료되었으면 리셋
        if (now > record.resetTime) {
          record = {
            count: 1,
            resetTime: now + windowMs
          }
        } else {
          record.count++
        }
      } else {
        // 첫 요청
        record = {
          count: 1,
          resetTime: now + windowMs
        }
      }

      // KV에 업데이트 (TTL 설정)
      const ttlSeconds = Math.ceil(windowMs / 1000)
      await kv.put(key, JSON.stringify(record), {
        expirationTtl: ttlSeconds
      })

      const allowed = record.count <= maxRequests
      const remaining = Math.max(0, maxRequests - record.count)

      return {
        allowed,
        remaining,
        resetTime: record.resetTime
      }
    }
  } catch (error) {
    console.error('KV Rate Limit Error:', error)
  }

  // KV 실패 시 in-memory fallback
  let record = inMemoryStore.get(key)

  if (record && now > record.resetTime) {
    // 윈도우 만료
    inMemoryStore.delete(key)
    record = undefined
  }

  if (!record) {
    record = {
      count: 1,
      resetTime: now + windowMs
    }
  } else {
    record.count++
  }

  inMemoryStore.set(key, record)

  const allowed = record.count <= maxRequests
  const remaining = Math.max(0, maxRequests - record.count)

  return {
    allowed,
    remaining,
    resetTime: record.resetTime
  }
}

/**
 * Rate Limiting 미들웨어 생성
 */
export function rateLimit(config: RateLimitConfig) {
  return async (c: Context, next: Next) => {
    const ip = getClientIp(c)

    // 화이트리스트 체크
    if (config.skipIps && config.skipIps.includes(ip)) {
      return next()
    }

    // 특정 경로 패턴에만 적용
    if (config.pathPattern) {
      const path = new URL(c.req.url).pathname
      if (!config.pathPattern.test(path)) {
        return next()
      }
    }

    const result = await checkRateLimit(c, ip, config)

    // Rate Limit 헤더 추가
    c.header('X-RateLimit-Limit', config.maxRequests.toString())
    c.header('X-RateLimit-Remaining', result.remaining.toString())
    c.header('X-RateLimit-Reset', new Date(result.resetTime).toISOString())

    if (!result.allowed) {
      const retryAfter = Math.ceil((result.resetTime - Date.now()) / 1000)
      c.header('Retry-After', retryAfter.toString())

      return c.json(
        {
          success: false,
          error: config.message || 'Too many requests. Please try again later.',
          retryAfter,
          resetTime: new Date(result.resetTime).toISOString()
        },
        429
      )
    }

    return next()
  }
}

/**
 * 사전 정의된 Rate Limit 정책들
 */
export const RateLimitPolicies = {
  /** 일반 API 엔드포인트 (분당 60회) */
  api: {
    windowMs: 60,
    maxRequests: 60,
    message: 'API 요청 제한을 초과했습니다. 잠시 후 다시 시도해주세요.',
    authenticatedMultiplier: 2
  },

  /** 인증 엔드포인트 (분당 5회) - 무차별 대입 공격 방지 */
  auth: {
    windowMs: 60,
    maxRequests: 5,
    message: '로그인 시도 횟수를 초과했습니다. 1분 후 다시 시도해주세요.',
    pathPattern: /^\/api\/auth\//
  },

  /** 주문 엔드포인트 (분당 10회) */
  order: {
    windowMs: 60,
    maxRequests: 10,
    message: '주문 요청이 너무 빈번합니다. 잠시 후 다시 시도해주세요.',
    pathPattern: /^\/api\/orders/,
    authenticatedMultiplier: 2
  },

  /** 카트 엔드포인트 (분당 20회) */
  cart: {
    windowMs: 60,
    maxRequests: 20,
    message: '장바구니 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
    pathPattern: /^\/api\/cart/,
    authenticatedMultiplier: 2
  },

  /** 환불 요청 (시간당 3회) - 악용 방지 */
  refund: {
    windowMs: 3600, // 1시간
    maxRequests: 3,
    message: '환불 요청 횟수를 초과했습니다. 1시간 후 다시 시도해주세요.',
    pathPattern: /^\/api\/orders\/.*\/refund/
  },

  /** 검색 엔드포인트 (분당 30회) */
  search: {
    windowMs: 60,
    maxRequests: 30,
    message: '검색 요청이 너무 빈번합니다. 잠시 후 다시 시도해주세요.',
    pathPattern: /^\/api\/search/
  },

  /** 알림톡 발송 (분당 10회) - 비용 발생 방지 */
  alimtalk: {
    windowMs: 60,
    maxRequests: 10,
    message: '알림톡 발송 요청이 너무 빈번합니다. 잠시 후 다시 시도해주세요.',
    pathPattern: /^\/api\/seller\/alimtalk\/send/
  },

  /** 파일 업로드 (분당 5회) */
  upload: {
    windowMs: 60,
    maxRequests: 5,
    message: '파일 업로드가 너무 빈번합니다. 잠시 후 다시 시도해주세요.',
    pathPattern: /^\/api\/.*\/upload/
  },

  /** 매우 엄격한 제한 (분당 3회) - 민감한 작업용 */
  strict: {
    windowMs: 60,
    maxRequests: 3,
    message: '요청 제한을 초과했습니다. 잠시 후 다시 시도해주세요.'
  },

  /** 느슨한 제한 (분당 120회) - 조회 작업용 */
  loose: {
    windowMs: 60,
    maxRequests: 120,
    authenticatedMultiplier: 1.5
  }
}

/**
 * 여러 Rate Limiter를 조합하는 헬퍼
 */
export function multiRateLimit(...limiters: ReturnType<typeof rateLimit>[]) {
  return async (c: Context, next: Next) => {
    for (const limiter of limiters) {
      const result = await limiter(c, async () => {})
      if (result && result.status === 429) {
        return result
      }
    }
    return next()
  }
}
