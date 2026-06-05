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

// 🛡️ 2026-06-04 (KV 무료한도 보호): L2 KV 레이어 OFF.
//   배경: /api/products·/api/group-buy/products 등 핫패스가 매 L1-miss 마다 KV.get/put 호출 →
//   Cloudflare KV 무료한도(읽기 10만/쓰기 1천 일) 소진(50% 경고). CLAUDE.md 로딩최적화 방향이
//   "edge cache(caches.default) 직접 read, KV 의존성 0" 이고, 이 캐시 함수의 모든 핫 콜러는 이미
//   publicCache(caches.default) 엣지캐시가 앞단에 있음 → L2 KV 는 중복.
//   효과: 요청 → 엣지캐시(콜로별, cross-req) → L1(인메모리, isolate내) → D1. KV ops ≈ 0.
//   복원: true 로 변경.
const L2_KV_ENABLED = false;

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

  // L2 KV — 🛡️ 기본 OFF (KV 무료한도 보호). 엣지캐시+L1 으로 커버. (L2_KV_ENABLED 참조)
  const useL2 = !!KV && L2_KV_ENABLED;

  // L2: KV hit
  if (useL2) {
    try {
      const cached = await KV!.get(fullKey, { type: 'json' });
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
    if (useL2) {
      try {
        await KV!.put(fullKey, JSON.stringify(entry), {
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
