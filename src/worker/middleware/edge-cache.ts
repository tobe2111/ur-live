/**
 * Edge Cache Middleware (Cloudflare caches.default 사용)
 *
 * 1인 운영 최적화: hot read endpoint 에 edge 캐싱 적용.
 * D1 쿼리 부하 감소 + 응답 속도 향상 (수백 ms → 수십 ms).
 *
 * 사용: app.use('/api/products', edgeCache(60))
 *
 * 무효화: 쓰기 엔드포인트에서 관련 path 를 purge 하지 않으므로, TTL 내에서는
 * 구 데이터 노출 가능. 빈도 높은 업데이트 필요하면 짧은 TTL 권장.
 */

import type { Context, Next } from 'hono';

export function edgeCache(ttlSeconds: number) {
  return async (c: Context, next: Next) => {
    // GET/HEAD 만 캐싱 (쓰기 요청은 우회)
    if (c.req.method !== 'GET' && c.req.method !== 'HEAD') {
      return next();
    }

    // 인증 헤더 있으면 캐싱 우회 (personalized content)
    if (c.req.header('Authorization') || c.req.header('Cookie')?.includes('session')) {
      return next();
    }

    const cacheUrl = new URL(c.req.url);
    const cacheKey = new Request(cacheUrl.toString(), { method: 'GET' });
    // @ts-expect-error — Cloudflare Workers 전역 caches
    const cache = caches.default;

    // 캐시 조회
    const cached = await cache.match(cacheKey);
    if (cached) {
      const headers = new Headers(cached.headers);
      headers.set('X-Cache-Status', 'HIT');
      return new Response(cached.body, {
        status: cached.status,
        headers,
      });
    }

    // 캐시 미스 → 다음 미들웨어로
    await next();

    // 성공 응답만 캐싱 (4xx/5xx 캐싱 안 함)
    if (c.res.status >= 200 && c.res.status < 300) {
      const response = c.res.clone();
      response.headers.set('Cache-Control', `public, max-age=${ttlSeconds}`);
      response.headers.set('X-Cache-Status', 'MISS');
      // 백그라운드에서 저장 (응답 블로킹 안 함)
      c.executionCtx.waitUntil(cache.put(cacheKey, response));
    }
  };
}
