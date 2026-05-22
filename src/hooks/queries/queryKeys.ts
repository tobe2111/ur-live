/**
 * 🛡️ 2026-05-22 사용자 명령 (이상적 + 영구 + 서버 부담 ↓):
 *   모든 query key 의 단일 진실원천. 한 곳에서 변경하면 전체 invalidation 자동.
 *
 * 사용:
 *   - useQuery({ queryKey: queryKeys.balance(), ... })
 *   - queryClient.invalidateQueries({ queryKey: queryKeys.balance() })
 *   - queryClient.setQueryData(queryKeys.balance(), 100)
 *
 * 룰:
 *   - queryKey 는 **항상** queryKeys 객체에서 import (직접 array literal 금지)
 *   - hierarchical: invalidate(queryKeys.user()) → user.* 전체 무효화
 */

export const queryKeys = {
  // 사용자 자기 데이터
  user: () => ['user'] as const,
  userProfile: () => ['user', 'profile'] as const,

  // 딜 / 결제
  points: () => ['points'] as const,
  balance: () => ['points', 'balance'] as const,
  chargeOptions: () => ['points', 'charge-options'] as const,

  // 장바구니 + 알림
  cart: () => ['cart'] as const,
  cartCount: () => ['cart', 'count'] as const,
  cartItems: () => ['cart', 'items'] as const,
  notifications: () => ['notifications'] as const,
  unreadCount: () => ['notifications', 'unread-count'] as const,

  // 상품
  products: () => ['products'] as const,
  productList: (filters?: Record<string, unknown>) => ['products', 'list', filters ?? {}] as const,
  product: (id: number | string) => ['products', 'detail', String(id)] as const,

  // 공구 상품
  groupBuy: () => ['group-buy'] as const,
  groupBuyList: (status: string, category: string) => ['group-buy', 'list', status, category] as const,
  groupBuyProduct: (id: number | string) => ['group-buy', 'detail', String(id)] as const,

  // 셀러
  seller: () => ['seller'] as const,
  sellerPublic: (id: number | string) => ['seller', 'public', String(id)] as const,

  // 내 자산
  myVouchers: () => ['my', 'vouchers'] as const,
  myOrders: (filters?: Record<string, unknown>) => ['my', 'orders', filters ?? {}] as const,
  myAppointments: () => ['my', 'appointments'] as const,

  // 카테고리 / 메타
  meta: () => ['meta'] as const,
  voucherCategories: () => ['meta', 'voucher-categories'] as const,

  // 라이브
  liveStreams: (filters?: Record<string, unknown>) => ['live', 'streams', filters ?? {}] as const,
  liveStream: (id: number | string) => ['live', 'stream', String(id)] as const,
} as const
