/**
 * 🛡️ 2026-05-02: TD-018 분할 — SellerProfileEditPage 공유 타입.
 */

export interface SellerProfile {
  id: number
  username: string
  name: string
  email: string
  phone?: string
  business_name?: string
  business_number?: string
  company_name?: string
  profile_image?: string
  bio?: string
  sns_instagram?: string
  sns_youtube?: string
  sns_facebook?: string
  sns_twitter?: string
  website_url?: string
  kakao_chat_link?: string
  // 🛡️ 2026-05-15 (PRISM 따라잡기): 미니샵 커스터마이징
  banner_url?: string
  brand_color?: string
  external_live_tiktok?: string
  external_live_instagram?: string
  external_live_facebook?: string
  status: string
  created_at: string
}
