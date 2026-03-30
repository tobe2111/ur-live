import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Eye, ShoppingBag, MessageCircle, Share2, X, Star, Check, Minus, Plus, Send, Heart, Loader2, ChevronLeft } from 'lucide-react'
import axios from 'axios'
import { getUserIdSync as getUserId } from '@/utils/auth'
import api from '@/lib/api'
import { useModal } from '@/components/CustomModal'
import { useLiveStreamWebSocket } from '@/hooks/useLiveStreamWebSocket'
import { useProductStock } from '@/hooks/useProductStock'
import type { ChatMessage } from '@/hooks/useFirebaseChat'
import Toast from '@/components/Toast'
import { toast } from '@/hooks/useToast'
import { createLogger } from '@/utils/logger'
import { useAuthStore } from '@/shared/stores'
import { DonationEffect } from '@/components/LiveDonation'
import '@/utils/console-suppressor'

const log = createLogger('LivePageV2')

// Axios-like error shape for catch blocks
interface ApiError {
  response?: {
    status?: number
    statusText?: string
    data?: {
      error?: string
    }
  }
  message?: string
}

function isApiError(error: unknown): error is ApiError {
  return typeof error === 'object' && error !== null && ('response' in error || 'message' in error)
}

// YouTube IFrame API types
interface YTPlayer {
  playVideo(): void
  pauseVideo(): void
  unMute(): void
  setVolume(volume: number): void
  destroy(): void
}

interface YTPlayerEvent {
  target: YTPlayer
  data: number
}

interface YTNamespace {
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

interface Stream {
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
}

interface Product {
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
  colors?: { name: string; hex: string }[]
  sizes?: string[]
}

interface ReelData {
  stream: Stream
  product: Product | null
}

// ============================================
// Demo Data - Removed (using real API data only)
// ============================================

// ============================================
// Utility Functions
// ============================================
const usernames = [
  'minjae_92', 'yuna_shop', 'hyejin.k', 'joonho_lee', 'soyeon_99',
  'dohyun_park', 'seulgi.m', 'taehyung_fan', 'nayeon_j', 'woojin.c',
]

const chatTexts = [
  '와 대박', '이거 진짜 좋아요', '가격 너무 착하다',
  '색상 이쁘다', '사이즈 추천해주세요!', '라이브 할인 최고',
  '지금 사야되나요?', '품절되기 전에 빨리!', '배송 얼마나 걸려요?',
  '후기 좋던데', '이거 선물용으로도 괜찮나요?', '재입고 언제 해요?',
]

function getRandomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function formatViewers(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  return n.toString()
}

// ============================================
// Sub Components
// ============================================

// YouTube/Instagram/KakaoTalk Icons
function YouTubeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  )
}

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
    </svg>
  )
}

function KakaoTalkIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 3c-5.523 0-10 3.694-10 8.25 0 2.904 1.887 5.46 4.726 6.924-.157.564-.57 2.044-.652 2.362-.101.395.145.39.305.284.125-.083 1.994-1.355 2.808-1.907A11.59 11.59 0 0 0 12 19.5c5.523 0 10-3.694 10-8.25S17.523 3 12 3z" />
    </svg>
  )
}

// TopNav Component
function TopNav({ viewers, sellerLinks }: { viewers: number; sellerLinks?: { youtube?: string; instagram?: string; kakao?: string } }) {
  return (
    <header className="fixed top-0 inset-x-0 z-50 flex items-center justify-between px-4 pt-safe pb-2">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 rounded-lg bg-red-500/90 backdrop-blur-sm px-2.5 py-1.5 shadow-lg shadow-red-500/30">
          <span className="h-2 w-2 rounded-full bg-white animate-blink-live" />
          <span className="text-xs font-extrabold tracking-wider text-white">LIVE</span>
        </div>
        <div className="flex items-center gap-1 rounded-lg bg-black/40 backdrop-blur-md px-2.5 py-1.5">
          <Eye className="h-3.5 w-3.5 text-white/80" />
          <span className="text-xs font-semibold text-white/90">
            {formatViewers(viewers)}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3 h-[34px]">
        {sellerLinks?.youtube && (
          <a
            href={sellerLinks.youtube}
            target="_blank"
            rel="noopener noreferrer"
            className="opacity-50 hover:opacity-80 transition-opacity flex items-center justify-center"
            aria-label="YouTube"
          >
            <YouTubeIcon className="h-[18px] w-[18px] text-white" />
          </a>
        )}
        {sellerLinks?.instagram && (
          <a
            href={sellerLinks.instagram}
            target="_blank"
            rel="noopener noreferrer"
            className="opacity-50 hover:opacity-80 transition-opacity flex items-center justify-center"
            aria-label="Instagram"
          >
            <InstagramIcon className="h-[18px] w-[18px] text-white" />
          </a>
        )}
        {sellerLinks?.kakao && (
          <a
            href={sellerLinks.kakao}
            target="_blank"
            rel="noopener noreferrer"
            className="opacity-50 hover:opacity-80 transition-opacity flex items-center justify-center"
            aria-label="KakaoTalk"
          >
            <KakaoTalkIcon className="h-[18px] w-[18px] text-white" />
          </a>
        )}
      </div>
    </header>
  )
}

function LiveChat({ messages, onChatClick }: { messages: ChatMessage[]; onChatClick: () => void }) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const recentMessages = messages.slice(-5)

  return (
    <div
      ref={scrollRef}
      className="flex flex-col gap-0.5 overflow-y-auto max-h-32 cursor-pointer no-scrollbar"
      onClick={onChatClick}
    >
      {recentMessages.map((msg) => {
        const isSystemMessage = msg.message.includes('장바구니') || 
                                 msg.message.includes('담았습니다') || 
                                 msg.message.includes('구매했습니다') ||
                                 msg.userName === 'System' ||
                                 msg.role === 'system'
        
        return (
          <p
            key={msg.id}
            className="text-[11px] leading-[1.3] animate-fade-in"
            style={{
              textShadow: '0 1px 4px rgba(0,0,0,0.8), 0 0 12px rgba(0,0,0,0.5)',
            }}
          >
            <span className="font-bold text-white/90">{msg.userName}</span>
            <span className={`${isSystemMessage ? 'text-yellow-300 font-semibold' : 'text-white/70'}`}>
              {' '}{msg.message}
            </span>
          </p>
        )
      })}
    </div>
  )
}

