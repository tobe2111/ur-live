/**
 * 🛡️ 2026-05-02: TD-018 분할 — SellerPublicPage 공유 타입.
 */

export interface Seller {
  id: number; name: string; username?: string; slug?: string; business_name?: string; profile_image?: string; bio?: string
  sns_instagram?: string; sns_youtube?: string; sns_facebook?: string; sns_twitter?: string
  kakao_chat_link?: string; website_url?: string; created_at: string
  business_number?: string; email?: string; phone?: string
  ceo_name?: string; mail_order_number?: string; business_address?: string
  // 🛡️ 2026-05-15 (PRISM 따라잡기): 미니샵 커스터마이징
  banner_url?: string; brand_color?: string
  external_live_tiktok?: string; external_live_instagram?: string; external_live_facebook?: string
  follower_count?: number
}

export interface LiveStream {
  id: number; title: string; youtube_video_id?: string; status: string; viewer_count?: number
  scheduled_at?: string; created_at: string
}

export interface Product {
  id: number; name: string; price: number; original_price?: number; discount_rate?: number
  image_url?: string; sold_count?: number; category?: string
  restaurant_name?: string; restaurant_address?: string
  group_buy_target?: number; group_buy_current?: number; group_buy_deadline?: string
}

export interface Short {
  id: number; title: string; youtube_video_id?: string; view_count: number; thumbnail_url?: string
  product_id?: number; product_name?: string; product_price?: number
}

export type Tab = 'home' | 'vouchers' | 'shorts' | 'live' | 'info'
