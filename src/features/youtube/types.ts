/**
 * YouTube Live Integration Types
 * Prism-style zero-setup live streaming
 */

export interface YouTubeOAuthTokens {
  access_token: string
  refresh_token: string
  expires_at: number
  scope: string
}

export interface YouTubeChannel {
  id: string
  title: string
  description: string
  thumbnail: string
  subscriberCount: number
  customUrl?: string
}

export interface YouTubeBroadcast {
  id: string
  title: string
  description: string
  scheduledStartTime: string
  thumbnailUrl?: string
  status: 'created' | 'live' | 'complete' | 'abandoned'
  liveChatId?: string
}

export interface YouTubeStream {
  id: string
  title: string
  ingestionInfo: {
    streamName: string // RTMP stream key
    ingestionAddress: string // RTMP URL
    rtmpsIngestionAddress?: string // RTMPS URL
  }
  cdn: {
    format: string
    ingestionType: string
  }
  status: 'created' | 'ready' | 'active' | 'inactive' | 'error'
}

export interface YouTubeLiveSetup {
  broadcast: YouTubeBroadcast
  stream: YouTubeStream
  rtmpUrl: string
  rtmpKey: string
  youtubeUrl: string
  embedUrl: string
}

export interface SellerYouTubeAuth {
  id: number
  seller_id: number
  google_email: string
  access_token: string
  refresh_token: string
  expires_at: number
  channel_id: string
  channel_title: string
  created_at: string
  updated_at: string
}

export interface LiveStreamProduct {
  id: number
  name: string
  price: number
  original_price?: number
  discount_rate?: number
  image_url: string
  is_active: boolean
  stock: number
}

export interface ProductOverlayData {
  product: LiveStreamProduct
  position: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right'
  display_duration: number
  animation: 'fade' | 'slide' | 'scale'
}

export interface StreamStatus {
  stream_id: number
  status: 'preparing' | 'ready' | 'live' | 'paused' | 'ended'
  viewer_count: number
  chat_count: number
  product_clicks: number
  started_at?: string
  current_product_id?: number
}
