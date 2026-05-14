/**
 * Workers Cache API utility — KV 무료 한도 보호 + 글로벌 edge cache.
 *
 * 🛡️ 2026-05-13: KV reads/writes 의 일부를 Cloudflare Cache API 로 전환.
 *   장점:
 *     - **무료 + 무제한** (KV 100k reads/day 와 무관)
 *     - 글로벌 엣지 캐시 (300+ POP)
 *     - stale-while-revalidate 자동
 *     - KV 보다 빠름 (in-region cache hit)
 *   단점:
 *     - 캐시 키 = URL 기반 (KV 처럼 임의 키 X)
 *     - 명시적 purge 불가 (TTL 또는 새 URL 필요)
 *
 * 사용 패턴:
 *   const cached = await cacheApiGet(`https://api.ur-team.com/cache/streams-live`)
 *   if (cached) return cached
 *   const fresh = await computeFresh()
 *   await cacheApiPut(`https://api.ur-team.com/cache/streams-live`, fresh, { ttl: 30 })
 *   return fresh
 *
 * 캐시 무효화는 cache-buster URL pattern 활용:
 *   /cache/streams-live?v=${dbVersionStamp}
 *   DB 변경 시 dbVersionStamp 증가 → 새 URL → cache miss → 새로 fetch
 */

/**
 * Cloudflare default cache 사용 (모든 worker 공유).
 *   trackingDomain: 우리 도메인 (live.ur-team.com 등) 이어야 cache hit 가능.
 *   Cache API 는 origin 도메인 기준 — Workers 안에서는 어떤 도메인이든 OK.
 */
const CACHE_PREFIX = 'https://cache.internal.ur-live/'

export interface CacheApiOptions {
  /** TTL in seconds. Default 60. */
  ttl?: number
  /** Stale-while-revalidate window. Default 60s. */
  staleWhileRevalidate?: number
}

export async function cacheApiGet<T>(key: string): Promise<T | null> {
  if (typeof caches === 'undefined') return null
  const cache = caches.default
  const cacheKey = CACHE_PREFIX + encodeURIComponent(key)
  try {
    const response = await cache.match(cacheKey)
    if (!response) return null
    const data = await response.json() as T
    return data
  } catch { return null }
}

export async function cacheApiPut<T>(
  key: string,
  data: T,
  options: CacheApiOptions = {},
): Promise<void> {
  if (typeof caches === 'undefined') return
  const { ttl = 60, staleWhileRevalidate = 60 } = options
  const cache = caches.default
  const cacheKey = CACHE_PREFIX + encodeURIComponent(key)
  try {
    const response = new Response(JSON.stringify(data), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': `public, max-age=${ttl}, stale-while-revalidate=${staleWhileRevalidate}`,
      },
    })
    await cache.put(cacheKey, response)
  } catch { /* best-effort */ }
}

/**
 * Cache-aside helper — get from cache, else compute + store.
 *   Cache API 가 KV 보다 빠르고 무료 + 무제한.
 */
export async function cacheApi<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: CacheApiOptions = {},
): Promise<T> {
  const cached = await cacheApiGet<T>(key)
  if (cached !== null) return cached
  const fresh = await fetcher()
  // fire-and-forget put (응답 지연 X)
  void cacheApiPut(key, fresh, options).catch(() => {})
  return fresh
}
