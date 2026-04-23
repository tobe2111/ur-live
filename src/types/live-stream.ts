/**
 * Live Stream 실시간 데이터 타입
 *
 * 🛡️ 2026-04-23 배치 166: useFirebaseChat/useFirebaseStream 에 정의되어 있던 타입을
 * 훅 구현과 분리해서 순수 타입 파일로 이동. Firebase 구현 의존성 제거.
 */

/**
 * 라이브 채팅 메시지
 */
export interface ChatMessage {
  id: string
  userId: number
  userName: string
  userType: 'viewer' | 'streamer' | 'system'
  message: string
  timestamp: number
  isSeller?: boolean
  isAdmin?: boolean
  role?: string
  username?: string
  source?: 'kakao' | 'youtube' | 'system' // 채팅 출처
  avatarUrl?: string // YouTube 프로필 이미지
}

/**
 * 라이브 스트림 실시간 상태
 */
export interface StreamData {
  id: number
  title?: string
  status: 'live' | 'scheduled' | 'ended'
  current_product_id: number | null
  viewer_count: number
  updated_at: number
}

/**
 * 상품 실시간 데이터 (재고 등)
 */
export interface ProductData {
  id: number
  name: string
  price: number
  original_price?: number
  discount_rate?: number
  stock: number
  image_url?: string
  updated_at: number
}
