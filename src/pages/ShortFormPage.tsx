import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Heart, Share2, ShoppingCart, Volume2, VolumeX, ChevronLeft, Menu } from 'lucide-react'
import { getUserId } from '@/utils/auth'
import axios from 'axios'
import GripFrameLayout from '@/components/GripFrameLayout'

interface Product {
  id: number
  name: string
  price: number
  current_price: number
  original_price?: number
  discount_rate: number
  image_url: string
  video_url?: string
  seller_name: string
  seller_profile_image?: string
  description?: string
  stock: number
  sold_count?: number
  category?: string
}

export default function ShortFormPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isMuted, setIsMuted] = useState(true)
  const [isLiked, setIsLiked] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showPaymentDrawer, setShowPaymentDrawer] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  
  const containerRef = useRef<HTMLDivElement>(null)
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([])
  const navigate = useNavigate()

  useEffect(() => {
    loadProducts()
  }, [])

  // Auto-play video when in view
  useEffect(() => {
    const currentVideo = videoRefs.current[currentIndex]
    if (currentVideo) {
      currentVideo.play().catch(err => console.log('Auto-play prevented:', err))
    }

    // Pause other videos
    videoRefs.current.forEach((video, index) => {
      if (video && index !== currentIndex) {
        video.pause()
      }
    })
  }, [currentIndex])

  async function loadProducts() {
    try {
      setLoading(true)
      const response = await axios.get('/api/products?featured=true&limit=20')
      if (response.data.success) {
        // Add placeholder video URLs for demo
        const productsWithVideos = response.data.data.map((p: Product) => ({
          ...p,
          video_url: p.video_url || 'https://assets.mixkit.co/videos/preview/mixkit-woman-showing-a-product-in-a-video-call-50292-large.mp4'
        }))
        setProducts(productsWithVideos)
      }
    } catch (error) {
      console.error('Failed to load products:', error)
    } finally {
      setLoading(false)
    }
  }

  function handleScroll(e: React.WheelEvent) {
    if (e.deltaY > 0 && currentIndex < products.length - 1) {
      // Scroll down
      setCurrentIndex(prev => prev + 1)
    } else if (e.deltaY < 0 && currentIndex > 0) {
      // Scroll up
      setCurrentIndex(prev => prev - 1)
    }
  }

  function handleTouchStart(e: React.TouchEvent) {
    const touchStartY = e.touches[0].clientY
    const element = e.currentTarget

    function handleTouchMove(e: TouchEvent) {
      const touchEndY = e.touches[0].clientY
      const diff = touchStartY - touchEndY

      if (Math.abs(diff) > 50) {
        if (diff > 0 && currentIndex < products.length - 1) {
          setCurrentIndex(prev => prev + 1)
        } else if (diff < 0 && currentIndex > 0) {
          setCurrentIndex(prev => prev - 1)
        }
        element.removeEventListener('touchmove', handleTouchMove)
      }
    }

    element.addEventListener('touchmove', handleTouchMove)
    element.addEventListener('touchend', () => {
      element.removeEventListener('touchmove', handleTouchMove)
    }, { once: true })
  }

  function toggleMute() {
    setIsMuted(!isMuted)
    const currentVideo = videoRefs.current[currentIndex]
    if (currentVideo) {
      currentVideo.muted = !isMuted
    }
  }

  function handleLike() {
    setIsLiked(!isLiked)
    // TODO: API call to like product
  }

  function handleShare() {
    const product = products[currentIndex]
    if (navigator.share) {
      navigator.share({
        title: product.name,
        text: `${product.name} - ₩${product.current_price.toLocaleString()}`,
        url: window.location.href
      })
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(window.location.href)
      alert('링크가 복사되었습니다!')
    }
  }

  async function handleAddToCart() {
    const userId = getUserId()
    if (!userId) {
      if (confirm('로그인이 필요합니다. 로그인 페이지로 이동하시겠습니까?')) {
        navigate('/login')
      }
      return
    }

    const product = products[currentIndex]
    try {
      await axios.post('/api/cart', {
        userId: Number(userId),
        productId: product.id,
        quantity: 1
      })
      alert('장바구니에 추가되었습니다!')
    } catch (error) {
      console.error('Failed to add to cart:', error)
      alert('장바구니 추가에 실패했습니다.')
    }
  }

  function handleBuyNow() {
    const product = products[currentIndex]
    setSelectedProduct(product)
    setShowPaymentDrawer(true)
  }

  function handleCheckout() {
    const userId = getUserId()
    if (!userId) {
      if (confirm('로그인이 필요합니다. 로그인 페이지로 이동하시겠습니까?')) {
        navigate('/login')
      }
      return
    }

    // Navigate to checkout with selected product
    navigate('/checkout', {
      state: {
        products: [selectedProduct],
        fromShortForm: true
      }
    })
  }

  if (loading) {
    return (
      <GripFrameLayout>
        <div className="flex items-center justify-center h-screen bg-black">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
        </div>
      </GripFrameLayout>
    )
  }

  const currentProduct = products[currentIndex]

  return (
    <GripFrameLayout>
      <div 
        ref={containerRef}
        className="relative w-full h-screen overflow-hidden bg-black"
        onWheel={handleScroll}
        onTouchStart={handleTouchStart}
      >
      {/* Header - Transparent overlay */}
      <div className="absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-black/60 to-transparent p-4">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <button 
            onClick={() => navigate('/')}
            className="text-white p-2 hover:bg-white/20 rounded-full transition"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          
          <div className="flex gap-4">
            <button className="text-white text-sm font-medium px-4 py-2 rounded-full bg-white/20 backdrop-blur-sm">
              추천
            </button>
            <button className="text-white text-sm font-medium px-4 py-2 rounded-full hover:bg-white/20 transition">
              라이브
            </button>
          </div>

          <button className="text-white p-2 hover:bg-white/20 rounded-full transition">
            <Menu className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Video Container */}
      <div className="relative w-full h-full max-w-md mx-auto">
        {products.map((product, index) => (
          <div
            key={product.id}
            className={`absolute inset-0 transition-transform duration-500 ${
              index === currentIndex ? 'translate-y-0' : 
              index < currentIndex ? '-translate-y-full' : 
              'translate-y-full'
            }`}
          >
            <video
              ref={el => videoRefs.current[index] = el}
              src={product.video_url}
              className="w-full h-full object-cover"
              loop
              muted={isMuted}
              playsInline
              poster={product.image_url}
            />
          </div>
        ))}

        {/* Mute Toggle */}
        <button
          onClick={toggleMute}
          className="absolute top-24 right-4 z-20 text-white p-3 bg-black/30 backdrop-blur-sm rounded-full hover:bg-black/50 transition"
        >
          {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
        </button>

        {/* Side Interaction Bar */}
        <div className="absolute right-4 bottom-32 z-20 flex flex-col gap-6">
          <button
            onClick={handleLike}
            className="flex flex-col items-center gap-1 text-white"
          >
            <div className="p-3 bg-black/30 backdrop-blur-sm rounded-full hover:bg-black/50 transition">
              <Heart className={`w-6 h-6 ${isLiked ? 'fill-red-500 text-red-500' : ''}`} />
            </div>
            <span className="text-xs font-medium">좋아요</span>
          </button>

          <button
            onClick={handleShare}
            className="flex flex-col items-center gap-1 text-white"
          >
            <div className="p-3 bg-black/30 backdrop-blur-sm rounded-full hover:bg-black/50 transition">
              <Share2 className="w-6 h-6" />
            </div>
            <span className="text-xs font-medium">공유</span>
          </button>

          <button
            onClick={handleAddToCart}
            className="flex flex-col items-center gap-1 text-white"
          >
            <div className="p-3 bg-black/30 backdrop-blur-sm rounded-full hover:bg-black/50 transition">
              <ShoppingCart className="w-6 h-6" />
            </div>
            <span className="text-xs font-medium">장바구니</span>
          </button>
        </div>

        {/* Bottom Info Section */}
        <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black via-black/80 to-transparent p-6 pb-8">
          <div className="max-w-md mx-auto">
            {/* Seller Info */}
            <div className="flex items-center gap-3 mb-4">
              <img
                src={currentProduct?.seller_profile_image || 'https://via.placeholder.com/40'}
                alt={currentProduct?.seller_name}
                className="w-10 h-10 rounded-full object-cover border-2 border-white"
              />
              <div>
                <p className="text-white font-medium text-sm">{currentProduct?.seller_name}</p>
                <p className="text-white/70 text-xs">셀러</p>
              </div>
              <button className="ml-auto px-4 py-1.5 bg-white text-black text-xs font-medium rounded-full hover:bg-gray-100 transition">
                팔로우
              </button>
            </div>

            {/* Product Info */}
            <h2 className="text-white text-lg font-bold mb-2 line-clamp-2">
              {currentProduct?.name}
            </h2>
            
            <div className="flex items-baseline gap-2 mb-4">
              {currentProduct?.discount_rate > 0 && (
                <>
                  <span className="text-red-400 text-2xl font-bold">
                    {currentProduct.discount_rate}%
                  </span>
                  <span className="text-white/60 text-sm line-through">
                    ₩{currentProduct.original_price?.toLocaleString()}
                  </span>
                </>
              )}
              <span className="text-white text-2xl font-bold">
                ₩{currentProduct?.current_price.toLocaleString()}
              </span>
            </div>

            {/* Purchase Button */}
            <button
              onClick={handleBuyNow}
              className="w-full py-4 bg-white text-black font-bold text-lg rounded-xl hover:bg-gray-100 transition shadow-lg"
            >
              지금 구매하기
            </button>
          </div>
        </div>

        {/* Progress Indicator */}
        <div className="absolute left-4 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-2">
          {products.map((_, index) => (
            <div
              key={index}
              className={`w-1 h-8 rounded-full transition-all ${
                index === currentIndex ? 'bg-white' : 'bg-white/30'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Payment Drawer - Slide Up */}
      {showPaymentDrawer && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-t-3xl shadow-2xl animate-slide-up">
            {/* Drawer Handle */}
            <div className="flex justify-center py-3">
              <div className="w-12 h-1.5 bg-gray-300 rounded-full"></div>
            </div>

            <div className="p-6 max-h-[80vh] overflow-y-auto">
              {/* Product Summary */}
              <div className="flex gap-4 mb-6 pb-6 border-b">
                <img
                  src={selectedProduct.image_url}
                  alt={selectedProduct.name}
                  className="w-20 h-20 object-cover rounded-lg"
                />
                <div className="flex-1">
                  <h3 className="font-bold text-lg mb-2">{selectedProduct.name}</h3>
                  <p className="text-2xl font-bold text-gray-900">
                    ₩{selectedProduct.current_price.toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Options */}
              <div className="mb-6">
                <h4 className="font-medium mb-3">수량</h4>
                <div className="flex items-center justify-between bg-gray-50 rounded-lg p-4">
                  <button className="w-10 h-10 flex items-center justify-center bg-white rounded-lg border hover:bg-gray-50">
                    -
                  </button>
                  <span className="font-medium">1</span>
                  <button className="w-10 h-10 flex items-center justify-center bg-white rounded-lg border hover:bg-gray-50">
                    +
                  </button>
                </div>
              </div>

              {/* Total */}
              <div className="flex justify-between items-center mb-6 py-4 border-t">
                <span className="text-lg font-medium">총 결제금액</span>
                <span className="text-2xl font-bold text-blue-600">
                  ₩{selectedProduct.current_price.toLocaleString()}
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowPaymentDrawer(false)}
                  className="flex-1 py-4 border-2 border-gray-300 text-gray-700 font-bold rounded-xl hover:bg-gray-50 transition"
                >
                  취소
                </button>
                <button
                  onClick={handleCheckout}
                  className="flex-1 py-4 bg-black text-white font-bold rounded-xl hover:bg-gray-800 transition"
                >
                  결제하기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Navigation Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-black/80 backdrop-blur-md border-t border-white/10">
        <div className="max-w-md mx-auto flex justify-around items-center py-3">
          <button
            onClick={() => navigate('/')}
            className="flex flex-col items-center gap-1 text-white/60 hover:text-white transition"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span className="text-xs">홈</span>
          </button>

          <button
            className="flex flex-col items-center gap-1 text-white transition"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19.5 3h-15A2.5 2.5 0 002 5.5v13A2.5 2.5 0 004.5 21h15a2.5 2.5 0 002.5-2.5v-13A2.5 2.5 0 0019.5 3zM8.5 7.5a2 2 0 11-2 2 2 2 0 012-2zm9 9h-11v-1a3 3 0 013-3h5a3 3 0 013 3z"/>
            </svg>
            <span className="text-xs font-medium">둘러보기</span>
          </button>

          <button
            onClick={() => navigate('/cart')}
            className="flex flex-col items-center gap-1 text-white/60 hover:text-white transition"
          >
            <ShoppingCart className="w-6 h-6" />
            <span className="text-xs">장바구니</span>
          </button>

          <button
            onClick={() => navigate('/orders')}
            className="flex flex-col items-center gap-1 text-white/60 hover:text-white transition"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span className="text-xs">마이</span>
          </button>
        </div>
      </div>

      <style>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
        
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
      </div>
    </GripFrameLayout>
  )
}
