import { useEffect, useState, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import axios from 'axios'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, ShoppingCart, Circle, Users, Volume2, VolumeX, MessageCircle, Send, X } from 'lucide-react'

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
  avatar?: string
}

export default function LivePage() {
  const { streamId } = useParams()
  const [stream, setStream] = useState<Stream | null>(null)
  const [currentProduct, setCurrentProduct] = useState<CurrentProduct | null>(null)
  const [loading, setLoading] = useState(true)
  const [muted, setMuted] = useState(true)
  const [chatOpen, setChatOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const playerRef = useRef<any>(null)
  const playerInstanceRef = useRef<any>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const messageInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadStreamData()
    loadCurrentProduct()
    loadDemoMessages()
    
    // Poll for product changes every 3 seconds
    const interval = setInterval(loadCurrentProduct, 3000)
    return () => clearInterval(interval)
  }, [streamId])

  useEffect(() => {
    // Auto-scroll chat to bottom
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function loadDemoMessages() {
    // Demo messages for UI showcase
    const demoMessages: ChatMessage[] = [
      {
        id: '1',
        username: '김지수',
        message: '와 이 제품 너무 예쁘다! 😍',
        timestamp: Date.now() - 120000,
        avatar: 'https://ui-avatars.com/api/?name=김지수&background=007aff&color=fff',
      },
      {
        id: '2',
        username: '박민준',
        message: '가격이 얼마인가요?',
        timestamp: Date.now() - 90000,
        avatar: 'https://ui-avatars.com/api/?name=박민준&background=34c759&color=fff',
      },
      {
        id: '3',
        username: '이서연',
        message: '재고 있나요?',
        timestamp: Date.now() - 60000,
        avatar: 'https://ui-avatars.com/api/?name=이서연&background=ff9500&color=fff',
      },
      {
        id: '4',
        username: '최영호',
        message: '바로 구매했습니다! 🛒',
        timestamp: Date.now() - 30000,
        avatar: 'https://ui-avatars.com/api/?name=최영호&background=ff3b30&color=fff',
      },
    ]
    setMessages(demoMessages)
  }

  function handleSendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!newMessage.trim()) return

    const message: ChatMessage = {
      id: Date.now().toString(),
      username: '나',
      message: newMessage,
      timestamp: Date.now(),
      avatar: 'https://ui-avatars.com/api/?name=나&background=007aff&color=fff',
    }

    setMessages(prev => [...prev, message])
    setNewMessage('')
    messageInputRef.current?.focus()
  }

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

  async function handleQuickBuy() {
    if (!currentProduct?.product) return

    try {
      // TODO: Get actual user ID from session
      const userId = 1
      
      const response = await axios.post('/api/cart', {
        userId,
        productId: currentProduct.product.id,
        optionId: null,
        quantity: 1,
        priceSnapshot: currentProduct.product.price,
        liveStreamId: streamId,
      })

      if (response.data.success) {
        alert(`${currentProduct.product.name}\n장바구니에 담았습니다! 🛒`)
      }
    } catch (error) {
      console.error('Failed to add to cart:', error)
      alert('구매에 실패했습니다. 다시 시도해주세요.')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fbfbfd] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#007aff] mx-auto mb-4"></div>
          <p className="text-[17px] text-[#6e6e73]">로딩 중...</p>
        </div>
      </div>
    )
  }

  if (!stream) {
    return (
      <div className="min-h-screen bg-[#fbfbfd] flex items-center justify-center">
        <div className="text-center px-4">
          <h2 className="text-[28px] font-semibold text-[#1d1d1f] mb-4">
            라이브를 찾을 수 없습니다
          </h2>
          <Button className="apple-button" asChild>
            <Link to="/">홈으로 돌아가기</Link>
          </Button>
        </div>
      </div>
    )
  }

  const discountedPrice = currentProduct?.product 
    ? currentProduct.product.price * (1 - currentProduct.product.discount_rate / 100)
    : 0

  return (
    <div className="min-h-screen bg-black">
      {/* Header - Overlay on video */}
      <header className="fixed top-0 left-0 right-0 z-50 apple-glass-dark border-b border-white/10">
        <div className="flex h-[52px] items-center justify-between px-4 sm:px-6">
          {/* Back Button */}
          <Link 
            to="/" 
            className="flex items-center space-x-2 text-white hover:opacity-80 transition-opacity"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="text-[14px] font-normal hidden sm:inline">홈으로</span>
          </Link>

          {/* Stream Info */}
          <div className="flex items-center space-x-3">
            <Badge className="bg-[#ff3b30] text-white border-0 px-2.5 py-1">
              <Circle className="h-2 w-2 fill-white text-white animate-pulse mr-1.5" />
              <span className="text-[11px] sm:text-[12px] font-semibold">LIVE</span>
            </Badge>
            {stream.viewer_count && (
              <Badge className="bg-white/10 backdrop-blur-md text-white border-0 px-2.5 py-1">
                <Users className="h-3 w-3 mr-1.5" />
                <span className="text-[11px] sm:text-[12px] font-semibold">
                  {stream.viewer_count.toLocaleString()}
                </span>
              </Badge>
            )}
          </div>

          {/* Mute Toggle */}
          <button
            onClick={toggleMute}
            className="flex items-center justify-center h-9 w-9 rounded-full bg-white/10 backdrop-blur-md hover:bg-white/20 transition-colors"
          >
            {muted ? (
              <VolumeX className="h-5 w-5 text-white" />
            ) : (
              <Volume2 className="h-5 w-5 text-white" />
            )}
          </button>
        </div>
      </header>

      {/* Video Player Container */}
      <div className="relative w-full h-screen">
        {/* YouTube Player */}
        <div 
          ref={playerRef}
          id="youtube-player"
          className="absolute inset-0 w-full h-full"
        ></div>

        {/* Gradient Overlay for better readability */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/50 pointer-events-none"></div>

        {/* Stream Title - Bottom Left */}
        <div className="absolute bottom-32 sm:bottom-40 left-0 right-0 px-4 sm:px-6 pointer-events-none">
          <div className="max-w-2xl">
            <h1 className="text-[21px] sm:text-[24px] md:text-[28px] font-semibold text-white mb-2 leading-tight">
              {stream.title}
            </h1>
            {stream.description && (
              <p className="text-[14px] sm:text-[15px] text-white/80 line-clamp-2">
                {stream.description}
              </p>
            )}
          </div>
        </div>

        {/* Chat Button - Mobile */}
        <button
          onClick={() => setChatOpen(!chatOpen)}
          className="md:hidden absolute bottom-40 right-4 flex items-center justify-center h-12 w-12 rounded-full bg-white/10 backdrop-blur-md hover:bg-white/20 transition-colors"
        >
          <MessageCircle className="h-6 w-6 text-white" />
        </button>

        {/* Bottom Controls */}
        <div className="absolute bottom-0 left-0 right-0 apple-glass-dark border-t border-white/10">
          <div className="px-4 sm:px-6 py-4">
            {currentProduct?.product ? (
              <div className="flex items-center justify-between gap-4">
                {/* Product Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] sm:text-[14px] text-white/60 mb-1">
                    지금 소개 중
                  </p>
                  <h3 className="text-[15px] sm:text-[17px] font-semibold text-white mb-2 truncate">
                    {currentProduct.product.name}
                  </h3>
                  <div className="flex items-baseline gap-2">
                    {currentProduct.product.discount_rate > 0 && (
                      <>
                        <Badge className="bg-[#ff3b30] text-white border-0 px-2 py-0.5">
                          <span className="text-[12px] font-bold">
                            {currentProduct.product.discount_rate}%
                          </span>
                        </Badge>
                        <span className="text-[13px] text-white/40 line-through">
                          {currentProduct.product.price.toLocaleString()}원
                        </span>
                      </>
                    )}
                    <span className="text-[19px] sm:text-[21px] font-bold text-white">
                      {discountedPrice.toLocaleString()}원
                    </span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 sm:gap-3">
                  <Button
                    variant="outline"
                    className="hidden sm:flex border-white/20 bg-white/10 backdrop-blur-md text-white hover:bg-white/20 rounded-full px-5"
                    asChild
                  >
                    <Link to="/my-orders">
                      <ShoppingCart className="mr-2 h-4 w-4" />
                      장바구니
                    </Link>
                  </Button>
                  <button
                    onClick={handleQuickBuy}
                    className="apple-button whitespace-nowrap px-6 sm:px-8"
                  >
                    구매하기
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-[15px] text-white/60">
                  곧 새로운 상품이 소개됩니다
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Desktop Chat Sidebar */}
      <div className="hidden md:block fixed right-0 top-[52px] bottom-0 w-80 lg:w-96 apple-glass-dark border-l border-white/10 overflow-hidden">
        <div className="flex flex-col h-full">
          {/* Chat Header */}
          <div className="border-b border-white/10 px-4 py-3">
            <div className="flex items-center justify-between">
              <h3 className="text-[17px] font-semibold text-white">
                실시간 채팅
              </h3>
              <Badge className="bg-white/10 text-white border-0 px-2.5 py-1">
                <Circle className="h-2 w-2 fill-white text-white animate-pulse mr-1.5" />
                <span className="text-[12px] font-semibold">LIVE</span>
              </Badge>
            </div>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.map((msg) => (
              <div key={msg.id} className="smooth-appear">
                <div className="flex items-start space-x-2">
                  <img
                    src={msg.avatar}
                    alt={msg.username}
                    className="h-7 w-7 rounded-full flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-[13px] font-semibold text-white">
                        {msg.username}
                      </span>
                      <span className="text-[11px] text-white/40">
                        {new Date(msg.timestamp).toLocaleTimeString('ko-KR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <p className="text-[14px] text-white/90 leading-relaxed break-words mt-0.5">
                      {msg.message}
                    </p>
                  </div>
                </div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Chat Input */}
          <div className="border-t border-white/10 p-3">
            <form onSubmit={handleSendMessage} className="flex gap-2">
              <input
                ref={messageInputRef}
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="메시지 입력..."
                className="flex-1 bg-white/10 border border-white/20 rounded-full px-4 py-2.5 text-[14px] text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[#007aff] focus:border-transparent"
              />
              <button
                type="submit"
                disabled={!newMessage.trim()}
                className="flex items-center justify-center h-10 w-10 rounded-full bg-[#007aff] disabled:bg-white/10 disabled:text-white/30 text-white hover:bg-[#0051d5] disabled:hover:bg-white/10 transition-colors"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Mobile Chat Overlay */}
      {chatOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={() => setChatOpen(false)}>
          <div 
            className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl flex flex-col max-h-[80vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Chat Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <h3 className="text-[21px] font-semibold text-[#1d1d1f]">
                  실시간 채팅
                </h3>
                <Badge className="bg-[#ff3b30] text-white border-0 px-2 py-0.5">
                  <Circle className="h-1.5 w-1.5 fill-white text-white animate-pulse mr-1" />
                  <span className="text-[11px] font-semibold">LIVE</span>
                </Badge>
              </div>
              <button
                onClick={() => setChatOpen(false)}
                className="flex items-center justify-center h-8 w-8 rounded-full hover:bg-gray-100 transition-colors"
              >
                <X className="h-5 w-5 text-[#1d1d1f]" />
              </button>
            </div>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {messages.length > 0 ? (
                messages.map((msg) => (
                  <div key={msg.id} className="smooth-appear">
                    <div className="flex items-start space-x-3">
                      <img
                        src={msg.avatar}
                        alt={msg.username}
                        className="h-8 w-8 rounded-full flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2 mb-1">
                          <span className="text-[14px] font-semibold text-[#1d1d1f]">
                            {msg.username}
                          </span>
                          <span className="text-[12px] text-[#6e6e73]">
                            {new Date(msg.timestamp).toLocaleTimeString('ko-KR', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                        <p className="text-[15px] text-[#1d1d1f] leading-relaxed break-words">
                          {msg.message}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-[15px] text-[#6e6e73] py-8">
                  첫 메시지를 남겨보세요!
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Chat Input */}
            <div className="border-t border-gray-100 p-4">
              <form onSubmit={handleSendMessage} className="flex gap-3">
                <input
                  ref={messageInputRef}
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="메시지 입력..."
                  className="flex-1 bg-[#f5f5f7] border-0 rounded-full px-4 py-3 text-[15px] text-[#1d1d1f] placeholder:text-[#6e6e73] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim()}
                  className="flex items-center justify-center h-11 w-11 rounded-full bg-[#007aff] disabled:bg-[#e5e5ea] disabled:text-[#8e8e93] text-white hover:bg-[#0051d5] disabled:hover:bg-[#e5e5ea] transition-colors"
                >
                  <Send className="h-5 w-5" />
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
