/**
 * 🛡️ 2026-05-02: TD-018 분할 — MainHomePage 공유 타입.
 */

export interface LiveStream {
  id: number; title: string; youtube_video_id?: string; status: string
  seller_name?: string; viewer_count?: number; scheduled_at?: string
  current_product?: { id: number; name: string; price: number } | null
  thumbnail_url?: string; image_url?: string
}

export interface Product {
  id: number; name: string; price: number; original_price?: number; image_url?: string
  discount_rate?: number; seller_name?: string; category?: string
  group_buy_target?: number; group_buy_current?: number; group_buy_deadline?: string
  sold_count?: number; avg_rating?: number; review_count?: number; restaurant_address?: string
}
