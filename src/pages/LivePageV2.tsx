import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { Eye, ShoppingBag, MessageCircle, Share2, X, Send, Heart, Loader2, ChevronLeft } from 'lucide-react'
import axios from 'axios'
import KakaoShareButton from '@/components/KakaoShareButton'
import { getUserIdSync as getUserId } from '@/utils/auth'
import api from '@/lib/api'
import { useModal } from '@/components/CustomModal'
import { useLiveStreamWebSocket } from '@/hooks/useLiveStreamWebSocket'
import { useProductStock } from '@/hooks/useProductStock'
import type { ChatMessage } from '@/hooks/useFirebaseChat'
import Toast from '@/components/Toast'
import { toast } from '@/hooks/useToast'
import { DonationEffect } from '@/components/LiveDonation'
import { maskUserName } from '@/components/live/LiveUtils'
import { TeamPointsBadge } from '@/components/live/TeamPointsBadge'
import LiveDonation from '@/components/LiveDonation'
import AuctionPanel from '@/components/live/AuctionPanel'
import TimeDealPopup from '@/components/live/TimeDealPopup'
import '@/utils/console-suppressor'

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
  getCurrentTime(): number
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

// YouTube IFrame API types are declared in @/components/live/LiveTypes.ts

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
  stock?: number // 🔥 Firebase 실시간 재고
  seller_id?: number
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
function TopNav({ viewers, sellerLinks, sellerName, sellerAvatar, sellerId }: {
  viewers: number; sellerLinks?: { youtube?: string; instagram?: string; kakao?: string }
  sellerName?: string; sellerAvatar?: string; sellerId?: number
}) {
  const [following, setFollowing] = useState(false)
  const handleFollow = async () => {
    if (!sellerId) return
    try {
      await api.post(`/api/social/follow/${sellerId}`)
      setFollowing(f => !f)
    } catch {}
  }
  useEffect(() => {
    if (!sellerId) return
    api.get(`/api/social/follow/${sellerId}`).then(r => {
      if (r.data.success) setFollowing(r.data.data?.following || false)
    }).catch(() => {})
  }, [sellerId])

  return (
    <header className="fixed top-0 inset-x-0 z-50 px-4 pt-safe pb-2">
      {/* 상단: 뒤로가기 + LIVE + 시청자 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <a href="/" className="flex h-8 w-8 items-center justify-center rounded-full bg-black/40 backdrop-blur-sm">
            <ChevronLeft className="h-5 w-5 text-white/80" />
          </a>
          <div className="flex items-center gap-1.5 rounded-lg bg-red-500/90 backdrop-blur-sm px-2.5 py-1.5 shadow-lg shadow-red-500/30">
            <span className="h-2 w-2 rounded-full bg-white animate-blink-live" />
            <span className="text-xs font-extrabold tracking-wider text-white">LIVE</span>
          </div>
          <div className="flex items-center gap-1 rounded-lg bg-black/40 backdrop-blur-md px-2.5 py-1.5">
            <Eye className="h-3.5 w-3.5 text-white/80" />
            <span className="text-xs font-semibold text-white/90">{formatViewers(viewers)}</span>
          </div>
        </div>
        <div className="flex items-center gap-3 h-[34px]">
          {sellerLinks?.youtube && <a href={sellerLinks.youtube} target="_blank" rel="noopener noreferrer" className="opacity-50 hover:opacity-80"><YouTubeIcon className="h-[18px] w-[18px] text-white" /></a>}
          {sellerLinks?.instagram && <a href={sellerLinks.instagram} target="_blank" rel="noopener noreferrer" className="opacity-50 hover:opacity-80"><InstagramIcon className="h-[18px] w-[18px] text-white" /></a>}
        </div>
      </div>
      {/* 셀러 프로필 */}
      {sellerName && (
        <div className="flex items-center gap-2 mt-2 bg-black/40 backdrop-blur-md rounded-full pl-1 pr-3 py-1 w-fit">
          <img src={sellerAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(sellerName)}&size=28&background=random`}
            alt="" className="w-7 h-7 rounded-full object-cover" />
          <span className="text-xs font-bold text-white/90">{sellerName}</span>
          <button onClick={handleFollow}
            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${following ? 'bg-white/20 text-white/70' : 'bg-pink-500 text-white'}`}>
            {following ? '팔로잉' : '팔로우'}
          </button>
        </div>
      )}

    </header>
  )
}

