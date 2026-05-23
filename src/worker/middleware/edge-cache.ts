/**
 * Edge Cache Middleware (Cloudflare caches.default 사용)
 *
 * 1인 운영 최적화: hot read endpoint 에 edge 캐싱 적용.
 * D1 쿼리 부하 감소 + 응답 속도 향상 (수백 ms → 수십 ms).
 *
 * 두 가지 모드:
 *   1) edgeCache(ttl)   — 보수적: Authorization/Cookie session 있으면 우회
 *      (개인화 응답이 끼어 들어올 가능성이 있는 endpoint 용)
 *   2) publicCache(ttl) — 무조건: 인증 헤더 무시하고 항상 캐싱
 *      (서버 응답이 user-agnostic 임을 호출자가 보장해야 함 — 상품 목록 등)
 *
 * 무효화: 쓰기 엔드포인트에서 관련 path 를 purge 하지 않으므로, TTL 내에서는
 * 구 데이터 노출 가능. 빈도 높은 업데이트 필요하면 짧은 TTL 권장.
 */

import type { Context, Next } from 'hono';

interface CacheOptions {
  /** 인증 헤더 (Authorization / Cookie session) 가 있으면 캐싱을 우회할지. default: true */
  bypassIfAuthed?: boolean;
  /** Cache-Control / X-Cache-Status 헤더 prefix (디버깅용). default: 'edge' */
  tag?: string;
}

function makeCacheMiddleware(ttlSeconds: number, opts: CacheOptions = {}) {
  const bypassIfAuthed = opts.bypassIfAuthed ?? true;
  const tag = opts.tag ?? 'edge';
  return async (c: Context, next: Next) => {
    // GET/HEAD 만 캐싱 (쓰기 요청은 우회)
    if (c.req.method !== 'GET' && c.req.method !== 'HEAD') {
      return next();
    }

    // 보수 모드: 인증 헤더 있으면 캐싱 우회 (personalized content)
    if (bypassIfAuthed && (c.req.header('Authorization') || c.req.header('Cookie')?.includes('session'))) {
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
      headers.set('X-Cache-Status', `${tag}-HIT`);
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
      // 🛡️ 2026-04-28: stale-while-revalidate 추가 (browser cache 활용)
      //  - max-age 동안 즉시 사용 (서버 호출 0)
      //  - 그 후 swr 동안 stale 사용 + 백그라운드 refresh → 체감 속도 ↑
      const swr = Math.max(60, Math.min(600, ttlSeconds * 10));
      response.headers.set('Cache-Control', `public, max-age=${ttlSeconds}, stale-while-revalidate=${swr}`);
      response.headers.set('X-Cache-Status', `${tag}-MISS`);
      // 백그라운드에서 저장 (응답 블로킹 안 함)
      c.executionCtx.waitUntil(cache.put(cacheKey, response));
    }
  };
}

/**
 * 보수 모드 edge cache — 인증 헤더 (Authorization / Cookie session) 가 있으면 캐싱 우회.
 * 응답이 user-specific 일 가능성이 있는 endpoint 에 사용.
 */
export function edgeCache(ttlSeconds: number) {
  return makeCacheMiddleware(ttlSeconds, { bypassIfAuthed: true, tag: 'edge' });
}

/**
 * 무조건 public edge cache — 인증 헤더 무시하고 항상 캐싱.
 *
 * 사용 조건 (호출자 책임):
 *   - 응답이 user-agnostic 이어야 함 (사용자별 다른 데이터 X)
 *   - 비공개 정보 (이메일, 주문, 좌표 등) 노출 없어야 함
 *
 * 예: /api/products (목록), /api/banners, /api/streams, /api/sellers/:id/public
 *
 * 효과: 로그인 사용자도 첫 번째 사용자가 채운 edge cache 를 공유 → D1 hit 거의 0.
 */
export function publicCache(ttlSeconds: number) {
  return makeCacheMiddleware(ttlSeconds, { bypassIfAuthed: false, tag: 'public' });
}
