/**
 * Cache Invalidation Strategy
 *
 * 실시간 데이터 변경 시 관련 캐시를 즉시 무효화합니다.
 * - 상품 재고 변경 → 상품 목록/상세 캐시 삭제
 * - 라이브 상태 변경 → 라이브 목록 캐시 삭제
 * - 상품 생성/수정/삭제 → 관련 캐시 삭제
 *
 * 🛡️ 2026-05-12: live.ur-team.com 외 ur-live.pages.dev / 프리뷰 도메인도 동시 무효화.
 *   기존: 프라이머리 호스트만 무효화 → .pages.dev 미러는 TTL 끝까지 stale.
 */

import { purgeCache } from './edge-cache';

const HOSTS = [
  'https://live.ur-team.com',
  'https://ur-live.pages.dev',
];

/** 단일 path 를 모든 알려진 호스트의 full URL 로 확장 */
function expand(path: string): string[] {
  return HOSTS.map(h => `${h}${path}`);
}
function expandAll(paths: string[]): string[] {
  return paths.flatMap(expand);
}

/**
 * 상품 관련 캐시 무효화
 * 
 * @param productId 상품 ID (선택)
 */
export async function invalidateProductCache(productId?: number): Promise<void> {
  const paths = [
    '/api/products',
    '/api/products?featured=true',
    '/api/products?limit=20',
    '/api/products?limit=50',
  ];
  if (productId) paths.push(`/api/products/${productId}`);
  await purgeCache(expandAll(paths));
}

/**
 * 라이브 스트림 관련 캐시 무효화
 * 
 * @param streamId 스트림 ID (선택)
 */
export async function invalidateBannerCache(): Promise<void> {
  await purgeCache(expandAll(['/api/banners', '/api/banners/active']));
}

export async function invalidateLiveStreamCache(streamId?: number): Promise<void> {
  const paths = ['/api/streams', '/api/live-streams'];
  if (streamId) paths.push(`/api/streams/${streamId}`);
  await purgeCache(expandAll(paths));
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
  await purgeCache(expandAll([
    `/api/streams/${streamId}`,
    `/api/products/${productId}`,
  ]));
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
  const paths = [
    `/api/users/${userId}`,
    `/api/${userType}s/${userId}`,
  ];
  if (userType === 'seller') {
    paths.push(`/api/sellers/${userId}/profile`, `/api/sellers/${userId}/info`);
  }
  await purgeCache(expandAll(paths));
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
  const paths: string[] = [`/api/${documentType}s`];
  if (documentId) paths.push(`/api/${documentType}s/${documentId}`);
  const cacheKeys: string[] = expandAll(paths);

  // 3. 최신 공지사항 캐시 (공지사항인 경우)
  if (documentType === 'notice') {
    cacheKeys.push(...expand('/api/notices/latest'));
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
  await purgeCache(expandAll([
    `/api/products/${productId}/stock`,
    `/api/products/${productId}`,
    '/api/products',
  ]));
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
  const paths: string[] = [];
  if (cacheType === 'all' || cacheType === 'products') {
    paths.push('/api/products', '/api/products?featured=true');
  }
  if (cacheType === 'all' || cacheType === 'live-streams') {
    paths.push('/api/streams', '/api/live-streams');
  }
  if (cacheType === 'all' || cacheType === 'documents') {
    paths.push('/api/notices', '/api/terms', '/api/privacy', '/api/faqs');
  }
  await purgeCache(expandAll(paths));
}
