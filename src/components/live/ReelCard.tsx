import { useState, useEffect, useRef, useMemo, memo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import PKLiveBanner from '@/components/live/PKLiveBanner'
import { getUserIdSync as getUserId } from '@/utils/auth'
import api from '@/lib/api'
import { useModal } from '@/components/CustomModal'
import { useLiveStreamWebSocket } from '@/hooks/useLiveStreamWebSocket'
import { useProductStock } from '@/hooks/useProductStock'
import type { ChatMessage } from '@/types/live-stream'
import { DonationEffect } from '@/components/LiveDonation'
import { maskUserName } from '@/components/live/LiveUtils'
import { TeamPointsBadge } from '@/components/live/TeamPointsBadge'
import AuctionPanel from '@/components/live/AuctionPanel'
import TimeDealPopup from '@/components/live/TimeDealPopup'
import ScheduledOverlay from '@/components/live/ScheduledOverlay'
import ReelProductCard from '@/components/live/ReelProductCard'
import ReelChatSheet from '@/components/live/ReelChatSheet'
import ReelActionRail from '@/components/live/ReelActionRail'

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
  isMuted(): boolean
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
  seller_shipping_fee?: number
  donation_goal?: number | null
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

// 🛡️ 2026-04-29: LiveChat sub-component → @/components/live/LiveChatStream.tsx 추출 (TD-006)
//   ReelCard 1447 → 1407줄 (40줄 감소). 외부 import 0건 확인됨.
import LiveChat from '@/components/live/LiveChatStream'

// 🛡️ 2026-04-29 (TD-006): ProductListSheet → @/components/live/ProductListSheet.tsx 사용
//   기존 ReelCard 자체 정의 (96줄) 제거. 외부 ProductListSheet 가 더 정교한 디자인.
import { ProductListSheet } from '@/components/live/ProductListSheet'
import { formatNumber } from '@/utils/format'
import { useStreamStore } from '@/shared/stores/useStreamStore'
export type { Stream, Product, ReelData, YTPlayer, YTPlayerEvent, ApiError }

function ReelCardImpl({
  reel,
  isActive,
  isCurrentProduct = false
}: {
  reel: ReelData
  isActive: boolean
  isCurrentProduct?: boolean
}) {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { showAlert } = useModal()
  const [productListSheetOpen, setProductListSheetOpen] = useState(false)
  const [streamProducts, setStreamProducts] = useState<Product[]>([])
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [chatModalOpen, setChatModalOpen] = useState(true)
  const [chatInputOpen, setChatInputOpen] = useState(false)
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
  
  // Donation effects
  const [donationEffects, setDonationEffects] = useState<Array<{ id: string; donorName: string; amount: number; message: string }>>([])

  // Flash sale countdown
  const [flashSaleSecondsLeft, setFlashSaleSecondsLeft] = useState<number | null>(null)

  // Product change animation
  const [productSlideKey, setProductSlideKey] = useState(0)

  // Next live preview (shown when stream ends)
  const [nextLive, setNextLive] = useState<{ id: number; title: string; scheduled_at: string | null } | null>(null)

  // VOD delay: hide iframe for 5 min after ending so YouTube processes the recording
  const [vodReady, setVodReady] = useState(stream.status !== 'ended')

  // View tracking cleanup (component-local, avoid global collision)
  const viewTrackCleanupRef = useRef<(() => void) | null>(null)
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)

  // ── 후원은 LiveDonation 컴포넌트에서 처리 (딜 포인트 방식) ──
  
  // Handle null product case
  const safeProduct = (product || {
    name: stream.title || t('live.noProductInfo', { defaultValue: '상품 정보 없음' }),
    // ✅ 이미지 없을 때: undefined로 두어 배경 이미지 비활성화
    image: undefined,
    price: 0,
    originalPrice: 0
  }) as Product
  
  // 🔥 DO WebSocket 기반 실시간 채팅 + 스트림 상태

  // YouTube 라이브 채팅 폴링 (WebSocket 채팅과 통합)
  const [ytChatMessages, setYtChatMessages] = useState<ChatMessage[]>([])

  const ytPageTokenRef = useRef('')

  // 🛡️ 2026-05-04 (perf): isActive + visibility 가드 추가.
  //   이전: 모든 ReelCard 가 mount 직후 6s 폴링 → N개 카드 = N requests/6s.
  //   이후: 활성 카드 + tab visible 일 때만 폴링.
  useEffect(() => {
    if (stream.status !== 'live' || !isActive) return
    let active = true

    const pollYouTubeChat = async () => {
      if (document.hidden) return
      try {
        const url = `/api/youtube/chat/chat/${stream.id}${ytPageTokenRef.current ? `?pageToken=${ytPageTokenRef.current}` : ''}`
        const res = await api.get(url)
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
    const interval = setInterval(pollYouTubeChat, 6000)
    return () => { active = false; clearInterval(interval) }
  }, [stream.id, stream.status, isActive])
  const {
    messages: chatMessages,
    isConnected: chatConnected,
    error: chatError,
    sendMessage: sendChatMessage,
    addLocalMessage,
    streamData: wsStreamData,
    lastDonation,
    activeFlashSale,
    pinnedMessage,
  } = useLiveStreamWebSocket(stream.id, isActive, stream.status === 'ended')

  // ── PC 패널 공유 스토어 사이드이펙트 ──────────────────────────────────────
  // ReelCard 핵심 로직 무변경. 스토어에 쓰기만 담당.
  const {
    setStream: storeSetStream,
    setViewerCount: storeSetViewerCount,
    setCurrentProductId: storeSetCurrentProductId,
    setProducts: storeSetProducts,
    setMessages: storeSetMessages,
    setConnected: storeSetConnected,
    setSendMessage: storeSetSendMessage,
    reset: storeReset,
  } = useStreamStore()

  useEffect(() => {
    if (!isActive) return
    storeSetStream({ id: stream.id, title: stream.title, sellerName: stream.streamerName || stream.seller_name || '' })
    storeSetSendMessage(sendChatMessage)
    return () => { storeReset() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stream.id, isActive])

  useEffect(() => {
    if (!isActive) return
    storeSetConnected(chatConnected)
  }, [isActive, chatConnected, storeSetConnected])

  useEffect(() => {
    if (!isActive) return
    const merged = [
      ...chatMessages.map(m => ({ ...m, source: m.source || 'kakao' as const })),
      ...ytChatMessages,
    ].sort((a, b) => a.timestamp - b.timestamp).slice(-50)
    storeSetMessages(merged)
  }, [isActive, chatMessages, ytChatMessages, storeSetMessages])

  useEffect(() => {
    if (!isActive || streamProducts.length === 0) return
    storeSetProducts(streamProducts)
  }, [isActive, streamProducts, storeSetProducts])

  useEffect(() => {
    if (!isActive) return
    storeSetCurrentProductId(wsStreamData?.current_product_id ?? null)
  }, [isActive, wsStreamData?.current_product_id, storeSetCurrentProductId])
  // ── 스토어 사이드이펙트 끝 ────────────────────────────────────────────────

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
        ? t('live.donationMsg', { name: detail.donorName, amount: formatNumber(detail.amount), message: detail.message, defaultValue: `🎉 ${detail.donorName}님이 ${formatNumber(detail.amount)}딜 후원! "${detail.message}"` })
        : t('live.donationMsgNoText', { name: detail.donorName, amount: formatNumber(detail.amount), defaultValue: `🎉 ${detail.donorName}님이 ${formatNumber(detail.amount)}딜 후원!` })
      addLocalMessage({
        id: `donation-alert-${Date.now()}`,
        userId: 0,
        userName: t('live.donationSystem', { defaultValue: '시스템' }),
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
                  setPlayerError(t('live.player.cannotPlay'))
                  break
                case 5:
                  setPlayerError(t('live.player.browserError'))
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

    // @ts-ignore
    if (window.YT && window.YT.Player) {
      initializePlayer()
    } else {
      // API 로드 완료 시 콜백 등록 (index.html에서 초기화된 배열 사용)
      // @ts-ignore
      window.youtubeCallbacks.push(() => {
        if (isMounted) initializePlayer()
      })
      // 🛡️ 2026-05-06: YouTube iframe_api 스크립트는 어디서도 lazy load 되지 않아
      //   playerReady 가 영원히 false → "라이브 입장 중..." 무한 로딩 사고. 여기서 1회 로드.
      const SCRIPT_ID = 'youtube-iframe-api'
      if (!document.getElementById(SCRIPT_ID)) {
        const tag = document.createElement('script')
        tag.id = SCRIPT_ID
        tag.src = 'https://www.youtube.com/iframe_api'
        tag.async = true
        document.head.appendChild(tag)
      }
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
    // playerRef.current 은 ref — playerReady state(stale 가능)보다 신뢰도 높음
    if (playerRef.current) {
      try {
        playerRef.current.unMute()
        playerRef.current.setVolume(100)
        playerRef.current.playVideo()
        setShowPlayButton(false)
        // iOS Safari unmute 비동기 확인 (최대 3회, 500ms 간격)
        let retries = 0
        const verifyUnmute = setInterval(() => {
          retries++
          if (!playerRef.current) { clearInterval(verifyUnmute); return }
          try {
            if (!playerRef.current.isMuted()) {
              setIsMuted(false)
              clearInterval(verifyUnmute)
            } else if (retries < 3) {
              playerRef.current.unMute()
            } else {
              setIsMuted(false) // 3회 시도 후 UI 업데이트만
              clearInterval(verifyUnmute)
            }
          } catch { clearInterval(verifyUnmute) }
        }, 500)
        return
      } catch (error) {
        if (import.meta.env.DEV) console.error('[ReelCard] Failed to start video:', error)
        // API 호출 실패 시 플레이어 파괴 후 fallback 진행 (두 플레이어 충돌 방지)
        try { playerRef.current.destroy() } catch {}
        playerRef.current = null
        setPlayerReady(false)
      }
    }
    // 플레이어 미초기화 / 파괴 후 — 직접 iframe으로 재생 (사용자 gesture로 unmuted 재생 가능)
    const playerEl = document.getElementById(`youtube-player-${stream.id}`)
    if (playerEl && stream.youtube_video_id) {
      while (playerEl.firstChild) playerEl.removeChild(playerEl.firstChild)
      const iframe = document.createElement('iframe')
      iframe.src = `https://www.youtube.com/embed/${stream.youtube_video_id}?autoplay=1&mute=0&playsinline=1&rel=0&modestbranding=1&controls=0&origin=${encodeURIComponent(window.location.origin)}`
      iframe.allow = 'autoplay; encrypted-media; fullscreen'
      iframe.style.cssText = 'width:100%;height:100%;border:0'
      playerEl.appendChild(iframe)
      setShowPlayButton(false)
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
          const response = await api.get(`/api/streams/${stream.id}/current-product`)
          if (response.data.success && response.data.data) {
            const newProduct = response.data.data
            if (!newProduct) return
            setCurrentProduct(newProduct)
          }
        } catch (error) {
          if (import.meta.env.DEV) console.error('[WS] Error loading new product:', error)
        }
      }

      loadNewProduct()
    }
  }, [wsStreamData?.current_product_id, stream.id, isSeller])

  // 상품 전환 슬라이드 애니메이션 트리거
  useEffect(() => {
    if (currentProduct?.id) setProductSlideKey(k => k + 1)
  }, [currentProduct?.id])

  // 플래시세일 카운트다운
  useEffect(() => {
    if (!activeFlashSale?.ends_at) { setFlashSaleSecondsLeft(null); return }
    const tick = () => {
      const left = Math.max(0, Math.floor((new Date(activeFlashSale.ends_at).getTime() - Date.now()) / 1000))
      setFlashSaleSecondsLeft(left)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [activeFlashSale?.ends_at])

  // Wake Lock — 활성 라이브 시청 중 화면 꺼짐 방지
  useEffect(() => {
    if (!isActive || stream.status === 'ended') return
    const acquire = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLockRef.current = await (navigator as Navigator & { wakeLock: { request(t: string): Promise<WakeLockSentinel> } }).wakeLock.request('screen')
        }
      } catch { /* 거부 또는 미지원 — 무시 */ }
    }
    const onVisible = () => { if (document.visibilityState === 'visible' && !wakeLockRef.current) acquire() }
    acquire()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      try { wakeLockRef.current?.release() } catch { /* */ }
      wakeLockRef.current = null
    }
  }, [isActive, stream.status])

  // VOD 준비 대기: ended 전환 후 5분 뒤 YouTube 처리 완료 가정
  useEffect(() => {
    if (stream.status !== 'ended') { setVodReady(true); return }
    setVodReady(false)
    const id = setTimeout(() => setVodReady(true), 5 * 60 * 1000)
    return () => clearTimeout(id)
  }, [stream.status])

  // 다음 라이브 예고: 스트림 종료 시 셀러의 다음 scheduled 라이브 조회
  useEffect(() => {
    if (stream.status !== 'ended' || !stream.seller_id) return
    let active = true
    api.get(`/api/seller/${stream.seller_id}/public-streams?status=scheduled&limit=1`)
      .then(r => { if (active && r.data?.data?.[0]) setNextLive(r.data.data[0]) })
      .catch(() => {})
    return () => { active = false }
  }, [stream.status, stream.seller_id])

  // D1 폴링에서 재고 변경 감지 시 UI 업데이트
  useEffect(() => {
    if (!polledProduct || !currentProduct) return

    if (polledProduct.stock !== currentProduct.stock) {
      setCurrentProduct(prev => {
        if (!prev) return prev
        return { ...prev, stock: polledProduct.stock }
      })
    }
  }, [polledProduct?.stock, currentProduct?.id])

  // 초기 상품 로드: 전체 상품 데이터(stock, originalPrice 등)를 DB에서 가져옴
  // ✅ currentProduct 조건 제거 - stream 목록 API의 current_product는 일부 필드만 포함하므로 항상 전체 로드
  useEffect(() => {
    if (!stream.id) return

    const loadInitialProduct = async () => {
      try {
        const response = await api.get(`/api/streams/${stream.id}/current-product`)
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
      showAlert(t('live.loginErrorMsg', { defaultValue: '로그인 페이지로 이동 중 오류가 발생했습니다.' }), 'error', t('live.loginErrorTitle', { defaultValue: '오류 발생' }))
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
      setNotificationText(t('live.outOfStock', { defaultValue: '품절된 상품입니다' }))
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
      
      showAlert(t('live.loginRequired', { defaultValue: '로그인이 필요합니다!' }), 'warning', t('live.loginRequiredTitle', { defaultValue: '로그인 필요' }))
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
      setNotificationText(t('live.addedToCart', { defaultValue: '장바구니에 추가되었습니다' }))
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
      const userName = localStorage.getItem('user_name') || t('live.anonymous', { defaultValue: '익명' })
      const maskedName = maskUserName(userName)
      const systemMsg = t('live.cartSystemMsg', { name: maskedName, product: currentProduct.name, defaultValue: `${maskedName}님이 ${currentProduct.name}을(를) 담았습니다!` })

      try {
        await sendChatMessage(systemMsg, 0, t('live.systemUser', { defaultValue: '🎉 시스템' }), 'system')
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
      const errorMessage = apiErr?.response?.data?.error || apiErr?.message || t('live.cartAddFailed', { defaultValue: '장바구니 추가에 실패했습니다.' })
      const errorString = typeof errorMessage === 'string' ? errorMessage : JSON.stringify(errorMessage);
      
      if (errorString.includes('Insufficient stock') || errorString.includes('재고가 부족')) {
        setNotificationText(t('live.stockInsufficient', { defaultValue: '재고가 부족합니다' }))
        setShowNotification(true)
        setTimeout(() => setShowNotification(false), 2500)
      } else {
        showAlert(errorString, 'error', t('live.cartAddFailTitle', { defaultValue: '장바구니 추가 실패' }))
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
      showAlert(t('live.loginRequired', { defaultValue: '로그인이 필요합니다!' }), 'warning', t('live.loginRequiredTitle', { defaultValue: '로그인 필요' }))
      handleKakaoLogin()
      return
    }

    // ✅ 현재 상품이 없으면 담기 불가
    if (!currentProduct) {
      showAlert(t('live.noProductForSale', { defaultValue: '판매 중인 상품이 없습니다.' }), 'info', t('live.noProductTitle', { defaultValue: '상품 없음' }))
      return
    }
    
    setCheckingOut(true)
    try {
      // 바로구매: 장바구니 거치지 않고 해당 상품만 결제
      localStorage.setItem('lastViewedLiveId', String(stream.id))
      localStorage.setItem('lastViewedLiveAt', String(Date.now()))
      navigate('/checkout', {
        state: {
          returnUrl: `/live/${stream.id}`,
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
            shipping_fee: stream.seller_shipping_fee ?? 3000,
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
      const errorMessage = apiErr?.response?.data?.error || apiErr?.message || t('live.checkoutFailed', { defaultValue: '상품 담기에 실패했습니다.' })
      showAlert(errorMessage, 'error', t('live.checkoutFailTitle', { defaultValue: '결제 실패' }))
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
      setNotificationText(t('live.productIntroducing', { defaultValue: '✅ 이 상품을 지금 소개 중입니다!' }))
      setShowNotification(true)
      setTimeout(() => setShowNotification(false), 2000)

    } catch (error: unknown) {
      if (import.meta.env.DEV) console.error('[Seller] Failed to change product:', error)
      const apiErr = isApiError(error) ? error : undefined
      showAlert(apiErr?.response?.data?.error || t('live.productChangeFailed', { defaultValue: '상품 전환에 실패했습니다.' }), 'error', t('live.productChangeFailTitle', { defaultValue: '전환 실패' }))
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
      showAlert(t('live.spamWarning', { defaultValue: '메시지를 너무 빠르게 보내고 있습니다. 잠시 후 다시 시도해주세요.' }), 'warning', t('live.spamWarningTitle', { defaultValue: '도배 방지' }))
      return
    }

    setSendingMessage(true)
    try {
      const userId = getUserId()
      if (!userId) {
        showAlert(t('live.loginRequiredForChat', { defaultValue: '로그인이 필요합니다.' }), 'warning', t('live.loginRequiredTitle', { defaultValue: '로그인 필요' }))
        setSendingMessage(false)
        return
      }

      const rawUserName = localStorage.getItem('user_name') || t('live.anonymous', { defaultValue: '익명' })
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
      showAlert(t('live.messageSendFailed', { defaultValue: '메시지 전송에 실패했습니다.' }), 'error', t('live.messageSendFailTitle', { defaultValue: '전송 실패' }))
    } finally {
      setSendingMessage(false)
    }
  }

  return (
    <div className="relative h-full w-full snap-start snap-always overflow-hidden bg-black">
      {/* LIVE Badge - 셀러가 자신의 스트림을 보고 있고, 현재 소개 중인 상품일 때만 표시 */}
      {isCurrentProduct && isSeller && (
        <div className="absolute top-24 left-4 z-[101] flex items-center gap-2 bg-gradient-to-r from-purple-600 to-pink-600 px-3 py-1.5 rounded-full shadow-2xl">
          <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
          <span className="text-white font-bold text-[11px] tracking-wide">{t('live.intro')}</span>
        </div>
      )}
      
      {/* 배경 레이어: custom 썸네일 → DB thumbnail_url → YouTube hqdefault → 숨김 (404 시).
          🛡️ 2026-05-11: youtube_video_id 가 있어도 YouTube 비디오가 삭제되면 404 (콘솔 스팸). 셀러 업로드 / DB 저장 썸네일 우선. */}
      {(() => {
        const candidates: string[] = []
        const customThumb = (stream as { custom_thumbnail_url?: string }).custom_thumbnail_url
        if (customThumb) candidates.push(customThumb)
        if (stream.thumbnail_url && !candidates.includes(stream.thumbnail_url)) candidates.push(stream.thumbnail_url)
        if (stream.youtube_video_id) candidates.push(`https://img.youtube.com/vi/${stream.youtube_video_id}/hqdefault.jpg`)
        if (candidates.length === 0) return null
        return (
          <img
            src={candidates[0]}
            data-fallback-index="0"
            data-fallbacks={JSON.stringify(candidates)}
            alt=""
            className="absolute inset-0 h-full w-full object-cover -z-10"
            loading="eager"
            decoding="async"
            fetchPriority="high"
            onError={(e) => {
              const img = e.currentTarget
              try {
                const list: string[] = JSON.parse(img.dataset.fallbacks || '[]')
                const idx = parseInt(img.dataset.fallbackIndex || '0') + 1
                if (idx < list.length) {
                  img.dataset.fallbackIndex = String(idx)
                  img.src = list[idx]
                } else {
                  img.style.display = 'none'
                }
              } catch {
                img.style.display = 'none'
              }
            }}
          />
        )
      })()}
      <div className="absolute inset-0 h-full w-full bg-gradient-to-br from-gray-900 via-gray-800 to-black -z-20" />

      {/* YouTube Player Container */}
      <div
        id={`youtube-player-${stream.id}`}
        className="absolute inset-0 w-full h-full z-[5] overflow-hidden [&_iframe]:!absolute [&_iframe]:!top-[50%] [&_iframe]:!left-[50%] [&_iframe]:![transform:translate(-50%,-50%)] [&_iframe]:!w-[max(100vw,177.78dvh)] [&_iframe]:!h-[max(100dvh,56.25vw)]"
      />

      {/* 예약 방송 + 라이브 시작 직후 (video_id 미수신) UI */}
      {(stream.status === 'scheduled' || (stream.status === 'live' && !stream.youtube_video_id)) && (
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
          <p className="text-white text-lg font-bold mb-1">{t('live.player.errorTitle')}</p>
          <p className="text-white/70 text-sm">{playerError}</p>
        </div>
      )}

      {/* 라이브 종료 후 VOD 준비 대기 오버레이 (5분) */}
      {stream.status === 'ended' && !vodReady && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/80 px-6 text-center">
          <div className="h-16 w-16 rounded-full bg-white/10 flex items-center justify-center mb-4 animate-pulse">
            <svg className="w-8 h-8 text-white/60" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.069A1 1 0 0121 8.868V15.132a1 1 0 01-1.447.899L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
            </svg>
          </div>
          <p className="text-white text-base font-bold mb-1">{t('live.vodPreparing', { defaultValue: '다시보기 준비 중' })}</p>
          <p className="text-white/50 text-sm">{t('live.vodPreparingDesc', { defaultValue: '방송이 종료되었습니다. 잠시 후 다시보기가 제공됩니다.' })}</p>
          {nextLive && (
            <div className="mt-4 rounded-xl bg-white/10 px-4 py-3 text-left w-full max-w-xs">
              <p className="text-white/60 text-xs mb-1">{t('live.nextLive', { defaultValue: '다음 라이브' })}</p>
              <p className="text-white text-sm font-bold truncate">{nextLive.title}</p>
              {nextLive.scheduled_at && (
                <p className="text-white/50 text-xs mt-0.5">{new Date(nextLive.scheduled_at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* 다음 라이브 예고 (VOD 준비 완료 후에도 표시) */}
      {stream.status === 'ended' && vodReady && nextLive && (
        <div className="absolute bottom-32 left-4 right-4 z-20 pointer-events-none">
          <div className="rounded-xl bg-black/70 backdrop-blur-sm px-4 py-3">
            <p className="text-white/60 text-xs mb-1">{t('live.nextLive', { defaultValue: '다음 라이브' })}</p>
            <p className="text-white text-sm font-bold truncate">{nextLive.title}</p>
            {nextLive.scheduled_at && (
              <p className="text-white/50 text-xs mt-0.5">{new Date(nextLive.scheduled_at).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
            )}
          </div>
        </div>
      )}

      {/* 🛡️ 2026-05-07: youtube_video_id 없을 때 명확한 안내 (무한 로딩 방지).
          셀러가 방송 생성만 하고 YouTube 송출 시작 안 한 케이스. */}
      {stream.status !== 'scheduled' && !stream.youtube_video_id && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/70 px-6 text-center">
          <div className="h-16 w-16 rounded-full bg-yellow-500/20 flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-yellow-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            </svg>
          </div>
          <p className="text-white text-lg font-bold mb-1">{t('live.notReady', { defaultValue: '방송 준비 중' })}</p>
          <p className="text-white/70 text-sm">{t('live.notReadyDesc', { defaultValue: '셀러가 곧 방송을 시작해요' })}</p>
        </div>
      )}

      {/* 라이브/종료 방송: 로딩 → 자동재생 → 실패 시 탭 유도 */}
      {stream.status !== 'scheduled' && stream.youtube_video_id && !playerError && showPlayButton && (
        <button
          onClick={handleVideoClick}
          className="absolute inset-0 z-10 flex flex-col items-center justify-center transition-all bg-black/60 cursor-pointer"
          aria-label={t('live.enterAria', { defaultValue: '방송 입장하기' })}
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
                  <p className="text-white text-xl font-bold mb-1">{t('live.tapToStart')}</p>
                  <p className="text-white/50 text-xs">{t('live.tapToStartSub')}</p>
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
                  <p className="text-white text-xl font-bold mb-1.5">{t('live.entering')}</p>
                  <p className="text-white/60 text-sm">{t('live.enteringSub')}</p>
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
        {/* 🛡️ 2026-04-30: 좌측 넘침 수정 left-3→left-4 (max-w 추가) */}
        {!isSeller && (
          <div className="pointer-events-auto absolute top-14 left-4 right-4 z-20" style={{ maxWidth: 'calc(100% - 32px)' }}>
            <TeamPointsBadge streamId={stream.id} donationGoal={stream.donation_goal} />
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

        {/* 플래시세일 배너 — WebSocket activeFlashSale 이벤트 시 표시 */}
        {activeFlashSale && flashSaleSecondsLeft !== null && flashSaleSecondsLeft > 0 && (
          <div className="pointer-events-auto absolute top-[4.5rem] left-4 right-4 z-20">
            <div className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 px-3 py-2 shadow-lg shadow-orange-500/30 animate-fade-in">
              <span className="text-lg">⚡</span>
              <div className="flex-1 min-w-0">
                <p className="text-white text-xs font-bold truncate">
                  {t('live.flashSale', { defaultValue: '{{rate}}% 추가 할인', rate: activeFlashSale.discount_rate })}
                </p>
              </div>
              <div className="shrink-0 bg-white/20 rounded-lg px-2 py-0.5 text-white text-xs font-mono font-bold">
                {String(Math.floor(flashSaleSecondsLeft / 60)).padStart(2,'0')}:{String(flashSaleSecondsLeft % 60).padStart(2,'0')}
              </div>
            </div>
          </div>
        )}

        {/* 🛡️ 2026-04-29 v4 Boutique 톤: TimeDealPopup default off (Q6=C 보존하되 미표시).
            타임딜 정보는 chat feed 의 inline 시스템 이벤트로 노출. */}
        {activeFlashSale && <TimeDealPopup streamId={stream.id} />}

        {/* Spacer pushes content to bottom */}
        <div className="flex-1" />

        {/* Content area — safe area 대응 */}
        <div className="pointer-events-auto relative flex flex-col px-3 pb-safe" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
          {/* 🛡️ 2026-04-27 PK 진행 배너 (활성 PK 만 표시) */}
          <div className="mb-2">
            <PKLiveBanner liveStreamId={stream.id} />
          </div>
          {/* Chat + action icons row */}
          <div className="flex items-end gap-2 mb-2">
            {/* 🛡️ 2026-04-29 v4 Boutique 톤: chat feed 는 chatModalOpen=true 일 때만 표시 (Q9=A).
                평소에는 시청자가 영상에 집중. chat 버튼(우측 action rail) 클릭 시 채팅창 열림. */}
            <div className="min-w-0 flex-1">
              {chatModalOpen && (
                <LiveChat
                  messages={mergedChatMessages}
                  onChatClick={() => setChatInputOpen(true)}
                  pinnedMessage={pinnedMessage}
                />
              )}
            </div>

            {/* 🛡️ TD-006: ReelActionRail 컴포넌트로 추출 (2026-05-06) */}
            <ReelActionRail
              stream={stream}
              safeProduct={safeProduct}
              isSeller={!!isSeller}
              streamProductCount={streamProducts?.length ?? 0}
              onOpenProducts={openProductListSheet}
              onOpenChat={() => setChatInputOpen(true)}
            />
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
                        <p className="text-[11px] text-gray-900 dark:text-white font-medium truncate">{p.name}</p>
                        <p className="text-[12px] font-bold text-red-400">₩{formatNumber(p.price || 0)}</p>
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

          {/* 🛡️ TD-006: ReelProductCard 컴포넌트로 추출 (2026-05-06) */}
          <ReelProductCard
            key={productSlideKey}
            safeProduct={safeProduct}
            currentProduct={currentProduct}
            isSeller={!!isSeller}
            streamProduct={product}
            isCurrentProduct={isCurrentProduct}
            addingToCart={addingToCart}
            checkingOut={checkingOut}
            changingProduct={changingProduct}
            streamId={stream.id}
            onAddToCart={handleAddToCart}
            onCheckout={handleCheckout}
            onChangeProduct={handleChangeProduct}
          />
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

      {/* Chat Input Sheet — 채팅 버튼 클릭 시만 열림 */}
      {chatInputOpen && (
        <ReelChatSheet
          chatMessage={chatMessage}
          sendingMessage={sendingMessage}
          isSeller={!!isSeller}
          onChatMessageChange={setChatMessage}
          onClose={() => setChatInputOpen(false)}
          onSubmit={handleSendMessage}
        />
      )}
      {/* 후원은 LiveDonation 컴포넌트에서 처리 (딜 포인트 방식) */}
    </div>
  )
}

// React.memo: reel 객체 동일 참조 + isActive/isCurrentProduct 동일 시 재렌더링 skip.
// 무한 스크롤 카드 다수 마운트 시 비활성 카드의 불필요한 re-render 차단 (LivePageV2 activeIndex 변경 → 모든 카드 재렌더링 방지).
export default memo(ReelCardImpl)
