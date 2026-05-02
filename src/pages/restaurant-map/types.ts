/**
 * 🛡️ 2026-05-02: TD-018 분할 — RestaurantMapPage 공유 타입.
 */

export interface Restaurant {
  id: number; name: string; restaurant_name: string; restaurant_address: string
  restaurant_phone: string; restaurant_lat: number; restaurant_lng: number
  price: number; original_price: number; image_url: string
  discount_percent: number; rating: number
  category?: string
  seller_id?: number
}

// 🛡️ 2026-04-28: 옵션 B — 카카오 Places 일반 맛집 (식사권 미출시)
export interface KakaoPlace {
  id: string
  place_name: string
  category_name: string
  phone: string
  road_address_name: string
  address_name: string
  x: string // longitude (string)
  y: string // latitude (string)
  place_url: string
  distance?: string // meters
}

export type SortBy = 'distance' | 'discount' | 'price' | 'rating'
