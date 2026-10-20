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
 *      🛡️ 2026-05-23 (Task 2): publicCache 는 KV second-layer 도 사용.
 *        Edge cache 는 PoP 별 격리 (한국 PoP ≠ 일본 PoP). KV 는 region 간 공유.
 *        L1 = edge cache (수십 ms hit) → L2 = KV (~50ms hit) → L3 = D1 (~200-500ms).
 *        KV TTL = edge TTL × 6 (더 오래 보관 → cold start 거의 0).
 *        CACHE_KV 미바인딩 시 KV 레이어 자동 skip (graceful degradation).
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
  /** KV second-layer 사용 여부. default: false (publicCache 만 활성) */
  useKv?: boolean;
}

interface KvCacheEnvelope {
  status: number;
  contentType: string;
  body: string;
  cachedAt: number;
}

/**
 * KV second-layer cache 조회.
 * env.CACHE_KV 없거나 에러 시 null 반환 (graceful degradation).
 *
 * 🛡️ 2026-05-25: SSR inline 용도로 외부 export (`readKvCacheForSSR`).
 */
async function readKvCache(env: Record<string, unknown>, kvKey: string): Promise<KvCacheEnvelope | null> {
  const kv = env.CACHE_KV as KVNamespace | undefined;
  if (!kv) return null;
  try {
    const raw = await kv.get(kvKey, 'text');
    if (!raw) return null;
    return JSON.parse(raw) as KvCacheEnvelope;
  } catch {
    return null;
  }
}

/**
 * 🛡️ 2026-05-25 (SSR): 외부 호출용 — HTMLRewriter 에서 메인 페이지 critical data inline.
 *   path + query 만 key (publicCache 와 동일 정규화). null = miss → 클라이언트 fetch fallback.
 */
export async function readKvCacheForSSR(
  env: Record<string, unknown>,
  pathAndQuery: string,
): Promise<{ body: string; contentType: string; status: number } | null> {
  const envelope = await readKvCache(env, `apicache:${pathAndQuery}`);
  if (!envelope) return null;
  return { body: envelope.body, contentType: envelope.contentType, status: envelope.status };
}

/**
 * KV second-layer cache 저장.
 * env.CACHE_KV 없거나 에러 시 silent skip.
 */
async function writeKvCache(
  env: Record<string, unknown>,
  kvKey: string,
  envelope: KvCacheEnvelope,
  ttlSeconds: number,
): Promise<void> {
  const kv = env.CACHE_KV as KVNamespace | undefined;
  if (!kv) return;
  try {
    // KV expirationTtl 최소 60s
    const ttl = Math.max(60, ttlSeconds);
    await kv.put(kvKey, JSON.stringify(envelope), { expirationTtl: ttl });
  } catch {
    /* silent — KV 실패해도 응답 흐름엔 영향 없음 */
  }
}

