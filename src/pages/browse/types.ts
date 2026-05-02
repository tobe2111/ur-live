/**
 * 🛡️ 2026-05-02: TD-018 분할 — BrowsePage 공유 타입.
 */

export interface RecentProduct {
  id: number
  name: string
  price?: number
  image?: string
}

export interface Product {
  id: number
  name: string
  price: number
  current_price: number
  original_price?: number
  discount_rate: number
  image_url: string
  sold_count?: number
  stock: number
  category?: string
  seller_name?: string
  restaurant_name?: string
  restaurant_lat?: number
  restaurant_lng?: number
}

export type SortOption = 'popular' | 'newest' | 'price_asc' | 'price_desc' | 'discount'

export const SORT_LABELS: Record<SortOption, string> = {
  popular: '인기순',
  newest: '최신순',
  price_asc: '낮은 가격순',
  price_desc: '높은 가격순',
  discount: '할인율순',
}

export const ITEMS_PER_PAGE = 12
