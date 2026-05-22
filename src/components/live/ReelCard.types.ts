/**
 * 🛡️ 2026-05-22: ReelCard.tsx (1515줄) 분할 — 타입 정의.
 */

export interface ApiError {
  response?: { status?: number; statusText?: string; data?: { error?: string } }
  message?: string
}

export function isApiError(error: unknown): error is ApiError {
  return typeof error === 'object' && error !== null && ('response' in error || 'message' in error)
}

export interface Stream {
  id: number
  title: string
  streamerName: string
  streamerAvatar?: string
  videoUrl?: string
  youtube_video_id?: string
  thumbnail_url?: string
  status: 'live' | 'ended' | 'scheduled'
  viewerCount: number
  products?: Product[]
  seller_youtube?: string
  seller_instagram?: string
  seller_kakao?: string
  current_product_id?: number | null
  seller_id?: number
  current_product?: Product | null
  scheduled_at?: string
  seller_name?: string
  seller_tiktok?: string
  seller_shipping_fee?: number
  donation_goal?: number | null
  created_at?: string
  product_display_mode?: 'current_only' | 'all'
}

export interface Product {
  id: number
  name: string
  price: number
  originalPrice: number
  original_price?: number
  image: string
  image_url?: string
  description: string
  rating: number
  sold: number
  stock?: number
  seller_id?: number
  seller_name?: string
  colors?: { name: string; hex: string }[]
  sizes?: string[]
}

export interface ReelData {
  stream: Stream
  product: Product | null
}
