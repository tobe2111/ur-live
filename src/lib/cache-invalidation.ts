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
}

/**
 * 라이브 스트림 관련 캐시 무효화
 * 
 * @param streamId 스트림 ID (선택)
 */
export async function invalidateBannerCache(): Promise<void> {
  await purgeCache([
    'https://live.ur-team.com/api/banners',
    'https://live.ur-team.com/api/banners/active',
  ]);
}

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
}

/**
 * 재고 변경 시 캐시 무효화
 * 
 * @param productId 상품 ID
 */
export async function invalidateStockCache(productId: number): Promise<void> {
  await invalidateProductCache(productId);
}

/**
 * 라이브 상태 변경 시 캐시 무효화
 * 
 * @param streamId 스트림 ID
 */
export async function invalidateLiveStatusCache(streamId: number): Promise<void> {
  await invalidateLiveStreamCache(streamId);
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
}

/**
 * ✨ 유저 프로필 캐시 무효화
 * 
 * 사용 시점:
 * - 프로필 정보 수정 시
 * - 프로필 이미지 업로드 시
 * - 닉네임 변경 시
 * 
 * @param userId 유저 ID
 * @param userType 유저 타입 ('user' | 'seller' | 'admin')
 */
export async function invalidateUserProfileCache(userId: number, userType: 'user' | 'seller' | 'admin'): Promise<void> {
  const cacheKeys: string[] = [];

  // 1. 유저 프로필 조회 API
  cacheKeys.push(
    `https://live.ur-team.com/api/users/${userId}`,
    `https://live.ur-team.com/api/${userType}s/${userId}`
  );

  // 2. 셀러인 경우 셀러 정보 API도 무효화
  if (userType === 'seller') {
    cacheKeys.push(
      `https://live.ur-team.com/api/sellers/${userId}/profile`,
      `https://live.ur-team.com/api/sellers/${userId}/info`
    );
  }

  await purgeCache(cacheKeys);
}

/**
 * ✨ 정적 문서 캐시 무효화
 * 
 * 사용 시점:
 * - 공지사항 생성/수정/삭제 시
 * - 약관 수정 시
 * - FAQ 수정 시
 * 
 * @param documentType 문서 타입 ('notice' | 'terms' | 'privacy' | 'faq')
 * @param documentId 문서 ID (선택)
 */
export async function invalidateStaticDocumentCache(
  documentType: 'notice' | 'terms' | 'privacy' | 'faq',
  documentId?: number
): Promise<void> {
  const cacheKeys: string[] = [];

  // 1. 문서 목록 캐시
  cacheKeys.push(`https://live.ur-team.com/api/${documentType}s`);

  // 2. 특정 문서 상세 캐시
  if (documentId) {
    cacheKeys.push(`https://live.ur-team.com/api/${documentType}s/${documentId}`);
  }

  // 3. 최신 공지사항 캐시 (공지사항인 경우)
  if (documentType === 'notice') {
    cacheKeys.push(`https://live.ur-team.com/api/notices/latest`);
  }

  await purgeCache(cacheKeys);
}

/**
 * ✨ 재고 Micro-cache 무효화 (10초 TTL)
 * 
 * 사용 시점:
 * - 주문 완료 시 (재고 감소)
 * - 재고 수동 조정 시
 * - 재입고 시
 * 
 * @param productId 상품 ID
 */
export async function invalidateStockMicroCache(productId: number): Promise<void> {
  const cacheKeys = [
    `https://live.ur-team.com/api/products/${productId}/stock`,
    `https://live.ur-team.com/api/products/${productId}`,
    `https://live.ur-team.com/api/products` // 목록도 함께 무효화
  ];

  await purgeCache(cacheKeys);
}

/**
 * ✨ 일괄 캐시 무효화 (관리자용)
 * 
 * 사용 시점:
 * - 대규모 상품 업데이트 시
 * - 시스템 점검 후 캐시 초기화 시
 * 
 * @param cacheType 캐시 타입 ('all' | 'products' | 'live-streams' | 'users' | 'documents')
 */
export async function invalidateAllCache(
  cacheType: 'all' | 'products' | 'live-streams' | 'users' | 'documents' = 'all'
): Promise<void> {
  const cacheKeys: string[] = [];

  if (cacheType === 'all' || cacheType === 'products') {
    cacheKeys.push(
      'https://live.ur-team.com/api/products',
      'https://live.ur-team.com/api/products?featured=true'
    );
  }

  if (cacheType === 'all' || cacheType === 'live-streams') {
    cacheKeys.push(
      'https://live.ur-team.com/api/streams',
      'https://live.ur-team.com/api/live-streams'
    );
  }

  if (cacheType === 'all' || cacheType === 'documents') {
    cacheKeys.push(
      'https://live.ur-team.com/api/notices',
      'https://live.ur-team.com/api/terms',
      'https://live.ur-team.com/api/privacy',
      'https://live.ur-team.com/api/faqs'
    );
  }

  await purgeCache(cacheKeys);
}
