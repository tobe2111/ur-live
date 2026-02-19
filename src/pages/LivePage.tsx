import { CustomModal, useModal } from '@/components/CustomModal'
import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import axios from 'axios'
import api from '@/lib/api'
import { ArrowLeft, Share2, MessageCircle, ShoppingBag, Send, X, Instagram, Facebook, Youtube, Package } from 'lucide-react'
import { LazyImage } from '@/components/LazyImage'
import { getUserId, saveUserInfo, isLoggedIn as checkIsLoggedIn } from '@/utils/auth'

interface Product {
  id: number
  name: string
  price: number
  discount_rate: number
  stock: number
  image_url?: string
}

interface Stream {
  id: number
  title: string
  description: string
  youtube_video_id: string
  platform?: string
  seller_name: string
  seller_profile_image?: string
  viewer_count?: number
  seller_instagram?: string
  seller_facebook?: string
  seller_youtube?: string
}

interface CurrentProduct {
  product: Product
}

interface ChatMessage {
  id: number
  user_id?: number
  user_name: string
  user_avatar?: string
  message: string
  is_seller: boolean
  is_admin: boolean
  is_deleted: boolean
  created_at: string
}

export default function LivePage() {
  const { streamId } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [stream, setStream] = useState<Stream | null>(null)
  const [currentProduct, setCurrentProduct] = useState<CurrentProduct | null>(null)
  const [loading, setLoading] = useState(true)
  const [muted, setMuted] = useState(true)  // Start muted for autoplay
  const playerRef = useRef<any>(null)
  const { modal, showAlert, closeModal } = useModal()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [lastMessageId, setLastMessageId] = useState<number>(0)
  const [sendingMessage, setSendingMessage] = useState(false)
  const [cartCount, setCartCount] = useState(0)
  const [showCart, setShowCart] = useState(false)
  const [cartItems, setCartItems] = useState<any[]>([])
  const [likes, setLikes] = useState(1234)
  const [videoStatus, setVideoStatus] = useState<'loading' | 'ended' | 'playing'>('loading')
  const [playerReady, setPlayerReady] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [showChatInput, setShowChatInput] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Filter out TikTok CSP warnings from console (dev experience improvement)
  useEffect(() => {
    const originalWarn = console.warn
    const originalError = console.error
    
    console.warn = (...args: any[]) => {
      const message = args[0]?.toString() || ''
      // Filter TikTok CSP and Permissions Policy warnings
      if (
        message.includes('Content Security Policy') ||
        message.includes('Permissions policy violation') ||
        message.includes('upgrade-insecure-requests') ||
        message.includes('unload is not allowed')
      ) {
        return // Suppress these warnings
      }
      originalWarn.apply(console, args)
    }
    
    console.error = (...args: any[]) => {
      const message = args[0]?.toString() || ''
      // Filter TikTok-related errors that don't affect functionality
      if (
        message.includes('Content Security Policy') ||
        message.includes('Permissions policy')
      ) {
        return // Suppress these errors
      }
      originalError.apply(console, args)
    }
    
    return () => {
      console.warn = originalWarn
      console.error = originalError
    }
  }, [])

  // 사용자 이름 마스킹 함수 (첫 글자만 보이고 나머지는 *)
  function maskUserName(name: string): string {
    if (!name || name === '익명' || name.includes('시스템')) {
      return name  // 익명이나 시스템은 그대로 표시
    }
    
    if (name.length === 1) {
      return name  // 1글자는 그대로
    }
    
    if (name.length === 2) {
      return name[0] + '*'  // 2글자: 정* 
    }
    
    // 3글자 이상: 정**
    return name[0] + '*'.repeat(name.length - 1)
  }

  // Handle Kakao login callback parameters
  useEffect(() => {
    const loginStatus = searchParams.get('login')
    const sessionToken = searchParams.get('session')
    const userId = searchParams.get('userId')
    const userName = searchParams.get('userName')
    
    if (loginStatus === 'success' && sessionToken) {
      // CRITICAL: Save with correct keys for API client
      localStorage.setItem('user_session_token', sessionToken)  // ✅ API client key
      
      // user_type은 seller/admin이 아닌 경우에만 user로 설정
      const existingUserType = localStorage.getItem('user_type')
      if (existingUserType !== 'seller' && existingUserType !== 'admin') {
        localStorage.setItem('user_type', 'user')  // ✅ User type
      }
      
      localStorage.setItem('user_id', userId || '')
      localStorage.setItem('user_name', decodeURIComponent(userName || '카카오 사용자'))
      
      // Remove old keys
      localStorage.removeItem('session')
      
      setIsLoggedIn(true)
      
      console.log('✅ 로그인 성공:', { userId, userName })
      
      // Clean URL (remove login parameters, keep streamId)
      const cleanUrl = `/live/${streamId}`
      window.history.replaceState({}, document.title, cleanUrl)
      
      // Show success message
      showAlert(`환영합니다, ${decodeURIComponent(userName || '카카오 사용자')}님!`, 'success', '로그인 완료')
    }
  }, [searchParams, streamId])

  // Save current live stream ID for "Continue Shopping" button
  useEffect(() => {
    if (streamId) {
      localStorage.setItem('lastViewedLiveId', streamId)
      console.log('[LivePage] 저장된 라이브 ID:', streamId)
    }
  }, [streamId])

  // Check login status from localStorage
  useEffect(() => {
    // 통합 인증: checkIsLoggedIn() 사용
    if (checkIsLoggedIn()) {
      setIsLoggedIn(true)
      
      // Check if there's a temporary cart item to restore
      const tempCartItem = localStorage.getItem('tempCartItem')
      if (tempCartItem) {
        try {
          const cartData = JSON.parse(tempCartItem)
          // Add to cart automatically
          setTimeout(async () => {
            try {
              const uid = getUserId()
              if (!uid) {
                console.error('User ID not found after login')
                localStorage.removeItem('tempCartItem')
                return
              }
              
              await axios.post('/api/cart', {
                userId: uid,
                productId: cartData.productId,
                quantity: cartData.quantity,
                priceSnapshot: cartData.priceSnapshot,
                liveStreamId: cartData.liveStreamId
              })
              
              localStorage.setItem('hasCartItems', 'true')
              localStorage.removeItem('tempCartItem')
              
              // Show success message
              showAlert(`로그인 완료! ${cartData.productName}을(를) 장바구니에 담았습니다.`, 'success', '장바구니 추가 완료')
            } catch (error) {
              console.error('Failed to restore cart item:', error)
              localStorage.removeItem('tempCartItem')
            }
          }, 500)
        } catch (error) {
          console.error('Failed to parse temp cart item:', error)
          localStorage.removeItem('tempCartItem')
        }
      }
    }
    
    // Prevent scrolling on body and html
    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    document.documentElement.style.height = '100dvh'
    document.body.style.height = '100dvh'
    
    loadStreamData()
    loadCurrentProduct()
    loadChatMessages() // 초기 채팅 메시지 로드
    
    // 실시간 채팅 폴링 (3초마다)
    const chatInterval = setInterval(loadChatMessages, 3000)
    
    const interval = setInterval(loadCurrentProduct, 3000)
    return () => {
      clearInterval(interval)
      clearInterval(chatInterval)
      // Restore scrolling when leaving the page
      document.documentElement.style.overflow = ''
      document.body.style.overflow = ''
      document.documentElement.style.height = ''
      document.body.style.height = ''
    }
  }, [streamId])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (!stream?.youtube_video_id) return

    // YouTube player only
    let player: any = null
    let isMounted = true  // Track if component is mounted

    const initializePlayer = () => {
      try {
        // @ts-ignore
        if (!window.YT || !window.YT.Player) return
        if (!isMounted) return  // Don't initialize if unmounted

        const playerElement = document.getElementById('youtube-player')
        if (!playerElement) return

        // Clear any existing content
        playerElement.innerHTML = ''

        // @ts-ignore
        player = new window.YT.Player('youtube-player', {
          height: '100%',
          width: '100%',
          videoId: stream.youtube_video_id,
          playerVars: {
            autoplay: 1,
            mute: 1,
            controls: 0,  // Hide controls for immersive live experience
            modestbranding: 1,
            rel: 0,
            showinfo: 0,
            iv_load_policy: 3,
            playsinline: 1,  // Critical for iOS
            enablejsapi: 1,
            // origin parameter removed to fix postMessage errors
            // Loop settings for non-live videos
            loop: 1,  // Enable loop
            playlist: stream.youtube_video_id,  // Required for loop to work
            // Mobile optimizations
            fs: 0,  // Disable fullscreen button for cleaner look
            cc_load_policy: 0,  // Don't show captions by default
          },
          events: {
            onReady: (event: any) => {
              if (!isMounted) return  // Don't update state if unmounted
              console.log('YouTube player ready')
              playerRef.current = event.target
              setPlayerReady(true)
              setVideoStatus('playing')
              
              // Apply full-screen style to iframe immediately
              const applyIframeStyles = () => {
                const iframe = playerElement.querySelector('iframe')
                if (iframe) {
                  console.log('Applying iframe styles, current size:', iframe.offsetWidth, 'x', iframe.offsetHeight)
                  
                  // Force remove YouTube's default styles
                  iframe.removeAttribute('style')
                  iframe.removeAttribute('width')
                  iframe.removeAttribute('height')
                  
                  // Apply our styles with maximum specificity
                  iframe.style.cssText = `
                    position: absolute !important;
                    top: 0 !important;
                    left: 0 !important;
                    width: 100% !important;
                    height: 100% !important;
                    max-width: 100% !important;
                    max-height: 100% !important;
                    pointer-events: none !important;
                    border: none !important;
                    z-index: 1 !important;
                  `
                  
                  console.log('After applying styles:', iframe.offsetWidth, 'x', iframe.offsetHeight)
                }
              }
              
              // Apply immediately
              applyIframeStyles()
              
              // Also apply after a short delay to override any YouTube changes
              setTimeout(applyIframeStyles, 100)
              setTimeout(applyIframeStyles, 500)
              
              // Start playing (muted for autoplay policy)
              event.target.playVideo()
            },
            onStateChange: (event: any) => {
              if (!isMounted) return  // Don't update state if unmounted
              console.log('YouTube player state:', event.data)
              
              // @ts-ignore
              if (event.data === window.YT.PlayerState.PLAYING) {
                if (isMounted) setVideoStatus('playing')
              } else if (event.data === window.YT.PlayerState.BUFFERING) {
                // Keep playing status during buffering
                if (isMounted) setVideoStatus('playing')
              } else if (event.data === window.YT.PlayerState.ENDED) {
                // For non-live videos, restart from beginning
                console.log('Video ended, restarting...')
                if (isMounted) setVideoStatus('playing')
                // Restart video for loop (backup in case YouTube loop fails)
                if (event.target && typeof event.target.seekTo === 'function') {
                  event.target.seekTo(0)
                  event.target.playVideo()
                }
              } else if (event.data === window.YT.PlayerState.PAUSED) {
                // @ts-ignore
                console.log('Video paused, attempting to play...')
                setTimeout(() => {
                  if (isMounted && event.target && typeof event.target.playVideo === 'function') {
                    event.target.playVideo()
                  }
                }, 100)
              }
            },
            onError: (event: any) => {
              if (!isMounted) return  // Don't update state if unmounted
              console.error('YouTube player error:', event.data)
              // Error codes: 2=invalid ID, 5=HTML5 error, 100=not found, 101/150=embedding disabled
              if (isMounted) setVideoStatus('ended')
            },
          },
        })
      } catch (error) {
        console.error('Failed to initialize YouTube player:', error)
      }
    }

    // Load YouTube IFrame API if not already loaded
    // @ts-ignore
    if (window.YT && window.YT.Player) {
      initializePlayer()
    } else {
      const existingScript = document.querySelector('script[src*="youtube.com/iframe_api"]')
      if (!existingScript) {
        const tag = document.createElement('script')
        tag.src = 'https://www.youtube.com/iframe_api'
        tag.async = true
        const firstScriptTag = document.getElementsByTagName('script')[0]
        firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag)
      }

      // @ts-ignore
      window.onYouTubeIframeAPIReady = () => {
        if (isMounted) initializePlayer()
      }
    }

    return () => {
      isMounted = false  // Mark as unmounted
      
      // Destroy player safely
      if (player && typeof player.destroy === 'function') {
        try {
          player.destroy()
        } catch (error) {
          console.error('Error destroying player:', error)
        }
      }
      
      // Clear player ref
      playerRef.current = null
    }
  }, [stream])

  // Firebase 실시간 채팅 초기화
  useEffect(() => {
    if (!streamId) return

    // Firebase SDK 로드 확인
    const checkFirebase = () => {
      // @ts-ignore
      if (typeof window.firebase !== 'undefined' && window.firebase) {
        console.log('✅ Firebase SDK loaded')
        initializeFirebaseChat()
      } else {
        console.log('⏳ Waiting for Firebase SDK...')
        setTimeout(checkFirebase, 500)
      }
    }

    checkFirebase()
  }, [streamId])

  function initializeFirebaseChat() {
    try {
      // @ts-ignore
      const firebaseConfig = {
        apiKey: "AIzaSyA8Lsr6o9gRjMARI-mWaFGrciRs9z2CH7s",
        authDomain: "urteam-live-commerce.firebaseapp.com",
        databaseURL: "https://urteam-live-commerce-default-rtdb.asia-southeast1.firebasedatabase.app",
        projectId: "urteam-live-commerce",
        storageBucket: "urteam-live-commerce.firebasestorage.app",
        messagingSenderId: "1098157020294",
        appId: "1:1098157020294:web:5f527d8e3e9f941cedad07"
      }

      // @ts-ignore
      if (!window.firebase.apps.length) {
        // @ts-ignore
        window.firebase.initializeApp(firebaseConfig)
      }

      // @ts-ignore
      const database = window.firebase.database()
      const chatRef = database.ref(`chats/stream${streamId}`)
      
      console.log('✅ Firebase 초기화 완료')

      // 최신 10개 메시지 가져오기
      chatRef.limitToLast(10).once('value', (snapshot) => {
        const loadedMessages: ChatMessage[] = []
        snapshot.forEach((child) => {
          const msg = child.val()
          loadedMessages.push({
            id: child.key || Date.now().toString(),
            username: msg.username,
            message: msg.text,
            timestamp: msg.timestamp,
            isSystem: msg.isSystem || false
          })
        })
        
        if (loadedMessages.length > 0) {
          setMessages(loadedMessages)
          console.log(`📥 ${loadedMessages.length}개 메시지 로드됨`)
        } else {
          // 메시지 없으면 데모 메시지 로드
          loadDemoMessages()
        }
      })

      // 실시간 리스너 (새 메시지만)
      let lastMessageTime = Date.now()
      chatRef.orderByChild('timestamp').startAt(lastMessageTime).on('child_added', (snapshot) => {
        const msg = snapshot.val()
        
        // 중복 방지 (이미 로드된 메시지 제외)
        if (msg.timestamp > lastMessageTime) {
          const newMessage: ChatMessage = {
            id: snapshot.key || Date.now().toString(),
            username: msg.username,
            message: msg.text,
            timestamp: msg.timestamp,
            isSystem: msg.isSystem || false
          }
          
          setMessages(prev => [...prev, newMessage])
          console.log('📩 새 메시지:', newMessage)
        }
      })

      // Cleanup
      return () => {
        chatRef.off()
      }
    } catch (error) {
      console.error('❌ Firebase 초기화 실패:', error)
      loadDemoMessages()
    }
  }

  function loadDemoMessages() {
    // 실제 채팅 메시지 로드로 대체됨
    loadChatMessages()
  }

  async function loadChatMessages() {
    if (!streamId) return

    try {
      const url = lastMessageId > 0 
        ? `/api/chat/${streamId}/messages?since=${lastMessageId}&limit=50`
        : `/api/chat/${streamId}/messages?limit=50`

      const response = await axios.get(url)
      
      if (response.data.success) {
        const newMessages = response.data.data as ChatMessage[]
        
        if (newMessages.length > 0) {
          setMessages(prev => {
            // 중복 제거
            const existingIds = new Set(prev.map(m => m.id))
            const filtered = newMessages.filter(m => !existingIds.has(m.id))
            return [...prev, ...filtered]
          })
          
          // 마지막 메시지 ID 업데이트
          const lastId = Math.max(...newMessages.map(m => m.id))
          setLastMessageId(lastId)
        }
      }
    } catch (error) {
      console.error('Failed to load chat messages:', error)
    }
  }

  async function sendChatMessage() {
    if (!newMessage.trim() || !streamId || sendingMessage) return

    const messageText = newMessage.trim()
    setNewMessage('')
    setSendingMessage(true)

    try {
      const userId = getUserId()
      const userName = localStorage.getItem('user_name') || '익명'
      
      const response = await axios.post(`/api/chat/${streamId}/messages`, {
        userId: userId || null,
        userName: maskUserName(userName),
        userAvatar: null,
        message: messageText,
        isSeller: false,
        isAdmin: false
      })

      if (response.data.success) {
        // 메시지 전송 성공 - 즉시 새 메시지 로드
        loadChatMessages()
      }
    } catch (error: any) {
      console.error('Failed to send message:', error)
      
      if (error.response?.status === 403) {
        showAlert('채팅이 금지되었습니다', 'error', '채팅 금지')
      } else {
        showAlert('메시지 전송에 실패했습니다', 'error', '전송 실패')
      }
      
      // 실패 시 메시지 복구
      setNewMessage(messageText)
    } finally {
      setSendingMessage(false)
    }
  }

  async function loadStreamData() {
    try {
      const response = await axios.get(`/api/streams/${streamId}`)
      if (response.data.success) {
        setStream(response.data.data)
      }
    } catch (error) {
      console.error('Failed to load stream:', error)
    } finally {
      setLoading(false)
    }
  }

  async function loadCurrentProduct() {
    try {
      const response = await axios.get(`/api/streams/${streamId}/current-product`)
      if (response.data.success && response.data.data) {
        setCurrentProduct(response.data.data)
      }
    } catch (error) {
      console.error('Failed to load current product:', error)
    }
  }

  const [showNotification, setShowNotification] = useState(false)
  const [notificationText, setNotificationText] = useState('')
  const [addingToCart, setAddingToCart] = useState(false)
  const [checkingOut, setCheckingOut] = useState(false)

  async function handleAddToCart() {
    if (!currentProduct?.product) return
    if (addingToCart) return  // Prevent double-click
    
    // 재고 확인
    if (currentProduct.product.stock === 0) {
      setNotificationText('품절된 상품입니다')
      setShowNotification(true)
      setTimeout(() => setShowNotification(false), 2000)
      return
    }

    // Check login first
    if (!isLoggedIn) {
      // Save current product to temporary cart before login
      const tempCart = {
        productId: currentProduct.product.id,
        quantity: 1,
        priceSnapshot: currentProduct.product.price,
        liveStreamId: streamId,
        productName: currentProduct.product.name,
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
      // 통합 인증: getUserId() 사용
      const userId = getUserId()
      
      if (!userId) {
        // 현재 URL을 returnUrl로 저장
        const currentUrl = window.location.pathname + window.location.search
        localStorage.setItem('loginReturnUrl', currentUrl)
        
        // 장바구니에 담으려던 상품 정보 임시 저장
        const tempCartData = {
          productId: currentProduct.product.id,
          productName: currentProduct.product.name,
          quantity: 1,
          priceSnapshot: currentProduct.product.price,
          liveStreamId: streamId
        }
        localStorage.setItem('tempCartItem', JSON.stringify(tempCartData))
        
        showAlert('로그인이 필요합니다. 로그인 후 자동으로 장바구니에 담아드립니다.', 'info', '로그인 필요')
        setTimeout(() => {
          window.location.href = '/login'
        }, 1500)
        return
      }
      
      // POST to server
      await axios.post('/api/cart', {
        userId: userId,
        productId: currentProduct.product.id,
        quantity: 1,
        priceSnapshot: currentProduct.product.price,
        liveStreamId: streamId
      })
      
      // Set flag in localStorage
      localStorage.setItem('hasCartItems', 'true')
      
      setCartCount(prev => prev + 1)
      setCartItems(prev => [...prev, currentProduct.product])

      // Show notification banner
      setNotificationText(`${currentProduct.product.name}을(를) 담았습니다!`)
      setShowNotification(true)
      setTimeout(() => setShowNotification(false), 2000)

      // Add system message to chat via Firebase
      try {
        // @ts-ignore
        if (typeof window.firebase !== 'undefined' && window.firebase) {
          // @ts-ignore
          const database = window.firebase.database()
          const chatRef = database.ref(`chats/stream${streamId}`)
          
          const userName = localStorage.getItem('user_name') || '익명'
          const maskedName = maskUserName(userName)  // 마스킹 적용!
          
          chatRef.push({
            username: '🎉 시스템',
            text: `${maskedName}님이 ${currentProduct.product.name}을(를) 담았습니다!`,  // 마스킹된 이름 사용
            // @ts-ignore
            timestamp: window.firebase.database.ServerValue.TIMESTAMP,
            isSystem: true
          })
        }
      } catch (error) {
        console.error('시스템 메시지 전송 실패:', error)
      }
    } catch (error: any) {
      console.error('Failed to add to cart:', error)
      const errorMessage = error.response?.data?.error || error.message || '장바구니 추가에 실패했습니다.'
      
      // 재고 부족 에러 처리
      if (errorMessage.includes('Insufficient stock') || errorMessage.includes('재고가 부족')) {
        setNotificationText('재고가 부족합니다')
        setShowNotification(true)
        setTimeout(() => setShowNotification(false), 2500)
      } else {
        showAlert(errorMessage, 'error', '장바구니 추가 실패')
      }
    } finally {
      setAddingToCart(false)
    }
  }

  // Kakao Sync Login
  async function handleKakaoLogin() {
    try {
      // Save current page to return after login
      localStorage.setItem('loginReturnUrl', window.location.pathname)
      
      // Navigate to login page with return URL
      navigate('/login?returnUrl=' + encodeURIComponent(window.location.pathname))
    } catch (error) {
      console.error('[Login] Exception:', error)
      showAlert('로그인 페이지로 이동 중 오류가 발생했습니다.', 'error', '오류 발생')
    }
  }

  async function handleCheckout() {
    if (checkingOut) return  // Prevent double-click
    
    // Check login FIRST (before checking cart)
    if (!isLoggedIn) {
      showAlert('로그인이 필요합니다!', 'warning', '로그인 필요')
      handleKakaoLogin()
      return
    }
    
    // Check if cart has items
    const hasCartItems = localStorage.getItem('hasCartItems')
    
    if (!hasCartItems || hasCartItems !== 'true') {
      showAlert('상품을 먼저 담아주세요!', 'info', '상품 담기')
      return
    }
    
    setCheckingOut(true)
    // Verify cart on server
    try {
      // 통합 인증: getUserId() 사용
      const userId = getUserId()
      
      if (!userId) {
        // 현재 URL을 returnUrl로 저장
        const currentUrl = window.location.pathname + window.location.search
        localStorage.setItem('loginReturnUrl', currentUrl)
        
        showAlert('로그인이 필요합니다.', 'warning', '로그인 필요')
        setCheckingOut(false)
        setTimeout(() => {
          window.location.href = '/login'
        }, 1500)
        return
      }
      
      const response = await api.get('/api/cart')
      console.log('[Checkout] Server cart response:', response.data)
      
      // Check if response is valid and has items
      const cartData = response.data?.data || response.data
      if (!cartData || !Array.isArray(cartData) || cartData.length === 0) {
        showAlert('장바구니가 비어있습니다. 상품을 먼저 담아주세요!', 'info', '장바구니 비어있음')
        localStorage.removeItem('hasCartItems')
        setCheckingOut(false)
        return
      }
      
      // Navigate to cart page only if cart has items
      console.log('[Checkout] Navigating to cart with', cartData.length, 'items')
      navigate('/cart')
      
    } catch (error: any) {
      console.error('Failed to check cart:', error)
      const errorMessage = error.response?.data?.error || error.message || '장바구니 확인에 실패했습니다.'
      showAlert(errorMessage, 'error', '결제 실패')
    } finally {
      setCheckingOut(false)
    }
  }

  function handleSNSFollow(platform: 'instagram' | 'facebook' | 'youtube') {
    if (!stream) return
    
    let url = ''
    if (platform === 'instagram' && stream.seller_instagram) {
      url = stream.seller_instagram.startsWith('http') 
        ? stream.seller_instagram 
        : `https://instagram.com/${stream.seller_instagram}`
    } else if (platform === 'facebook' && stream.seller_facebook) {
      url = stream.seller_facebook.startsWith('http') 
        ? stream.seller_facebook 
        : `https://facebook.com/${stream.seller_facebook}`
    } else if (platform === 'youtube' && stream.seller_youtube) {
      url = stream.seller_youtube.startsWith('http') 
        ? stream.seller_youtube 
        : `https://youtube.com/${stream.seller_youtube}`
    }
    
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer')
    }
  }

  function handleSendMessage(e: React.FormEvent) {
    e.preventDefault()
    sendChatMessage()
    setShowChatInput(false)
  }

  function handleShowProducts() {
    // Navigate to products page or show product list
    showAlert('상품 목록 보기 기능 (구현 예정)', 'info', '준비 중')
  }

  function toggleMute() {
    if (playerRef.current) {
      if (muted) {
        playerRef.current.unMute()
        setMuted(false)
      } else {
        playerRef.current.mute()
        setMuted(true)
      }
    }
  }

  async function handleShare() {
    const shareUrl = window.location.href
    const shareTitle = stream?.title || '유어 쇼핑 라이브'
    const shareText = `${shareTitle} - ${stream?.seller_name || ''}`

    console.log('[Share] URL:', shareUrl)
    console.log('[Share] Title:', shareTitle)
    console.log('[Share] Text:', shareText)

    // Web Share API 지원 확인 (모바일)
    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl,
        })
        console.log('공유 성공')
      } catch (error: any) {
        // 사용자가 공유 취소한 경우 (AbortError)
        if (error.name !== 'AbortError') {
          console.error('공유 실패:', error)
          // Fallback to clipboard
          copyToClipboard(shareUrl)
        }
      }
    } else {
      // Web Share API 미지원 (데스크톱) - 클립보드 복사
      copyToClipboard(shareUrl)
    }
  }

  function copyToClipboard(text: string) {
    console.log('[Clipboard] Copying text:', text)
    console.log('[Clipboard] Text length:', text.length)
    console.log('[Clipboard] Text chars:', text.split('').map(c => `${c}(${c.charCodeAt(0)})`).join(' '))
    
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(() => {
          console.log('[Clipboard] Copy success')
          showAlert('링크가 복사되었습니다!\n원하는 곳에 붙여넣기 해주세요.', 'success', '공유하기')
        })
        .catch((error) => {
          console.error('클립보드 복사 실패:', error)
          // Fallback for older browsers
          fallbackCopyToClipboard(text)
        })
    } else {
      // Fallback for older browsers
      fallbackCopyToClipboard(text)
    }
  }

  function fallbackCopyToClipboard(text: string) {
    const textArea = document.createElement('textarea')
    textArea.value = text
    textArea.style.position = 'fixed'
    textArea.style.left = '-999999px'
    textArea.style.top = '-999999px'
    document.body.appendChild(textArea)
    textArea.focus()
    textArea.select()
    
    try {
      const successful = document.execCommand('copy')
      if (successful) {
        showAlert('링크가 복사되었습니다!\n원하는 곳에 붙여넣기 해주세요.', 'success', '공유하기')
      } else {
        showAlert('링크 복사에 실패했습니다.\n수동으로 URL을 복사해주세요.', 'error', '공유 실패')
      }
    } catch (error) {
      console.error('Fallback 복사 실패:', error)
      showAlert('링크 복사에 실패했습니다.\n수동으로 URL을 복사해주세요.', 'error', '공유 실패')
    } finally {
      document.body.removeChild(textArea)
    }
  }

  const discountedPrice = currentProduct?.product 
    ? currentProduct.product.price * (1 - currentProduct.product.discount_rate / 100)
    : 0

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-[17px]">로딩 중...</div>
      </div>
    )
  }

  if (!stream) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center px-4">
          <h2 className="text-[28px] font-semibold text-white mb-4">
            라이브를 찾을 수 없습니다
          </h2>
          <button 
            onClick={() => navigate('/')}
            className="bg-white text-black px-6 py-3 rounded-full font-semibold"
          >
            홈으로 돌아가기
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="relative w-full overflow-hidden bg-black" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' }}>
      {/* Custom Modal */}
      <CustomModal
        isOpen={modal.isOpen}
        onClose={closeModal}
        onConfirm={modal.onConfirm}
        title={modal.title}
        message={modal.message}
        type={modal.type}
      />
      
      {/* YouTube/TikTok Video Container - Full Screen */}
      <div 
        className="absolute inset-0 w-full h-full bg-black"
        style={{ 
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 0,
          overflow: 'hidden',
        }}
      >
        {videoStatus === 'loading' && (
          <div className="absolute inset-0 bg-black flex items-center justify-center">
            <p className="text-white text-[17px] font-semibold">방송 준비 중입니다.</p>
          </div>
        )}
        {videoStatus === 'ended' && (
          <div className="absolute inset-0 bg-black flex items-center justify-center">
            <p className="text-white text-[17px] font-semibold">방송이 종료되었습니다.</p>
          </div>
        )}
        {/* YouTube/TikTok Player Container - Always render with object-fit cover */}
        <div 
          id="youtube-player"
          className="absolute inset-0"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            overflow: 'hidden',
            pointerEvents: stream?.platform === 'tiktok' ? 'auto' : (muted ? 'none' : 'auto'),
            zIndex: 1,
          }}
        />
        
        {/* Tap to unmute overlay (YouTube only) */}
        {stream?.platform !== 'tiktok' && muted && videoStatus === 'playing' && (
          <div 
            onClick={toggleMute}
            className="absolute inset-0 z-10 cursor-pointer"
            style={{ pointerEvents: 'auto' }}
          >
            <div className="absolute inset-0 bg-black/10" />
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
              <div className="bg-black/70 backdrop-blur-md px-6 py-4 rounded-2xl flex items-center gap-3 shadow-2xl border border-white/10 animate-pulse">
                <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM12.293 7.293a1 1 0 011.414 0L15 8.586l1.293-1.293a1 1 0 111.414 1.414L16.414 10l1.293 1.293a1 1 0 01-1.414 1.414L15 11.414l-1.293 1.293a1 1 0 01-1.414-1.414L13.586 10l-1.293-1.293a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
                <span className="text-white text-[15px] font-bold">탭하여 소리 켜기</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Notification Banner */}
      {showNotification && (
        <div 
          className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 animate-fade-in"
          style={{
            animation: 'fadeIn 0.3s ease-in-out',
          }}
        >
          <div className="bg-[#34c759]/90 backdrop-blur-lg px-6 py-3 rounded-full text-center shadow-lg border border-white/10">
            <span className="text-white text-[13px] font-semibold tracking-wide" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
              ✓ {notificationText}
            </span>
          </div>
        </div>
      )}

      {/* Top Bar - 개선: 중앙 정렬, 위로 올리기, 옅은 배경 */}
      <div className="fixed top-0 left-0 right-0 z-40 px-5 pt-4 pb-3">
        <div className="flex items-center justify-between max-w-screen-sm mx-auto">
          {/* 뒤로가기 버튼 - 옅은 원형 배경 */}
          <button
            onClick={() => navigate('/')}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-black/20 backdrop-blur-md border border-white/10 transition-all active:scale-95"
            style={{
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
            }}
          >
            <ArrowLeft className="w-5 h-5 text-white" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))' }} />
          </button>

          {/* 중앙: LIVE 배지 + 시청자 수 */}
          <div className="flex items-center gap-1.5">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/20 backdrop-blur-md border border-white/10" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
              <div className="w-1.5 h-1.5 bg-[#ff3b30] rounded-full animate-pulse" />
              <span className="text-white text-[9px] font-bold tracking-wide" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>LIVE</span>
            </div>
            {stream.viewer_count && (
              <div className="px-2.5 py-1 rounded-full bg-black/20 backdrop-blur-md border border-white/10" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
                <span className="text-white text-[9px] font-semibold" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>
                  {stream.viewer_count.toLocaleString()}
                </span>
              </div>
            )}
          </div>

          {/* 우측: SNS 버튼 - 더 작게 */}
          <div className="flex items-center gap-1.5">
            {stream.seller_instagram && (
              <button 
                onClick={() => handleSNSFollow('instagram')}
                className="flex items-center justify-center w-7 h-7 rounded-full bg-black/20 backdrop-blur-md border border-white/10 transition-all active:scale-95"
                style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}
              >
                <Instagram className="w-3.5 h-3.5 text-white" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))' }} />
              </button>
            )}
            {stream.seller_youtube && (
              <button 
                onClick={() => handleSNSFollow('youtube')}
                className="flex items-center justify-center w-7 h-7 rounded-full bg-black/20 backdrop-blur-md border border-white/10 transition-all active:scale-95"
                style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}
              >
                <Youtube className="w-3.5 h-3.5 text-white" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))' }} />
              </button>
            )}
            {stream.seller_facebook && (
              <button 
                onClick={() => handleSNSFollow('facebook')}
                className="flex items-center justify-center w-7 h-7 rounded-full bg-black/20 backdrop-blur-md border border-white/10 transition-all active:scale-95"
                style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}
              >
                <Facebook className="w-3.5 h-3.5 text-white" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))' }} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Right Side Icons - 개선: 위치 하향 */}
      <div className="fixed right-4 bottom-[180px] z-30 flex flex-col gap-3">
        {/* 공유 버튼 - 더 작게 */}
        <button 
          onClick={handleShare}
          className="flex flex-col items-center gap-1 transition-all active:scale-95"
        >
          <div className="w-9 h-9 rounded-full bg-black/20 backdrop-blur-md border border-white/10 flex items-center justify-center" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
            <Share2 className="w-4 h-4 text-white" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))' }} />
          </div>
          <span className="text-white text-[8px] font-bold" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.9)' }}>
            공유
          </span>
        </button>

        {/* 채팅 버튼 - 더 작게 */}
        <button 
          onClick={() => setShowChatInput(!showChatInput)}
          className="flex flex-col items-center gap-1 transition-all active:scale-95"
        >
          <div className="w-9 h-9 rounded-full bg-black/20 backdrop-blur-md border border-white/10 flex items-center justify-center" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
            <MessageCircle className="w-4 h-4 text-white" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))' }} />
          </div>
          <span className="text-white text-[8px] font-bold" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.9)' }}>
            채팅
          </span>
        </button>
      </div>

      {/* Bottom Content - 개선: 상품 카드 하단으로, 그라데이션 제거 */}
      <div className="fixed bottom-0 left-0 right-0 z-20 pb-8">
        <div className="flex flex-col justify-end px-5 space-y-4">
          {/* Chat Messages - 폰트 축소 */}
          <div className="space-y-1 max-h-24 overflow-y-auto">
            {messages.slice(-4).map((msg) => (
              <div key={msg.id} className={`flex items-start gap-1.5 px-2 py-0.5 rounded-lg backdrop-blur-sm max-w-[80%] ${
                msg.is_admin ? 'bg-red-400/30' : msg.is_seller ? 'bg-blue-400/30' : 'bg-black/15'
              }`} style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }}>
                <span 
                  className={`text-[10px] font-bold shrink-0 ${
                    msg.is_admin ? 'text-red-300' : msg.is_seller ? 'text-blue-300' : 'text-white'
                  }`}
                  style={{ 
                    textShadow: '0 1px 3px rgba(0,0,0,0.9)',
                  }}
                >
                  {msg.is_admin ? '👑 ' : msg.is_seller ? '🏪 ' : ''}{msg.user_name}
                </span>
                <span 
                  className={`text-[10px] ${
                    msg.is_admin ? 'text-red-200' : msg.is_seller ? 'text-blue-200' : 'text-white/95'
                  }`}
                  style={{ 
                    textShadow: '0 1px 3px rgba(0,0,0,0.9)',
                  }}
                >
                  {msg.message}
                </span>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Product Card - 제거 (하단 버튼으로 이동) */}

          {/* Chat Input - 채팅 버튼 클릭 시에만 표시 */}
          {showChatInput && (
            <form onSubmit={handleSendMessage} className="flex items-center gap-3 animate-fade-in">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="메시지를 입력하세요..."
                autoFocus
                className="flex-1 h-12 bg-white/95 backdrop-blur-xl border border-white/30 rounded-full px-5 text-[13px] text-[#1d1d1f] placeholder:text-[#6e6e73] shadow-lg"
              />
              <button
                type="submit"
                className="flex items-center justify-center w-12 h-12 rounded-full bg-[#0064FF] shadow-lg flex-shrink-0 transition-all active:scale-95"
              >
                <Send className="w-5 h-5 text-white" />
              </button>
            </form>
          )}

          {/* 하단 버튼 - 상품 카드 + 결제 버튼 */}
          {!showChatInput && (
            currentProduct?.product ? (
            <div className="flex gap-2 sm:gap-3 items-center">
              {/* 상품 카드 (썸네일 제거, 높이 조정) */}
              <button
                onClick={handleAddToCart}
                disabled={addingToCart || currentProduct.product.stock === 0}
                className="flex-1 flex items-center gap-2 sm:gap-2.5 px-3 py-3 sm:py-3.5 rounded-2xl bg-white/95 backdrop-blur-xl shadow-xl transition-all active:scale-95 border border-white/30 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}
              >
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-[10px] font-bold text-[#1d1d1f] line-clamp-1 mb-0.5">
                    {currentProduct.product.name}
                  </p>
                  <div className="flex items-baseline gap-1">
                    {currentProduct.product.stock === 0 ? (
                      <span className="text-[#ff3b30] text-[11px] font-extrabold">
                        품절
                      </span>
                    ) : currentProduct.product.stock <= 10 ? (
                      <>
                        {currentProduct.product.discount_rate > 0 && (
                          <span className="text-[#ff3b30] text-[9px] font-extrabold">
                            {currentProduct.product.discount_rate}%
                          </span>
                        )}
                        <span className="text-[#1d1d1f] text-[11px] font-extrabold">
                          {discountedPrice.toLocaleString()}원
                        </span>
                        <span className="text-[#ff9500] text-[8px] font-bold">
                          (재고 {currentProduct.product.stock}개)
                        </span>
                      </>
                    ) : (
                      <>
                        {currentProduct.product.discount_rate > 0 && (
                          <span className="text-[#ff3b30] text-[9px] font-extrabold">
                            {currentProduct.product.discount_rate}%
                          </span>
                        )}
                        <span className="text-[#1d1d1f] text-[11px] font-extrabold">
                          {discountedPrice.toLocaleString()}원
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <div className={`flex-shrink-0 ${currentProduct.product.stock === 0 ? 'bg-[#8e8e93]' : 'bg-[#FF6B35]'} text-white px-2 py-1 rounded-full text-[8px] font-extrabold`}>
                  {currentProduct.product.stock === 0 ? '품절' : addingToCart ? '담는중...' : '담기'}
                </div>
              </button>

              {/* 결제 버튼 */}
              <button
                onClick={handleCheckout}
                disabled={checkingOut || currentProduct.product.stock === 0}
                className="relative flex-shrink-0 flex items-center justify-center gap-1.5 sm:gap-2 px-4 py-3 sm:px-5 sm:py-3.5 rounded-2xl bg-[#0064FF] shadow-xl transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ boxShadow: '0 4px 16px rgba(0,100,255,0.4)' }}
              >
                <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                <span className="text-white text-[11px] sm:text-[12px] font-extrabold">{checkingOut ? '확인중...' : '결제'}</span>
                {cartCount > 0 && (
                  <div className="absolute -top-1.5 -right-1.5 min-w-[22px] h-[22px] bg-[#ff3b30] rounded-full flex items-center justify-center px-1.5 shadow-lg">
                    <span className="text-white text-[10px] font-extrabold">{cartCount}</span>
                  </div>
                )}
              </button>
            </div>
            ) : (
              <div className="flex items-center justify-center p-4 bg-white/95 backdrop-blur-xl rounded-2xl shadow-xl border border-white/30">
                <p className="text-gray-500 text-sm">상품 준비 중...</p>
              </div>
            )
          )}
        </div>
      </div>

      {/* Cart Bottom Sheet */}
      {showCart && (
        <div 
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
          onClick={() => setShowCart(false)}
        >
          <div 
            className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl max-h-[80vh] overflow-y-auto pb-safe"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-[#e5e5ea] px-6 py-4 rounded-t-3xl">
              <div className="flex items-center justify-between">
                <h3 className="text-[21px] font-semibold text-[#1d1d1f]">
                  장바구니 ({cartCount})
                </h3>
                <button
                  onClick={() => setShowCart(false)}
                  className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-[#f5f5f7]"
                >
                  <X className="w-5 h-5 text-[#1d1d1f]" />
                </button>
              </div>
            </div>

            <div className="px-6 py-4">
              {cartItems.length === 0 ? (
                <div className="text-center py-12">
                  <ShoppingBag className="w-16 h-16 text-[#6e6e73] mx-auto mb-4" />
                  <p className="text-[17px] text-[#6e6e73]">장바구니가 비어있습니다</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {cartItems.map((item, index) => (
                    <div key={index} className="flex gap-4 p-4 bg-[#f5f5f7] rounded-2xl">
                      <LazyImage
                        src={item.image_url || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="80" height="80"%3E%3Crect width="80" height="80" fill="%23f3f4f6"/%3E%3C/svg%3E'}
                        alt={item.name}
                        className="w-20 h-20 rounded-xl object-cover"
                      />
                      <div className="flex-1">
                        <p className="text-[15px] font-semibold text-[#1d1d1f] mb-1">
                          {item.name}
                        </p>
                        <p className="text-[17px] font-bold text-[#1d1d1f]">
                          {(item.price * (1 - item.discount_rate / 100)).toLocaleString()}원
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {cartItems.length > 0 && (
              <div className="sticky bottom-0 bg-white border-t border-[#e5e5ea] px-6 py-4">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[17px] font-semibold text-[#1d1d1f]">
                    총 결제 금액
                  </span>
                  <span className="text-[24px] font-bold text-[#1d1d1f]">
                    {cartItems.reduce((sum, item) => 
                      sum + item.price * (1 - item.discount_rate / 100), 0
                    ).toLocaleString()}원
                  </span>
                </div>
                <button
                  onClick={() => navigate('/cart')}
                  className="w-full bg-[#0064FF] text-white py-4 rounded-2xl text-[17px] font-semibold"
                >
                  결제하기
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
