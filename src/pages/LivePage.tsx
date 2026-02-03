import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { ArrowLeft, Heart, Share2, MessageCircle, ShoppingBag, Send, X, Instagram, Facebook, Youtube } from 'lucide-react'

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
  const [stream, setStream] = useState<Stream | null>(null)
  const [currentProduct, setCurrentProduct] = useState<CurrentProduct | null>(null)
  const [loading, setLoading] = useState(true)
  const [muted, setMuted] = useState(true)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [cartCount, setCartCount] = useState(0)
  const [showCart, setShowCart] = useState(false)
  const [cartItems, setCartItems] = useState<any[]>([])
  const [likes, setLikes] = useState(1234)
  const [liked, setLiked] = useState(false)
  const [playerReady, setPlayerReady] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Check login status
    const token = localStorage.getItem('access_token')
    const userId = localStorage.getItem('user_id')
    setIsLoggedIn(!!(token && userId))
    
    loadStreamData()
    loadCurrentProduct()
    loadDemoMessages()
    
    const interval = setInterval(loadCurrentProduct, 3000)
    return () => clearInterval(interval)
  }, [streamId])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (!stream?.youtube_video_id) return

    let player: any = null

    const initializePlayer = () => {
      try {
        // @ts-ignore
        if (!window.YT || !window.YT.Player) return

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
            controls: 0,
            modestbranding: 1,
            rel: 0,
            showinfo: 0,
            iv_load_policy: 3,
            playsinline: 1,
            loop: 1,
            enablejsapi: 1,
            origin: window.location.origin,
          },
          events: {
            onReady: (event: any) => {
              event.target.playVideo()
              setPlayerReady(true)
            },
            onError: (event: any) => {
              console.warn('YouTube player error:', event.data)
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
      window.onYouTubeIframeAPIReady = initializePlayer
    }

    return () => {
      if (player && typeof player.destroy === 'function') {
        player.destroy()
      }
    }
  }, [stream])

  function loadDemoMessages() {
    const demoMessages: ChatMessage[] = [
      {
        id: '1',
        username: '김지수',
        message: '와 이 제품 너무 예쁘다! 😍',
        timestamp: Date.now() - 120000,
      },
      {
        id: '2',
        username: '박민준',
        message: '가격이 얼마인가요?',
        timestamp: Date.now() - 90000,
      },
      {
        id: '3',
        username: '이서연',
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

  function handleAddToCart() {
    if (!currentProduct?.product) return

    setCartCount(prev => prev + 1)
    setCartItems(prev => [...prev, currentProduct.product])

    // Show notification banner
    setNotificationText(`${currentProduct.product.name}을(를) 담았습니다!`)
    setShowNotification(true)
    setTimeout(() => setShowNotification(false), 2000)
  }

  function handleCheckout() {
    if (!isLoggedIn) {
      // Redirect to Kakao login
      const currentUrl = window.location.href
      const kakaoAuthUrl = `https://kauth.kakao.com/oauth/authorize?client_id=aa88264eac0ae190a132205063753960&redirect_uri=${encodeURIComponent(window.location.origin + '/auth/kakao/callback')}&response_type=code&state=${encodeURIComponent(currentUrl)}`
      window.location.href = kakaoAuthUrl
      return
    }
    
    setShowCart(true)
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

    const message: ChatMessage = {
      id: Date.now().toString(),
      username: '나',
      message: newMessage,
      timestamp: Date.now(),
    }

    setMessages(prev => [...prev, message])
    setNewMessage('')
  }

  function handleLike() {
    setLiked(!liked)
    setLikes(prev => liked ? prev - 1 : prev + 1)
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
    <div className="relative w-full h-screen overflow-hidden bg-black">
      {/* YouTube Video Container - Full Screen */}
      <div 
        className="absolute inset-0 w-full h-full"
        style={{ 
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: 0,
        }}
      >
        <div 
          id="youtube-player"
          className="absolute inset-0"
          style={{
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
          }}
        />
        
        {/* Subtle Bottom Gradient */}
        <div 
          className="absolute inset-x-0 bottom-0 pointer-events-none"
          style={{
            height: '40%',
            background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.2) 30%, transparent 100%)',
          }}
        />
      </div>

      {/* Notification Banner */}
      {showNotification && (
        <div 
          className="fixed top-20 left-4 right-4 z-50 animate-fade-in"
          style={{
            animation: 'fadeIn 0.3s ease-in-out',
          }}
        >
          <div className="bg-[#34c759]/95 backdrop-blur-sm px-4 py-2 rounded-full text-center">
            <span className="text-white text-[13px] font-semibold" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>
              ✓ {notificationText}
            </span>
          </div>
        </div>
      )}

      {/* Top Bar */}
      <div className="fixed top-0 left-0 right-0 z-40 px-4 pt-4 pb-2 safe-top">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-black/30 backdrop-blur-sm"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#ff3b30]/90">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
              <span className="text-white text-[12px] font-bold">LIVE</span>
            </div>
            {stream.viewer_count && (
              <div className="px-3 py-1.5 rounded-full bg-black/30 backdrop-blur-sm">
                <span className="text-white text-[12px] font-semibold">
                  {stream.viewer_count.toLocaleString()}
                </span>
              </div>
            )}
          </div>

          {/* SNS Follow Buttons */}
          <div className="flex items-center gap-2">
            {stream.seller_instagram && (
              <button 
                onClick={() => handleSNSFollow('instagram')}
                className="flex items-center justify-center w-9 h-9 rounded-full bg-gradient-to-br from-purple-600 to-pink-500 backdrop-blur-sm"
              >
                <Instagram className="w-5 h-5 text-white" />
              </button>
            )}
            {stream.seller_youtube && (
              <button 
                onClick={() => handleSNSFollow('youtube')}
                className="flex items-center justify-center w-9 h-9 rounded-full bg-[#ff0000] backdrop-blur-sm"
              >
                <Youtube className="w-5 h-5 text-white" />
              </button>
            )}
            {stream.seller_facebook && (
              <button 
                onClick={() => handleSNSFollow('facebook')}
                className="flex items-center justify-center w-9 h-9 rounded-full bg-[#1877f2] backdrop-blur-sm"
              >
                <Facebook className="w-5 h-5 text-white" />
              </button>
            )}
            {!stream.seller_instagram && !stream.seller_youtube && !stream.seller_facebook && (
              <button className="flex items-center justify-center w-10 h-10 rounded-full bg-black/30 backdrop-blur-sm">
                <span className="text-[20px]">{muted ? '🔇' : '🔊'}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Right Side Mini Icons */}
      <div className="fixed right-3 bottom-32 z-30 flex flex-col gap-3">
        <button onClick={handleLike} className="flex flex-col items-center gap-0.5">
          <div className="w-11 h-11 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center">
            <Heart className={`w-5 h-5 ${liked ? 'fill-[#ff3b30] text-[#ff3b30]' : 'text-white'}`} />
          </div>
          <span className="text-white text-[10px] font-medium" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>
            {likes > 1000 ? `${(likes / 1000).toFixed(1)}K` : likes}
          </span>
        </button>

        <button className="flex flex-col items-center gap-0.5">
          <div className="w-11 h-11 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center">
            <Share2 className="w-5 h-5 text-white" />
          </div>
          <span className="text-white text-[10px] font-medium" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>
            공유
          </span>
        </button>

        <button className="flex flex-col items-center gap-0.5">
          <div className="w-11 h-11 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center">
            <MessageCircle className="w-5 h-5 text-white" />
          </div>
          <span className="text-white text-[10px] font-medium" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>
            {messages.length}
          </span>
        </button>
      </div>

      {/* Bottom Content Area - 30% of screen */}
      <div className="fixed bottom-0 left-0 right-0 z-20 pb-4 safe-bottom" style={{ height: '30vh' }}>
        <div className="h-full flex flex-col justify-end px-4 space-y-3">
          {/* Stream Info */}
          <div>
            <h1 className="text-white text-[18px] font-bold mb-0.5 leading-tight" style={{ textShadow: '0 2px 8px rgba(0,0,0,0.9)' }}>
              {stream.title}
            </h1>
            <p className="text-white/90 text-[13px] leading-tight" style={{ textShadow: '0 1px 6px rgba(0,0,0,0.9)' }}>
              {stream.description}
            </p>
          </div>

          {/* Chat Messages - Clean & Minimal */}
          <div className="space-y-1.5 max-h-20 overflow-y-auto">
            {messages.slice(-3).map((msg) => (
              <div key={msg.id} className="flex items-start gap-1.5">
                <span 
                  className="text-white text-[13px] font-semibold leading-tight" 
                  style={{ textShadow: '0 2px 6px rgba(0,0,0,0.9)' }}
                >
                  {msg.username}
                </span>
                <span 
                  className="text-white text-[13px] leading-tight" 
                  style={{ textShadow: '0 2px 6px rgba(0,0,0,0.9)' }}
                >
                  {msg.message}
                </span>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Slim Product Card - Horizontal Bar */}
          {currentProduct?.product && (
            <div className="bg-white/95 backdrop-blur-sm rounded-2xl px-3 py-2.5 shadow-lg">
              <div className="flex items-center gap-3">
                <img
                  src={currentProduct.product.image_url || 'https://via.placeholder.com/48'}
                  alt={currentProduct.product.name}
                  className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold text-[#1d1d1f] line-clamp-1 leading-tight">
                    {currentProduct.product.name}
                  </p>
                  <div className="flex items-baseline gap-1">
                    {currentProduct.product.discount_rate > 0 && (
                      <span className="text-[#ff3b30] text-[11px] font-bold">
                        {currentProduct.product.discount_rate}%
                      </span>
                    )}
                    <span className="text-[#1d1d1f] text-[14px] font-bold">
                      {discountedPrice.toLocaleString()}원
                    </span>
                  </div>
                </div>
                <button
                  onClick={handleAddToCart}
                  className="flex-shrink-0 bg-[#FF5126] text-white px-4 py-1.5 rounded-full text-[12px] font-bold"
                >
                  담기
                </button>
              </div>
            </div>
          )}

          {/* Bottom Action Bar */}
          <div className="flex items-center gap-2">
            {/* Chat Input - Outline Only */}
            <form onSubmit={handleSendMessage} className="flex-1 flex items-center gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="메시지 입력..."
                className="flex-1 bg-transparent border border-white/40 rounded-full px-4 py-2.5 text-[13px] text-white placeholder:text-white/60"
                style={{ 
                  backdropFilter: 'blur(8px)',
                  textShadow: '0 1px 2px rgba(0,0,0,0.5)'
                }}
              />
            </form>

            {/* Large Payment Button - Circle */}
            <button
              onClick={handleCheckout}
              className="relative flex items-center justify-center w-14 h-14 rounded-full bg-[#0064FF] shadow-lg flex-shrink-0"
            >
              <ShoppingBag className="w-6 h-6 text-white" />
              {cartCount > 0 && (
                <div className="absolute -top-1 -right-1 min-w-[22px] h-[22px] bg-[#ff3b30] rounded-full flex items-center justify-center px-1.5">
                  <span className="text-white text-[11px] font-bold">{cartCount}</span>
                </div>
              )}
            </button>
          </div>
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
