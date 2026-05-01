/**
 * 🛡️ 2026-05-01: TD-018 분할 — SellerLiveBroadcastPage 공유 타입.
 */

export interface Product {
  id: number
  name: string
  price: number
  image_url: string
  stock: number
  is_active: boolean
  is_supply_product?: boolean
}

export interface LiveStream {
  id: number
  title: string
  youtube_video_id: string
  youtube_broadcast_id?: string
  youtube_url?: string
  rtmp_url?: string
  rtmp_key?: string
  status: 'scheduled' | 'live' | 'ended'
  viewer_count: number
  current_product_id?: number
  ended_at?: string
  scheduled_at?: string
}

export type WizardStep = 'info' | 'setup' | 'live'

export interface YouTubeChannel {
  id: number
  channel_id: string
  channel_title: string
  channel_thumbnail: string
  subscriber_count: number
  is_active: boolean
  has_persistent_key?: boolean
  token_expired?: boolean
}

export type Destination = 'youtube' | 'tiktok' | 'chzzk' | 'soop'

export interface DestinationPlatform {
  key: string
  label: string
  status: 'available' | 'coming_soon' | 'deprecated'
  icon: string
  region: string
  features: { rtmp_ingest: boolean; chat_relay: boolean; product_overlay: boolean; oauth_required: boolean }
  eta?: string
  note?: string
}
