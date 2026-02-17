import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, ShoppingCart, Heart, Share2, Minus, Plus, AlertCircle } from 'lucide-react'
import api from '@/lib/api'
import { getUserId, isLoggedIn } from '@/utils/auth'
import MobileFooter from '@/components/MobileFooter'

interface Product {
  id: number
  name: string
  description: string
  price: number
  current_price?: number
  original_price?: number
  discount_rate: number
  image_url: string
  seller_name: string
  seller_id?: number
  stock: number
  sold_count?: number
  category?: string
  detail_images?: string | string[]
  kakao_chat_link?: string
}

interface ProductOption {
  id: number
  product_id: number
  option_type: string
  option_value: string
  price_adjustment: number
  stock: number
}

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [product, setProduct] = useState<Product | null>(null)
  const [options, setOptions] = useState<ProductOption[]>([])
  const [selectedOptions, setSelectedOptions] = useState<{ [key: string]: number }>({})
  const [quantity, setQuantity] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  useEffect(() => {
    loadProduct()
    
    // 로그인 전 실제 출발지 저장 (로그인/콜백 페이지가 아닌 경우만)
    const referrer = document.referrer
    if (referrer && !referrer.includes('/login') && !referrer.includes('/auth/kakao')) {
      const referrerPath = new URL(referrer).pathname
      sessionStorage.setItem('productDetailReferrer', referrerPath)
    }
  }, [id])

  async function loadProduct() {
    try {
      setLoading(true)
      // Public API - 상품 정보와 옵션을 함께 조회
      const response = await api.get(`/api/products/${id}`)
      if (response.data.success && response.data.data) {
        setProduct(response.data.data.product)
        setOptions(response.data.data.options || [])
      } else {
        setError('상품을 불러올 수 없습니다.')
      }
    } catch (err) {
      console.error('Failed to load product:', err)
      setError('상품을 불러올 수 없습니다.')
    } finally {
      setLoading(false)
    }
  }

  function showToast(message: string, type: 'success' | 'error' = 'success') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  async function handleAddToCart() {
    if (!isLoggedIn()) {
      showToast('로그인이 필요합니다.', 'error')
      // 현재 페이지 경로를 저장하고 로그인 페이지로 이동
      localStorage.setItem('loginReturnUrl', window.location.pathname)
      setTimeout(() => navigate('/login'), 1000)
      return
    }

    try {
      await api.post('/api/cart', {
        userId: Number(getUserId()),
        productId: product!.id,
        quantity,
        priceSnapshot: product!.current_price || product!.price
      })
      showToast('장바구니에 추가되었습니다!')
    } catch (err) {
      console.error('Failed to add to cart:', err)
      showToast('장바구니 추가에 실패했습니다.', 'error')
    }
  }

  async function handleBuyNow() {
    if (!isLoggedIn()) {
      showToast('로그인이 필요합니다.', 'error')
      // 현재 페이지 경로를 저장하고 로그인 페이지로 이동
      localStorage.setItem('loginReturnUrl', window.location.pathname)
      setTimeout(() => navigate('/login'), 1000)
      return
    }

    try {
      // 장바구니에 추가
      await api.post('/api/cart', {
        userId: Number(getUserId()),
        productId: product!.id,
        quantity,
        priceSnapshot: product!.current_price || product!.price
      })
      // 결제 페이지로 이동
      navigate('/checkout')
    } catch (err) {
      console.error('Failed to proceed to checkout:', err)
      showToast('구매하기에 실패했습니다.', 'error')
    }
  }

  function increaseQuantity() {
    if (product && quantity < product.stock) {
      setQuantity(quantity + 1)
    }
  }

  function decreaseQuantity() {
    if (quantity > 1) {
      setQuantity(quantity - 1)
    }
  }

  function handleShare() {
    const shareUrl = window.location.href
    const shareText = `${product!.name} - ${displayPrice.toLocaleString()}원`
    
    if (navigator.share) {
      navigator.share({
        title: product!.name,
        text: shareText,
        url: shareUrl
      }).catch(err => console.log('Share failed:', err))
    } else {
      // Fallback: Copy to clipboard
      navigator.clipboard.writeText(shareUrl).then(() => {
        showToast('링크가 복사되었습니다!')
      }).catch(() => {
        showToast('링크 복사에 실패했습니다.', 'error')
      })
    }
  }

  function handleKakaoShare() {
    if (typeof window.Kakao === 'undefined') {
      showToast('카카오톡 공유를 사용할 수 없습니다.', 'error')
      return
    }

    if (!window.Kakao.isInitialized()) {
      window.Kakao.init('YOUR_KAKAO_JS_KEY') // Replace with actual key
    }

    window.Kakao.Share.sendDefault({
      objectType: 'commerce',
      content: {
        title: product!.name,
        imageUrl: product!.image_url,
        link: {
          mobileWebUrl: window.location.href,
          webUrl: window.location.href
        }
      },
      commerce: {
        productName: product!.name,
        regularPrice: product!.price,
        discountPrice: displayPrice,
        discountRate: product!.discount_rate
      },
      buttons: [
        {
          title: '구매하기',
          link: {
            mobileWebUrl: window.location.href,
            webUrl: window.location.href
          }
        }
      ]
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">상품 정보를 불러오는 중...</p>
        </div>
      </div>
    )
  }

  if (error || !product) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">상품을 찾을 수 없습니다</h2>
          <p className="text-gray-600 mb-6">{error || '요청하신 상품이 존재하지 않습니다.'}</p>
          <button
            onClick={() => navigate('/')}
            className="bg-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-purple-700 transition"
          >
            홈으로 돌아가기
          </button>
        </div>
      </div>
    )
  }

  const displayPrice = product.current_price || product.price
  
  // Parse detail_images if it's a JSON string
  const detailImages = product.detail_images 
    ? (typeof product.detail_images === 'string' 
        ? JSON.parse(product.detail_images) 
        : product.detail_images)
    : []

  return (
    <div className="min-h-screen bg-white pb-28">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
        <div className="flex items-center justify-between px-4 py-3">
          <button 
            onClick={() => {
              // 세션 스토리지에서 실제 출발지 확인
              const actualReferrer = sessionStorage.getItem('productDetailReferrer')
              
              if (actualReferrer && actualReferrer !== '/login' && !actualReferrer.includes('/auth/kakao')) {
                // 로그인 전 실제 출발지가 있으면 그곳으로
                navigate(actualReferrer)
                sessionStorage.removeItem('productDetailReferrer')
              } else if (window.history.length > 2) {
                // 히스토리가 충분하면 뒤로가기 (로그인/콜백 페이지 건너뛰기)
                navigate(-2)
              } else {
                // 히스토리 없으면 홈으로
                navigate('/')
              }
            }}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <ArrowLeft className="w-6 h-6 text-gray-900" />
          </button>
          <h1 className="text-lg font-bold text-gray-900">상품 상세</h1>
          <div className="flex items-center gap-2">
            <button 
              onClick={handleShare}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
              aria-label="공유하기"
            >
              <Share2 className="w-5 h-5 text-gray-600" />
            </button>
            <button className="p-2 hover:bg-gray-100 rounded-lg transition">
              <Heart className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>
      </header>

      {/* Product Image */}
      <div className="w-full aspect-square bg-gray-100 relative">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ShoppingCart className="w-24 h-24 text-gray-300" />
          </div>
        )}
        
        {/* Discount Badge */}
        {product.discount_rate > 0 && (
          <div className="absolute top-4 left-4 bg-red-500 text-white text-sm font-bold px-3 py-1 rounded-lg">
            {product.discount_rate}% OFF
          </div>
        )}
      </div>

      {/* Product Info */}
      <div className="p-6 space-y-6">
        {/* Seller */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-indigo-500 rounded-full flex items-center justify-center">
            <span className="text-white text-xs font-bold">{product.seller_name.charAt(0)}</span>
          </div>
          <span className="text-sm font-medium text-gray-700">{product.seller_name}</span>
        </div>

        {/* Product Name */}
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{product.name}</h2>
          {product.description && (
            <p className="text-gray-600 leading-relaxed">{product.description}</p>
          )}
        </div>

        {/* Price */}
        <div className="space-y-2">
          {product.original_price && product.original_price > displayPrice && (
            <div className="flex items-center gap-2">
              <span className="text-lg text-gray-400 line-through">
                ₩{product.original_price.toLocaleString()}
              </span>
              <span className="text-red-500 font-bold">{product.discount_rate}%</span>
            </div>
          )}
          <div className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
            ₩{displayPrice.toLocaleString()}
          </div>
        </div>

        {/* Stock & Sales */}
        <div className="flex gap-4 text-sm">
          <div>
            <span className="text-gray-500">재고: </span>
            <span className={`font-semibold ${product.stock < 10 ? 'text-red-600' : 'text-gray-900'}`}>
              {product.stock}개
            </span>
          </div>
          {product.sold_count && product.sold_count > 0 && (
            <div>
              <span className="text-gray-500">판매: </span>
              <span className="font-semibold text-gray-900">{product.sold_count}개</span>
            </div>
          )}
        </div>

        {/* Detail Images */}
        {detailImages.length > 0 && (
          <div className="border-t border-gray-200 pt-6">
            <h3 className="text-lg font-bold text-gray-900 mb-4">상품 상세 이미지</h3>
            <div className="space-y-2">
              {detailImages.map((imageUrl: string, index: number) => (
                <div key={index} className="w-full aspect-square bg-gray-100 rounded-lg overflow-hidden">
                  <img
                    src={imageUrl}
                    alt={`${product.name} 상세 ${index + 1}`}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement
                      // Prevent infinite loop
                      if (!target.dataset.fallbackApplied) {
                        target.dataset.fallbackApplied = 'true'
                        target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="800" height="800"%3E%3Crect width="800" height="800" fill="%23f3f4f6"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="24" fill="%239ca3af"%3E이미지 없음%3C/text%3E%3C/svg%3E'
                      }
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quantity Selector */}
        <div className="border-t border-gray-200 pt-6">
          <label className="block text-sm font-medium text-gray-700 mb-3">수량</label>
          <div className="flex items-center gap-4">
            <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
              <button
                onClick={decreaseQuantity}
                disabled={quantity <= 1}
                className="p-3 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                <Minus className="w-5 h-5" />
              </button>
              <span className="px-6 py-3 font-semibold text-lg">{quantity}</span>
              <button
                onClick={increaseQuantity}
                disabled={quantity >= product.stock}
                className="p-3 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">총 금액</p>
              <p className="text-xl font-bold text-purple-600">
                ₩{(displayPrice * quantity).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg lg:static lg:shadow-none">
        <div className="flex gap-3 w-full">
          <button
            onClick={handleAddToCart}
            className="flex-1 bg-white border-2 border-purple-600 text-purple-600 font-bold py-4 rounded-xl hover:bg-purple-50 transition-all duration-200"
          >
            <ShoppingCart className="w-5 h-5 inline mr-2" />
            장바구니
          </button>
          <button
            onClick={handleBuyNow}
            className="flex-1 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold py-4 rounded-xl hover:from-purple-700 hover:to-indigo-700 transition-all duration-200 shadow-lg"
          >
            구매하기
          </button>
        </div>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 animate-slideDown">
          <div className={`px-6 py-3 rounded-lg shadow-lg ${
            toast.type === 'success' 
              ? 'bg-green-500 text-white' 
              : 'bg-red-500 text-white'
          }`}>
            {toast.message}
          </div>
        </div>
      )}

      {/* Mobile Footer */}
      <div className="pb-24 lg:pb-0">
        <MobileFooter />
      </div>

      <style>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translate(-50%, -20px);
          }
          to {
            opacity: 1;
            transform: translate(-50%, 0);
          }
        }
        .animate-slideDown {
          animation: slideDown 0.3s ease-out;
        }
      `}</style>
    </div>
  )
}
