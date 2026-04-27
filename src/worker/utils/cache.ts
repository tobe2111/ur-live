// ============================================================
// KV-backed cache utility (cache-aside pattern)
// Used to shield D1 from traffic spikes (viral moments, TV features, etc.)
//
// - Graceful fallback when KV is not configured (returns fetcher() directly)
// - Stale-while-revalidate: returns stale data instead of blocking if slightly expired
// - Key namespacing to avoid collisions across features
// ============================================================

import type { KVNamespace } from '@cloudflare/workers-types';

import { swallow } from './swallow';
export interface CacheOptions {
  /** Fresh TTL in seconds. Default 300 (5 min). */
  ttl?: number;
  /** Additional seconds the entry remains usable as stale. Default 60. */
  staleWhileRevalidate?: number;
  /** Key prefix used to group cache entries. Default "cache". */
  namespace?: string;
}

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  staleUntil: number;
}

/**
 * In-isolate in-flight promise map for cache stampede protection.
 *
 * When many concurrent requests miss the same key inside a single Worker
 * isolate, we fetch once and share the promise with the rest. This prevents
 * the "thundering herd" from overwhelming D1 during a viral moment.
 *
 * ⚠️  Scope: only deduplicates within a single isolate. Multiple isolates
 *    (or colos) can still stampede simultaneously. For a true global lock
 *    you'd need a Durable Object — outside the scope of this utility.
 */
const inFlight = new Map<string, Promise<unknown>>();

/**
 * Cache-aside read helper with stale-while-revalidate semantics.
 *
 * @param KV        KV namespace (optional — falls back to direct fetcher when undefined)
 * @param key       Cache key (will be prefixed with namespace)
 * @param fetcher   Function to compute the fresh value on a miss
 * @param options   TTL / SWR / namespace overrides
 */
export async function cacheGet<T>(
  KV: KVNamespace | undefined,
  key: string,
  fetcher: () => Promise<T>,
  options: CacheOptions = {}
): Promise<T> {
  // Graceful fallback if KV is not bound (e.g. local dev or pre-provisioned env)
  if (!KV) return fetcher();

  const { ttl = 300, staleWhileRevalidate = 60, namespace = 'cache' } = options;
  const fullKey = `${namespace}:${key}`;

  try {
    const cached = await KV.get(fullKey, { type: 'json' });
    if (cached && typeof cached === 'object') {
      const entry = cached as CacheEntry<T>;
      const now = Date.now();
      if (now < entry.expiresAt) {
        // Fresh hit
        return entry.data;
      }
      if (now < entry.staleUntil) {
        // Stale but still serviceable — return and let TTL expire naturally.
        // (We intentionally don't fire-and-forget revalidate here because doing
        //  so reliably in Workers requires waitUntil plumbing. Next cold request
        //  after staleUntil will refresh.)
        return entry.data;
      }
    }
  } catch {
    // KV read failed — fall through to origin fetch
  }

  // Origin fetch — dedupe concurrent misses within this isolate.
  const existing = inFlight.get(fullKey) as Promise<T> | undefined;
  if (existing) {
    return existing;
  }

  const promise: Promise<T> = (async () => {
    const fresh = await fetcher();
    try {
      const now = Date.now();
      const entry: CacheEntry<T> = {
        data: fresh,
        expiresAt: now + ttl * 1000,
        staleUntil: now + (ttl + staleWhileRevalidate) * 1000,
      };
      await KV.put(fullKey, JSON.stringify(entry), {
        // KV auto-cleanup after stale window
        expirationTtl: ttl + staleWhileRevalidate,
      });
    } catch {
      // Cache write failures are non-fatal
    }
    return fresh;
  })();

  inFlight.set(fullKey, promise);
  try {
    return await promise;
  } finally {
    inFlight.delete(fullKey);
  }
}

/**
 * Invalidate one or more cache keys.
 *
 * Note: KV has no pattern/prefix delete. For "wildcard" invalidation
 * (e.g. all product listings), either enumerate known keys here or rely
 * on the short TTL — for hot public GETs a 30–60s TTL is usually fine.
 */
export async function cacheInvalidate(
  KV: KVNamespace | undefined,
  keys: string | string[],
  namespace = 'cache'
): Promise<void> {
  if (!KV) return;
  const arr = Array.isArray(keys) ? keys : [keys];
  await Promise.all(
    arr.map((k) => KV.delete(`${namespace}:${k}`).catch(swallow('worker:utils:cache')))
  );
}

/**
 * Helper to build a stable cache key from query parameters.
 * Undefined / empty values are omitted so keys stay compact.
 */
export function buildCacheKey(
  prefix: string,
  parts: Record<string, string | number | undefined | null>
): string {
  const segments: string[] = [prefix];
  for (const [k, v] of Object.entries(parts)) {
    if (v === undefined || v === null || v === '') continue;
    segments.push(`${k}:${v}`);
  }
  return segments.join(':');
}