// 하트 플로팅 애니메이션
function HeartReaction() {
  const [hearts, setHearts] = useState<{ id: number; x: number }[]>([])
  let nextId = useRef(0)

  const addHeart = () => {
    const id = nextId.current++
    const x = Math.random() * 30 - 15
    setHearts(prev => [...prev.slice(-15), { id, x }])
    setTimeout(() => setHearts(prev => prev.filter(h => h.id !== id)), 2000)
  }

  return (
    <div className="relative">
      {/* 플로팅 하트 */}
      <div className="absolute bottom-12 right-0 w-16 h-40 pointer-events-none overflow-hidden">
        {hearts.map(h => (
          <div key={h.id} className="absolute bottom-0 animate-float-heart" style={{ left: `calc(50% + ${h.x}px)` }}>
            <Heart className="w-5 h-5 text-pink-500 fill-pink-500" />
          </div>
        ))}
      </div>
      <button
        onClick={addHeart}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm transition-all active:scale-125"
        aria-label="Like"
      >
        <Heart className="h-5 w-5 text-pink-400 fill-pink-400" />
      </button>
    </div>
  )
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
        const isKakao = !isYouTube && !isSystemMessage

        return (
          <div key={msg.id} className="flex items-start gap-1 animate-fade-in">
            {/* YouTube 유저만 아이콘 표시 */}
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

// Countdown hook for scheduled streams
function useCountdown(targetDate: string | undefined) {
  const [remaining, setRemaining] = useState('')

  useEffect(() => {
    if (!targetDate) return

    const update = () => {
      const diff = new Date(targetDate).getTime() - Date.now()
      if (diff <= 0) {
        setRemaining('곧 시작됩니다')
        return
      }
      const days = Math.floor(diff / 86400000)
      const hours = Math.floor((diff % 86400000) / 3600000)
      const minutes = Math.floor((diff % 3600000) / 60000)
      const seconds = Math.floor((diff % 60000) / 1000)

      if (days > 0) {
        setRemaining(`D-${days} ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`)
      } else {
        setRemaining(`${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`)
      }
    }

    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [targetDate])

  return remaining
}

// Scheduled stream overlay
function ScheduledOverlay({ stream, onGoHome }: { stream: Stream; onGoHome: () => void }) {
  const countdown = useCountdown(stream.scheduled_at)

  const formattedDate = stream.scheduled_at
    ? `${new Date(stream.scheduled_at).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })} ${new Date(stream.scheduled_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`
    : null

  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-5 px-8">
        <div className="px-5 py-2 bg-blue-600 rounded-full flex items-center gap-2">
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-white text-sm font-bold">방송 예정</span>
        </div>

        <h2 className="text-white text-xl font-bold text-center leading-tight">
          {stream.title}
        </h2>

        {(stream.seller_name || stream.streamerName) && (
          <p className="text-white/70 text-sm">
            @{stream.seller_name || stream.streamerName}
          </p>
        )}

        {stream.scheduled_at && (
          <div className="text-center">
            <p className="text-white/60 text-xs mb-2">방송 시작까지</p>
            <p className="text-white text-3xl font-bold font-mono tracking-wider">
              {countdown}
            </p>
            <p className="text-white/50 text-sm mt-2">{formattedDate}</p>
          </div>
        )}

        {!stream.scheduled_at && (
          <p className="text-white/60 text-sm">방송 시작 시간이 아직 정해지지 않았습니다</p>
        )}

        <div className="flex gap-3 mt-2">
          <KakaoShareButton
            title={stream.title}
            description={stream.seller_name ? `${stream.seller_name}의 라이브 방송` : '유어딜 라이브'}
            link={`/live/${stream.id}`}
            className="px-6 py-2.5 bg-[#FEE500] text-[#3C1E1E] rounded-full text-sm font-bold"
            compact={false}
          />
          <button
            onClick={onGoHome}
            className="px-6 py-2.5 bg-white/10 hover:bg-white/20 text-white/80 rounded-full text-sm font-medium transition-colors"
          >
            홈으로
          </button>
        </div>
      </div>
    </div>
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
  const [playerReady, setPlayerReady] = useState(false)
  const [showPlayButton, setShowPlayButton] = useState(true)
  const [autoplayFailed, setAutoplayFailed] = useState(false)
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

        playerElement.innerHTML = ''

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
            fs: 0,
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
              // 2초 후에도 재생 안 되면 탭 유도 CTA 표시
              setTimeout(() => {
                if (isMounted && showPlayButton) {
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
                  setAutoplayFailed(false)
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

  // View tracking: record view when user watches this stream
  useEffect(() => {
    if (!isActive || !stream.id) return
    const sessionId = `view-${stream.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    let watchSeconds = 0
    const heartbeatInterval = setInterval(() => {
      watchSeconds += 30
      fetch(`/api/live/${stream.id}/view`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, action: 'heartbeat', watchDuration: watchSeconds }),
      }).catch((e) => console.warn("[Poll]", e?.message || e))
    }, 30000)

    // Initial join
    fetch(`/api/live/${stream.id}/view`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, action: 'join', deviceType: /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop' }),
    }).catch((e) => console.warn("[Poll]", e?.message || e))

    return () => {
      clearInterval(heartbeatInterval)
      // Leave
      fetch(`/api/live/${stream.id}/view`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, action: 'leave', watchDuration: watchSeconds }),
      }).catch((e) => console.warn("[Poll]", e?.message || e))
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
        console.error('[ReelCard] Failed to start video:', error)
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
        console.error('[InitialProduct] Error loading:', error)
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
      const response = await api.post('/api/cart', {
        product_id: currentProduct.id,
        quantity: 1,
        price_snapshot: currentProduct.price,
        live_stream_id: stream.id,
      })
      
      localStorage.setItem('hasCartItems', 'true')
      
      // 🎯 장바구니 아이템 추가 이벤트 발생 (아이콘 애니메이션용)
      window.dispatchEvent(new CustomEvent('cartItemAdded'))

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
      console.error('[Seller] Failed to change product:', error)
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
      console.error('Failed to send message:', error)
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

      {/* 라이브/종료 방송: 로딩 → 자동재생 → 실패 시 탭 유도 */}
      {stream.status !== 'scheduled' && showPlayButton && (
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
        {/* Top bar: 딜 잔액 게이지 (LIVE 뱃지 아래에 위치) */}
        {!isSeller && (
          <div className="pointer-events-auto absolute top-16 left-3 z-20">
            <TeamPointsBadge streamId={stream.id} />
          </div>
        )}

        {/* Bottom gradient */}
        <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

        {/* Donation effects overlay */}
        <DonationEffect donations={donationEffects} />

        {/* 라이브 경매 패널 */}
        {!isSeller && (
          <div className="pointer-events-auto absolute top-28 left-3 right-14 z-20">
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
                messages={[
                  ...chatMessages.map(m => ({ ...m, source: m.source || 'kakao' as const })),
                  ...ytChatMessages,
                ].sort((a, b) => a.timestamp - b.timestamp).slice(-8)}
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

          {/* 하단 바: 현재 상품 + 장바구니 + 구매 */}
          <div className="flex items-center gap-1.5 w-full rounded-2xl bg-black/40 backdrop-blur-xl px-3 py-2 border border-white/[0.08]">

            {/* Product info */}
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

            {/* Basket */}
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

            {/* Seller: Change Product / User: Buy */}
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
              >
                {changingProduct ? '⏳ 전환 중...' : isCurrentProduct ? '✅ 소개 중' : '🔄 변경하기'}
              </button>
            ) : (
              <button
                onClick={() => {
                  if (currentProduct) handleCheckout()
                  else showAlert('판매 중인 상품이 없습니다.', 'info', '상품 없음')
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

// ============================================
// Main LivePageV2 Component
// ============================================
export default function LivePageV2() {
  const { streamId } = useParams<{ streamId: string }>()
  const navigate = useNavigate()
  const [sp] = useSearchParams()
  useEffect(() => {
    const ref = sp.get('ref')
    if (ref) {
      localStorage.setItem('affiliate_ref', ref)
      localStorage.setItem('affiliate_ref_expires', String(Date.now() + 86400000))
      document.cookie = `affiliate_ref=${ref}; path=/; max-age=86400; SameSite=Lax`
    }
  }, [sp])
  const [activeIndex, setActiveIndex] = useState(0)
  const [reels, setReels] = useState<ReelData[]>([])
  const [loading, setLoading] = useState(true)
  const [isDirectLink, setIsDirectLink] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)
  
  const [currentStream, setCurrentStream] = useState<Stream | null>(null)
  
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
      localStorage.setItem('user_session_token', session)
      localStorage.setItem('user_id', userId)

      const existingUserType = localStorage.getItem('user_type')
      if (existingUserType !== 'seller' && existingUserType !== 'admin') {
        localStorage.setItem('user_type', 'user')
      }

      if (userName) {
        localStorage.setItem('user_name', decodeURIComponent(userName))
      }

      localStorage.removeItem('session')

      urlParams.delete('login')
      urlParams.delete('session')
      urlParams.delete('userId')
      urlParams.delete('userName')

      const newSearch = urlParams.toString()
      const newUrl = window.location.pathname + (newSearch ? '?' + newSearch : '')
      window.history.replaceState({}, '', newUrl)
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

        // Load streams (single or all based on context)
        let streams: Stream[] = []
        
        if (shouldShowSingleStream && streamId) {
          // DIRECT LINK: Load only the requested stream
          try {
            const singleStreamResponse = await axios.get(`/api/streams/${streamId}`)
            
            if (singleStreamResponse.data.success && singleStreamResponse.data.data) {
              streams = [singleStreamResponse.data.data]
            }
          } catch (error) {
            console.error('[LivePageV2] Single stream API failed:', error)
          }
        } else {
          // HOMEPAGE LINK: Load ALL active streams
          try {
            const streamsResponse = await axios.get('/api/streams')
            
            if (streamsResponse.data.success && streamsResponse.data.data?.length > 0) {
              streams = streamsResponse.data.data
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

        
        // Set initial active index based on streamId BEFORE setReels
        let initialIndex = 0
        if (streamId) {
          const foundIndex = reelsData.findIndex(r => r.stream.id === parseInt(streamId))
          if (foundIndex !== -1) {
            initialIndex = foundIndex
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
    }
    
    // Update currentStream
    if (currentStream?.id !== activeStreamId) {
      setCurrentStream(activeReel.stream)
    }
  }, [activeIndex, reels])

  // Scroll to initial activeIndex after reels are loaded
  useEffect(() => {
    if (reels.length === 0 || !containerRef.current) return
    if (activeIndex === 0) return // Already at top, no need to scroll
    
    // Scroll to the active reel
    const targetElement = containerRef.current.children[activeIndex] as HTMLElement
    if (targetElement) {
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
    <main className="relative h-dvh overflow-hidden bg-black no-scrollbar" style={{ scrollbarWidth: 'none' }}>
      <TopNav
        viewers={viewerCount}
        sellerName={reels[activeIndex]?.stream?.seller_name || reels[activeIndex]?.stream?.streamerName}
        sellerAvatar={reels[activeIndex]?.stream?.streamerAvatar}
        sellerId={reels[activeIndex]?.stream?.seller_id}
        sellerLinks={{
          youtube: reels[activeIndex]?.stream?.seller_youtube || undefined,
          instagram: reels[activeIndex]?.stream?.seller_instagram || undefined,
          kakao: reels[activeIndex]?.stream?.seller_kakao || undefined,
        }}
      />
      
      
      <div
        ref={containerRef}
        className={`h-dvh w-full no-scrollbar scrollbar-hide ${
          isDirectLink
            ? 'overflow-hidden' // Direct link: No scroll, single stream only
            : 'overflow-y-scroll snap-y snap-mandatory' // Homepage: Scrollable reels
        }`}
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
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
