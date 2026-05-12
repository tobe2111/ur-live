// ============================================================
// KV-backed cache utility (cache-aside pattern)
// L1: isolate 인메모리 (KV read/write 0), L2: KV
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

// L1: isolate 인메모리 캐시 — KV 요청 자체를 차단
const l1 = new Map<string, CacheEntry<unknown>>();

// L1 정리 (메모리 누수 방지, 1분 주기)
let l1LastCleanup = Date.now();
function maybeCleanL1() {
  const now = Date.now();
  if (now - l1LastCleanup < 60_000) return;
  l1LastCleanup = now;
  for (const [k, v] of l1) {
    if (now > v.staleUntil) l1.delete(k);
  }
}

/**
 * In-isolate in-flight promise map for cache stampede protection.
 */
const inFlight = new Map<string, Promise<unknown>>();

export async function cacheGet<T>(
  KV: KVNamespace | undefined,
  key: string,
  fetcher: () => Promise<T>,
  options: CacheOptions = {}
): Promise<T> {
  const { ttl = 300, staleWhileRevalidate = 60, namespace = 'cache' } = options;
  const fullKey = `${namespace}:${key}`;
  const now = Date.now();

  maybeCleanL1();

  // L1 hit (인메모리) — KV 접근 없음
  const l1hit = l1.get(fullKey) as CacheEntry<T> | undefined;
  if (l1hit) {
    if (now < l1hit.expiresAt) return l1hit.data;
    if (now < l1hit.staleUntil) return l1hit.data;
    l1.delete(fullKey);
  }

  // KV 없으면 바로 fetcher
  if (!KV) return fetcher();

  // L2: KV hit
  try {
    const cached = await KV.get(fullKey, { type: 'json' });
    if (cached && typeof cached === 'object') {
      const entry = cached as CacheEntry<T>;
      if (now < entry.staleUntil) {
        l1.set(fullKey, entry); // L1에 올려놔서 다음 요청은 KV read도 없음
        return entry.data;
      }
    }
  } catch {
    // KV read 실패 — origin fetch
  }

  // Stampede 방지: 같은 키 동시 miss는 하나만 fetch
  const existing = inFlight.get(fullKey) as Promise<T> | undefined;
  if (existing) return existing;

  const promise: Promise<T> = (async () => {
    const fresh = await fetcher();
    const entry: CacheEntry<T> = {
      data: fresh,
      expiresAt: now + ttl * 1000,
      staleUntil: now + (ttl + staleWhileRevalidate) * 1000,
    };
    l1.set(fullKey, entry);
    if (KV) {
      try {
        await KV.put(fullKey, JSON.stringify(entry), {
          expirationTtl: ttl + staleWhileRevalidate,
        });
      } catch {
        // Cache write 실패는 치명적이지 않음
      }
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

export async function cacheInvalidate(
  KV: KVNamespace | undefined,
  keys: string | string[],
  namespace = 'cache'
): Promise<void> {
  const arr = Array.isArray(keys) ? keys : [keys];
  // L1에서도 즉시 제거
  arr.forEach(k => l1.delete(`${namespace}:${k}`));
  if (!KV) return;
  await Promise.all(
    arr.map((k) => KV.delete(`${namespace}:${k}`).catch(swallow('worker:utils:cache')))
  );
}

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
