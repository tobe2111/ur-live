import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ShoppingBag, MessageCircle, Share2, X, Star, Check, Send } from 'lucide-react'
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
import LiveDonation, { DonationEffect } from '@/components/LiveDonation'
import '@/utils/console-suppressor'

// Extracted components and utilities
import type { YTPlayer, YTPlayerEvent, Stream, Product, ReelData } from '@/components/live/LiveTypes'
import { isApiError, usernames, chatTexts, getRandomItem, formatViewers, maskUserName } from '@/components/live/LiveUtils'
import { TopNav } from '@/components/live/TopNav'
import { LiveChat } from '@/components/live/LiveChatFeed'
import { ProductListSheet } from '@/components/live/ProductListSheet'
import { TeamPointsBadge } from '@/components/live/TeamPointsBadge'

const log = createLogger('LivePageV2')

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
  const [currentVideoTime, setCurrentVideoTime] = useState(0)

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

  // Poll current video time for chat timeline sync
  useEffect(() => {
    if (!playerReady || !isActive) return
    const interval = setInterval(() => {
      try {
        if (playerRef.current?.getCurrentTime) {
          setCurrentVideoTime(playerRef.current.getCurrentTime())
        }
      } catch { /* ignore */ }
    }, 1000)
    return () => clearInterval(interval)
  }, [playerReady, isActive])

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
      }).catch(() => {})
    }, 30000)

    // Initial join
    fetch(`/api/live/${stream.id}/view`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, action: 'join', deviceType: /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop' }),
    }).catch(() => {})

    return () => {
      clearInterval(heartbeatInterval)
      // Leave
      fetch(`/api/live/${stream.id}/view`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, action: 'leave', watchDuration: watchSeconds }),
      }).catch(() => {})
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

      // 바로구매: 장바구니 거치지 않고 해당 상품만 결제
      log.debug('[Checkout] Direct purchase - navigating to checkout with product:', currentProduct.id)
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
        className="absolute inset-0 w-full h-full z-[5] overflow-hidden [&_iframe]:!absolute [&_iframe]:!top-[50%] [&_iframe]:!left-[50%] [&_iframe]:![transform:translate(-50%,-50%)] [&_iframe]:!w-[177.78vh] [&_iframe]:!h-[56.25vw] [&_iframe]:!min-w-full [&_iframe]:!min-h-full"
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
        {/* Top bar: 딜 잔액 게이지 (LIVE 뱃지 아래에 위치) */}
        {!isSeller && (
          <div className="pointer-events-auto absolute top-12 left-3 z-20">
            <TeamPointsBadge streamId={stream.id} />
          </div>
        )}

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
              <LiveChat
                messages={chatMessages}
                onChatClick={() => setChatModalOpen(true)}
                currentVideoTime={currentVideoTime}
                streamStartTime={stream.created_at ? new Date(stream.created_at).getTime() : undefined}
                timelineSync={stream.status === 'ended'}
              />
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

              {/* 후원하기 버튼 (딜 포인트) */}
              {!isSeller && stream?.id && (
                <LiveDonation streamId={stream.id} />
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

          {/* Chat Sheet with messages + input */}
          <div className="fixed inset-x-0 bottom-0 z-[90] bg-white rounded-t-3xl animate-sheet-up max-h-[70vh] flex flex-col">
            <div className="p-4 border-b flex items-center justify-between shrink-0">
              <h3 className="text-lg font-bold text-gray-900">채팅</h3>
              <button
                onClick={() => setChatModalOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200"
              >
                <X className="h-4 w-4 text-gray-800" />
              </button>
            </div>

            {/* Chat messages list */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 min-h-[200px] max-h-[45vh]">
              {chatMessages.slice(-50).map((msg) => {
                const isSeller = msg.isSeller || msg.userType === 'streamer'
                const isSystem = msg.userType === 'system' || msg.userName === '시스템'

                if (isSeller) {
                  return (
                    <div key={msg.id} className="rounded-xl px-3 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-md">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-[9px] font-bold bg-white/20 px-1.5 py-0.5 rounded-full">🎙 셀러</span>
                        <span className="text-[11px] font-bold">{msg.userName}</span>
                        <span className="text-[9px] text-white/60 ml-auto">
                          {new Date(msg.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-[13px] leading-[1.4]">{msg.message}</p>
                    </div>
                  )
                }

                if (isSystem) {
                  return (
                    <div key={msg.id} className="text-center">
                      <span className="text-[11px] text-yellow-600 bg-yellow-50 px-3 py-1 rounded-full font-medium">
                        {msg.message}
                      </span>
                    </div>
                  )
                }

                return (
                  <div key={msg.id} className="flex gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-[12px] font-bold text-gray-800">{msg.userName}</span>
                        <span className="text-[9px] text-gray-400">
                          {new Date(msg.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-[13px] text-gray-600 leading-[1.4]">{msg.message}</p>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Input */}
            <div className="p-4 border-t shrink-0">
              {isSeller && (
                <div className="flex items-center gap-1.5 mb-2">
                  <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">🎙 셀러로 채팅</span>
                </div>
              )}
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <input
                  type="text"
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  placeholder={isSeller ? "셀러 메시지를 입력하세요..." : "메시지를 입력하세요..."}
                  className={`flex-1 rounded-xl border px-4 py-3 text-sm focus:outline-none ${
                    isSeller
                      ? 'border-indigo-300 focus:border-indigo-500 bg-indigo-50/50'
                      : 'border-gray-300 focus:border-red-500'
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
          tiktok: reels[activeIndex]?.stream?.seller_tiktok || undefined,
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
