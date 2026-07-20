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

export interface Product {
  id: number; name: string; price: number; original_price?: number; discount_rate?: number
  image_url?: string; sold_count?: number; category?: string
  avg_rating?: number; review_count?: number
  dominant_color?: string | null
  restaurant_name?: string; restaurant_address?: string
  group_buy_target?: number; group_buy_current?: number; group_buy_deadline?: string
  // 🛡️ 2026-05-19: 교환권 (KT Alpha) 구분.
  deal_only?: number
}

// 🧹 2026-07-20 (링크샵 전수조사): LiveStream·Short·Tab 타입 제거 — 라이브/쇼츠 영구중단 + 탭→
//   단일 스크롤 섹션 전환(2026-06-25) 이후 도달불가. Seller/Product 만 사용 중.
