/**
 * 🛡️ 2026-05-02: TD-018 분할 — GroupBuyListPage 공유 타입.
 */

export interface GroupBuyProduct {
  id: number
  name: string
  price: number
  original_price?: number
  image_url?: string
  category?: string
  seller_name?: string
  restaurant_name?: string
  restaurant_address?: string
  group_buy_target?: number
  group_buy_current?: number
  group_buy_deadline?: string
  group_buy_status?: string
  sold_count?: number
  created_at?: string
}

export interface CommunityGroupBuy {
  id: number
  creator_name: string
  restaurant_name: string
  restaurant_address?: string
  proposed_price: number
  deposit_per_person: number
  target_count: number
  current_count: number
  total_deposited: number
  status: string
  invite_code: string
  expires_at?: string
  created_at?: string
}

export type MainTab = 'seller' | 'community'
// 🛡️ 2026-05-17: voucher 4 카테고리 (통합 후) + general + legacy 3종 (마이그레이션 사이 graceful).
//   대분류: 'general' = 온라인(배송), voucher 4종 = 오프라인(매장 방문).
export type CategoryFilter =
  | 'all'
  | 'general'        // 온라인 (일반 상품, 배송)
  // 오프라인 voucher 4종 (신규)
  | 'meal_voucher'
  | 'beauty_voucher'
  | 'stay_voucher'
  | 'etc_voucher'
  // 레거시 (마이그레이션 완료 후 제거 가능)
  | 'health_voucher'
  | 'pet_voucher'
  | 'activity_voucher'
export type SortOption = 'popular' | 'deadline' | 'newest' | 'discount'
