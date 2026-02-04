import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
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
  const [muted, setMuted] = useState(false)
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
              console.log('YouTube player ready')
              setPlayerReady(true)
              setVideoStatus('playing')
              event.target.playVideo()
              // Unmute after 1 second (to bypass autoplay policy)
              setTimeout(() => {
                event.target.unMute()
              }, 1000)
            },
            onStateChange: (event: any) => {
              console.log('YouTube player state:', event.data)
              // @ts-ignore
              if (event.data === window.YT.PlayerState.ENDED) {
                setVideoStatus('ended')
              } else if (event.data === window.YT.PlayerState.PLAYING) {
                setVideoStatus('playing')
              } else if (event.data === window.YT.PlayerState.BUFFERING) {
                // Keep playing status during buffering
                setVideoStatus('playing')
              }
            },
            onError: (event: any) => {
              console.error('YouTube player error:', event.data)
              // Error codes: 2=invalid ID, 5=HTML5 error, 100=not found, 101/150=embedding disabled
              setVideoStatus('ended')
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

    // Add system message to chat
    const systemMessage: ChatMessage = {
      id: Date.now().toString(),
      username: '시스템',
      message: `${currentProduct.product.name} 주문 감사합니다 ♡`,
      timestamp: Date.now(),
      isSystem: true
    }
    setMessages(prev => [...prev, systemMessage])
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
    setShowChatInput(false)
  }

  function handleShowProducts() {
    // Navigate to products page or show product list
    alert('상품 목록 보기 기능 (구현 예정)')
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
        {(videoStatus === 'loading' || videoStatus === 'playing') && (
          <div 
            id="youtube-player"
            className="absolute inset-0"
            style={{
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
            }}
          />
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
              {/* 상품 카드 (이미지 형태) - 결제 버튼보다 낮게 */}
              <button
                onClick={handleAddToCart}
                className="flex-1 flex items-center gap-2.5 px-3 py-2.5 rounded-2xl bg-white/95 backdrop-blur-xl shadow-xl transition-all active:scale-95 border border-white/30"
                style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}
              >
                <img
                  src={currentProduct.product.image_url || 'https://via.placeholder.com/64'}
                  alt={currentProduct.product.name}
                  className="w-12 h-12 rounded-xl object-cover flex-shrink-0 shadow-md"
                />
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-[11px] font-bold text-[#1d1d1f] line-clamp-1 mb-0.5">
                    {currentProduct.product.name}
                  </p>
                  <div className="flex items-baseline gap-1.5">
                    {currentProduct.product.discount_rate > 0 && (
                      <span className="text-[#ff3b30] text-[11px] font-extrabold">
                        {currentProduct.product.discount_rate}%
                      </span>
                    )}
                    <span className="text-[#1d1d1f] text-[13px] font-extrabold">
                      {discountedPrice.toLocaleString()}원
                    </span>
                  </div>
                </div>
                <div className="flex-shrink-0 bg-[#FF6B35] text-white px-3 py-1.5 rounded-full text-[10px] font-extrabold">
                  담기
                </div>
              </button>

              {/* 결제 버튼 */}
              <button
                onClick={handleCheckout}
                className="relative flex-shrink-0 flex items-center justify-center gap-2 px-5 py-3.5 rounded-2xl bg-[#0064FF] shadow-xl transition-all active:scale-95"
                style={{ boxShadow: '0 4px 16px rgba(0,100,255,0.4)' }}
              >
                <ShoppingBag className="w-5 h-5 text-white" />
                <span className="text-white text-[12px] font-extrabold">결제</span>
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
