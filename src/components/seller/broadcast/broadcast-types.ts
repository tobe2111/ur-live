// ── Broadcast Types ────────────────────────────────────────────────

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
// 송출 도구 (streaming tool): 셀러가 영상을 어떻게 push 할지
export type StreamMethod = 'youtube' | 'obs' | 'prism' | 'quick'
// 목적지 플랫폼 (destination): 시청자가 어디서 보는지
export type Destination = 'youtube' | 'tiktok' | 'chzzk' | 'soop'

// ── 멀티플랫폼 API 타입 ────────────────────────────────────────────
export interface DestinationPlatform {
  key: string; label: string; status: 'available' | 'coming_soon' | 'deprecated'
  icon: string; region: string
  features: { rtmp_ingest: boolean; chat_relay: boolean; product_overlay: boolean; oauth_required: boolean }
  eta?: string; note?: string
}

// 🛡️ 2026-04-23 배치 167: /api/platforms/streaming-tools/:tool/preset 로부터 로드.
export interface ToolPreset {
  label: string; resolution: string; fps: number
  video_bitrate_kbps: number; audio_bitrate_kbps: number
  keyframe_interval_sec: number; buffer_sec: number
  recommended_for: string
}

export interface BroadcastTemplate {
  name: string
  title: string
  description: string
  privacy: 'public' | 'unlisted' | 'private'
  productIds: number[]
}
