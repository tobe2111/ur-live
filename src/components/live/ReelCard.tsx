import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Eye, ShoppingBag, MessageCircle, Share2, X, Send, Heart, Loader2 } from 'lucide-react'
import axios from 'axios'
import KakaoShareButton from '@/components/KakaoShareButton'
import { getUserIdSync as getUserId } from '@/utils/auth'
import api from '@/lib/api'
import { useModal } from '@/components/CustomModal'
import { useLiveStreamWebSocket } from '@/hooks/useLiveStreamWebSocket'
import { useProductStock } from '@/hooks/useProductStock'
import type { ChatMessage } from '@/hooks/useFirebaseChat'
import { toast } from '@/hooks/useToast'
import { DonationEffect } from '@/components/LiveDonation'
import { maskUserName } from '@/components/live/LiveUtils'
import { TeamPointsBadge } from '@/components/live/TeamPointsBadge'
import LiveDonation from '@/components/LiveDonation'
import AuctionPanel from '@/components/live/AuctionPanel'
import TimeDealPopup from '@/components/live/TimeDealPopup'
import HeartReaction from '@/components/live/HeartReaction'
import ScheduledOverlay from '@/components/live/ScheduledOverlay'

interface ApiError {
  response?: { status?: number; statusText?: string; data?: { error?: string } }
  message?: string
}

function isApiError(error: unknown): error is ApiError {
  return typeof error === 'object' && error !== null && ('response' in error || 'message' in error)
}

interface YTPlayer {
  playVideo(): void
  pauseVideo(): void
  unMute(): void
  setVolume(volume: number): void
  destroy(): void
  getCurrentTime(): number
  getDuration(): number
}

interface YTPlayerEvent {
  target: YTPlayer
  data: number
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
  scheduled_at?: string
  seller_name?: string
  seller_tiktok?: string
  created_at?: string
  product_display_mode?: 'current_only' | 'all'
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
  stock?: number
  seller_id?: number
  colors?: { name: string; hex: string }[]
  sizes?: string[]
}

interface ReelData {
  stream: Stream
  product: Product | null
}

