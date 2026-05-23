/**
 * 🛡️ 2026-05-22 사용자 명령 "이상적이고 영구적으로 + 서버 부담 ↓":
 *   공통 query hook 라이브러리. 모든 read-heavy API 를 통일된 패턴으로.
 *
 * 룰:
 *   - 모든 page / component 는 직접 api.get() 대신 본 hook 사용.
 *   - 같은 데이터 — 어디서 호출하든 React Query 가 dedup + cache 공유.
 *   - mutation 후 호출하는 invalidate / setQueryData 도 본 라이브러리 export.
 *
 * 효과:
 *   - 사용자 1명 세션 내 동일 데이터 server hit = 1 (이전: 페이지마다 호출 → N hit)
 *   - localStorage initialData → 페이지 진입 즉시 0ms 표시
 *   - prefetch on hover/touch → 클릭 시 0ms (목록 → 상세)
 *   - placeholderData → 목록의 partial 데이터로 상세 즉시 표시
 *   - 30일 LRU cleanup → localStorage 무한 부풀음 차단
 *   - mutation 후 자동 갱신 → 항상 정확한 값
 */

export { queryKeys } from './queryKeys'
export { readCache, writeCache, clearCache, clearAllUserCache, cleanupExpiredCache } from './localCache'

// 사용자 자산
export { useBalance, useSetBalance, useInvalidateBalance } from './useBalance'
export { useCartCount, useSetCartCount, useInvalidateCart } from './useCartCount'
export { useUnreadCount, useInvalidateUnreadCount } from './useUnreadCount'
export { useUserProfile, useInvalidateUserProfile } from './useUserProfile'

// 상품 / 공구
export {
  useProduct,
  useProductList,
  usePrefetchProduct,
  prefetchProduct,
  useHydrateProductsCache,
  type Product,
} from './useProduct'
export {
  useGroupBuyProduct,
  usePrefetchGroupBuyProduct,
  prefetchGroupBuyProduct,
  useHydrateGroupBuyCache,
  type GroupBuyProduct,
} from './useGroupBuyProduct'

// 셀러 공개
export { useSellerPublic } from './useSellerPublic'

// 내 자산
export { useMyOrders, useMyVouchers, useMyAppointments, useInvalidateMyOrders, useInvalidateMyVouchers } from './useMyData'

// 어드민 (2026-05-22 P1 영구 fix)
export {
  useAdminOpsInsights,
  useAdminSellers,
  useAdminPendingSellers,
  useAdminAgencies,
  useAdminAgencyApprovals,
  useAdminCommissionRates,
  useAdminCronFailures,
  useAdminAlimtalkFailures,
  useAdminDisputes,
  useInvalidateAdminSellers,
  useInvalidateAdminAgencies,
  useInvalidateAdminAgencyApprovals,
  useInvalidateAdminDisputes,
  useInvalidateAdminAll,
} from './useAdmin'