function makeCacheMiddleware(ttlSeconds: number, opts: CacheOptions = {}) {
  const bypassIfAuthed = opts.bypassIfAuthed ?? true;
  const tag = opts.tag ?? 'edge';
  const useKv = opts.useKv ?? false;
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
    const swr = Math.max(60, Math.min(600, ttlSeconds * 10));

    // L1: Edge cache 조회
    const cached = await cache.match(cacheKey);
    if (cached) {
      const headers = new Headers(cached.headers);
      headers.set('X-Cache-Status', `${tag}-HIT`);
      return new Response(cached.body, {
        status: cached.status,
        headers,
      });
    }

    // L2: KV cache 조회 (publicCache 만)
    if (useKv) {
      // path + query 만 key (host 무관 — region 간 공유)
      const kvKey = `apicache:${cacheUrl.pathname}${cacheUrl.search}`;
      const envelope = await readKvCache(c.env as Record<string, unknown>, kvKey);
      if (envelope) {
        const headers = new Headers({
          'Content-Type': envelope.contentType,
          'Cache-Control': `public, max-age=${ttlSeconds}, stale-while-revalidate=${swr}`,
          'X-Cache-Status': `${tag}-KV-HIT`,
        });
        // L2 hit → L1 도 backfill (다음 같은 PoP 요청은 L1 hit)
        const backfillResponse = new Response(envelope.body, {
          status: envelope.status,
          headers,
        });
        c.executionCtx.waitUntil(cache.put(cacheKey, backfillResponse.clone()));
        return backfillResponse;
      }
    }

    // L1, L2 모두 miss → 다음 미들웨어로 (D1 hit)
    await next();

    // 성공 응답만 캐싱 (4xx/5xx 캐싱 안 함)
    if (c.res.status >= 200 && c.res.status < 300) {
      const response = c.res.clone();
      // 🛡️ 2026-04-28: stale-while-revalidate 추가 (browser cache 활용)
      //  - max-age 동안 즉시 사용 (서버 호출 0)
      //  - 그 후 swr 동안 stale 사용 + 백그라운드 refresh → 체감 속도 ↑
      // 🛡️ 2026-05-27 (속도 + 비용): CDN-Cache-Control 분리.
      //  - 브라우저 Cache-Control: max-age=60s (데이터 fresh 우선)
      //  - CF edge CDN-Cache-Control: max-age=ttlSeconds × 3 (server 부하 ↓)
      //  - 브라우저는 항상 비교적 최신 데이터, edge 는 길게 유지 (worker invocation ↓ → 비용 ↓)
      const browserMaxAge = Math.min(60, ttlSeconds);
      const cdnMaxAge = ttlSeconds * 3;
      response.headers.set('Cache-Control', `public, max-age=${browserMaxAge}, stale-while-revalidate=${swr}`);
      response.headers.set('CDN-Cache-Control', `public, max-age=${cdnMaxAge}, stale-while-revalidate=${swr}`);
      response.headers.set('X-Cache-Status', `${tag}-MISS`);

      // L1 (Edge) backfill — 응답 블로킹 안 함
      c.executionCtx.waitUntil(cache.put(cacheKey, response));

      // L2 (KV) backfill — TTL 은 edge TTL × 6 (더 오래 보관)
      if (useKv) {
        const kvKey = `apicache:${cacheUrl.pathname}${cacheUrl.search}`;
        const kvTtl = ttlSeconds * 6;
        // body 추출 — 별도 clone (위 cache.put 이 stream consume 가능)
        const kvResponse = c.res.clone();
        c.executionCtx.waitUntil((async () => {
          try {
            const body = await kvResponse.text();
            await writeKvCache(c.env as Record<string, unknown>, kvKey, {
              status: kvResponse.status,
              contentType: kvResponse.headers.get('content-type') || 'application/json',
              body,
              cachedAt: Date.now(),
            }, kvTtl);
          } catch { /* silent */ }
        })());
      }
    }
  };
}

/**
 * 보수 모드 edge cache — 인증 헤더 (Authorization / Cookie session) 가 있으면 캐싱 우회.
 * 응답이 user-specific 일 가능성이 있는 endpoint 에 사용.
 */
export function edgeCache(ttlSeconds: number) {
  return makeCacheMiddleware(ttlSeconds, { bypassIfAuthed: true, tag: 'edge', useKv: false });
}

/**
 * 무조건 public edge cache (L1) + KV cache (L2) — 인증 헤더 무시하고 항상 캐싱.
 *
 * 사용 조건 (호출자 책임):
 *   - 응답이 user-agnostic 이어야 함 (사용자별 다른 데이터 X)
 *   - 비공개 정보 (이메일, 주문, 좌표 등) 노출 없어야 함
 *
 * 예: /api/products (목록), /api/banners, /api/streams, /api/sellers/:id/public
 *
 * 효과:
 *   - L1 (Edge) hit: ~10ms — 같은 PoP 의 2번째 사용자부터
 *   - L2 (KV) hit:   ~50ms — 다른 PoP / 첫 사용자 / Edge expire 후 stale 갱신
 *   - L1+L2 miss:    D1 hit (~200-500ms) — 신선도 진짜 필요한 첫 호출만
 */
export function publicCache(ttlSeconds: number) {
  // 🛡️ 2026-05-27 (비용 최적화): KV second-layer 기본 비활성.
  //   기존: 5분 cron × 13 endpoint = 일 3,744 KV write → 무료 한도 1,000 초과 (비용 발생)
  //   변경: edge cache (`caches.default`) 만 — 한도 무한, 비용 $0.
  //   한국 (ICN PoP) 사용자 99%+ → cron warming 이 한국 PoP 채워서 hit 동일.
  //   글로벌 사용자 (1%) 는 첫 사용자만 D1 hit, 이후 같은 PoP edge cache.
  //   region 간 share 필요한 endpoint 만 publicCacheWithKv 사용.
  return makeCacheMiddleware(ttlSeconds, { bypassIfAuthed: false, tag: 'public', useKv: false });
}

/**
 * 🛡️ 2026-05-27: KV second-layer 명시적 옵트인 — 글로벌 region share 필요할 때만.
 */
export function publicCacheWithKv(ttlSeconds: number) {
  return makeCacheMiddleware(ttlSeconds, { bypassIfAuthed: false, tag: 'public-kv', useKv: true });
}
