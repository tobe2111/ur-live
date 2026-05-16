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
export type CategoryFilter = 'all' | 'meal_voucher' | 'general'
export type SortOption = 'popular' | 'deadline' | 'newest' | 'discount'
