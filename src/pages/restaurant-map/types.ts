/**
 * 🛡️ 2026-05-02: TD-018 분할 — RestaurantMapPage 공유 타입.
 */

export interface Restaurant {
  id: number; name: string; restaurant_name: string; restaurant_address: string
  restaurant_phone: string; restaurant_lat: number; restaurant_lng: number
  price: number; original_price: number; image_url: string
  /** 🐛 2026-09-09: 종전 `discount_percent` 는 **선언만 되고 한 번도 채워진 적이 없다** —
   *  서버(`/api/group-buy/products`)가 보내는 이름은 `discount_rate` 다. 이름이 어긋나 지도만
   *  자체 계산식을 쓰다가 서버 정렬·카드와 할인율 정의가 갈렸다. 실제 이름으로 교정.
   *  ⚠️ 표시·정렬은 반드시 `priceDisplay()`(shared/price-display) 경유. */
  discount_rate?: number | null; rating: number
  category?: string
  seller_id?: number
}

// 🛡️ 2026-04-28: 옵션 B — 카카오 Places 일반 맛집 (이용권 미출시)
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
