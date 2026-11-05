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

/**
 * 🩹 2026-11-04 — **실패를 정상(빈 목록)으로 숨기는 핸들러**를 위한 표시. 그런 응답은 200 이라 캐시가 실패로 못 보고,
 *   오히려 빈 응답을 캐시에 넣고 **예비 사본까지 빈 것으로 덮었다**(홈 섹션의 catch → `{success:true,data:[]}`).
 *   핸들러가 이걸 달면: 저장하지 않고, 예비 사본이 있으면 그것을 낸다(없으면 그 빈 응답을 그대로 — 종전 동작).
 */
export const DEGRADED_HEADER = 'X-Ur-Degraded';
export function markDegraded(c: Context): void {
  try { c.header(DEGRADED_HEADER, '1'); } catch { /* 헤더가 잠겼으면 종전 동작 */ }
}

/** 🛟 예비 사본 보관 시간 — 원본이 실패했을 때만 꺼낸다. */
export const STALE_BACKUP_SECONDS = 24 * 60 * 60;
/**
 * ⚡ 2026-11-05 — **만료 직후 손님을 기다리게 하지 않는다**(stale-while-revalidate, 큰 CDN 의 기본기).
 *   Cache API(`caches.default`)는 `stale-while-revalidate` 를 지키지 않는다 — 만료되면 그냥 없다. 그래서 만료 뒤 첫 손님이
 *   원본(D1, 미국 동부)까지의 왕복 여러 번을 고스란히 기다렸다(한국에서 질의마다 ≈0.2초).
 *   이제: 예비 사본이 **방금 만료된 정도**(아래 창)면 그것을 즉시 내고, 뒤에서 같은 주소를 한 번 다시 받아 채운다.
 *   창 밖(오래된 사본)은 종전대로 손님이 원본을 기다린다 — 최대 낡음 = 엣지 수명 + 창.
 */
export const STORED_AT_HEADER = 'X-Ur-Stored-At';
export const REVALIDATE_HEADER = 'x-ur-revalidate';
/** 만료 뒤 옛 사본을 바로 내 줄 수 있는 추가 시간(ms) — TTL 과 같되 60초를 넘지 않는다(가격·재고가 오래 낡지 않게). */
export function swrExtraMs(ttlSeconds: number): number {
  return Math.min(Math.max(1, ttlSeconds), 60) * 1000;
}
/** 예비 사본이 SWR 로 내 줄 만큼 신선한가 — 엣지 수명(ttl×3) + 창 안. 저장 시각이 없으면(옛 사본) 아니다. */
export function swrServable(storedAt: number, ttlSeconds: number, now = Date.now()): boolean {
  if (!Number.isFinite(storedAt) || storedAt <= 0) return false;
  const age = now - storedAt;
  return age >= 0 && age <= ttlSeconds * 3 * 1000 + swrExtraMs(ttlSeconds);
}
/** isolate 안에서 같은 주소를 동시에 두 번 갱신하지 않는다. */
const _revalidating = new Set<string>();

