import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { ArrowLeft, Heart, Share2, MessageCircle, ShoppingBag, Send, X, Plus } from 'lucide-react'

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
  const playerRef = useRef<any>(null)
  const playerInstanceRef = useRef<any>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
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
    // Load YouTube IFrame API
    const tag = document.createElement('script')
    tag.src = 'https://www.youtube.com/iframe_api'
    const firstScriptTag = document.getElementsByTagName('script')[0]
    firstScriptTag?.parentNode?.insertBefore(tag, firstScriptTag)

    // @ts-ignore
    window.onYouTubeIframeAPIReady = () => {
      if (stream?.youtube_video_id && playerRef.current) {
        // @ts-ignore
        playerInstanceRef.current = new window.YT.Player('youtube-player', {
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
          },
          events: {
            onReady: (event: any) => {
              event.target.playVideo()
            },
          },
        })
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

  function toggleMute() {
    if (playerInstanceRef.current) {
      if (muted) {
        playerInstanceRef.current.unMute()
      } else {
        playerInstanceRef.current.mute()
      }
      setMuted(!muted)
    }
  }

  function handleAddToCart() {
    if (!currentProduct?.product) return

    // Add to cart
    setCartCount(prev => prev + 1)
    setCartItems(prev => [...prev, currentProduct.product])

    // Add system message to chat
    const systemMessage: ChatMessage = {
      id: Date.now().toString(),
      username: '나',
      message: `${currentProduct.product.name}을(를) 담았습니다! 감사합니다.`,
      timestamp: Date.now(),
      isSystem: true,
    }
    setMessages(prev => [...prev, systemMessage])
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
    <div className="relative h-screen w-screen overflow-hidden bg-black">
      {/* Full Screen YouTube Video Background */}
      <div className="absolute inset-0 w-full h-full" style={{ zIndex: 0 }}>
        <div 
          ref={playerRef}
          id="youtube-player"
          className="absolute inset-0 w-full h-full"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        ></div>
        {/* Bottom gradient for text readability */}
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/60 via-black/20 to-transparent pointer-events-none"></div>
      </div>

      {/* Top Header - Floating */}
      <div className="absolute top-0 left-0 right-0 z-40 px-4 pt-safe">
        <div className="flex items-center justify-between h-14">
          <button
            onClick={() => navigate('/')}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-black/30 backdrop-blur-md"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#ff3b30]">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
              <span className="text-white text-[12px] font-semibold">LIVE</span>
            </div>
            {stream.viewer_count && (
              <div className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-black/30 backdrop-blur-md">
                <span className="text-white text-[12px] font-semibold">
                  {stream.viewer_count.toLocaleString()}
                </span>
              </div>
            )}
          </div>

          <button
            onClick={toggleMute}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-black/30 backdrop-blur-md"
          >
            <span className="text-white text-[20px]">{muted ? '🔇' : '🔊'}</span>
          </button>
        </div>
      </div>

      {/* Right Side Floating Icons */}
      <div className="absolute right-4 bottom-32 z-30 flex flex-col gap-4">
        <button
          onClick={handleLike}
          className="flex flex-col items-center gap-1"
        >
          <div className="w-12 h-12 rounded-full bg-black/30 backdrop-blur-md flex items-center justify-center">
            <Heart className={`w-6 h-6 ${liked ? 'fill-[#ff3b30] text-[#ff3b30]' : 'text-white'}`} />
          </div>
          <span className="text-white text-[11px] font-medium" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>
            {likes.toLocaleString()}
          </span>
        </button>

        <button className="flex flex-col items-center gap-1">
          <div className="w-12 h-12 rounded-full bg-black/30 backdrop-blur-md flex items-center justify-center">
            <Share2 className="w-6 h-6 text-white" />
          </div>
          <span className="text-white text-[11px] font-medium" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>
            공유
          </span>
        </button>

        <button className="flex flex-col items-center gap-1">
          <div className="w-12 h-12 rounded-full bg-black/30 backdrop-blur-md flex items-center justify-center">
            <MessageCircle className="w-6 h-6 text-white" />
          </div>
          <span className="text-white text-[11px] font-medium" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>
            {messages.length}
          </span>
        </button>
      </div>

      {/* Chat Messages - Left Bottom Floating */}
      <div className="absolute left-4 bottom-48 z-20 w-72 max-h-64 overflow-y-auto">
        <div className="space-y-2">
          {messages.slice(-5).map((msg) => (
            <div
              key={msg.id}
              className={`px-3 py-2 rounded-2xl backdrop-blur-md ${
                msg.isSystem 
                  ? 'bg-[#34c759]/90' 
                  : 'bg-black/30'
              }`}
            >
              <div className="flex items-baseline gap-2">
                <span className="text-white text-[13px] font-semibold" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
                  {msg.username}
                </span>
              </div>
              <p className="text-white text-[14px] leading-snug mt-0.5" style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}>
                {msg.message}
              </p>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>
      </div>

      {/* Product Card - Compact Left Bottom */}
      {currentProduct?.product && (
        <div className="absolute left-4 bottom-32 z-30">
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden" style={{ width: '280px' }}>
            <div className="flex items-center gap-3 p-3">
              <img
                src={currentProduct.product.image_url || 'https://via.placeholder.com/60'}
                alt={currentProduct.product.name}
                className="w-14 h-14 rounded-xl object-cover flex-shrink-0"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://via.placeholder.com/60'
                }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-[#1d1d1f] line-clamp-1">
                  {currentProduct.product.name}
                </p>
                <div className="flex items-baseline gap-1.5 mt-0.5">
                  {currentProduct.product.discount_rate > 0 && (
                    <span className="text-[#ff3b30] text-[13px] font-bold">
                      {currentProduct.product.discount_rate}%
                    </span>
                  )}
                  <span className="text-[#1d1d1f] text-[15px] font-bold">
                    {discountedPrice.toLocaleString()}원
                  </span>
                </div>
              </div>
              <button
                onClick={handleAddToCart}
                className="flex-shrink-0 bg-[#007aff] text-white px-4 py-2 rounded-full text-[13px] font-semibold"
              >
                담기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Bar - Fixed */}
      <div className="absolute bottom-0 left-0 right-0 z-40 pb-safe">
        {/* Chat Input */}
        <div className="px-4 pb-2">
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="메시지를 입력하세요..."
              className="flex-1 bg-black/30 backdrop-blur-md border-0 rounded-full px-4 py-2.5 text-[14px] text-white placeholder:text-white/60"
            />
            <button
              type="submit"
              disabled={!newMessage.trim()}
              className="flex items-center justify-center w-10 h-10 rounded-full bg-[#007aff] disabled:bg-white/20 text-white"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 px-4 pb-4">
          <button
            onClick={() => navigate('/my-orders')}
            className="flex items-center justify-center gap-2 bg-white/90 backdrop-blur-md text-[#1d1d1f] px-5 py-3 rounded-full text-[15px] font-semibold"
          >
            <ShoppingBag className="w-5 h-5" />
            <span>내 주문</span>
          </button>

          <button
            onClick={() => setShowCart(true)}
            className="relative flex-1 flex items-center justify-center gap-2 bg-[#007aff] text-white px-6 py-3 rounded-full text-[15px] font-semibold"
          >
            <span>결제하기</span>
            {cartCount > 0 && (
              <div className="absolute -top-1 -right-1 min-w-[24px] h-6 bg-[#ff3b30] rounded-full flex items-center justify-center px-2">
                <span className="text-white text-[12px] font-bold">{cartCount}</span>
              </div>
            )}
          </button>
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
            {/* Sheet Header */}
            <div className="sticky top-0 bg-white border-b border-[#e5e5ea] px-6 py-4 rounded-t-3xl">
              <div className="flex items-center justify-between">
                <h3 className="text-[21px] font-semibold text-[#1d1d1f]">
                  장바구니 ({cartCount})
                </h3>
                <button
                  onClick={() => setShowCart(false)}
                  className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-[#f5f5f7] transition-colors"
                >
                  <X className="w-5 h-5 text-[#1d1d1f]" />
                </button>
              </div>
            </div>

            {/* Cart Items */}
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
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://via.placeholder.com/80'
                        }}
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

            {/* Total and Checkout */}
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
                  className="w-full bg-[#007aff] text-white py-4 rounded-2xl text-[17px] font-semibold"
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
