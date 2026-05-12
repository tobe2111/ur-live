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

// YouTube IFrame API types
export interface YTPlayer {
  playVideo(): void
  pauseVideo(): void
  unMute(): void
  setVolume(volume: number): void
  destroy(): void
  getCurrentTime(): number
  getDuration(): number
}

export interface YTPlayerEvent {
  target: YTPlayer
  data: number
}

export interface YTNamespace {
  Player: new (elementId: string, options: object) => YTPlayer
  PlayerState: {
    PLAYING: number
    PAUSED: number
    ENDED: number
  }
}

// Extend window for YouTube IFrame API
declare global {
  interface Window {
    YT: YTNamespace
    youtubeCallbacks: (() => void)[]
    onYouTubeIframeAPIReady: () => void
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