function ProductListSheet({
  products,
  currentProductId,
  onClose,
  onSelectProduct,
  loading,
  stream: sheetStream,
}: {
  products: Product[]
  currentProductId: number | null
  onClose: () => void
  onSelectProduct: (product: Product) => void
  loading: boolean
  stream?: Stream
}) {
  const safeProducts = products || []
  
  return (
    <>
      <div
        className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm animate-overlay-in"
        onClick={onClose}
      />

      <div className="fixed inset-x-0 bottom-0 z-[70] max-h-[60dvh] overflow-y-auto rounded-t-3xl bg-white backdrop-blur-xl border-t border-gray-200 animate-sheet-up no-scrollbar shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-center py-3 bg-white/90 backdrop-blur-md border-b border-gray-100">
          <div className="h-1 w-10 rounded-full bg-gray-300" />
          <button
            onClick={onClose}
            className="absolute right-4 flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4 text-gray-800" />
          </button>
        </div>

        <div className="px-5 pt-4 pb-3 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-900">라이브 상품 ({safeProducts.length}개)</h3>
          <p className="text-sm text-gray-500 mt-1">상품을 선택해서 구매하세요</p>
        </div>

        <div className="px-5 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 border-3 border-gray-300 border-t-gray-900 rounded-full animate-spin" />
            </div>
          ) : safeProducts.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingBag className="h-12 w-12 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">등록된 상품이 없습니다</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">{safeProducts.map((product) => {
                const isCurrentProduct = product.id === currentProductId
                const isOutOfStock = product.stock !== undefined && product.stock === 0
                const discount = product.original_price && product.original_price > product.price
                  ? Math.round(((product.original_price - product.price) / product.original_price) * 100)
                  : 0

                return (
                  <button
                    key={product.id}
                    onClick={() => !isOutOfStock && onSelectProduct(product)}
                    disabled={isOutOfStock}
                    className={`relative flex items-center gap-4 bg-white rounded-2xl overflow-hidden p-4 transition-all duration-200 ${
                      isOutOfStock
                        ? 'opacity-60 cursor-not-allowed'
                        : isCurrentProduct
                        ? 'ring-4 ring-red-500 shadow-xl shadow-red-500/30 active:scale-[0.98]'
                        : 'hover:shadow-lg border border-gray-200 active:scale-[0.98]'
                    }`}
                  >
                    {isOutOfStock && (
                      <div className="absolute inset-0 bg-black/40 z-20 flex items-center justify-center">
                        <div className="bg-gray-900 text-white px-4 py-2 rounded-lg font-bold text-sm">
                          품절
                        </div>
                      </div>
                    )}

                    {isCurrentProduct && !isOutOfStock && (
                      <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 bg-red-600 px-2.5 py-1 rounded-full shadow-lg">
                        <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                        <span className="text-white font-bold text-[10px] tracking-wider">LIVE</span>
                      </div>
                    )}

                    <div className="relative h-20 w-20 shrink-0 rounded-xl bg-gray-100 overflow-hidden">
                      <img
                        src={product.image_url || product.image || sheetStream?.thumbnail_url || (sheetStream?.youtube_video_id ? `https://img.youtube.com/vi/${sheetStream.youtube_video_id}/maxresdefault.jpg` : '')}
                        alt={product.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const img = e.target as HTMLImageElement
                          const fallback = sheetStream?.thumbnail_url || (sheetStream?.youtube_video_id ? `https://img.youtube.com/vi/${sheetStream.youtube_video_id}/maxresdefault.jpg` : '')
                          if (fallback && img.src !== fallback) {
                            img.src = fallback
                          }
                        }}
                      />
                      {discount > 0 && (
                        <div className="absolute top-1 right-1 bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-md">
                          -{discount}%
                        </div>
                      )}
                    </div>

                    <div className="flex-1 text-left">
                      <h4 className="text-base font-bold text-gray-900 line-clamp-2 mb-2">
                        {product.name}
                      </h4>
                      <div className="flex items-baseline gap-2">
                        <span className="text-xl font-extrabold text-gray-900">
                          ₩{(product.price || 0).toLocaleString()}
                        </span>
                        {product.original_price && product.original_price > product.price && (
                          <span className="text-sm text-gray-400 line-through">
                            ₩{product.original_price.toLocaleString()}
                          </span>
                        )}
                      </div>
                      {product.stock !== undefined && (
                        <p className="text-sm text-gray-500 mt-1">
                          재고: {product.stock}개
                        </p>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ReelCard Component
function ReelCard({ 
  reel, 
  isActive, 
  isCurrentProduct = false 
}: { 
  reel: ReelData
  isActive: boolean
  isCurrentProduct?: boolean 
}) {
  const navigate = useNavigate()
  const { showAlert } = useModal()
  const [productListSheetOpen, setProductListSheetOpen] = useState(false)
  const [streamProducts, setStreamProducts] = useState<Product[]>([])
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [chatModalOpen, setChatModalOpen] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const playerRef = useRef<YTPlayer | null>(null)
  // Check if user came from homepage or direct link
  const [isDirectLink, setIsDirectLink] = useState(false)
  const [playerReady, setPlayerReady] = useState(false)
  const [showPlayButton, setShowPlayButton] = useState(true)
  const [isMuted, setIsMuted] = useState(true) // Start muted for autoplay
  
  // Cart & Purchase state
  const [addingToCart, setAddingToCart] = useState(false)
  const [checkingOut, setCheckingOut] = useState(false)
  const [showNotification, setShowNotification] = useState(false)
  const [notificationText, setNotificationText] = useState('')
  const [currentProduct, setCurrentProduct] = useState<Product | null>(reel.product)
  const [isLoggedIn, setIsLoggedIn] = useState(!!getUserId())
  
  // Chat input
  const [chatMessage, setChatMessage] = useState('')
  const [sendingMessage, setSendingMessage] = useState(false)
  const [lastMessageTime, setLastMessageTime] = useState(0)
  
  // Destructure reel first (MUST be before any usage)
  const { product, stream } = reel
  
  // Seller control (now safe to use stream)
  const [changingProduct, setChangingProduct] = useState(false)
  const userId = getUserId()
  const userType = localStorage.getItem('user_type')
  const isSeller = userType === 'seller' && userId && stream.seller_id === parseInt(userId)
  
  // Toast notification state
  const [productChangeToast, setProductChangeToast] = useState<string | null>(null)

  // Donation effects
  const [donationEffects, setDonationEffects] = useState<Array<{ id: string; donorName: string; amount: number; message: string }>>([])

  // ── 후원 모달 상태 ──
  const [donationModal, setDonationModal] = useState(false)
  const [donationAmount, setDonationAmount] = useState(5000)
  const [donationMessage, setDonationMessage] = useState('')
  const [donationAnonymous, setDonationAnonymous] = useState(false)
  const [donating, setDonating] = useState(false)
  // 2단계 결제: step 1 = 금액/메시지, step 2 = 토스 위젯
  const [donationStep, setDonationStep] = useState<1 | 2>(1)
  const [donationOrderData, setDonationOrderData] = useState<{ orderId: string; amount: number; orderName: string } | null>(null)
  const paymentWidgetRef = useRef<any>(null)
  
  // Handle null product case
  const safeProduct = (product || {
    name: stream.title || '상품 정보 없음',
    // ✅ 이미지 없을 때: undefined로 두어 배경 이미지 비활성화
    image: undefined,
    price: 0,
    originalPrice: 0
  }) as Product
  
  // 🔥 DO WebSocket 기반 실시간 채팅 + 스트림 상태
  const {
    messages: chatMessages,
    isConnected: chatConnected,
    error: chatError,
    sendMessage: sendChatMessage,
    streamData: wsStreamData,
    lastDonation,
  } = useLiveStreamWebSocket(stream.id, true)

  // Handle incoming donation events from WebSocket
  useEffect(() => {
    if (!lastDonation) return
    const effectId = `don-${Date.now()}`
    setDonationEffects(prev => [...prev, {
      id: effectId,
      donorName: lastDonation.donorName,
      amount: lastDonation.amount,
      message: lastDonation.message,
    }])
    // Auto-remove after 5 seconds
    const timer = setTimeout(() => {
      setDonationEffects(prev => prev.filter(d => d.id !== effectId))
    }, 5000)
    return () => clearTimeout(timer)
  }, [lastDonation])

  // YouTube Player Integration
  useEffect(() => {
    // Initialize player for all reels (not just active one)
    // isActive check removed - this fixes YouTube video not playing issue
    if (!stream.youtube_video_id) return

    let player: YTPlayer | null = null
    let isMounted = true

    const initializePlayer = () => {
      try {
        log.debug(`[ReelCard] Initializing player for stream ${stream.id}:`, stream.youtube_video_id)
        // @ts-ignore
        if (!window.YT || !window.YT.Player) {
          log.debug(`[ReelCard] YouTube API not ready for stream ${stream.id}`)
          return
        }
        if (!isMounted) {
          log.debug(`[ReelCard] Component unmounted for stream ${stream.id}`)
          return
        }

        const playerElement = document.getElementById(`youtube-player-${stream.id}`)
        if (!playerElement) {
          log.debug(`[ReelCard] Player element not found for stream ${stream.id}`)
          return
        }

        log.debug(`[ReelCard] Creating YouTube player for stream ${stream.id}`)
        playerElement.innerHTML = ''

        // @ts-ignore
        player = new window.YT.Player(`youtube-player-${stream.id}`, {
          height: '100%',
          width: '100%',
          videoId: stream.youtube_video_id,
          playerVars: {
            autoplay: 0, // Don't autoplay (user must click)
            mute: 1,
            controls: 0,
            modestbranding: 1,
            rel: 0,
            showinfo: 0,
            iv_load_policy: 3,
            playsinline: 1,
            enablejsapi: 1,
            loop: 1,
            playlist: stream.youtube_video_id,
            fs: 0,
            cc_load_policy: 0,
            origin: window.location.origin, // ✅ CORS 에러 방지
          },
          events: {
            onReady: (event: YTPlayerEvent) => {
              if (!isMounted) return
              log.debug(`[ReelCard] YouTube Player ready for stream ${stream.id}:`, stream.youtube_video_id)
              playerRef.current = event.target
              setPlayerReady(true)
              setShowPlayButton(true) // Show play button overlay
            },
            onStateChange: (event: YTPlayerEvent) => {
              if (!isMounted) return
              try {
                // @ts-ignore
                if (event.data === window.YT.PlayerState.PLAYING) {
                  setShowPlayButton(false)
                } else if (event.data === window.YT.PlayerState.PAUSED) {
                  setShowPlayButton(true)
                }
              } catch (e) {
                // Suppress postMessage errors
              }
            },
            onError: (event: YTPlayerEvent) => {
              if (!isMounted) return
              console.error(`[ReelCard] YouTube player error for video ${stream.youtube_video_id}:`, event.data)
              // Error codes: 2=invalid ID, 5=HTML5 error, 100=not found, 101/150=embedding disabled
              setShowPlayButton(true)
            },
          },
        })
      } catch (error) {
        // Only log critical errors, suppress postMessage
        if (error instanceof Error && !error.message.includes('postMessage')) {
          console.error('[ReelCard] YouTube player error:', error.message)
        }
      }
    }

    // @ts-ignore
    if (window.YT && window.YT.Player) {
      log.debug(`[ReelCard] YouTube API already loaded, initializing stream ${stream.id}`)
      initializePlayer()
    } else {
      log.debug(`[ReelCard] YouTube API not loaded, queueing callback for stream ${stream.id}`)
      const existingScript = document.querySelector('script[src*="youtube.com/iframe_api"]')
      if (!existingScript) {
        log.debug('[ReelCard] Loading YouTube IFrame API script')
        const tag = document.createElement('script')
        tag.src = 'https://www.youtube.com/iframe_api'
        tag.async = true
        const firstScriptTag = document.getElementsByTagName('script')[0]
        firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag)
      }

      // Store callback in array to support multiple reels
      // @ts-ignore
      if (!window.youtubeCallbacks) {
        log.debug('[ReelCard] Creating YouTube callbacks array')
        // @ts-ignore
        window.youtubeCallbacks = []
        // @ts-ignore
        window.onYouTubeIframeAPIReady = () => {
          log.debug('[ReelCard] YouTube IFrame API ready, executing callbacks:', window.youtubeCallbacks.length)
          // @ts-ignore
          window.youtubeCallbacks.forEach(cb => cb())
          // @ts-ignore
          window.youtubeCallbacks = []
        }
      }
      // @ts-ignore
      window.youtubeCallbacks.push(() => {
        log.debug(`[ReelCard] Executing queued callback for stream ${stream.id}`)
        if (isMounted) initializePlayer()
      })
    }

    return () => {
      isMounted = false
      if (player && typeof player.destroy === 'function') {
        try {
          player.destroy()
        } catch (error) {
          // Suppress cleanup errors
        }
      }
    }
  }, [stream.youtube_video_id, stream.id])  // isActive removed from dependencies

  // Cleanup: Pause video when component unmounts or becomes inactive
  useEffect(() => {
    return () => {
      if (playerRef.current && !isActive) {
        try {
          playerRef.current.pauseVideo()
          log.debug(`[ReelCard] Paused video for stream ${stream.id} (inactive)`)
        } catch (e) {
          // Ignore errors
        }
      }
    }
  }, [isActive, stream.id])

  // Pause video when no longer active
  useEffect(() => {
    if (!isActive && playerRef.current && playerReady) {
      try {
        playerRef.current.pauseVideo()
        setShowPlayButton(true)
        log.debug(`[ReelCard] Paused video for stream ${stream.id} (not active)`)
      } catch (e) {
        // Ignore errors
      }
    }
  }, [isActive, playerReady, stream.id])
  
  // Handle video click to unmute and play
  const handleVideoClick = () => {
    if (playerRef.current && playerReady) {
      try {
        // Unmute and play for better UX
        playerRef.current.unMute()
        playerRef.current.setVolume(100)
        playerRef.current.playVideo()
        setIsMuted(false)
        setShowPlayButton(false)
        log.debug('[ReelCard] Video started with audio enabled')
      } catch (error) {
        log.error('[ReelCard] Failed to start video:', error)
      }
    }
  }

  // ============================================
  // Real-time Product Updates via DO WebSocket + D1 polling
  // ============================================

  // D1 폴링 기반 재고 모니터링 (Firebase 제거, 5초 주기)
  const { productData: polledProduct } = useProductStock(currentProduct?.id || null)

  // WebSocket에서 상품 변경 감지 시 UI 업데이트
  useEffect(() => {
    if (!wsStreamData) return

    const newProductId = wsStreamData.current_product_id

    if (newProductId && newProductId !== currentProduct?.id) {
      const loadNewProduct = async () => {
        try {
          const response = await axios.get(`/api/streams/${stream.id}/current-product`)
          if (response.data.success && response.data.data) {
            const newProduct = response.data.data
            if (!newProduct) return
            setCurrentProduct(newProduct)

            if (!isSeller && newProduct?.name) {
              setProductChangeToast(`🎁 새로운 상품: ${newProduct.name}`)
            }

            log.debug(`[WS] Product changed to ${newProduct.name}`)
          }
        } catch (error) {
          console.error('[WS] Error loading new product:', error)
        }
      }

      loadNewProduct()
    }
  }, [wsStreamData?.current_product_id, stream.id, isSeller])

  // D1 폴링에서 재고 변경 감지 시 UI 업데이트
  useEffect(() => {
    if (!polledProduct || !currentProduct) return

    if (polledProduct.stock !== currentProduct.stock) {
      setCurrentProduct(prev => {
        if (!prev) return prev
        return { ...prev, stock: polledProduct.stock }
      })

      log.debug(`[Stock] Stock updated to ${polledProduct.stock}`)

      if (polledProduct.stock === 0) {
        setProductChangeToast(`🔴 ${polledProduct.name}이(가) 품절되었습니다!`)
      } else if (polledProduct.stock <= 5 && polledProduct.stock > 0) {
        setProductChangeToast(`⚠️ ${polledProduct.name} 재고가 ${polledProduct.stock}개 남았습니다!`)
      }
    }
  }, [polledProduct?.stock, currentProduct?.id])

  // 초기 상품 로드: 전체 상품 데이터(stock, originalPrice 등)를 DB에서 가져옴
  // ✅ currentProduct 조건 제거 - stream 목록 API의 current_product는 일부 필드만 포함하므로 항상 전체 로드
  useEffect(() => {
    if (!stream.id) return

    const loadInitialProduct = async () => {
      try {
        const response = await axios.get(`/api/streams/${stream.id}/current-product`)
        if (response.data.success && response.data.data) {
          setCurrentProduct(response.data.data)
          log.debug('✅ Initial product loaded (full data)')
        } else if (response.data.success && !response.data.data) {
          // current_product_id가 null → 상품 없음 상태로 명시적 초기화
          setCurrentProduct(null)
        }
      } catch (error) {
        console.error('[InitialProduct] Error loading:', error)
      }
    }

    loadInitialProduct()
  }, [stream.id])

  // ============================================
  // Mask Username Helper
  // ============================================
  function maskUserName(name: string): string {
    if (!name || name.length === 0) return '익명'
    if (name === '익명' || name === 'Anonymous') return name
    
    if (name.length === 1) {
      return name + '*'
    } else if (name.length === 2) {
      return name[0] + '*'
    } else if (name.length === 3) {
      return name[0] + '*' + name[2]
    } else {
      return name[0] + '*'.repeat(name.length - 2) + name[name.length - 1]
    }
  }

  // ============================================
  // Kakao Login Handler
  // ============================================
  async function handleKakaoLogin() {
    try {
      localStorage.setItem('loginReturnUrl', window.location.pathname)
      navigate('/login?returnUrl=' + encodeURIComponent(window.location.pathname))
    } catch (error) {
      console.error('[Login] Exception:', error)
      showAlert('로그인 페이지로 이동 중 오류가 발생했습니다.', 'error', '오류 발생')
    }
  }

  // ============================================
  // Add to Cart Handler
  // ============================================
  async function handleAddToCart() {
    if (!currentProduct) return
    if (addingToCart) return // Prevent double-click
    
    // Check stock
    if (currentProduct.stock === 0) {
      setNotificationText('품절된 상품입니다')
      setShowNotification(true)
      setTimeout(() => setShowNotification(false), 2000)
      return
    }

    // Check login first
    if (!isLoggedIn) {
      // Save temp cart item
      const tempCart = {
        productId: currentProduct.id,
        quantity: 1,
        priceSnapshot: currentProduct.price,
        liveStreamId: stream.id,
        productName: currentProduct.name,
        timestamp: Date.now()
      }
      localStorage.setItem('tempCartItem', JSON.stringify(tempCart))
      localStorage.setItem('loginReturnUrl', window.location.pathname)
      
      showAlert('로그인이 필요합니다!', 'warning', '로그인 필요')
      handleKakaoLogin()
      return
    }

    setAddingToCart(true)
    try {
      const userId = getUserId()
      
      log.debug('[handleAddToCart] 🛒 Starting add to cart:', {
        userId,
        productId: currentProduct.id,
        productName: currentProduct.name,
        stock: currentProduct.stock
      })
      
      if (!userId) {
        localStorage.setItem('loginReturnUrl', window.location.pathname)
        
        const tempCartData = {
          productId: currentProduct.id,
          productName: currentProduct.name,
          quantity: 1,
          priceSnapshot: currentProduct.price,
          liveStreamId: stream.id
        }
        localStorage.setItem('tempCartItem', JSON.stringify(tempCartData))
        
        showAlert('로그인이 필요합니다. 로그인 후 자동으로 장바구니에 담아드립니다.', 'info', '로그인 필요')
        setTimeout(() => {
          window.location.href = '/login'
        }, 1500)
        return
      }
      
      // POST to server (JWT에서 userId 자동 추출)
      const accessToken = useAuthStore.getState().accessToken;
      log.debug('[handleAddToCart] 🔑 Token before API:', accessToken?.substring(0, 20));
      
      if (!accessToken) {
        log.warn('[handleAddToCart] ❌ No token, redirecting to login');
        showAlert('로그인이 필요합니다.', 'warning', '로그인 필요');
        setTimeout(() => navigate('/login'), 1500);
        return;
      }
      
      log.debug('[handleAddToCart] 📡 Calling API /api/cart')
      
      const response = await api.post('/api/cart', {
        product_id: currentProduct.id,
        quantity: 1,
        price_snapshot: currentProduct.price,
        live_stream_id: stream.id,
      })
      
      log.debug('[handleAddToCart] ✅ API response:', response.data)
      
      // Set flag
      localStorage.setItem('hasCartItems', 'true')
      
      // 🎯 장바구니 아이템 추가 이벤트 발생 (아이콘 애니메이션용)
      window.dispatchEvent(new CustomEvent('cartItemAdded'))

      // 🔥 시스템 메시지 전송 (채팅창에 표시)
      const userName = localStorage.getItem('user_name') || '익명'
      const maskedName = maskUserName(userName)
      const systemMsg = `${maskedName}님이 ${currentProduct.name}을(를) 담았습니다!`

      try {
        log.debug('[handleAddToCart] 📢 Sending system message...')
        await sendChatMessage(systemMsg, 0, '🎉 시스템', 'system')
        log.debug('[handleAddToCart] ✅ System message sent successfully')
      } catch (error) {
        // 서버 전송 실패해도 로컬 채팅에 직접 추가 (사용자 본인에게만 보임)
        log.warn('[handleAddToCart] Server send failed, adding local message')
      }
    } catch (error: unknown) {
      console.error('[handleAddToCart] ❌ Error:', error)
      const apiErr = isApiError(error) ? error : undefined
      console.error('[handleAddToCart] ❌ Error details:', {
        status: apiErr?.response?.status,
        statusText: apiErr?.response?.statusText,
        data: apiErr?.response?.data,
        message: apiErr?.message
      })
      const errorMessage = apiErr?.response?.data?.error || apiErr?.message || '장바구니 추가에 실패했습니다.'
      const errorString = typeof errorMessage === 'string' ? errorMessage : JSON.stringify(errorMessage);
      
      if (errorString.includes('Insufficient stock') || errorString.includes('재고가 부족')) {
        setNotificationText('재고가 부족합니다')
        setShowNotification(true)
        setTimeout(() => setShowNotification(false), 2500)
      } else {
        showAlert(errorString, 'error', '장바구니 추가 실패')
      }
    } finally {
      setAddingToCart(false)
    }
  }

  // ============================================
  // Checkout Handler
  // ============================================
  async function handleCheckout() {
    if (checkingOut) return // Prevent double-click
    
    // Check login FIRST
    if (!isLoggedIn) {
      showAlert('로그인이 필요합니다!', 'warning', '로그인 필요')
      handleKakaoLogin()
      return
    }
    
    // ✅ 현재 상품이 없으면 담기 불가
    if (!currentProduct) {
      showAlert('판매 중인 상품이 없습니다.', 'info', '상품 없음')
      return
    }
    
    setCheckingOut(true)
    try {
      const userId = getUserId()
      
      if (!userId) {
        localStorage.setItem('loginReturnUrl', window.location.pathname)
        showAlert('로그인이 필요합니다.', 'warning', '로그인 필요')
        setCheckingOut(false)
        setTimeout(() => {
          window.location.href = '/login'
        }, 1500)
        return
      }
      
      // ✅ 먼저 현재 상품을 장바구니에 추가
      const accessToken = useAuthStore.getState().accessToken;
      log.debug('[Checkout] 🔑 Token before checkout:', accessToken?.substring(0, 20));
      
      if (!accessToken) {
        log.warn('[Checkout] ❌ No token');
        showAlert('로그인이 필요합니다.', 'warning', '로그인 필요');
        setCheckingOut(false);
        setTimeout(() => navigate('/login'), 1500);
        return;
      }

      const cartData = {
        product_id: currentProduct.id,
        quantity: 1,
        price_snapshot: currentProduct.price,
        live_stream_id: stream.id,
      }
      
      log.debug('[Checkout] Adding current product to cart:', cartData)
      
      await api.post('/api/cart', cartData)
      localStorage.setItem('hasCartItems', 'true')
      
      // 🎯 장바구니 아이템 추가 이벤트 발생
      window.dispatchEvent(new CustomEvent('cartItemAdded'))
      
      // ✅ 결제 페이지로 바로 이동
      log.debug('[Checkout] Navigating to checkout')
      navigate('/checkout')
      
    } catch (error: unknown) {
      console.error('Failed to add product to cart:', error)
      const apiErr = isApiError(error) ? error : undefined
      const errorMessage = apiErr?.response?.data?.error || apiErr?.message || '상품 담기에 실패했습니다.'
      showAlert(errorMessage, 'error', '결제 실패')
    } finally {
      setCheckingOut(false)
    }
  }

  // ============================================
  // Load Stream Products
  // ============================================
  async function loadStreamProducts() {
    if (loadingProducts || streamProducts.length > 0) return
    
    setLoadingProducts(true)
    try {
      const response = await api.get(`/api/streams/${stream.id}/products`)
      if (response.data.success) {
        const products = response.data.data || []
        // Sort: current product first, then others
        const sorted = products.sort((a: Product, b: Product) => {
          if (a.id === stream.current_product_id) return -1
          if (b.id === stream.current_product_id) return 1
          return 0
        })
        setStreamProducts(sorted)
      }
    } catch (error) {
      console.error('Failed to load stream products:', error)
    } finally {
      setLoadingProducts(false)
    }
  }

  // ============================================
  // Open Product List Sheet
  // ============================================
  function openProductListSheet() {
    loadStreamProducts()
    setProductListSheetOpen(true)
  }

  // ============================================
  // Seller: Change Current Product
  // ============================================
  async function handleChangeProduct() {
    if (!isSeller || !product || changingProduct) return

    setChangingProduct(true)
    try {
      await api.post(`/api/seller/streams/${stream.id}/change-product`, {
        productId: product.id
      })

      // Show success notification
      setNotificationText('✅ 이 상품을 지금 소개 중입니다!')
      setShowNotification(true)
      setTimeout(() => setShowNotification(false), 2000)

      log.debug('[Seller] Product changed successfully to:', product.id)
    } catch (error: unknown) {
      console.error('[Seller] Failed to change product:', error)
      const apiErr = isApiError(error) ? error : undefined
      showAlert(apiErr?.response?.data?.error || '상품 전환에 실패했습니다.', 'error', '전환 실패')
    } finally {
      setChangingProduct(false)
    }
  }

  // ============================================
  // 후원 처리 — Step 1: init API → 위젯 초기화 → Step 2로 이동
  // ============================================
  async function handleDonationStep1() {
    if (!isLoggedIn) { showAlert('로그인 후 후원하실 수 있습니다.', 'info', '로그인 필요'); return }
    if (donationAmount < 1000 || donationAmount % 100 !== 0) {
      toast.error('후원 금액은 최소 1,000원이며 100원 단위여야 합니다')
      return
    }
    setDonating(true)
    try {
      const token = localStorage.getItem('access_token') || localStorage.getItem('token')
      const initRes = await api.post('/api/donations/init', {
        stream_id: stream.id,
        amount: donationAmount,
        message: donationMessage || undefined,
        is_anonymous: donationAnonymous,
      }, { headers: token ? { Authorization: `Bearer ${token}` } : {} })

      if (!initRes.data.success) { toast.error(initRes.data.error); return }
      const { orderId, amount, orderName, clientKey } = initRes.data.data
      if (!clientKey) { toast.error('결제 설정을 불러올 수 없습니다'); return }

      // PaymentWidget v1 (gck_ 키)
      const userId = getUserId()
      const customerKey = userId ? `user_${userId}` : (window as any).PaymentWidget?.ANONYMOUS ?? '__anonymous__'
      const widget = (window as any).PaymentWidget(clientKey, customerKey)
      paymentWidgetRef.current = widget
      setDonationOrderData({ orderId, amount, orderName })
      setDonationStep(2) // useEffect가 위젯 렌더링 실행
    } catch (err: any) {
      toast.error(err?.message || '결제 준비 중 오류가 발생했습니다')
    } finally { setDonating(false) }
  }

  // Step 2에서 위젯 렌더링 (DOM이 준비된 후)
  useEffect(() => {
    if (donationStep !== 2 || !paymentWidgetRef.current || !donationOrderData) return
    const widget = paymentWidgetRef.current
    Promise.all([
      widget.renderPaymentMethods('#toss-donation-methods', { value: donationOrderData.amount, currency: 'KRW' }),
      widget.renderAgreement('#toss-donation-agreement'),
    ]).catch((err: any) => {
      console.error('[Donation] widget render error:', err)
      toast.error('결제창 로드에 실패했습니다. 다시 시도해주세요.')
      setDonationStep(1)
      paymentWidgetRef.current = null
    })
  }, [donationStep, donationOrderData])

  // Step 2: 결제 최종 요청
  async function handleDonationConfirm() {
    if (!paymentWidgetRef.current || !donationOrderData) return
    setDonating(true)
    try {
      await paymentWidgetRef.current.requestPayment({
        orderId: donationOrderData.orderId,
        orderName: donationOrderData.orderName,
        successUrl: `${window.location.origin}/live/${stream.id}?donation=success&orderId=${donationOrderData.orderId}&amount=${donationOrderData.amount}`,
        failUrl: `${window.location.origin}/live/${stream.id}?donation=fail`,
      })
    } catch (err: any) {
      if (err?.code !== 'USER_CANCEL') toast.error(err?.message || '결제 중 오류가 발생했습니다')
    } finally { setDonating(false) }
  }

  function closeDonationModal() {
    setDonationModal(false)
    setDonationStep(1)
    setDonationOrderData(null)
    paymentWidgetRef.current = null
  }

  // 후원 결제 완료 리다이렉트 처리
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const donation = params.get('donation')
    const paymentKey = params.get('paymentKey')
    const orderId = params.get('orderId')
    const amount = params.get('amount')
    if (donation === 'success' && paymentKey && orderId && amount) {
      window.history.replaceState({}, '', window.location.pathname)
      const token = localStorage.getItem('access_token') || localStorage.getItem('token')
      api.post('/api/donations/confirm', {
        paymentKey, orderId, amount: Number(amount),
        stream_id: stream.id,
        message: donationMessage || undefined,
        is_anonymous: donationAnonymous,
      }, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
        .then(res => {
          if (res.data.success) toast.success(res.data.message || '후원이 완료되었습니다!')
          else toast.error(res.data.error || '후원 처리에 실패했습니다')
        })
        .catch(() => toast.error('후원 처리에 실패했습니다'))
    } else if (donation === 'fail') {
      window.history.replaceState({}, '', window.location.pathname)
      toast.error('후원이 취소되었습니다')
    }
  }, [])

  // ============================================
  // Send Chat Message (with throttling)
  // ============================================
  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!chatMessage.trim() || sendingMessage) return

    // 도배 방지: 1초에 1회 제한
    const now = Date.now()
    if (now - lastMessageTime < 1000) {
      showAlert('메시지를 너무 빠르게 보내고 있습니다. 잠시 후 다시 시도해주세요.', 'warning', '도배 방지')
      return
    }

    setSendingMessage(true)
    try {
      const userId = getUserId()
      if (!userId) {
        showAlert('로그인이 필요합니다.', 'warning', '로그인 필요')
        setSendingMessage(false)
        return
      }

      const rawUserName = localStorage.getItem('user_name') || '익명'
      const maskedChatName = maskUserName(rawUserName)

      // 호환성: claims.userId (숫자 ID) 사용, 없으면 0 (Anonymous)
      const numericUserId = parseInt(localStorage.getItem('numeric_user_id') || '0', 10) || 0;

      // 🔥 SSE 기반 메시지 전송 (닉네임 마스킹 적용: 정종문 → 정*문)
      await sendChatMessage(
        chatMessage.trim(),
        numericUserId, // 숫자 ID 사용
        maskedChatName,
        'viewer'
      )

      // 마지막 메시지 시간 업데이트
      setLastMessageTime(now)
      setChatMessage('')
      setChatModalOpen(false)
    } catch (error) {
      console.error('Failed to send message:', error)
      showAlert('메시지 전송에 실패했습니다.', 'error', '전송 실패')
    } finally {
      setSendingMessage(false)
    }
  }

  return (
    <div className="relative h-full w-full snap-start snap-always overflow-hidden bg-black">
      {/* 🎉 상품 변경 Toast 알림 */}
      {productChangeToast && (
        <Toast
          message={productChangeToast}
          type="info"
          onClose={() => setProductChangeToast(null)}
          duration={3000}
        />
      )}
      
      {/* LIVE Badge - 셀러가 자신의 스트림을 보고 있고, 현재 소개 중인 상품일 때만 표시 */}
      {isCurrentProduct && isSeller && (
        <div className="absolute top-20 left-4 z-[101] flex items-center gap-2 bg-gradient-to-r from-purple-600 to-pink-600 px-3 py-1.5 rounded-full shadow-2xl">
          <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
          <span className="text-white font-bold text-[11px] tracking-wide">소개 중</span>
        </div>
      )}
      
      {/* 배경 레이어: YouTube 썸네일 → 그라데이션 폴백 (순서대로) */}
      {stream.youtube_video_id ? (
        <img
          src={`https://img.youtube.com/vi/${stream.youtube_video_id}/maxresdefault.jpg`}
          alt=""
          className="absolute inset-0 h-full w-full object-cover -z-10"
          onError={(e) => {
            // maxresdefault 실패 시 hqdefault로 폴백
            const img = e.currentTarget
            if (!img.src.includes('hqdefault')) {
              img.src = `https://img.youtube.com/vi/${stream.youtube_video_id}/hqdefault.jpg`
            } else {
              img.style.display = 'none'
            }
          }}
        />
      ) : null}
      <div className="absolute inset-0 h-full w-full bg-gradient-to-br from-gray-900 via-gray-800 to-black -z-20" />

      {/* YouTube Player Container */}
      {/* ✅ 세로 화면에서 16:9 영상이 cover 모드로 채워지도록 iframe CSS 강제 적용
           YouTube IFrame API는 style="width:100%;height:100%"를 인라인으로 설정하므로 !important 필요 */}
      <div
        id={`youtube-player-${stream.id}`}
        className="absolute inset-0 w-full h-full z-[5] [&_iframe]:!absolute [&_iframe]:!top-1/2 [&_iframe]:!left-1/2 [&_iframe]:!-translate-x-1/2 [&_iframe]:!-translate-y-1/2 [&_iframe]:!h-full [&_iframe]:!w-auto [&_iframe]:!aspect-video"
      />

      {/* 로딩 → 입장 버튼 → 재생 중 (3단계 상태 관리) */}
      {showPlayButton && (
        <button
          onClick={playerReady ? handleVideoClick : undefined}
          className={`absolute inset-0 z-10 flex flex-col items-center justify-center transition-all ${
            playerReady
              ? 'bg-black/40 backdrop-blur-[2px] cursor-pointer'
              : 'bg-black/60 cursor-default'
          }`}
          aria-label="방송 입장하기"
          disabled={!playerReady}
        >
          <div className="flex flex-col items-center gap-4">
            {/* Live Badge */}
            <div className="px-4 py-1.5 bg-red-600 rounded-full flex items-center gap-2">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
              <span className="text-white text-sm font-bold">LIVE</span>
            </div>

            {playerReady ? (
              <>
                {/* 준비 완료: 재생 버튼 */}
                <svg className="w-16 h-16 text-white drop-shadow-2xl transition-all hover:scale-110 active:scale-95" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
                <div className="text-center px-6">
                  <p className="text-white text-xl font-bold mb-1.5">방송 입장하기</p>
                  <p className="text-white/80 text-sm">탭하여 라이브 시청 시작</p>
                </div>
              </>
            ) : (
              <>
                {/* 로딩 중: 스피너 */}
                <div className="w-12 h-12 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                <p className="text-white/80 text-sm">방송 준비 중...</p>
              </>
            )}
          </div>
        </button>
      )}

      {/* Subtle top vignette */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-transparent pointer-events-none" />

      {/* Product overlay */}
      <div className="pointer-events-none absolute inset-0 z-10 flex flex-col">
        {/* Bottom gradient */}
        <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

        {/* Donation effects overlay */}
        <DonationEffect donations={donationEffects} />

        {/* Spacer pushes content to bottom */}
        <div className="flex-1" />

        {/* Content area */}
        <div className="pointer-events-auto relative flex flex-col px-4 pb-3">
          {/* Chat + action icons row */}
          <div className="flex items-end gap-3 mb-2.5">
            {/* Live chat feed - left side, wide */}
            <div className="min-w-0 flex-1">
              <LiveChat messages={chatMessages} onChatClick={() => setChatModalOpen(true)} />
            </div>

            {/* Chat + Donate + Share buttons - right side */}
            <div className="flex flex-col items-center gap-2.5 shrink-0 pb-1 mr-1">
              <button
                onClick={() => setChatModalOpen(true)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm transition-all active:scale-90"
                aria-label="Chat"
              >
                <MessageCircle className="h-5 w-5 text-white/90" />
              </button>
              <button
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm transition-all active:scale-90"
                aria-label="Share"
                onClick={() => {
                  if (navigator.share) {
                    navigator.share({ title: safeProduct.name, url: window.location.href })
                  } else {
                    navigator.clipboard?.writeText(window.location.href)
                    setNotificationText('링크가 복사되었습니다!')
                    setShowNotification(true)
                    setTimeout(() => setShowNotification(false), 2000)
                  }
                }}
              >
                <Share2 className="h-5 w-5 text-white/90" />
              </button>

              {/* 후원하기 버튼 */}
              {!isSeller && (
                <button
                  onClick={() => setDonationModal(true)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-gradient-to-r from-pink-500 to-rose-500 text-white text-xs font-bold shadow-lg shadow-pink-500/30 active:scale-95 transition-all"
                >
                  <Heart className="h-3.5 w-3.5 fill-white" />
                  후원
                </button>
              )}
            </div>
          </div>

          {/* Unified bottom bar: product info + basket + buy */}
          <div className="flex items-center gap-1.5 w-full rounded-2xl bg-black/40 backdrop-blur-xl px-3 py-2 border border-white/[0.08]">
            
            {/* Product info - left side - 클릭 비활성화 */}
            <div
              className="flex flex-col items-start min-w-0 flex-1 text-left animate-fade-in"
              key={currentProduct?.id || 'default'}
            >
              <h3 className="text-[13px] font-bold text-white leading-tight truncate w-full drop-shadow-lg">
                {safeProduct.name}
              </h3>
              <div className="flex items-baseline gap-1.5 mt-0.5">
                <span className="text-[14px] font-extrabold text-red-400 drop-shadow-md">
                  ₩{(safeProduct.price || 0).toLocaleString()}
                </span>
                {(safeProduct.originalPrice || safeProduct.original_price) && (
                  <span className="text-[10px] text-white/40 line-through">
                    ₩{(safeProduct.originalPrice || safeProduct.original_price || 0).toLocaleString()}
                  </span>
                )}
              </div>
            </div>

            {/* Basket button - Opens product list */}
            <button
              onClick={handleAddToCart}
              disabled={!product || addingToCart}
              className={`flex items-center gap-1 shrink-0 rounded-lg bg-white/10 px-2 py-1.5 transition-all active:scale-95 ${
                !product || addingToCart ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              aria-label="Add to cart"
            >
              <ShoppingBag className="h-3.5 w-3.5 text-white/80" />
              <span className="text-[11px] font-bold text-white/90">
                {addingToCart ? '추가 중...' : '담기'}
              </span>
            </button>

            {/* Seller: Change Product Button - 셀러는 "구매하기" 대신 "상품 변경" 버튼 표시 */}
            {isSeller && product ? (
              <button
                onClick={handleChangeProduct}
                disabled={changingProduct || isCurrentProduct}
                className={`shrink-0 rounded-lg px-3.5 py-1.5 text-[12px] font-extrabold transition-all active:scale-95 ${
                  isCurrentProduct
                    ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/30 cursor-default'
                    : changingProduct
                    ? 'bg-gray-500/50 text-white/50 opacity-50 cursor-not-allowed'
                    : 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/30 hover:shadow-xl'
                }`}
                aria-label="Change to this product"
              >
                {changingProduct ? '⏳ 전환 중...' : isCurrentProduct ? '✅ 소개 중' : '🔄 변경하기'}
              </button>
            ) : (
              /* Buy button - 일반 유저만 "구매하기" 버튼 표시 */
              <button
                onClick={() => {
                  if (currentProduct) {
                    handleCheckout() // 직접 결제 처리
                  } else {
                    showAlert('판매 중인 상품이 없습니다.', 'info', '상품 없음')
                  }
                }}
                disabled={!product}
                className={`shrink-0 rounded-lg bg-red-500 px-3.5 py-1.5 text-[12px] font-extrabold text-white shadow-lg shadow-red-500/30 transition-all active:scale-95 ${
                  !product ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                구매하기
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Product List Sheet */}
      {productListSheetOpen && (
        <div className="pointer-events-auto">
          <ProductListSheet
            products={streamProducts}
            currentProductId={stream.current_product_id || null}
            stream={stream}
            onClose={() => setProductListSheetOpen(false)}
            onSelectProduct={(selectedProduct) => {
              setProductListSheetOpen(false)
              setCurrentProduct(selectedProduct)
              // 모달 열기 대신 바로 장바구니 추가
              handleAddToCart()
            }}
            loading={loadingProducts}
          />
        </div>
      )}

      {/* Toast Notification */}
      {showNotification && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[100] animate-fade-in">
          <div className="rounded-xl bg-black/90 backdrop-blur-md px-5 py-3 text-sm font-bold text-white shadow-2xl border border-white/10">
            {notificationText}
          </div>
        </div>
      )}

      {/* Chat Modal */}
      {chatModalOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm animate-overlay-in"
            onClick={() => setChatModalOpen(false)}
          />
          
          {/* Chat Input Sheet */}
          <div className="fixed inset-x-0 bottom-0 z-[90] bg-white rounded-t-3xl animate-sheet-up">
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">메시지 보내기</h3>
                <button
                  onClick={() => setChatModalOpen(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200"
                >
                  <X className="h-4 w-4 text-gray-800" />
                </button>
              </div>
              
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <input
                  type="text"
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  placeholder="메시지를 입력하세요..."
                  className="flex-1 rounded-xl border border-gray-300 px-4 py-3 text-sm focus:border-red-500 focus:outline-none"
                  disabled={sendingMessage}
                />
                <button
                  type="submit"
                  disabled={!chatMessage.trim() || sendingMessage}
                  className="flex items-center justify-center rounded-xl bg-red-500 px-6 py-3 text-white font-bold transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="h-5 w-5" />
                </button>
              </form>
            </div>
          </div>
        </>
      )}
      {/* 후원 모달 */}
      {donationModal && (
        <>
          <div className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm" onClick={closeDonationModal} />
          <div className="fixed inset-x-0 bottom-0 z-[90] bg-white rounded-t-3xl animate-sheet-up">
            <div className="p-5">
              {/* 헤더 */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  {donationStep === 2 && (
                    <button onClick={() => { setDonationStep(1); paymentWidgetRef.current = null; setDonationOrderData(null) }} className="mr-1 p-1 rounded-full hover:bg-gray-100">
                      <ChevronLeft className="h-5 w-5 text-gray-500" />
                    </button>
                  )}
                  <Heart className="h-5 w-5 text-pink-500 fill-pink-500" />
                  <h3 className="text-lg font-bold text-gray-900">
                    {donationStep === 1 ? `${stream.streamerName || '셀러'} 후원하기` : '결제 방법 선택'}
                  </h3>
                </div>
                <button onClick={closeDonationModal} className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100">
                  <X className="h-4 w-4 text-gray-600" />
                </button>
              </div>

              {donationStep === 1 ? (
                <>
                  {/* 금액 빠른 선택 */}
                  <div className="grid grid-cols-4 gap-2 mb-3">
                    {[1000, 3000, 5000, 10000].map(amt => (
                      <button
                        key={amt}
                        onClick={() => setDonationAmount(amt)}
                        className={`py-2 rounded-xl text-sm font-semibold transition-colors ${
                          donationAmount === amt ? 'bg-pink-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {(amt/1000)}천원
                      </button>
                    ))}
                  </div>
                  {/* 직접 입력 */}
                  <div className="flex items-center gap-2 mb-3">
                    <input
                      type="number"
                      value={donationAmount}
                      onChange={e => setDonationAmount(Math.max(1000, Math.floor(Number(e.target.value) / 100) * 100))}
                      step={100} min={1000}
                      className="flex-1 rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-right focus:border-pink-400 focus:outline-none"
                    />
                    <span className="text-sm text-gray-500 shrink-0">원</span>
                  </div>
                  {/* 메시지 */}
                  <input
                    type="text"
                    placeholder="응원 메시지 (선택)"
                    value={donationMessage}
                    onChange={e => setDonationMessage(e.target.value)}
                    maxLength={50}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm mb-3 focus:border-pink-400 focus:outline-none"
                  />
                  {/* 익명 */}
                  <label className="flex items-center gap-2 mb-4 cursor-pointer">
                    <input type="checkbox" checked={donationAnonymous} onChange={e => setDonationAnonymous(e.target.checked)} className="rounded" />
                    <span className="text-sm text-gray-600">익명으로 후원</span>
                  </label>
                  <button
                    onClick={handleDonationStep1}
                    disabled={donating || donationAmount < 1000}
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 text-white font-bold text-base disabled:opacity-50 active:scale-[0.98] transition-all"
                  >
                    {donating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Heart className="h-5 w-5 fill-white" />}
                    {donationAmount.toLocaleString()}원 결제 방법 선택
                  </button>
                </>
              ) : (
                <>
                  {/* 토스 결제위젯 렌더링 영역 */}
                  <div id="toss-donation-methods" className="mb-3" />
                  <div id="toss-donation-agreement" className="mb-4" />
                  <button
                    onClick={handleDonationConfirm}
                    disabled={donating}
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-gradient-to-r from-pink-500 to-rose-500 text-white font-bold text-base disabled:opacity-50 active:scale-[0.98] transition-all"
                  >
                    {donating ? <Loader2 className="h-5 w-5 animate-spin" /> : <Heart className="h-5 w-5 fill-white" />}
                    {donationOrderData?.amount.toLocaleString()}원 결제하기
                  </button>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ============================================
// Main LivePageV2 Component
// ============================================
export default function LivePageV2() {
  const { streamId } = useParams<{ streamId: string }>()
  const navigate = useNavigate()
  const [activeIndex, setActiveIndex] = useState(0)
  const [reels, setReels] = useState<ReelData[]>([])
  const [loading, setLoading] = useState(true)
  const [isDirectLink, setIsDirectLink] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)
  
  // 스트리머 상품 선택 UI 상태
  const [isStreamer, setIsStreamer] = useState(false)
  const [showProductSelector, setShowProductSelector] = useState(false)
  const [currentStream, setCurrentStream] = useState<Stream | null>(null)
  const [changingProduct, setChangingProduct] = useState(false)
  
  // 실시간 시청자 수
  const [viewerCount, setViewerCount] = useState<number>(0)

  // URL 파라미터에서 로그인 세션 정보 체크 및 localStorage 저장
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const loginSuccess = urlParams.get('login')
    const session = urlParams.get('session')
    const userId = urlParams.get('userId')
    const userName = urlParams.get('userName')

    if (loginSuccess === 'success' && session && userId) {
      log.debug('[LivePageV2] 💾 로그인 성공 - localStorage 저장:', {
        session: session ? '있음' : '없음',
        userId,
        userName: userName ? decodeURIComponent(userName) : null
      })

      // CRITICAL: API 클라이언트가 읽을 수 있도록 올바른 키로 저장
      localStorage.setItem('user_session_token', session)  // ✅ 올바른 키
      localStorage.setItem('user_id', userId)
      
      // user_type은 seller/admin이 아닌 경우에만 user로 설정
      const existingUserType = localStorage.getItem('user_type')
      if (existingUserType !== 'seller' && existingUserType !== 'admin') {
        localStorage.setItem('user_type', 'user')  // ✅ 사용자 타입 저장
      }
      
      if (userName) {
        localStorage.setItem('user_name', decodeURIComponent(userName))
      }

      // 이전 키 제거 (호환성 정리)
      localStorage.removeItem('session')

      // URL 파라미터 제거 (깔끔한 URL 유지)
      urlParams.delete('login')
      urlParams.delete('session')
      urlParams.delete('userId')
      urlParams.delete('userName')
      
      const newSearch = urlParams.toString()
      const newUrl = window.location.pathname + (newSearch ? '?' + newSearch : '')
      window.history.replaceState({}, '', newUrl)

      log.debug('[LivePageV2] ✅ localStorage 저장 완료:', {
        user_session_token: localStorage.getItem('user_session_token') ? '있음' : '없음',
        user_type: localStorage.getItem('user_type'),
        user_id: localStorage.getItem('user_id'),
        user_name: localStorage.getItem('user_name')
      })
    }
  }, [])

  const reelRefs = useCallback((node: HTMLDivElement | null) => {
    if (!node) return
    if (observerRef.current) observerRef.current.observe(node)
  }, [])

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = Number(entry.target.getAttribute('data-index'))
            setActiveIndex(index)
          }
        })
      },
      {
        root: containerRef.current,
        threshold: 0.6,
      }
    )

    return () => observerRef.current?.disconnect()
  }, [])

  // Load reels data - MODIFIED: Check if direct link or from homepage
  useEffect(() => {
    const loadReels = async () => {
      try {
        setLoading(true)

        // Check if user came directly to this URL (not from homepage)
        const referrer = document.referrer
        const isFromHomepage = referrer.includes(window.location.origin) && 
                               (referrer.includes('/') || referrer.includes('/home'))
        const hasStreamId = !!streamId
        
        // Direct link: Show ONLY the requested stream (no scroll)
        // Homepage link: Show ALL streams (with scroll)
        const shouldShowSingleStream = hasStreamId && !isFromHomepage
        setIsDirectLink(shouldShowSingleStream)
        
        log.debug('[LivePageV2] Navigation context:', {
          hasStreamId,
          isFromHomepage,
          shouldShowSingleStream,
          referrer
        })

        // Load streams (single or all based on context)
        let streams: Stream[] = []
        
        if (shouldShowSingleStream && streamId) {
          // DIRECT LINK: Load only the requested stream
          try {
            const singleStreamResponse = await axios.get(`/api/streams/${streamId}`)
            log.debug('[LivePageV2] Single stream API response:', singleStreamResponse.data)
            
            if (singleStreamResponse.data.success && singleStreamResponse.data.data) {
              streams = [singleStreamResponse.data.data]
              log.debug('[LivePageV2] Loaded single stream (direct link)')
            }
          } catch (error) {
            console.error('[LivePageV2] Single stream API failed:', error)
          }
        } else {
          // HOMEPAGE LINK: Load ALL active streams
          try {
            const streamsResponse = await axios.get('/api/streams')
            log.debug('[LivePageV2] All streams API response:', streamsResponse.data)
            
            if (streamsResponse.data.success && streamsResponse.data.data?.length > 0) {
              streams = streamsResponse.data.data
              log.debug('[LivePageV2] Loaded all streams:', streams.length)
            }
          } catch (error) {
            console.error('[LivePageV2] Streams API failed:', error)
            throw error
          }
        }
            
        // Set current stream from URL parameter
        if (streamId) {
          const currentStreamData = streams.find(s => s.id === parseInt(streamId))
          if (currentStreamData) {
            setCurrentStream(currentStreamData)
            
            // Check streamer permission
            const userType = localStorage.getItem('user_type')
            const userId = getUserId()
            if (userType === 'seller' && userId && currentStreamData.seller_id === parseInt(userId)) {
              setIsStreamer(true)
              log.debug('[LivePageV2] 스트리머 권한 확인됨')
            }
          }
        }

        // Create reels: ONE reel per stream (not per product)
        // ✅ current_product_id JOIN 결과(stream.current_product)를 바로 사용하여 더미 이미지 플래시 방지
        // Products 카탈로그는 ReelCard 내부에서 loadStreamProducts()로 지연 로드됨
        const reelsData: ReelData[] = []

        for (const stream of streams) {
          reelsData.push({
            stream: stream,
            product: stream.current_product || null,
          })
        }

        log.debug('[LivePageV2] Created reels:', reelsData.length)
        
        // Set initial active index based on streamId BEFORE setReels
        let initialIndex = 0
        if (streamId) {
          const foundIndex = reelsData.findIndex(r => r.stream.id === parseInt(streamId))
          if (foundIndex !== -1) {
            initialIndex = foundIndex
            log.debug('[LivePageV2] Initial index for stream', streamId, ':', initialIndex)
          }
        }
        
        setActiveIndex(initialIndex)
        setReels(reelsData)
        
        setLoading(false)
      } catch (error) {
        console.error('[LivePageV2] Fatal error loading reels:', error)
        
        // Show error state instead of demo data
        setReels([])
        setLoading(false)
        
        // Could show an error message to user here
        // For now, just log and show empty state
      }
    }

    loadReels()
  }, [streamId])

  // Update URL and currentStream when activeIndex changes (user scrolls)
  useEffect(() => {
    if (reels.length === 0 || activeIndex < 0 || activeIndex >= reels.length) return
    
    const activeReel = reels[activeIndex]
    const activeStreamId = activeReel.stream.id
    
    // Update URL without reload
    if (window.location.pathname !== `/live/${activeStreamId}`) {
      window.history.replaceState(null, '', `/live/${activeStreamId}`)
      log.debug('[LivePageV2] URL updated to:', `/live/${activeStreamId}`)
    }
    
    // Update currentStream
    if (currentStream?.id !== activeStreamId) {
      setCurrentStream(activeReel.stream)
      
      // Check streamer permission for new stream
      const userType = localStorage.getItem('user_type')
      const userId = getUserId()
      const accessToken = localStorage.getItem('seller_token') || localStorage.getItem('access_token')
      
      log.debug('[LivePageV2] Checking seller permission:', {
        userType,
        userId,
        hasAccessToken: !!accessToken,
        streamSellerId: activeReel.stream.seller_id
      })
      
      if (userType === 'seller' && userId && activeReel.stream.seller_id === parseInt(userId)) {
        setIsStreamer(true)
        log.debug('[LivePageV2] ✅ User is seller of this stream')
      } else {
        setIsStreamer(false)
      }
    }
  }, [activeIndex, reels])

  // Scroll to initial activeIndex after reels are loaded
  useEffect(() => {
    if (reels.length === 0 || !containerRef.current) return
    if (activeIndex === 0) return // Already at top, no need to scroll
    
    // Scroll to the active reel
    const targetElement = containerRef.current.children[activeIndex] as HTMLElement
    if (targetElement) {
      log.debug('[LivePageV2] Scrolling to index:', activeIndex)
      targetElement.scrollIntoView({ behavior: 'instant' as ScrollBehavior })
    }
  }, [reels])

  // 🔥 KV 기반 실시간 시청자 수 추적 (Session-based)
  useEffect(() => {
    if (!currentStream?.id) return

    // 세션 ID 생성 또는 가져오기
    let sessionId = sessionStorage.getItem('viewer_session_id')
    if (!sessionId) {
      sessionId = crypto.randomUUID()
      sessionStorage.setItem('viewer_session_id', sessionId)
    }

    // 시청자 등록 (Heartbeat)
    const joinViewer = async () => {
      try {
        await axios.post(`/api/streams/${currentStream.id}/viewer/join`, {}, {
          headers: { 'X-Session-ID': sessionId }
        })
      } catch (error) {
        console.error('[LivePageV2] Failed to join viewer:', error)
      }
    }

    // 시청자 수 조회
    const fetchViewerCount = async () => {
      try {
        const response = await axios.get(`/api/streams/${currentStream.id}/viewer-count`)
        if (response.data.success) {
          setViewerCount(response.data.data.viewer_count)
        }
      } catch (error) {
        console.error('[LivePageV2] Failed to fetch viewer count:', error)
      }
    }

    // 초기 등록
    joinViewer()
    fetchViewerCount()

    // 30초마다 Heartbeat 전송 (KV TTL 60초)
    const heartbeatInterval = setInterval(joinViewer, 30000)

    // 10초마다 시청자 수 조회
    const countInterval = setInterval(fetchViewerCount, 10000)

    return () => {
      clearInterval(heartbeatInterval)
      clearInterval(countInterval)
    }
  }, [currentStream?.id])

  // 스트리머 전용: 상품 변경 함수
  const handleChangeProduct = async (productId: number) => {
    if (!currentStream || !streamId) return

    try {
      setChangingProduct(true)
      
      // JWT 기반 인증 토큰 사용 - seller_token이 primary
      const accessToken = localStorage.getItem('seller_token') || localStorage.getItem('access_token')
      
      if (!accessToken) {
        toast.info('로그인이 필요합니다.')
        return
      }

      const response = await api.post(
        `/api/seller/streams/${streamId}/change-product`,
        { productId },
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        }
      )

      if (response.data.success) {
        // 현재 스트림 정보 업데이트
        setCurrentStream({
          ...currentStream,
          current_product_id: productId
        })
        toast.success('상품이 변경되었습니다!')
        setShowProductSelector(false)
      } else {
        toast.error('상품 변경에 실패했습니다: ' + (response.data.error || '알 수 없는 오류'))
      }
    } catch (error) {
      console.error('[LivePageV2] Change product error:', error)
      toast.error('상품 변경 중 오류가 발생했습니다.')
    } finally {
      setChangingProduct(false)
    }
  }

  // ✅ 로딩 중 표시
  if (loading) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            {/* Outer spinning ring */}
            <div className="h-16 w-16 border-4 border-red-500/20 border-t-red-600 rounded-full animate-spin" />
            {/* Inner pulsing dot */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse" />
            </div>
          </div>
          <div className="text-white text-xl font-bold">라이브 입장 중...</div>
          <div className="text-white/60 text-sm">잠시만 기다려주세요</div>
        </div>
      </div>
    )
  }

  // ✅ 데이터 없음 표시
  if (reels.length === 0) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="text-white text-xl mb-2">진행 중인 라이브가 없습니다</div>
          <button
            onClick={() => navigate('/')}
            className="mt-4 px-6 py-2 bg-white/20 text-white rounded-lg hover:bg-white/30 transition-colors"
          >
            홈으로 돌아가기
          </button>
        </div>
      </div>
    )
  }

  // ✅ activeIndex가 유효한 범위인지 확인
  const currentReel = reels[activeIndex]
  if (!currentReel || !currentReel.stream) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="h-16 w-16 border-4 border-red-500/20 border-t-red-600 rounded-full animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse" />
            </div>
          </div>
          <div className="text-white text-xl font-bold">라이브 준비 중...</div>
        </div>
      </div>
    )
  }

  return (
    <main className="relative h-dvh overflow-hidden bg-black">
      <TopNav 
        viewers={viewerCount}
        sellerLinks={{
          youtube: reels[activeIndex]?.stream?.seller_youtube || undefined,
          instagram: reels[activeIndex]?.stream?.seller_instagram || undefined,
          kakao: reels[activeIndex]?.stream?.seller_kakao || undefined,
        }}
      />
      
      {/* 우측 상단 "상품 변경" 버튼 제거 - 각 릴 카드 내부 버튼으로 통일 */}
      
      {/* 상품 선택 모달도 제거 - 필요 없음 */}
      {false && showProductSelector && (
        <div 
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              log.debug('[LivePageV2] 배경 클릭으로 모달 닫기')
              setShowProductSelector(false)
            }
          }}
        >
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden shadow-2xl">
            {/* 헤더 */}
            <div className="flex items-center justify-between p-6 border-b border-gray-700">
              <h2 className="text-xl font-bold text-white">상품 선택</h2>
              <button
                onClick={() => setShowProductSelector(false)}
                className="p-2 hover:bg-gray-700 rounded-full transition-colors"
              >
                <X size={24} className="text-gray-400" />
              </button>
            </div>
            
            {/* 상품 목록 */}
            <div className="overflow-y-auto max-h-[calc(80vh-140px)] p-6">
              {reels.length === 0 ? (
                <div className="text-center text-gray-400 py-12">
                  <ShoppingBag size={48} className="mx-auto mb-4 opacity-50" />
                  <p>등록된 상품이 없습니다</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {reels.filter((reel): reel is ReelData & { product: Product } => reel.product !== null).map((reel) => {
                    const isCurrentProduct = currentStream?.current_product_id === reel.product.id
                    
                    return (
                      <button
                        key={reel.product.id}
                        onClick={() => handleChangeProduct(reel.product.id)}
                        disabled={changingProduct || isCurrentProduct}
                        className={`relative p-4 rounded-xl border-2 transition-all text-left ${
                          isCurrentProduct
                            ? 'border-purple-500 bg-purple-500/10'
                            : 'border-gray-700 hover:border-purple-400 bg-gray-800/50'
                        } ${
                          changingProduct ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                      >
                        {/* 현재 상품 배지 */}
                        {isCurrentProduct && (
                          <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 bg-purple-500 text-white text-xs font-bold rounded-full">
                            <Check size={12} />
                            <span>현재 상품</span>
                          </div>
                        )}
                        
                        {/* 상품 정보 */}
                        <div className="flex gap-3">
                          <img
                            src={reel.product.image_url || reel.product.image}
                            alt={reel.product.name}
                            className="w-20 h-20 object-cover rounded-lg"
                          />
                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-white text-sm mb-1 truncate">
                              {reel.product.name}
                            </h3>
                            <div className="flex items-baseline gap-2 mb-1">
                              <span className="text-lg font-bold text-purple-400">
                                ${reel.product.price.toFixed(2)}
                              </span>
                              {reel.product.originalPrice > reel.product.price && (
                                <span className="text-xs text-gray-400 line-through">
                                  ${reel.product.originalPrice.toFixed(2)}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-400">
                              <div className="flex items-center gap-1">
                                <Star size={12} className="fill-yellow-400 text-yellow-400" />
                                <span>{reel.product.rating}</span>
                              </div>
                              <span>•</span>
                              <span>{reel.product.sold.toLocaleString()} sold</span>
                            </div>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
            
            {/* 푸터 */}
            <div className="p-6 border-t border-gray-700 bg-gray-900/50">
              <p className="text-sm text-gray-400 text-center">
                선택한 상품이 시청자들에게 강조 표시됩니다
              </p>
            </div>
          </div>
        </div>
      )}
      
      <div
        ref={containerRef}
        className={`h-dvh w-full no-scrollbar ${
          isDirectLink 
            ? 'overflow-hidden' // Direct link: No scroll, single stream only
            : 'overflow-y-scroll snap-y snap-mandatory' // Homepage: Scrollable reels
        }`}
      >
        {reels.map((reel, index) => (
          <div
            key={`${reel.stream.id}-${reel.product?.id || 'no-product'}`}
            ref={reelRefs}
            data-index={index}
            className="h-dvh w-full snap-start snap-always"
          >
            <ReelCard 
              reel={reel} 
              isActive={activeIndex === index}
              isCurrentProduct={currentStream?.current_product_id === reel.product?.id}
            />
          </div>
        ))}
      </div>
    </main>
  )
}
