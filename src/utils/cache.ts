/**
 * KV Cache Utility Functions
 * 
 * Cloudflare KV를 활용한 캐싱 유틸리티
 * - TTL 기반 캐시 만료
 * - 자동 JSON 직렬화/역직렬화
 * - 타임스탬프 기반 유효성 검증
 */

export interface CachedData<T> {
  data: T;
  timestamp: number;
}

/**
 * KV 캐시에서 데이터 조회 (TTL 체크 포함)
 * 
 * @param kv KV Namespace
 * @param key 캐시 키
 * @param ttlSeconds TTL (초 단위, 기본 30초)
 * @returns 캐시된 데이터 또는 null (캐시 미스/만료)
 */
export async function getCached<T>(
  kv: KVNamespace,
  key: string,
  ttlSeconds: number = 30
): Promise<T | null> {
  try {
    const cached = await kv.get(key, 'json') as CachedData<T> | null;
    
    if (!cached) {
      return null; // 캐시 미스
    }

    // TTL 체크
    const age = Date.now() - cached.timestamp;
    if (age > ttlSeconds * 1000) {
      return null; // 캐시 만료
    }
    return cached.data;
  } catch (error) {
    console.error(`[Cache] Get error for key "${key}":`, error);
    return null;
  }
}

/**
 * KV 캐시에 데이터 저장 (TTL 설정)
 * 
 * @param kv KV Namespace
 * @param key 캐시 키
 * @param data 저장할 데이터
 * @param ttlSeconds TTL (초 단위, 기본 30초)
 */
export async function setCached<T>(
  kv: KVNamespace,
  key: string,
  data: T,
  ttlSeconds: number = 30
): Promise<void> {
  try {
    const cachedData: CachedData<T> = {
      data,
      timestamp: Date.now()
    };
    
    await kv.put(
      key,
      JSON.stringify(cachedData),
      { expirationTtl: ttlSeconds }
    );
  } catch (error) {
    console.error(`[Cache] Set error for key "${key}":`, error);
  }
}

/**
 * KV 캐시 무효화 (삭제)
 * 
 * @param kv KV Namespace
 * @param key 캐시 키
 */
export async function invalidateCache(
  kv: KVNamespace,
  key: string
): Promise<void> {
  try {
    await kv.delete(key);
  } catch (error) {
    console.error(`[Cache] Delete error for key "${key}":`, error);
  }
}

/**
 * 여러 캐시 키 일괄 무효화
 * 
 * @param kv KV Namespace
 * @param keys 캐시 키 배열
 */
export async function invalidateCaches(
  kv: KVNamespace,
  keys: string[]
): Promise<void> {
  try {
    await Promise.all(keys.map(key => kv.delete(key)));
  } catch (error) {
    console.error(`[Cache] Bulk delete error:`, error);
  }
}

/**
 * 캐시 키 생성 헬퍼
 * 
 * @param prefix 키 접두사 (예: 'stream', 'product')
 * @param id ID 값
 * @returns 포맷팅된 캐시 키 (예: 'stream:123')
 */
export function getCacheKey(prefix: string, id: string | number): string {
  return `${prefix}:${id}`;
}

/**
 * 복합 캐시 키 생성 (여러 파라미터)
 * 
 * @param prefix 키 접두사
 * @param params 키 파라미터들
 * @returns 포맷팅된 캐시 키 (예: 'streams:live:page1')
 */
export function getCacheKeyMulti(prefix: string, ...params: (string | number)[]): string {
  return `${prefix}:${params.join(':')}`;
}
