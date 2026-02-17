import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { Heart, Share2, ShoppingCart, MessageCircle, Eye, Youtube, Instagram } from 'lucide-react'
import axios from 'axios'

// ============================================
// TypeScript Interfaces
// ============================================
interface Product {
  id: number
  name: string
  price: number
  originalPrice?: number
  image: string
  description?: string
  stock?: number
  sizes?: string[]
  colors?: string[]
}

interface Stream {
  id: number
  title: string
  streamerId: number
  streamerName: string
  streamerAvatar?: string
  videoUrl?: string
  status: 'live' | 'ended' | 'scheduled'
  viewerCount: number
  products?: Product[]
}

interface CurrentProduct {
  productId: number
  name: string
  price: number
  originalPrice?: number
  image: string
  description?: string
  stock?: number
}

interface ChatMessage {
  id: string
  userId?: string
  userName?: string
  username?: string
  message?: string
  text?: string
  timestamp: number
  type?: 'user' | 'system' | 'product'
  isSystem?: boolean
}

// ============================================
// Main Component
// ============================================
export default function LivePageV2() {
  const { streamId } = useParams<{ streamId: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // ============================================
  // State Management
  // ============================================
  const [stream, setStream] = useState<Stream | null>(null)
  const [currentProduct, setCurrentProduct] = useState<CurrentProduct | null>(null)
  const [loading, setLoading] = useState(true)
  const [muted, setMuted] = useState(true)
  const [likes, setLikes] = useState(1234)
  const [isLiked, setIsLiked] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [showProductSheet, setShowProductSheet] = useState(false)
  const [selectedColor, setSelectedColor] = useState<string>('')
  const [selectedSize, setSelectedSize] = useState<string>('')
  const [quantity, setQuantity] = useState(1)
  const [playerReady, setPlayerReady] = useState(false)
  const [videoStatus, setVideoStatus] = useState<'playing' | 'ended'>('playing')
  const [lastMessageId, setLastMessageId] = useState(0)
  const [newMessage, setNewMessage] = useState('')
  const [sendingMessage, setSendingMessage] = useState(false)
  const [firebaseInitialized, setFirebaseInitialized] = useState(false)

  const chatEndRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<any>(null)
  const chatRefFirebase = useRef<any>(null)

  // ============================================
  // Initialization Effects
  // ============================================
  
  // Suppress TikTok console warnings
  useEffect(() => {
    const originalError = console.error
    console.error = (...args: any[]) => {
      if (
        typeof args[0] === 'string' &&
        (args[0].includes('tiktok') ||
          args[0].includes('CSP') ||
          args[0].includes('permissions-policy'))
      ) {
        return
      }
      originalError.apply(console, args)
    }
    return () => {
      console.error = originalError
    }
  }, [])

  // Handle login callback
  useEffect(() => {
    const loginParam = searchParams.get('login')
    const sessionParam = searchParams.get('session')
    const userIdParam = searchParams.get('userId')
    const userNameParam = searchParams.get('userName')

    if (loginParam === 'success' && sessionParam) {
      localStorage.setItem('auth_token', sessionParam)
      document.cookie = `auth_token=${sessionParam}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`
      
      if (userIdParam) localStorage.setItem('userId', userIdParam)
      if (userNameParam) localStorage.setItem('userName', userNameParam)
      
      setIsLoggedIn(true)
      
      // Clean URL
      const cleanUrl = window.location.pathname
      window.history.replaceState({}, '', cleanUrl)
      
      console.log('[LivePageV2] Login success, session saved')
    }
  }, [searchParams])

  // Check login status
  useEffect(() => {
    const token = localStorage.getItem('auth_token')
    if (token) {
      setIsLoggedIn(true)
    }
  }, [])

  // Load stream data
  useEffect(() => {
    if (!streamId) return

    const loadStreamData = async () => {
      try {
        setLoading(true)
        const response = await axios.get(`/api/streams/${streamId}`)
        
        if (!response.data.success) {
          setLoading(false)
          return
        }
        
        const streamData = response.data.data
        
        setStream(streamData)
        
        if (streamData.products && streamData.products.length > 0) {
          const firstProduct = streamData.products[0]
          setCurrentProduct({
            productId: firstProduct.id,
            name: firstProduct.name,
            price: firstProduct.price,
            originalPrice: firstProduct.originalPrice,
            image: firstProduct.image,
            description: firstProduct.description,
            stock: firstProduct.stock
          })
        }
        
        setLoading(false)
        console.log('[LivePageV2] Stream loaded:', streamData)
      } catch (error) {
        console.error('[LivePageV2] Failed to load stream:', error)
        setLoading(false)
      }
    }

    const loadCurrentProduct = async () => {
      try {
        const response = await axios.get(`/api/streams/${streamId}/current-product`)
        if (response.data.success && response.data.data) {
          const product = response.data.data
          setCurrentProduct({
            productId: product.id,
            name: product.name,
            price: product.price,
            originalPrice: product.originalPrice,
            image: product.image,
            description: product.description,
            stock: product.stock
          })
        }
      } catch (error) {
        console.error('[LivePageV2] Failed to load current product:', error)
      }
    }

    loadStreamData()
    loadCurrentProduct()
    
    // Poll current product every 3 seconds
    const productInterval = setInterval(loadCurrentProduct, 3000)
    
    return () => {
      clearInterval(productInterval)
    }
  }, [streamId])

  // Firebase Chat Integration
  useEffect(() => {
    if (!streamId) return

    const initializeFirebaseChat = () => {
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
        chatRefFirebase.current = chatRef
        
        console.log('[LivePageV2] Firebase 초기화 완료')
        setFirebaseInitialized(true)

        // 최신 10개 메시지 가져오기
        chatRef.limitToLast(10).once('value', (snapshot: any) => {
          const loadedMessages: ChatMessage[] = []
          snapshot.forEach((child: any) => {
            const msg = child.val()
            loadedMessages.push({
              id: child.key || Date.now().toString(),
              username: msg.username,
              userName: msg.username,
              message: msg.text,
              text: msg.text,
              timestamp: msg.timestamp,
              isSystem: msg.isSystem || false
            })
          })
          
          if (loadedMessages.length > 0) {
            setMessages(loadedMessages)
            console.log(`[LivePageV2] ${loadedMessages.length}개 메시지 로드됨`)
          }
        })

        // 실시간 리스너 (새 메시지만)
        let lastMessageTime = Date.now()
        chatRef.orderByChild('timestamp').startAt(lastMessageTime).on('child_added', (snapshot: any) => {
          const msg = snapshot.val()
          
          // 중복 방지
          if (msg.timestamp > lastMessageTime) {
            const newMessage: ChatMessage = {
              id: snapshot.key || Date.now().toString(),
              username: msg.username,
              userName: msg.username,
              message: msg.text,
              text: msg.text,
              timestamp: msg.timestamp,
              isSystem: msg.isSystem || false
            }
            
            setMessages(prev => [...prev, newMessage])
            console.log('[LivePageV2] 새 메시지:', newMessage)
          }
        })
      } catch (error) {
        console.error('[LivePageV2] Firebase 초기화 실패:', error)
      }
    }

    // @ts-ignore
    if (typeof window.firebase !== 'undefined' && window.firebase) {
      initializeFirebaseChat()
    } else {
      console.log('[LivePageV2] Waiting for Firebase SDK...')
      const checkFirebase = setInterval(() => {
        // @ts-ignore
        if (typeof window.firebase !== 'undefined' && window.firebase) {
          clearInterval(checkFirebase)
          initializeFirebaseChat()
        }
      }, 500)
      
      return () => clearInterval(checkFirebase)
    }

    return () => {
      if (chatRefFirebase.current) {
        chatRefFirebase.current.off()
      }
    }
  }, [streamId])

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // YouTube Player Integration
  useEffect(() => {
    if (!stream?.videoUrl) return
    
    // Check if it's a YouTube video
    const youtubeMatch = stream.videoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/)
    if (!youtubeMatch) return
    
    const videoId = youtubeMatch[1]
    let player: any = null
    let isMounted = true

    const initializePlayer = () => {
      try {
        // @ts-ignore
        if (!window.YT || !window.YT.Player) return
        if (!isMounted) return

        const playerElement = document.getElementById('youtube-player')
        if (!playerElement) return

        playerElement.innerHTML = ''

        // @ts-ignore
        player = new window.YT.Player('youtube-player', {
          height: '100%',
          width: '100%',
          videoId: videoId,
          playerVars: {
            autoplay: 1,
            mute: muted ? 1 : 0,
            controls: 0,
            modestbranding: 1,
            rel: 0,
            showinfo: 0,
            iv_load_policy: 3,
            playsinline: 1,
            enablejsapi: 1,
            origin: window.location.origin,
            loop: 1,
            playlist: videoId,
            fs: 0,
            cc_load_policy: 0,
          },
          events: {
            onReady: (event: any) => {
              if (!isMounted) return
              console.log('[LivePageV2] YouTube player ready')
              playerRef.current = event.target
              setPlayerReady(true)
              setVideoStatus('playing')
              
              const applyIframeStyles = () => {
                const iframe = playerElement.querySelector('iframe')
                if (iframe) {
                  iframe.removeAttribute('style')
                  iframe.removeAttribute('width')
                  iframe.removeAttribute('height')
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
                }
              }
              
              applyIframeStyles()
              setTimeout(applyIframeStyles, 100)
              setTimeout(applyIframeStyles, 500)
              
              event.target.playVideo()
            },
            onStateChange: (event: any) => {
              if (!isMounted) return
              // @ts-ignore
              if (event.data === window.YT.PlayerState.PLAYING) {
                setVideoStatus('playing')
              } else if (event.data === window.YT.PlayerState.ENDED) {
                event.target.seekTo(0)
                event.target.playVideo()
              } else if (event.data === window.YT.PlayerState.PAUSED) {
                setTimeout(() => {
                  if (isMounted && event.target) {
                    event.target.playVideo()
                  }
                }, 100)
              }
            },
            onError: (event: any) => {
              if (!isMounted) return
              console.error('[LivePageV2] YouTube player error:', event.data)
              setVideoStatus('ended')
            },
          },
        })
      } catch (error) {
        console.error('[LivePageV2] Failed to initialize YouTube player:', error)
      }
    }

    // Load YouTube IFrame API
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
      isMounted = false
      if (player && typeof player.destroy === 'function') {
        try {
          player.destroy()
        } catch (error) {
          console.error('[LivePageV2] Error destroying player:', error)
        }
      }
    }
  }, [stream?.videoUrl, muted])

  // ============================================
  // Handler Functions
  // ============================================

  const handleLike = () => {
    if (!isLiked) {
      setLikes(prev => prev + 1)
      setIsLiked(true)
    } else {
      setLikes(prev => prev - 1)
      setIsLiked(false)
    }
  }

  const handleShare = async () => {
    const shareUrl = window.location.href
    if (navigator.share) {
      try {
        await navigator.share({
          title: stream?.title || 'UR Live',
          url: shareUrl
        })
      } catch (err) {
        console.log('[LivePageV2] Share cancelled')
      }
    } else {
      navigator.clipboard.writeText(shareUrl)
      alert('링크가 클립보드에 복사되었습니다!')
    }
  }

  const handleAddToCart = async () => {
    if (!currentProduct) {
      alert('상품 정보를 불러오는 중입니다.')
      return
    }

    if (!isLoggedIn) {
      // Save temp cart and redirect to login
      const tempCart = {
        productId: currentProduct.productId,
        quantity,
        color: selectedColor,
        size: selectedSize,
        timestamp: Date.now()
      }
      localStorage.setItem('tempCartItem', JSON.stringify(tempCart))
      localStorage.setItem('returnPath', window.location.pathname)
      
      alert('로그인이 필요합니다.')
      // Initiate Kakao login
      window.location.href = '/api/auth/kakao'
      return
    }

    try {
      const userId = localStorage.getItem('userId')
      const response = await axios.post('/api/cart', {
        userId,
        productId: currentProduct.productId,
        quantity,
        color: selectedColor,
        size: selectedSize
      })

      if (response.data.success) {
        alert('장바구니에 추가되었습니다!')
        setShowProductSheet(false)
      }
    } catch (error) {
      console.error('[LivePageV2] Add to cart failed:', error)
      alert('장바구니 추가에 실패했습니다.')
    }
  }

  const handleCheckout = async () => {
    if (!currentProduct) {
      alert('상품 정보를 불러오는 중입니다.')
      return
    }

    if (!isLoggedIn) {
      alert('로그인이 필요합니다.')
      window.location.href = '/api/auth/kakao'
      return
    }

    // Navigate to checkout with product data
    navigate('/checkout', {
      state: {
        items: [{
          productId: currentProduct.productId,
          name: currentProduct.name,
          price: currentProduct.price,
          quantity,
          color: selectedColor,
          size: selectedSize,
          image: currentProduct.image
        }]
      }
    })
  }

  const sendChatMessage = async () => {
    if (!newMessage.trim() || !streamId || sendingMessage || !firebaseInitialized) return

    const messageText = newMessage.trim()
    setNewMessage('')
    setSendingMessage(true)

    try {
      const userId = localStorage.getItem('userId') || 'anonymous'
      const userName = localStorage.getItem('userName') || '익명'
      
      // Firebase에 메시지 전송
      if (chatRefFirebase.current) {
        await chatRefFirebase.current.push({
          username: maskUserName(userName),
          text: messageText,
          timestamp: Date.now(),
          userId: userId,
          isSystem: false
        })
        console.log('[LivePageV2] Message sent to Firebase')
      }
    } catch (error) {
      console.error('[LivePageV2] Failed to send message:', error)
      alert('메시지 전송에 실패했습니다.')
    } finally {
      setSendingMessage(false)
    }
  }

  const maskUserName = (name: string): string => {
    if (!name || name === '익명') return '익명'
    if (name.length === 1) return name
    if (name.length === 2) return name[0] + '*'
    return name[0] + '*'.repeat(name.length - 1)
  }

  // ============================================
  // Loading State
  // ============================================
  if (loading) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    )
  }

  if (!stream) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center">
        <div className="text-white text-xl">스트림을 찾을 수 없습니다</div>
      </div>
    )
  }

  // ============================================
  // Main Render
  // ============================================
  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      {/* ============================================ */}
      {/* Top Navigation */}
      {/* ============================================ */}
      <div className="absolute top-0 left-0 right-0 z-50 pt-safe">
        <div className="px-4 py-3 flex items-center justify-between">
          {/* Left: Back button */}
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-black/30 backdrop-blur-md text-white hover:bg-black/50 transition-colors"
            aria-label="뒤로가기"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {/* Center: LIVE badge + viewer count */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/90 backdrop-blur-md animate-blink-live">
              <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
              <span className="text-white text-sm font-bold tracking-wider">LIVE</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/30 backdrop-blur-md">
              <Eye className="w-4 h-4 text-white" />
              <span className="text-white text-sm font-medium">
                {stream.viewerCount.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Right: Social icons */}
          <div className="flex items-center gap-2">
            <a
              href="https://www.youtube.com/@yourhannel"
              target="_blank"
              rel="noopener noreferrer"
              className="w-10 h-10 flex items-center justify-center rounded-full bg-black/30 backdrop-blur-md text-white hover:bg-red-500 transition-colors"
              aria-label="YouTube"
            >
              <Youtube className="w-5 h-5" />
            </a>
            <a
              href="https://www.instagram.com/youraccount"
              target="_blank"
              rel="noopener noreferrer"
              className="w-10 h-10 flex items-center justify-center rounded-full bg-black/30 backdrop-blur-md text-white hover:bg-pink-500 transition-colors"
              aria-label="Instagram"
            >
              <Instagram className="w-5 h-5" />
            </a>
            <button
              className="w-10 h-10 flex items-center justify-center rounded-full bg-black/30 backdrop-blur-md text-white hover:bg-yellow-500 transition-colors"
              aria-label="KakaoTalk"
              onClick={() => window.open('https://open.kakao.com/yourlink', '_blank')}
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 3c5.799 0 10.5 3.664 10.5 8.185 0 4.52-4.701 8.184-10.5 8.184a13.5 13.5 0 01-1.727-.11l-4.408 2.883c-.501.265-.678.236-.472-.413l.892-3.678c-2.88-1.46-4.785-3.99-4.785-6.866C1.5 6.665 6.201 3 12 3z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* ============================================ */}
      {/* Video Player */}
      {/* ============================================ */}
      <div className="absolute inset-0 flex items-center justify-center bg-black">
        {stream.videoUrl ? (
          <div className="w-full h-full relative">
            {/* YouTube Player Container */}
            <div
              id="youtube-player"
              className="absolute inset-0 w-full h-full"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
              }}
            />
            
            {/* Mute/Unmute Button */}
            <button
              onClick={() => {
                setMuted(!muted)
                if (playerRef.current) {
                  if (muted) {
                    playerRef.current.unMute()
                  } else {
                    playerRef.current.mute()
                  }
                }
              }}
              className="absolute bottom-40 left-4 z-30 w-12 h-12 rounded-full bg-black/30 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/50 transition-colors"
              aria-label={muted ? '음소거 해제' : '음소거'}
            >
              {muted ? (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" clipRule="evenodd" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                </svg>
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                </svg>
              )}
            </button>
          </div>
        ) : (
          <div className="text-white text-center">
            <div className="text-6xl mb-4">📡</div>
            <p className="text-xl">스트림 준비 중...</p>
          </div>
        )}
      </div>

      {/* ============================================ */}
      {/* Right Side Action Buttons */}
      {/* ============================================ */}
      <div className="absolute right-4 bottom-32 z-40 flex flex-col items-center gap-6">
        {/* Like button */}
        <button
          onClick={handleLike}
          className="flex flex-col items-center gap-1 group"
          aria-label="좋아요"
        >
          <div className="w-12 h-12 rounded-full bg-black/30 backdrop-blur-md flex items-center justify-center group-hover:bg-red-500/50 transition-all">
            <Heart
              className={`w-6 h-6 transition-all ${
                isLiked ? 'fill-red-500 text-red-500 scale-110' : 'text-white'
              }`}
            />
          </div>
          <span className="text-white text-xs font-medium drop-shadow-lg">
            {likes >= 1000 ? `${(likes / 1000).toFixed(1)}K` : likes}
          </span>
        </button>

        {/* Comment button */}
        <button
          className="flex flex-col items-center gap-1 group"
          aria-label="댓글"
        >
          <div className="w-12 h-12 rounded-full bg-black/30 backdrop-blur-md flex items-center justify-center group-hover:bg-blue-500/50 transition-all">
            <MessageCircle className="w-6 h-6 text-white" />
          </div>
          <span className="text-white text-xs font-medium drop-shadow-lg">
            {messages.length}
          </span>
        </button>

        {/* Share button */}
        <button
          onClick={handleShare}
          className="flex flex-col items-center gap-1 group"
          aria-label="공유"
        >
          <div className="w-12 h-12 rounded-full bg-black/30 backdrop-blur-md flex items-center justify-center group-hover:bg-green-500/50 transition-all">
            <Share2 className="w-6 h-6 text-white" />
          </div>
          <span className="text-white text-xs font-medium drop-shadow-lg">공유</span>
        </button>
      </div>

      {/* ============================================ */}
      {/* Bottom Product Info & Chat */}
      {/* ============================================ */}
      <div className="absolute bottom-0 left-0 right-0 z-40 pb-safe">
        {/* Chat messages */}
        <div className="px-4 mb-3 max-h-64 overflow-y-auto no-scrollbar">
          <div className="space-y-2">
            {messages.slice(-5).map((msg) => (
              <div
                key={msg.id}
                className="inline-block px-3 py-2 rounded-2xl bg-black/40 backdrop-blur-md animate-fade-in"
              >
                <span className="text-white font-medium text-sm drop-shadow-lg">
                  {maskUserName(msg.userName || msg.username || '익명')}:
                </span>
                <span className="text-white/90 text-sm ml-2 drop-shadow-lg">
                  {msg.message || msg.text || ''}
                </span>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
        </div>

        {/* Chat input (optional - can be enabled later) */}
        {isLoggedIn && (
          <div className="px-4 mb-3">
            <div className="flex gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !sendingMessage) {
                    sendChatMessage()
                  }
                }}
                placeholder="채팅 메시지를 입력하세요..."
                className="flex-1 px-4 py-2 rounded-full bg-black/40 backdrop-blur-md text-white placeholder-white/50 border border-white/10 focus:outline-none focus:border-white/30"
                disabled={sendingMessage}
              />
              <button
                onClick={sendChatMessage}
                disabled={sendingMessage || !newMessage.trim()}
                className="px-4 py-2 rounded-full bg-red-500 text-white font-medium hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                전송
              </button>
            </div>
          </div>
        )}

        {/* Product info bar */}
        {currentProduct && (
          <div className="mx-4 mb-4 rounded-2xl bg-black/50 backdrop-blur-xl border border-white/10 overflow-hidden">
            <div className="p-4">
              <div className="flex items-center gap-3">
                {/* Product image */}
                <img
                  src={currentProduct.image}
                  alt={currentProduct.name}
                  className="w-16 h-16 rounded-xl object-cover"
                />
                
                {/* Product info */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-white font-bold text-base truncate drop-shadow-lg">
                    {currentProduct.name}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-red-400 font-bold text-lg drop-shadow-lg">
                      ₩{currentProduct.price.toLocaleString()}
                    </span>
                    {currentProduct.originalPrice && (
                      <span className="text-gray-400 text-sm line-through drop-shadow-lg">
                        ₩{currentProduct.originalPrice.toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowProductSheet(true)}
                    className="px-4 py-2.5 rounded-xl bg-white/10 backdrop-blur-md text-white font-medium text-sm hover:bg-white/20 transition-all border border-white/20"
                  >
                    담기
                  </button>
                  <button
                    onClick={handleCheckout}
                    className="px-4 py-2.5 rounded-xl bg-red-500 text-white font-bold text-sm hover:bg-red-600 transition-all shadow-lg shadow-red-500/30"
                  >
                    구매하기
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ============================================ */}
      {/* Product Sheet Modal */}
      {/* ============================================ */}
      {showProductSheet && currentProduct && (
        <div className="fixed inset-0 z-50 flex items-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-overlay-in"
            onClick={() => setShowProductSheet(false)}
          />
          
          {/* Sheet */}
          <div className="relative w-full max-h-[80vh] bg-white rounded-t-3xl animate-sheet-up overflow-y-auto">
            <div className="p-6">
              {/* Handle bar */}
              <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto mb-6" />
              
              {/* Product image */}
              <img
                src={currentProduct.image}
                alt={currentProduct.name}
                className="w-full h-64 object-cover rounded-2xl mb-6"
              />
              
              {/* Product name */}
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                {currentProduct.name}
              </h2>
              
              {/* Price */}
              <div className="flex items-center gap-3 mb-6">
                <span className="text-3xl font-bold text-red-500">
                  ₩{currentProduct.price.toLocaleString()}
                </span>
                {currentProduct.originalPrice && (
                  <span className="text-lg text-gray-400 line-through">
                    ₩{currentProduct.originalPrice.toLocaleString()}
                  </span>
                )}
              </div>
              
              {/* Description */}
              {currentProduct.description && (
                <p className="text-gray-600 mb-6 leading-relaxed">
                  {currentProduct.description}
                </p>
              )}
              
              {/* Color selector */}
              {stream.products?.[0]?.colors && stream.products[0].colors.length > 0 && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    색상 선택
                  </label>
                  <div className="flex gap-2">
                    {stream.products[0].colors.map((color) => (
                      <button
                        key={color}
                        onClick={() => setSelectedColor(color)}
                        className={`px-4 py-2 rounded-lg border-2 transition-all ${
                          selectedColor === color
                            ? 'border-red-500 bg-red-50 text-red-700'
                            : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                        }`}
                      >
                        {color}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Size selector */}
              {stream.products?.[0]?.sizes && stream.products[0].sizes.length > 0 && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    사이즈 선택
                  </label>
                  <div className="flex gap-2">
                    {stream.products[0].sizes.map((size) => (
                      <button
                        key={size}
                        onClick={() => setSelectedSize(size)}
                        className={`px-4 py-2 rounded-lg border-2 transition-all ${
                          selectedSize === size
                            ? 'border-red-500 bg-red-50 text-red-700'
                            : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                        }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Quantity selector */}
              <div className="mb-8">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  수량
                </label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="w-10 h-10 rounded-lg border-2 border-gray-300 flex items-center justify-center text-gray-700 hover:border-gray-400 transition-colors"
                  >
                    −
                  </button>
                  <span className="text-xl font-medium w-12 text-center">
                    {quantity}
                  </span>
                  <button
                    onClick={() => setQuantity(quantity + 1)}
                    className="w-10 h-10 rounded-lg border-2 border-gray-300 flex items-center justify-center text-gray-700 hover:border-gray-400 transition-colors"
                  >
                    +
                  </button>
                </div>
              </div>
              
              {/* Action buttons */}
              <div className="flex gap-3">
                <button
                  onClick={handleAddToCart}
                  className="flex-1 py-4 rounded-xl bg-gray-100 text-gray-900 font-bold text-lg hover:bg-gray-200 transition-colors"
                >
                  <ShoppingCart className="w-5 h-5 inline mr-2" />
                  장바구니에 담기
                </button>
                <button
                  onClick={handleCheckout}
                  className="flex-1 py-4 rounded-xl bg-red-500 text-white font-bold text-lg hover:bg-red-600 transition-colors shadow-lg shadow-red-500/30"
                >
                  바로 구매하기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