function LiveChat({ messages, onChatClick }: { messages: ChatMessage[]; onChatClick: () => void }) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const recentMessages = messages.slice(-6)

  return (
    <div
      ref={scrollRef}
      className="flex flex-col gap-1 overflow-y-auto max-h-36 cursor-pointer no-scrollbar"
      onClick={onChatClick}
    >
      {recentMessages.map((msg) => {
        const isSystemMessage = msg.userName === 'System' || msg.role === 'system'
        const isYouTube = msg.source === 'youtube'

        return (
          <div key={msg.id} className="flex items-start gap-1 animate-fade-in">
            {isYouTube && (
              <svg viewBox="0 0 24 24" fill="#FF0000" className="w-3.5 h-3.5 shrink-0 mt-0.5">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
              </svg>
            )}
            {isSystemMessage ? (
              <p className="text-[11px] leading-[1.3] text-yellow-300 font-semibold" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
                {msg.message}
              </p>
            ) : (
              <p className="text-[11px] leading-[1.3]" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.8), 0 0 12px rgba(0,0,0,0.5)' }}>
                <span className="font-bold text-white/90">{msg.userName}</span>
                <span className="text-white/70"> {msg.message}</span>
              </p>
            )}
          </div>
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
  loading: loadingProducts,
  stream,
}: {
  products: Product[]
  currentProductId: number | null
  onClose: () => void
  onSelectProduct: (product: Product) => void
  loading: boolean
  stream?: Stream
}) {
  const navigate = useNavigate()

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" onClick={onClose}>
      <div className="bg-black/40 absolute inset-0" />
      <div
        className="relative bg-[#1A1A1A] rounded-t-2xl max-h-[70vh] overflow-hidden flex flex-col animate-slideUp"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h3 className="text-white font-bold">상품 목록 ({products.length})</h3>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/10">
            <X className="w-5 h-5 text-white/70" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {loadingProducts ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-8 text-gray-500">등록된 상품이 없습니다</div>
          ) : (
            products.map((p) => (
              <button
                key={p.id}
                onClick={() => onSelectProduct(p)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all ${
                  currentProductId === p.id
                    ? 'bg-pink-500/20 border border-pink-500/50'
                    : 'bg-white/5 hover:bg-white/10'
                }`}
              >
                {(p.image_url || p.image) ? (
                  <img
                    src={p.image_url || p.image}
                    alt={p.name}
                    className="w-14 h-14 rounded-lg object-cover flex-shrink-0"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                  />
                ) : (
                  <div className="w-14 h-14 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                    <ShoppingBag className="w-5 h-5 text-gray-500" />
                  </div>
                )}
                <div className="flex-1 text-left min-w-0">
                  <p className="text-white text-sm font-medium truncate">{p.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {(p.original_price || p.originalPrice) > p.price && (
                      <span className="text-xs text-gray-500 line-through">
                        {(p.original_price || p.originalPrice).toLocaleString()}원
                      </span>
                    )}
                    <span className="text-sm font-bold text-pink-400">{p.price.toLocaleString()}원</span>
                  </div>
                  {currentProductId === p.id && (
                    <span className="inline-block mt-1 text-[10px] bg-pink-500 text-white px-2 py-0.5 rounded-full font-bold">
                      현재 소개 중
                    </span>
                  )}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    navigate(`/products/${p.id}`)
                  }}
                  className="shrink-0 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs text-white font-medium transition-colors"
                >
                  상세
                </button>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export { LiveChat, ProductListSheet }
export type { Stream, Product, ReelData, YTPlayer, YTPlayerEvent, ApiError }

export default function ReelCard({ 
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
  const [playerReady, setPlayerReady] = useState(false)
  const [showPlayButton, setShowPlayButton] = useState(true)
  const showPlayButtonRef = useRef(true)
  const [autoplayFailed, setAutoplayFailed] = useState(false)
  // v15-4: YouTube iframe API error code별 사용자 안내 메시지
  const [playerError, setPlayerError] = useState<string | null>(null)
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

  // View tracking cleanup (component-local, avoid global collision)
  const viewTrackCleanupRef = useRef<(() => void) | null>(null)

  // ── 후원은 LiveDonation 컴포넌트에서 처리 (딜 포인트 방식) ──
  
  // Handle null product case
  const safeProduct = (product || {
    name: stream.title || '상품 정보 없음',
    // ✅ 이미지 없을 때: undefined로 두어 배경 이미지 비활성화
    image: undefined,
    price: 0,
    originalPrice: 0
  }) as Product
  
  // 🔥 DO WebSocket 기반 실시간 채팅 + 스트림 상태

  // YouTube 라이브 채팅 폴링 (WebSocket 채팅과 통합)
  const [ytChatMessages, setYtChatMessages] = useState<ChatMessage[]>([])

  const ytPageTokenRef = useRef('')

  useEffect(() => {
    if (stream.status !== 'live') return
    let active = true

    const pollYouTubeChat = async () => {
      try {
        const url = `/api/youtube/chat/chat/${stream.id}${ytPageTokenRef.current ? `?pageToken=${ytPageTokenRef.current}` : ''}`
        const res = await axios.get(url)
        if (res.data.success && res.data.data?.messages) {
          const ytMsgs: ChatMessage[] = res.data.data.messages.map((m: any) => ({
            id: `yt-${m.id}`,
            userId: 0,
            userName: m.author,
            userType: 'viewer' as const,
            message: m.message,
            timestamp: m.timestamp,
            source: 'youtube' as const,
            avatarUrl: m.avatarUrl,
          }))
          if (ytMsgs.length > 0) {
            setYtChatMessages(prev => {
              const existing = new Set(prev.map(p => p.id))
              const newMsgs = ytMsgs.filter(m => !existing.has(m.id))
              return [...prev, ...newMsgs].slice(-50)
            })
          }
          if (res.data.data.nextPageToken) ytPageTokenRef.current = res.data.data.nextPageToken
        }
      } catch { /* YouTube 채팅 비활성 시 무시 */ }
    }

    pollYouTubeChat()
    const interval = setInterval(pollYouTubeChat, 6000) // 6초마다
    return () => { active = false; clearInterval(interval) }
  }, [stream.id, stream.status])
  const {
    messages: chatMessages,
    isConnected: chatConnected,
    error: chatError,
    sendMessage: sendChatMessage,
    addLocalMessage,
    streamData: wsStreamData,
    lastDonation,
  } = useLiveStreamWebSocket(stream.id, true, stream.status === 'ended')

  // 채팅 메시지 병합 메모이제이션 (flicker 방지)
  const mergedChatMessages = useMemo(() =>
    [
      ...chatMessages.map(m => ({ ...m, source: m.source || 'kakao' as const })),
      ...ytChatMessages,
    ].sort((a, b) => a.timestamp - b.timestamp).slice(-8),
    [chatMessages, ytChatMessages]
  )

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

  // Listen for donationAlert custom events and add system chat message
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (!detail) return
      const msg = detail.message
        ? `🎉 ${detail.donorName}님이 ${detail.amount.toLocaleString()}딜 후원! "${detail.message}"`
        : `🎉 ${detail.donorName}님이 ${detail.amount.toLocaleString()}딜 후원!`
      addLocalMessage({
        id: `donation-alert-${Date.now()}`,
        userId: 0,
        userName: '시스템',
        userType: 'system',
        message: msg,
        timestamp: Date.now(),
      })
    }
    window.addEventListener('donationAlert', handler)
    return () => window.removeEventListener('donationAlert', handler)
  }, [addLocalMessage])

  // YouTube Player Integration
  useEffect(() => {
    // Initialize player for all reels (not just active one)
    // isActive check removed - this fixes YouTube video not playing issue
    if (!stream.youtube_video_id) return

    let player: YTPlayer | null = null
    let isMounted = true

    const initializePlayer = () => {
      try {
        // @ts-ignore
        if (!window.YT || !window.YT.Player) {
          return
        }
        if (!isMounted) {
          return
        }

        const playerElement = document.getElementById(`youtube-player-${stream.id}`)
        if (!playerElement) {
          return
        }

        while (playerElement.firstChild) playerElement.removeChild(playerElement.firstChild)

        // @ts-ignore
        player = new window.YT.Player(`youtube-player-${stream.id}`, {
          height: '100%',
          width: '100%',
          videoId: stream.youtube_video_id,
          playerVars: {
            autoplay: 1, // 음소거 상태에서 자동재생
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
            fs: 1,  // 🛡️ 2026-04-22: fullscreen 활성화 — 모바일 가로 시청 지원
            cc_load_policy: 0,
            origin: window.location.origin, // ✅ CORS 에러 방지
          },
          events: {
            onReady: (event: YTPlayerEvent) => {
              if (!isMounted) return
              playerRef.current = event.target
              setPlayerReady(true)
              // 자동 재생 시도 (음소거 상태)
              try {
                event.target.playVideo()
              } catch {
                // autoplay 실패
              }
              // 2초 후에도 재생 안 되면 탭 유도 CTA 표시 (ref로 stale closure 방지)
              setTimeout(() => {
                if (isMounted && showPlayButtonRef.current) {
                  setAutoplayFailed(true)
                }
              }, 2000)
            },
            onStateChange: (event: YTPlayerEvent) => {
              if (!isMounted) return
              try {
                // @ts-ignore
                if (event.data === window.YT.PlayerState.PLAYING) {
                  setShowPlayButton(false)
                  showPlayButtonRef.current = false
                  setAutoplayFailed(false)
                } else if (event.data === window.YT.PlayerState.PAUSED) {
                  setShowPlayButton(true)
                  showPlayButtonRef.current = true
                }
              } catch (e) {
                // Suppress postMessage errors
              }
            },
            onError: (event: YTPlayerEvent) => {
              if (!isMounted) return
              if (import.meta.env.DEV) console.warn(`[YT] Player error for video ${stream.youtube_video_id}:`, event.data)
              // YouTube iframe API 공식 에러 코드:
              //   2  = invalid video ID
              //   5  = HTML5 player 재생 오류
              //   100 = video not found / deleted
              //   101 = private video (embed disallowed)
              //   150 = same as 101 (owner disabled embedding)
              switch (event.data) {
                case 2:
                case 100:
                case 101:
                case 150:
                  setPlayerError('이 영상을 재생할 수 없습니다. 셀러에게 문의해주세요.')
                  break
                case 5:
                  setPlayerError('브라우저 호환성 문제입니다. 새로고침해주세요.')
                  break
                default:
                  setShowPlayButton(true)
              }
            },
          },
        })
      } catch (error) {
        // Only log critical errors, suppress postMessage
        if (error instanceof Error && !error.message.includes('postMessage')) {
          if (import.meta.env.DEV) console.error('[ReelCard] YouTube player error:', error.message)
        }
      }
    }

    // @ts-ignore - YouTube API는 index.html에서 미리 로드됨
    if (window.YT && window.YT.Player) {
      initializePlayer()
    } else {
      // API 로드 완료 시 콜백 등록 (index.html에서 초기화된 배열 사용)
      // @ts-ignore
      window.youtubeCallbacks.push(() => {
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
        } catch (e) {
          // Ignore errors
        }
      }
    }
  }, [isActive, stream.id])

  // View tracking: 2초 디바운스하여 빠른 스크롤 시 중복 join 방지
  useEffect(() => {
    if (!isActive || !stream.id) return
    const joinTimer = setTimeout(() => {
      const sessionId = `view-${stream.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      let watchSeconds = 0
      const heartbeatInterval = setInterval(() => {
        watchSeconds += 30
        fetch(`/api/live/${stream.id}/view`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, action: 'heartbeat', watchDuration: watchSeconds }),
        }).catch((e) => { if (import.meta.env.DEV) console.warn("[Poll]", e?.message || e) })
      }, 30000)
      fetch(`/api/live/${stream.id}/view`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, action: 'join', deviceType: /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop' }),
      }).catch((e) => { if (import.meta.env.DEV) console.warn("[Poll]", e?.message || e) })
      viewTrackCleanupRef.current = () => {
        clearInterval(heartbeatInterval)
        fetch(`/api/live/${stream.id}/view`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, action: 'leave', watchDuration: watchSeconds }),
        }).catch((e) => { if (import.meta.env.DEV) console.warn("[Poll]", e?.message || e) })
      }
    }, 2000)
    return () => {
      clearTimeout(joinTimer)
      if (viewTrackCleanupRef.current) {
        viewTrackCleanupRef.current()
        viewTrackCleanupRef.current = null
      }
    }
  }, [isActive, stream.id])

  // Pause video when no longer active
  useEffect(() => {
    if (!isActive && playerRef.current && playerReady) {
      try {
        playerRef.current.pauseVideo()
        setShowPlayButton(true)
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
      } catch (error) {
        if (import.meta.env.DEV) console.error('[ReelCard] Failed to start video:', error)
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

          }
        } catch (error) {
          if (import.meta.env.DEV) console.error('[WS] Error loading new product:', error)
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
        } else if (response.data.success && !response.data.data) {
          // current_product_id가 null → 상품 없음 상태로 명시적 초기화
          setCurrentProduct(null)
        }
      } catch (error) {
        if (import.meta.env.DEV) console.error('[InitialProduct] Error loading:', error)
      }
    }

    loadInitialProduct()
  }, [stream.id])

  // ============================================
  // Kakao Login Handler
  // ============================================
  async function handleKakaoLogin() {
    try {
      localStorage.setItem('loginReturnUrl', window.location.pathname)
      navigate('/login?returnUrl=' + encodeURIComponent(window.location.pathname))
    } catch (error) {
      if (import.meta.env.DEV) console.error('[Login] Exception:', error)
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
      const response = await api.post('/api/cart', {
        product_id: currentProduct.id,
        quantity: 1,
        price_snapshot: currentProduct.price,
        live_stream_id: stream.id,
      })
      
      localStorage.setItem('hasCartItems', 'true')
      
      window.dispatchEvent(new CustomEvent('cartItemAdded'))
      setNotificationText('장바구니에 추가되었습니다')
      setShowNotification(true)
      setTimeout(() => setShowNotification(false), 2000)
      try {
        const g = (window as any).gtag
        if (typeof g === 'function') {
          g('event', 'add_to_cart', {
            currency: 'KRW',
            value: currentProduct.price || 0,
            items: [{ item_id: currentProduct.id, item_name: currentProduct.name }],
          })
        }
      } catch {}

      // 🔥 시스템 메시지 전송 (채팅창에 표시)
      const userName = localStorage.getItem('user_name') || '익명'
      const maskedName = maskUserName(userName)
      const systemMsg = `${maskedName}님이 ${currentProduct.name}을(를) 담았습니다!`

      try {
        await sendChatMessage(systemMsg, 0, '🎉 시스템', 'system')
      } catch {
        // 시스템 메시지 전송 실패는 무시
      }
    } catch (error: unknown) {
      if (import.meta.env.DEV) console.error('[handleAddToCart] ❌ Error:', error)
      const apiErr = isApiError(error) ? error : undefined
      if (import.meta.env.DEV) console.error('[handleAddToCart] ❌ Error details:', {
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
      // 바로구매: 장바구니 거치지 않고 해당 상품만 결제
      navigate('/checkout', {
        state: {
          directPurchase: [{
            id: `live_${currentProduct.id}_${Date.now()}`,
            product_id: currentProduct.id,
            product_name: currentProduct.name,
            product_description: currentProduct.description ?? null,
            product_price: currentProduct.price,
            product_image: currentProduct.image_url,
            image_url: currentProduct.image_url,
            quantity: 1,
            price_snapshot: currentProduct.price,
            price: currentProduct.price,
            item_total: currentProduct.price,
            seller_id: currentProduct.seller_id ?? null,
            seller_name: (currentProduct as any).seller_name ?? null,
            shipping_fee: 3000,
            free_shipping_threshold: 0,
            option_id: null,
            option_value: null,
            live_stream_id: stream.id,
          }]
        }
      })
      
    } catch (error: unknown) {
      if (import.meta.env.DEV) console.error('Failed to add product to cart:', error)
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
      if (import.meta.env.DEV) console.error('Failed to load stream products:', error)
    } finally {
      setLoadingProducts(false)
    }
  }

  // ============================================
  // Open Product List Sheet
  // ============================================
  // 전체 상품 모드: 자동 로드
  useEffect(() => {
    if (stream.product_display_mode === 'all') {
      loadStreamProducts()
    }
  }, [stream.product_display_mode, stream.id])

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

    } catch (error: unknown) {
      if (import.meta.env.DEV) console.error('[Seller] Failed to change product:', error)
      const apiErr = isApiError(error) ? error : undefined
      showAlert(apiErr?.response?.data?.error || '상품 전환에 실패했습니다.', 'error', '전환 실패')
    } finally {
      setChangingProduct(false)
    }
  }

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
      if (import.meta.env.DEV) console.error('Failed to send message:', error)
      showAlert('메시지 전송에 실패했습니다.', 'error', '전송 실패')
    } finally {
      setSendingMessage(false)
    }
  }

  return (
    <div className="relative h-full w-full snap-start snap-always overflow-hidden bg-black">
      {/* 🎉 상품 변경 강조 배너 */}
      {productChangeToast && (
        <div className="absolute inset-x-0 top-1/3 z-[100] flex justify-center pointer-events-none animate-bounce-in">
          <div className="bg-gradient-to-r from-pink-500 to-red-500 text-white px-6 py-3 rounded-2xl shadow-2xl shadow-pink-500/30 max-w-[85%]">
            <p className="text-center text-sm font-bold">🔥 지금 이 상품!</p>
            <p className="text-center text-xs opacity-90 mt-0.5">{productChangeToast}</p>
          </div>
        </div>
      )}
      
      {/* LIVE Badge - 셀러가 자신의 스트림을 보고 있고, 현재 소개 중인 상품일 때만 표시 */}
      {isCurrentProduct && isSeller && (
        <div className="absolute top-24 left-4 z-[101] flex items-center gap-2 bg-gradient-to-r from-purple-600 to-pink-600 px-3 py-1.5 rounded-full shadow-2xl">
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
      <div
        id={`youtube-player-${stream.id}`}
        className="absolute inset-0 w-full h-full z-[5] overflow-hidden [&_iframe]:!absolute [&_iframe]:!top-[50%] [&_iframe]:!left-[50%] [&_iframe]:![transform:translate(-50%,-50%)] [&_iframe]:!w-[max(100vw,177.78vh)] [&_iframe]:!h-[max(100vh,56.25vw)]"
      />

      {/* 예약 방송 UI */}
      {stream.status === 'scheduled' && (
        <ScheduledOverlay stream={stream} onGoHome={() => navigate('/')} />
      )}

      {/* v15-4: YouTube 재생 오류 안내 오버레이 */}
      {playerError && stream.status !== 'scheduled' && (
        <div
          className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/80 px-6 text-center"
          role="alert"
        >
          <div className="h-16 w-16 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            </svg>
          </div>
          <p className="text-white text-lg font-bold mb-1">재생할 수 없는 영상</p>
          <p className="text-white/70 text-sm">{playerError}</p>
        </div>
      )}

      {/* 라이브/종료 방송: 로딩 → 자동재생 → 실패 시 탭 유도 */}
      {stream.status !== 'scheduled' && !playerError && showPlayButton && (
        <button
          onClick={playerReady ? handleVideoClick : undefined}
          className={`absolute inset-0 z-10 flex flex-col items-center justify-center transition-all ${
            autoplayFailed
              ? 'bg-black/50 cursor-pointer'
              : 'bg-black/60 cursor-default'
          }`}
          aria-label="방송 입장하기"
          disabled={!playerReady}
        >
          <div className="flex flex-col items-center gap-4">
            <div className="px-4 py-1.5 bg-red-600 rounded-full flex items-center gap-2">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
              <span className="text-white text-sm font-bold">LIVE</span>
            </div>

            {autoplayFailed ? (
              <>
                {/* 자동재생 실패 → 명확한 재생 버튼 */}
                <div className="h-20 w-20 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border-2 border-white/40">
                  <svg className="w-10 h-10 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
                <div className="text-center px-6">
                  <p className="text-white text-xl font-bold mb-1">터치하여 시청 시작</p>
                  <p className="text-white/50 text-xs">소리와 함께 라이브가 시작됩니다</p>
                </div>
              </>
            ) : (
              <>
                {/* 로딩 스피너 */}
                <div className="relative">
                  <div className="h-16 w-16 border-4 border-red-500/20 border-t-red-600 rounded-full animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse" />
                  </div>
                </div>
                <div className="text-center px-6">
                  <p className="text-white text-xl font-bold mb-1.5">라이브 입장 중...</p>
                  <p className="text-white/60 text-sm">잠시만 기다려주세요</p>
                </div>
              </>
            )}
          </div>
        </button>
      )}

      {/* Subtle top vignette */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-transparent pointer-events-none" />

      {/* Product overlay */}
      <div className="pointer-events-none absolute inset-0 z-10 flex flex-col">
        {/* Top bar: 딜 잔액 게이지 (TopNav 아래에 위치) */}
        {!isSeller && (
          <div className="pointer-events-auto absolute top-14 left-3 z-20">
            <TeamPointsBadge streamId={stream.id} />
          </div>
        )}

        {/* Bottom gradient */}
        <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

        {/* Donation effects overlay */}
        <DonationEffect donations={donationEffects} />

        {/* 라이브 경매 패널 */}
        {!isSeller && (
          <div className="pointer-events-auto absolute top-24 left-3 right-14 z-20">
            <AuctionPanel streamId={stream.id} />
          </div>
        )}

        {/* 타임딜 팝업 */}
        <TimeDealPopup streamId={stream.id} />

        {/* Spacer pushes content to bottom */}
        <div className="flex-1" />

        {/* Content area */}
        <div className="pointer-events-auto relative flex flex-col px-4 pb-3">
          {/* Chat + action icons row */}
          <div className="flex items-end gap-3 mb-2.5">
            {/* Live chat feed - left side, wide */}
            <div className="min-w-0 flex-1">
              <LiveChat
                messages={mergedChatMessages}
                onChatClick={() => setChatModalOpen(true)}
              />
            </div>

            {/* Chat + Heart + Donate + Share buttons - right side */}
            <div className="flex flex-col items-center gap-2.5 shrink-0 pb-1 mr-1">
              {/* 하트 반응 */}
              <HeartReaction />
              <button
                onClick={() => setChatModalOpen(true)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm transition-all active:scale-90"
                aria-label="Chat"
              >
                <MessageCircle className="h-5 w-5 text-white/90" />
              </button>
              <KakaoShareButton
                title={stream?.title || '유어딜 라이브'}
                description={safeProduct?.name || '라이브 방송 중'}
                imageUrl={safeProduct?.image_url}
                link={`/live/${stream?.id}`}
                compact
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm transition-all active:scale-90"
              />


              {/* 상품 목록 버튼 */}
              <button
                onClick={openProductListSheet}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm transition-all active:scale-90"
                aria-label="Products"
              >
                <ShoppingBag className="h-5 w-5 text-white/90" />
              </button>

              {/* 후원하기 버튼 (딜 포인트) */}
              {!isSeller && stream?.id && (
                <LiveDonation streamId={stream.id} />
              )}
            </div>
          </div>

          {/* 전체 상품 모드: 가로 스크롤 상품 목록 */}
          {stream.product_display_mode === 'all' && streamProducts.length > 0 && (
            <div className="mb-2 -mx-1">
              <div className="flex gap-2 overflow-x-auto no-scrollbar px-1 pb-1">
                {streamProducts.map(p => {
                  const isHighlighted = p.id === stream.current_product_id
                  return (
                    <button
                      key={p.id}
                      onClick={() => {
                        setCurrentProduct(p)
                      }}
                      className={`flex-shrink-0 flex items-center gap-2 rounded-xl px-2.5 py-2 backdrop-blur-xl border transition-all active:scale-95 ${
                        isHighlighted
                          ? 'bg-red-500/20 border-red-500/40'
                          : 'bg-black/30 border-white/10'
                      }`}
                      style={{ maxWidth: '200px' }}
                    >
                      <img
                        src={p.image_url || p.image || ''}
                        alt=""
                        className="w-10 h-10 rounded-lg object-cover shrink-0 bg-white/10"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                      />
                      <div className="text-left min-w-0">
                        <p className="text-[11px] text-white font-medium truncate">{p.name}</p>
                        <p className="text-[12px] font-bold text-red-400">₩{(p.price || 0).toLocaleString()}</p>
                      </div>
                      {isHighlighted && (
                        <span className="shrink-0 w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* v4 Cinema: 하단 상품 바 (글래스모피즘) — 상품 있을 때만 표시 */}
          {currentProduct && (
          <div className="flex items-stretch w-full rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)', backdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.12)' }}>
            <div className="flex items-center gap-2 flex-1 min-w-0 px-3 py-2.5"
              key={currentProduct?.id || 'default'}
            >
              {/* Product image */}
              {(safeProduct.image_url || safeProduct.image) && (
                <img src={safeProduct.image_url || safeProduct.image} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-white/60 truncate">지금 소개 중</p>
                <p className="text-[12px] font-semibold text-white/90 truncate">{safeProduct.name}</p>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  {(safeProduct.originalPrice || safeProduct.original_price || 0) > safeProduct.price && (
                    <span className="text-[10px] text-white/40 line-through">
                      {(safeProduct.originalPrice || safeProduct.original_price || 0).toLocaleString()}
                    </span>
                  )}
                  <span className="text-[15px] font-extrabold text-white">
                    {(safeProduct.price || 0).toLocaleString()}원
                  </span>
                </div>
              </div>
            </div>
          </div>
          )}
          {/* v4 Cinema: 구매 버튼 2열 — 상품 있을 때만 표시 */}
          {currentProduct && (
          <div className="grid grid-cols-2 w-full rounded-2xl overflow-hidden mt-1.5" style={{ background: 'rgba(255,255,255,0.07)', backdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.12)' }}>
            <button
              onClick={handleAddToCart}
              disabled={!currentProduct || addingToCart}
              className="py-2.5 text-center text-[13px] font-bold text-white active:scale-[0.98] transition-transform disabled:opacity-40"
              style={{ borderRight: '1px solid rgba(255,255,255,0.1)' }}
            >
              {addingToCart ? '추가 중...' : '장바구니'}
            </button>
            {isSeller && product ? (
              <button
                onClick={handleChangeProduct}
                disabled={changingProduct || isCurrentProduct}
                className="py-2.5 text-center text-[13px] font-extrabold text-white active:scale-[0.98] transition-transform disabled:opacity-40"
                style={{ background: 'linear-gradient(90deg, #EF4444, #EC4899)' }}
              >
                {changingProduct ? '⏳ 전환 중...' : isCurrentProduct ? '✅ 소개 중' : '🔄 변경'}
              </button>
            ) : (
              <button
                onClick={() => {
                  if (currentProduct) handleCheckout()
                  else showAlert('판매 중인 상품이 없습니다.', 'info', '상품 없음')
                }}
                disabled={!currentProduct}
                className="py-2.5 text-center text-[13px] font-extrabold text-white active:scale-[0.98] transition-transform disabled:opacity-40"
                style={{ background: 'linear-gradient(90deg, #EF4444, #EC4899)' }}
              >
                바로 구매
              </button>
            )}
          </div>
          )}
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
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[100] animate-fade-in">
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
            className="absolute inset-0 z-[80] bg-black/60 backdrop-blur-sm animate-overlay-in"
            onClick={() => setChatModalOpen(false)}
          />

          {/* Chat Input Sheet */}
          <div className="absolute inset-x-0 bottom-0 z-[90] bg-white rounded-t-3xl animate-sheet-up">
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-gray-900">메시지 보내기</h3>
                  {isSeller && (
                    <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">🎙 셀러</span>
                  )}
                </div>
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
                  placeholder={isSeller ? "셀러 메시지를 입력하세요..." : "메시지를 입력하세요..."}
                  className={`flex-1 rounded-xl border px-4 py-3 text-sm text-gray-900 focus:outline-none ${
                    isSeller
                      ? 'border-indigo-300 focus:border-indigo-500 bg-indigo-50/50'
                      : 'border-gray-300 focus:border-red-500 bg-white'
                  }`}
                  disabled={sendingMessage}
                />
                <button
                  type="submit"
                  disabled={!chatMessage.trim() || sendingMessage}
                  className={`flex items-center justify-center rounded-xl px-6 py-3 text-white font-bold transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
                    isSeller ? 'bg-indigo-500' : 'bg-red-500'
                  }`}
                >
                  <Send className="h-5 w-5" />
                </button>
              </form>
            </div>
          </div>
        </>
      )}
      {/* 후원은 LiveDonation 컴포넌트에서 처리 (딜 포인트 방식) */}
    </div>
  )
}
