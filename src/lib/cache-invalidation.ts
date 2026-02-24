/**
 * Cache Invalidation Strategy
 * 
 * 실시간 데이터 변경 시 관련 캐시를 즉시 무효화합니다.
 * - 상품 재고 변경 → 상품 목록/상세 캐시 삭제
 * - 라이브 상태 변경 → 라이브 목록 캐시 삭제
 * - 상품 생성/수정/삭제 → 관련 캐시 삭제
 */

import { purgeCache } from './edge-cache';

/**
 * 상품 관련 캐시 무효화
 * 
 * @param productId 상품 ID (선택)
 */
export async function invalidateProductCache(productId?: number): Promise<void> {
  const cacheKeys: string[] = [];

  // 1. 상품 목록 캐시 (모든 쿼리 파라미터 조합)
  cacheKeys.push(
    'https://live.ur-team.com/api/products',
    'https://live.ur-team.com/api/products?featured=true',
    'https://live.ur-team.com/api/products?limit=20',
    'https://live.ur-team.com/api/products?limit=50'
  );

  // 2. 특정 상품 상세 캐시
  if (productId) {
    cacheKeys.push(`https://live.ur-team.com/api/products/${productId}`);
  }

  await purgeCache(cacheKeys);
  console.log(`[Cache Invalidation] Invalidated product cache (${cacheKeys.length} keys)`);
}

/**
 * 라이브 스트림 관련 캐시 무효화
 * 
 * @param streamId 스트림 ID (선택)
 */
export async function invalidateLiveStreamCache(streamId?: number): Promise<void> {
  const cacheKeys: string[] = [];

  // 1. 라이브 스트림 목록 캐시
  cacheKeys.push(
    'https://live.ur-team.com/api/streams',
    'https://live.ur-team.com/api/live-streams'
  );

  // 2. 특정 스트림 상세 캐시
  if (streamId) {
    cacheKeys.push(`https://live.ur-team.com/api/streams/${streamId}`);
  }

  await purgeCache(cacheKeys);
  console.log(`[Cache Invalidation] Invalidated live stream cache (${cacheKeys.length} keys)`);
}

/**
 * 재고 변경 시 캐시 무효화
 * 
 * @param productId 상품 ID
 */
export async function invalidateStockCache(productId: number): Promise<void> {
  await invalidateProductCache(productId);
  console.log(`[Cache Invalidation] Invalidated stock cache for product ${productId}`);
}

/**
 * 라이브 상태 변경 시 캐시 무효화
 * 
 * @param streamId 스트림 ID
 */
export async function invalidateLiveStatusCache(streamId: number): Promise<void> {
  await invalidateLiveStreamCache(streamId);
  console.log(`[Cache Invalidation] Invalidated live status cache for stream ${streamId}`);
}

/**
 * 주문 완료 시 캐시 무효화 (재고 감소)
 * 
 * @param productIds 상품 ID 배열
 */
export async function invalidateOrderCache(productIds: number[]): Promise<void> {
  // 모든 상품의 캐시 무효화
  for (const productId of productIds) {
    await invalidateProductCache(productId);
  }
  console.log(`[Cache Invalidation] Invalidated cache for ${productIds.length} products after order`);
}

/**
 * 현재 상품 전환 시 캐시 무효화
 * 
 * @param streamId 스트림 ID
 * @param productId 상품 ID
 */
export async function invalidateCurrentProductCache(streamId: number, productId: number): Promise<void> {
  const cacheKeys = [
    `https://live.ur-team.com/api/streams/${streamId}`,
    `https://live.ur-team.com/api/products/${productId}`
  ];

  await purgeCache(cacheKeys);
  console.log(`[Cache Invalidation] Invalidated current product cache (stream ${streamId}, product ${productId})`);
}