/** 예비 사본의 키 — 같은 주소에 표식 쿼리 하나(같은 존이라 Cache API 가 받는다). */
export function staleKeyOf(u: URL): Request {
  const k = new URL(u.toString());
  k.searchParams.set('__ur_stale', '1');
  return new Request(k.toString(), { method: 'GET' });
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

    const staleKey = staleKeyOf(cacheUrl);

    // ⚡ SWR — 방금 만료됐으면 예비 사본을 즉시 내고 뒤에서 갱신(위 `swrServable`). 갱신 요청 자신은 이 분기를 건너뛴다.
    if (c.req.header(REVALIDATE_HEADER) !== '1') {
      const prev = await cache.match(staleKey).catch(() => undefined);
      const key = cacheUrl.toString();
      if (prev && swrServable(Number(prev.headers.get(STORED_AT_HEADER)), ttlSeconds) && !_revalidating.has(key)) {
        _revalidating.add(key);
        const ua = c.req.header('User-Agent') || 'ur-live-swr/1.0';
        c.executionCtx.waitUntil(
          fetch(key, { headers: { [REVALIDATE_HEADER]: '1', 'User-Agent': ua } })
            .then((r) => r.arrayBuffer()) // 읽어 버린다 — 복제된 본문의 cancel() 은 다른 복제가 안 읽히면 끝나지 않는다(시험이 잡았다)
            .catch(() => {})
            .finally(() => { _revalidating.delete(key); }),
        );
        const headers = new Headers(prev.headers);
        headers.set('X-Cache-Status', `${tag}-SWR`);
        headers.set('Cache-Control', `public, max-age=${Math.min(15, ttlSeconds)}`); // 브라우저는 짧게 — 곧 새 값이 온다
        headers.delete('CDN-Cache-Control');
        headers.delete(STORED_AT_HEADER);
        return new Response(prev.body, { status: prev.status, headers });
      }
    }

    // L1, L2 모두 miss → 다음 미들웨어로 (D1 hit)
    // 🛟 2026-11-04 [UNLOCK_LOADING] 대표 *"대기업급 안정성을 보여주는 최적화"* — **원본이 실패하면 마지막 성공 응답을 대신 낸다**
    //   (stale-if-error). 종전엔 캐시가 만료된 뒤 D1 이 실패하면 손님 화면이 그대로 오류였다 — 2026-09-01 D1 일일 읽기 한도에
    //   닿았을 때 소비자 API 가 통째로 500 이 된 바로 그 모양이다. 성공할 때마다 예비 사본(24시간)을 따로 두고,
    //   원본이 5xx 거나 던지면 그 사본을 `X-Cache-Status: *-STALE` 로 돌려준다. 예비 사본이 없으면 종전과 같다(오류 그대로).
    let threw: unknown = null;
    try { await next(); } catch (e) { threw = e; }
    const degraded = !threw && c.res.headers.get(DEGRADED_HEADER) === '1';
    if (threw || c.res.status >= 500 || degraded) {
      const stale = await cache.match(staleKey).catch(() => undefined);
      if (stale) {
        // ⚠️ `return new Response()` 는 안 된다 — Hono 는 응답이 이미 정해진 뒤 미들웨어의 반환값을 버린다(시험이 잡았다).
        //   `c.res` 를 **교체**하고, 교체 때 옛 응답 헤더가 덮어쓰므로 우리 헤더는 그 **뒤에** 다시 적는다.
        c.res = new Response(stale.body, { status: stale.status, headers: stale.headers });
        c.res.headers.set('X-Cache-Status', `${tag}-STALE`);
        c.res.headers.set('Cache-Control', 'public, max-age=15'); // 브라우저는 짧게 — 원본이 살아나면 곧 새 값으로
        c.res.headers.delete('CDN-Cache-Control');
        c.res.headers.delete(DEGRADED_HEADER); // 교체 때 옛 응답 헤더가 따라온다 — 내부 표시는 손님에게 안 보낸다
        c.res.headers.delete(STORED_AT_HEADER);
        c.res.headers.set('Content-Type', stale.headers.get('Content-Type') || 'application/json');
        return;
      }
      if (threw) throw threw;
      if (degraded) { try { c.res.headers.delete(DEGRADED_HEADER); } catch { /* 잠김 */ } }
      return; // 실패·빈 응답은 저장하지 않는다(예비 사본을 덮지 않는다)
    }

    // 성공 응답만 캐싱 (4xx/5xx 캐싱 안 함)
    if (c.res.status >= 200 && c.res.status < 300) {
      // 🛟 예비 사본 — 만료 캐시와 별개로 24시간 보관(원본 실패 때만 꺼낸다).
      const backup = c.res.clone();
      backup.headers.set('Cache-Control', `public, max-age=${STALE_BACKUP_SECONDS}`);
      backup.headers.set('CDN-Cache-Control', `public, max-age=${STALE_BACKUP_SECONDS}`);
      backup.headers.set(STORED_AT_HEADER, String(Date.now())); // ⚡ SWR 판정용(손님에게는 안 나간다 — 꺼낼 때 지운다)
      c.executionCtx.waitUntil(cache.put(staleKey, backup).catch(() => {}));
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
