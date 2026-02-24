/**
 * Edge Caching Middleware for Cloudflare Workers
 * 
 * Cloudflare의 엣지 캐시를 활용하여 API 응답을 전 세계 200+ 도시에 캐싱합니다.
 * - Cache API 사용
 * - Cache-Control 헤더 설정
 * - 조건부 캐싱 (인증 여부, HTTP 메서드)
 */

import { Context } from 'hono';

export interface CacheOptions {
  ttl: number;              // Time to live in seconds
  sMaxAge?: number;         // s-maxage for CDN
  staleWhileRevalidate?: number; // stale-while-revalidate in seconds
  cacheKey?: string;        // Custom cache key
  varyBy?: string[];        // Vary headers (default: ['Accept-Encoding'])
  skipCache?: boolean;      // Skip caching
}

/**
 * 캐시 가능한 요청인지 확인
 */
function isCacheable(c: Context): boolean {
  // GET 요청만 캐시
  if (c.req.method !== 'GET') {
    return false;
  }

  // 인증된 요청은 캐시하지 않음
  const authHeader = c.req.header('Authorization');
  const sessionToken = c.req.header('X-Session-Token');
  
  if (authHeader || sessionToken) {
    return false;
  }

  // ⚠️ 실시간성이 중요한 데이터는 캐시하지 않음
  const url = new URL(c.req.url);
  const pathname = url.pathname;

  // 1. 재고 조회 API (실시간 재고 확인 필요)
  if (pathname.includes('/api/products/') && pathname.includes('/stock')) {
    return false;
  }

  // 2. 라이브 스트림 상태 API (실시간 상태 확인 필요)
  if (pathname.includes('/api/streams/') && pathname.includes('/status')) {
    return false;
  }

  // 3. 현재 상품 API (라이브 중 상품 전환 실시간 반영)
  if (pathname.includes('/current-product')) {
    return false;
  }

  // 4. 실시간 채팅 API (SSE)
  if (pathname.includes('/api/chat') || pathname.includes('/api/sse')) {
    return false;
  }

  // 5. 주문 생성/결제 API (당연히 캐시 안 됨, POST이지만 명시)
  if (pathname.includes('/api/orders') || pathname.includes('/api/payment')) {
    return false;
  }

  return true;
}

/**
 * 캐시 키 생성
 */
function generateCacheKey(c: Context, customKey?: string): string {
  if (customKey) {
    return customKey;
  }

  const url = new URL(c.req.url);
  return url.toString();
}

/**
 * Cache-Control 헤더 생성
 */
function generateCacheControl(options: CacheOptions): string {
  const directives: string[] = [];

  // 브라우저 캐시 설정
  directives.push(`public`);
  directives.push(`max-age=${options.ttl}`);

  // CDN 캐시 설정 (Cloudflare Edge)
  if (options.sMaxAge !== undefined) {
    directives.push(`s-maxage=${options.sMaxAge}`);
  } else {
    directives.push(`s-maxage=${options.ttl}`);
  }

  // stale-while-revalidate 설정
  if (options.staleWhileRevalidate) {
    directives.push(`stale-while-revalidate=${options.staleWhileRevalidate}`);
  }

  return directives.join(', ');
}

/**
 * 엣지 캐싱 미들웨어
 * 
 * @example
 * app.get('/api/products', edgeCache({ ttl: 300 }), async (c) => {
 *   // 이 응답은 5분간 엣지에 캐시됨
 *   return c.json({ products: [...] });
 * });
 */
