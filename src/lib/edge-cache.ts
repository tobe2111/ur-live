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
  
  // 상품 목록 (5분)
  products: {
    ttl: 60,
    sMaxAge: 300,
    staleWhileRevalidate: 600
  },
  
  // 라이브 스트림 목록 (30초)
  liveStreams: {
    ttl: 10,
    sMaxAge: 30,
    staleWhileRevalidate: 60
  },
  
  // 상품 상세 (10분)
  productDetail: {
    ttl: 300,
    sMaxAge: 600,
    staleWhileRevalidate: 1800
  },
  
  // 카테고리/태그 (1시간)
  metadata: {
    ttl: 1800,
    sMaxAge: 3600,
    staleWhileRevalidate: 7200
  }
} as const;
