// Axios-like error shape for catch blocks
export interface ApiError {
  response?: {
    status?: number
    statusText?: string
    data?: {
      error?: string
    }
  }
  message?: string
}

// YouTube IFrame API types — SSOT, ReelCard / ShortsPage 등에서 import 해서 사용.
export interface YTPlayer {
  playVideo(): void
  pauseVideo(): void
  stopVideo?(): void
  unMute(): void
  mute(): void
  isMuted(): boolean
  setVolume(volume: number): void
  destroy(): void
  getCurrentTime(): number
  getDuration(): number
}

export interface YTPlayerEvent {
  target: YTPlayer
  data: number
}

export interface YTPlayerVars {
  autoplay?: 0 | 1
  mute?: 0 | 1
  controls?: 0 | 1 | 2
  modestbranding?: 0 | 1
  rel?: 0 | 1
  showinfo?: 0 | 1
  iv_load_policy?: 1 | 3
  playsinline?: 0 | 1
  enablejsapi?: 0 | 1
  loop?: 0 | 1
  playlist?: string
  fs?: 0 | 1
  cc_load_policy?: 0 | 1
  origin?: string
}

export interface YTPlayerOptions {
  height?: string | number
  width?: string | number
  videoId?: string
  playerVars?: YTPlayerVars
  events?: {
    onReady?: (event: YTPlayerEvent) => void
    onStateChange?: (event: YTPlayerEvent) => void
    onError?: (event: YTPlayerEvent) => void
  }
}

export interface YTNamespace {
  Player: new (elementId: string | HTMLElement, options: YTPlayerOptions) => YTPlayer
  PlayerState: {
    UNSTARTED: number
    ENDED: number
    PLAYING: number
    PAUSED: number
    BUFFERING: number
    CUED: number
  }
  ready?: (cb: () => void) => void
}

// Extend window for YouTube IFrame API
declare global {
  interface Window {
    YT?: YTNamespace
    youtubeCallbacks?: (() => void)[]
    onYouTubeIframeAPIReady?: () => void
  }
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
  seller_tiktok?: string
  seller_kakao?: string
  current_product_id?: number | null
  seller_id?: number
  current_product?: Product | null
  scheduled_at?: string
  seller_name?: string
  created_at?: string
  product_display_mode?: 'current_only' | 'all'
  donation_goal?: number | null
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
  stock?: number // 🔥 Firebase 실시간 재고
  seller_id?: number
  colors?: { name: string; hex: string }[]
  sizes?: string[]
}

export interface ReelData {
  stream: Stream
  product: Product | null
}