export function edgeCache(options: CacheOptions) {
  return async (c: Context, next: () => Promise<void>) => {
    // 캐시 불가능한 요청은 바로 다음 미들웨어로
    if (options.skipCache || !isCacheable(c)) {
      return next();
    }

    const cacheKey = generateCacheKey(c, options.cacheKey);
    const cache = caches.default;

    // 1. 캐시에서 조회
    let response = await cache.match(cacheKey);

    if (response) {
      // 캐시 히트
      console.log(`[Cache HIT] ${cacheKey}`);
      
      // X-Cache 헤더 추가
      const newHeaders = new Headers(response.headers);
      newHeaders.set('X-Cache', 'HIT');
      newHeaders.set('X-Cache-Key', cacheKey);
      
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders
      });
    }

    // 2. 캐시 미스 - 실제 응답 생성
    console.log(`[Cache MISS] ${cacheKey}`);
    await next();

    // 3. 응답 캐싱
    const originalResponse = c.res;
    
    // 성공 응답만 캐시 (200-299)
    if (originalResponse.status >= 200 && originalResponse.status < 300) {
      // Cache-Control 헤더 추가
      const cacheControl = generateCacheControl(options);
      originalResponse.headers.set('Cache-Control', cacheControl);
      originalResponse.headers.set('X-Cache', 'MISS');
      originalResponse.headers.set('X-Cache-Key', cacheKey);
      
      // Vary 헤더 설정
      const varyHeaders = options.varyBy || ['Accept-Encoding'];
      originalResponse.headers.set('Vary', varyHeaders.join(', '));

      // 캐시에 저장 (비동기)
      // clone()을 사용하여 원본 응답을 보존
      const responseToCache = originalResponse.clone();
      
      // 백그라운드에서 캐시 저장
      c.executionCtx?.waitUntil(
        cache.put(cacheKey, responseToCache)
      );
    }
  };
}

/**
 * 캐시 무효화 (Purge)
 * 
 * @param cacheKeys 무효화할 캐시 키 배열
 */
export async function purgeCache(cacheKeys: string[]): Promise<void> {
  const cache = caches.default;
  
  await Promise.all(
    cacheKeys.map(key => cache.delete(key))
  );
  
  console.log(`[Cache PURGE] Purged ${cacheKeys.length} keys`);
}

/**
 * 캐시 프리셋
 */
export const CACHE_PRESETS = {
  // 정적 콘텐츠 (1시간)
  static: {
    ttl: 3600,
    sMaxAge: 3600,
    staleWhileRevalidate: 86400 // 24시간
  },
  
  // 상품 목록 (1분) - 재고 변동 반영
  products: {
    ttl: 10,
    sMaxAge: 60,  // 1분으로 단축
    staleWhileRevalidate: 120
  },
  
  // 라이브 스트림 목록 (10초) - 실시간성 중요
  liveStreams: {
    ttl: 5,
    sMaxAge: 10,  // 10초로 단축
    staleWhileRevalidate: 30
  },
  
  // 상품 상세 (30초) - 재고 실시간 반영
  productDetail: {
    ttl: 10,
    sMaxAge: 30,  // 30초로 단축
    staleWhileRevalidate: 60
  },
  
  // 카테고리/태그 (1시간)
  metadata: {
    ttl: 1800,
    sMaxAge: 3600,
    staleWhileRevalidate: 7200
  },

  // ✨ 유저 프로필 (1시간) - 수정 시 캐시 무효화
  userProfile: {
    ttl: 3600,      // 브라우저 캐시: 1시간
    sMaxAge: 3600,  // 엣지 캐시: 1시간
    staleWhileRevalidate: 7200 // 2시간
  },

  // ✨ 정적 문서 (24시간) - 공지사항, 약관 등
  staticDocuments: {
    ttl: 86400,     // 브라우저 캐시: 24시간
    sMaxAge: 86400, // 엣지 캐시: 24시간
    staleWhileRevalidate: 604800 // 7일
  },

  // ✨ Micro-caching (10초) - 재고 관련 데이터
  microCache: {
    ttl: 10,        // 브라우저 캐시: 10초
    sMaxAge: 10,    // 엣지 캐시: 10초
    staleWhileRevalidate: 30 // 30초
  }
} as const;
