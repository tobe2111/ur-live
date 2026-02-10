import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import axios from 'axios'
import { ArrowLeft, Share2, MessageCircle, ShoppingBag, Send, X, Instagram, Facebook, Youtube, Package } from 'lucide-react'

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
  id: string
  username: string
  message: string
  timestamp: number
  isSystem?: boolean
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
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
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
      // Save to localStorage
      localStorage.setItem('session', sessionToken)
      localStorage.setItem('user_id', userId || '')
      localStorage.setItem('user_name', decodeURIComponent(userName || '카카오 사용자'))
      
      setIsLoggedIn(true)
      
      console.log('✅ 로그인 성공:', { userId, userName })
      
      // Clean URL (remove login parameters, keep streamId)
      const cleanUrl = `/live/${streamId}`
      window.history.replaceState({}, document.title, cleanUrl)
      
      // Show success message
      alert(`환영합니다, ${decodeURIComponent(userName || '카카오 사용자')}님!`)
    }
  }, [searchParams, streamId])

  // Check login status from localStorage
  useEffect(() => {
    const token = localStorage.getItem('access_token')
    const session = localStorage.getItem('session')
    const userId = localStorage.getItem('user_id')
    
    if ((token && userId) || (session && userId)) {
      setIsLoggedIn(true)
    }
    
    // Prevent scrolling on body and html
    document.documentElement.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    document.documentElement.style.height = '100dvh'
    document.body.style.height = '100dvh'
    
    loadStreamData()
    loadCurrentProduct()
    loadDemoMessages()
    
    const interval = setInterval(loadCurrentProduct, 3000)
    return () => {
      clearInterval(interval)
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
            origin: window.location.origin,
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
              
              // Apply aggressive full-screen cover style to iframe
              const iframe = playerElement.querySelector('iframe')
              if (iframe) {
                iframe.style.position = 'absolute'
                iframe.style.top = '50%'
                iframe.style.left = '50%'
                iframe.style.transform = 'translate(-50%, -50%)'
                // Make video cover entire viewport with no black bars
                // Use Math.max to ensure we always cover the screen
                const vw = window.innerWidth
                const vh = window.innerHeight
                const videoAspect = 16 / 9  // YouTube default
                const screenAspect = vw / vh
                
                if (screenAspect > videoAspect) {
                  // Screen is wider than video - fit width
                  iframe.style.width = '100vw'
                  iframe.style.height = `${(100 / screenAspect) * videoAspect}vh`
                  iframe.style.minHeight = '100vh'
                } else {
                  // Screen is taller than video - fit height
                  iframe.style.height = '100vh'
                  iframe.style.width = `${100 * screenAspect * videoAspect}vw`
                  iframe.style.minWidth = '100vw'
                }
                
                iframe.style.pointerEvents = 'none'  // Hide controls for live feel
              }
              
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
    const demoMessages: ChatMessage[] = [
      {
        id: '1',
        username: '김**',  // 마스킹 처리
        message: '와 이 제품 너무 예쁘다! 😍',
        timestamp: Date.now() - 120000,
      },
      {
        id: '2',
        username: '박**',  // 마스킹 처리
        message: '가격이 얼마인가요?',
        timestamp: Date.now() - 90000,
      },
      {
        id: '3',
        username: '이**',  // 마스킹 처리
        message: '재고 있나요?',
        timestamp: Date.now() - 60000,
      },
    ]
    setMessages(demoMessages)
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

    // Check login first
    if (!isLoggedIn) {
      alert('로그인이 필요합니다!')
      handleKakaoLogin()
      return
    }

    setAddingToCart(true)
    try {
      const userId = localStorage.getItem('user_id')
      
      if (!userId) {
        alert('로그인이 필요합니다.')
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
      alert(errorMessage)
    } finally {
      setAddingToCart(false)
    }
  }

  // Kakao Sync Login
  async function handleKakaoLogin() {
    try {
      // @ts-ignore - Kakao SDK loaded from CDN
      if (!window.Kakao) {
        console.error('[Kakao Sync] Kakao SDK not loaded')
        alert('카카오 SDK가 로드되지 않았습니다. 페이지를 새로고침해주세요.')
        return
      }

      // Initialize if not already initialized
      // @ts-ignore
      if (!window.Kakao.isInitialized()) {
        console.log('[Kakao Sync] Initializing Kakao SDK...')
        // @ts-ignore
        window.Kakao.init('975a2e7f97254b08f15dba4d177a2865')
        console.log('[Kakao Sync] SDK Initialized:', window.Kakao.isInitialized())
      }

      console.log('[Kakao Sync] Starting authorize...')

      // Use Kakao.Auth.authorize() for SDK 2.x
      // @ts-ignore
      window.Kakao.Auth.authorize({
        redirectUri: `${window.location.origin}/auth/kakao/sync/callback`,
        state: window.location.pathname, // Return to current page after login
        throughTalk: false  // Force browser login (no Intent)
      })
    } catch (error) {
      console.error('[Kakao Sync] Exception:', error)
      alert('로그인 중 오류가 발생했습니다.')
    }
  }

  async function handleCheckout() {
    if (checkingOut) return  // Prevent double-click
    
    // Check login FIRST (before checking cart)
    if (!isLoggedIn) {
      alert('로그인이 필요합니다!')
      handleKakaoLogin()
      return
    }
    
    // Check if cart has items
    const hasCartItems = localStorage.getItem('hasCartItems')
    
    if (!hasCartItems || hasCartItems !== 'true') {
      alert('상품을 먼저 담아주세요!')
      return
    }
    
    setCheckingOut(true)
    // Verify cart on server
    try {
      const userId = localStorage.getItem('user_id')
      
      if (!userId) {
        alert('로그인이 필요합니다.')
        setCheckingOut(false)
        return
      }
      
      const response = await axios.get(`/api/cart/${userId}`)
      console.log('[Checkout] Server cart response:', response.data)
      
      // Check if response is valid and has items
      const cartData = response.data?.data || response.data
      if (!cartData || !Array.isArray(cartData) || cartData.length === 0) {
        alert('장바구니가 비어있습니다. 상품을 먼저 담아주세요!')
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
      alert(errorMessage)
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
    if (!newMessage.trim()) return

    // Firebase로 메시지 전송
    try {
      // @ts-ignore
      if (typeof window.firebase !== 'undefined' && window.firebase) {
        // @ts-ignore
        const database = window.firebase.database()
        const chatRef = database.ref(`chats/stream${streamId}`)
        
        const userName = localStorage.getItem('user_name') || '익명'
        const maskedName = maskUserName(userName)  // 마스킹 적용!
        
        // 새 메시지 추가
        chatRef.push({
          username: maskedName,  // 마스킹된 이름 사용
          text: newMessage,
          // @ts-ignore
          timestamp: window.firebase.database.ServerValue.TIMESTAMP,
          isSystem: false
        })
        
        console.log('✅ 메시지 전송:', newMessage)
      } else {
        // Firebase 없으면 로컬에만 추가 (폴백)
        const userName = localStorage.getItem('user_name') || '익명'
        const maskedName = maskUserName(userName)
        
        const message: ChatMessage = {
          id: Date.now().toString(),
          username: maskedName,  // 마스킹된 이름 사용
          message: newMessage,
          timestamp: Date.now(),
        }
        setMessages(prev => [...prev, message])
      }
      
      setNewMessage('')
      setShowChatInput(false)
    } catch (error) {
      console.error('메시지 전송 실패:', error)
      alert('메시지 전송에 실패했습니다.')
    }
  }

  function handleShowProducts() {
    // Navigate to products page or show product list
    alert('상품 목록 보기 기능 (구현 예정)')
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
    <div className="relative w-full h-[100dvh] overflow-hidden bg-black" style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100dvh' }}>
      {/* YouTube/TikTok Video Container - Full Screen with dvh */}
      <div 
        className="absolute inset-0 w-full h-full"
        style={{ 
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100dvh',
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
            width: '100%',
            height: '100%',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: stream?.platform === 'tiktok' ? 'auto' : (muted ? 'none' : 'auto'),
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
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/20 backdrop-blur-md border border-white/10" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
              <div className="w-2 h-2 bg-[#ff3b30] rounded-full animate-pulse" />
              <span className="text-white text-[11px] font-bold tracking-wide" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>LIVE</span>
            </div>
            {stream.viewer_count && (
              <div className="px-3 py-1.5 rounded-full bg-black/20 backdrop-blur-md border border-white/10" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
                <span className="text-white text-[11px] font-semibold" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>
                  {stream.viewer_count.toLocaleString()}
                </span>
              </div>
            )}
          </div>

          {/* 우측: SNS 버튼 - 옅은 원형 배경 */}
          <div className="flex items-center gap-2">
            {stream.seller_instagram && (
              <button 
                onClick={() => handleSNSFollow('instagram')}
                className="flex items-center justify-center w-9 h-9 rounded-full bg-black/20 backdrop-blur-md border border-white/10 transition-all active:scale-95"
                style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}
              >
                <Instagram className="w-4 h-4 text-white" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))' }} />
              </button>
            )}
            {stream.seller_youtube && (
              <button 
                onClick={() => handleSNSFollow('youtube')}
                className="flex items-center justify-center w-9 h-9 rounded-full bg-black/20 backdrop-blur-md border border-white/10 transition-all active:scale-95"
                style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}
              >
                <Youtube className="w-4 h-4 text-white" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))' }} />
              </button>
            )}
            {stream.seller_facebook && (
              <button 
                onClick={() => handleSNSFollow('facebook')}
                className="flex items-center justify-center w-9 h-9 rounded-full bg-black/20 backdrop-blur-md border border-white/10 transition-all active:scale-95"
                style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}
              >
                <Facebook className="w-4 h-4 text-white" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))' }} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Right Side Icons - 개선: 안쪽으로 이동, 말풍선으로 채팅 */}
      <div className="fixed right-5 bottom-40 z-30 flex flex-col gap-5">
        {/* 공유 버튼 */}
        <button className="flex flex-col items-center gap-1.5 transition-all active:scale-95">
          <div className="w-11 h-11 rounded-full bg-black/20 backdrop-blur-md border border-white/10 flex items-center justify-center" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
            <Share2 className="w-5 h-5 text-white" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))' }} />
          </div>
          <span className="text-white text-[10px] font-bold" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.9)' }}>
            공유
          </span>
        </button>

        {/* 채팅 버튼 (말풍선 클릭 시 입력창) */}
        <button 
          onClick={() => setShowChatInput(!showChatInput)}
          className="flex flex-col items-center gap-1.5 transition-all active:scale-95"
        >
          <div className="w-11 h-11 rounded-full bg-black/20 backdrop-blur-md border border-white/10 flex items-center justify-center" style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
            <MessageCircle className="w-5 h-5 text-white" style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))' }} />
          </div>
          <span className="text-white text-[10px] font-bold" style={{ textShadow: '0 2px 4px rgba(0,0,0,0.9)' }}>
            채팅
          </span>
        </button>
      </div>

      {/* Bottom Content - 개선: 상품 카드 하단으로, 그라데이션 제거 */}
      <div className="fixed bottom-0 left-0 right-0 z-20 pb-8">
        <div className="flex flex-col justify-end px-5 space-y-4">
          {/* Chat Messages - 간격 축소 */}
          <div className="space-y-1 max-h-24 overflow-y-auto">
            {messages.slice(-4).map((msg) => (
              <div key={msg.id} className={`flex items-start gap-2 px-2.5 py-1 rounded-lg backdrop-blur-sm max-w-[80%] ${
                msg.isSystem ? 'bg-yellow-400/30' : 'bg-black/15'
              }`} style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }}>
                <span 
                  className={`text-[12px] font-bold shrink-0 ${
                    msg.isSystem ? 'text-yellow-300' : 'text-white'
                  }`}
                  style={{ 
                    textShadow: '0 1px 3px rgba(0,0,0,0.9)',
                  }}
                >
                  {msg.username}
                </span>
                <span 
                  className={`text-[12px] ${
                    msg.isSystem ? 'text-yellow-200' : 'text-white/95'
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
          {!showChatInput && currentProduct?.product && (
            <div className="flex gap-3 items-center">
              {/* 상품 카드 (썸네일 제거, 높이 조정) */}
              <button
                onClick={handleAddToCart}
                disabled={addingToCart}
                className="flex-1 flex items-center gap-2.5 px-3 py-3.5 rounded-2xl bg-white/95 backdrop-blur-xl shadow-xl transition-all active:scale-95 border border-white/30 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}
              >
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-[12px] font-bold text-[#1d1d1f] line-clamp-1 mb-1">
                    {currentProduct.product.name}
                  </p>
                  <div className="flex items-baseline gap-1.5">
                    {currentProduct.product.discount_rate > 0 && (
                      <span className="text-[#ff3b30] text-[11px] font-extrabold">
                        {currentProduct.product.discount_rate}%
                      </span>
                    )}
                    <span className="text-[#1d1d1f] text-[14px] font-extrabold">
                      {discountedPrice.toLocaleString()}원
                    </span>
                  </div>
                </div>
                <div className="flex-shrink-0 bg-[#FF6B35] text-white px-3 py-1.5 rounded-full text-[10px] font-extrabold">
                  {addingToCart ? '담는중...' : '담기'}
                </div>
              </button>

              {/* 결제 버튼 */}
              <button
                onClick={handleCheckout}
                disabled={checkingOut}
                className="relative flex-shrink-0 flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-[#0064FF] shadow-xl transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ boxShadow: '0 4px 16px rgba(0,100,255,0.4)' }}
              >
                <ShoppingBag className="w-5 h-5 text-white" />
                <span className="text-white text-[12px] font-extrabold">{checkingOut ? '확인중...' : '결제'}</span>
                {cartCount > 0 && (
                  <div className="absolute -top-1.5 -right-1.5 min-w-[22px] h-[22px] bg-[#ff3b30] rounded-full flex items-center justify-center px-1.5 shadow-lg">
                    <span className="text-white text-[10px] font-extrabold">{cartCount}</span>
                  </div>
                )}
              </button>
            </div>
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
                  className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-[#f5f5f7]"
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
                      <img
                        src={item.image_url || 'https://via.placeholder.com/80'}
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
                  onClick={() => navigate('/checkout')}
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
