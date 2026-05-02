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
  status: string
  created_at: string
}
