import { useEffect, useState, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import axios from 'axios'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, ShoppingCart, Circle, Users, Volume2, VolumeX, MessageCircle } from 'lucide-react'

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

export default function LivePage() {
  const { streamId } = useParams()
  const [stream, setStream] = useState<Stream | null>(null)
  const [currentProduct, setCurrentProduct] = useState<CurrentProduct | null>(null)
  const [loading, setLoading] = useState(true)
  const [muted, setMuted] = useState(true)
  const [chatOpen, setChatOpen] = useState(false)
  const playerRef = useRef<any>(null)
  const playerInstanceRef = useRef<any>(null)

  useEffect(() => {
    loadStreamData()
    loadCurrentProduct()
    
    // Poll for product changes every 3 seconds
    const interval = setInterval(loadCurrentProduct, 3000)
    return () => clearInterval(interval)
  }, [streamId])

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

      {/* Mobile Chat Overlay */}
      {chatOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={() => setChatOpen(false)}>
          <div 
            className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl p-6 max-h-[70vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[21px] font-semibold text-[#1d1d1f]">
                실시간 채팅
              </h3>
              <button
                onClick={() => setChatOpen(false)}
                className="text-[#007aff] text-[17px] font-normal"
              >
                닫기
              </button>
            </div>
            <div className="space-y-3">
              <div className="text-center text-[15px] text-[#6e6e73] py-8">
                채팅 기능이 곧 추가됩니다
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
