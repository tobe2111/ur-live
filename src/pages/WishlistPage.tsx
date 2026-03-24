import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { toast } from '@/hooks/useToast'
import WishlistButton from '../components/WishlistButton'

interface WishlistItem {
  id: number
  user_id: number
  product_id: number
  created_at: string
  product_name: string
  price: number
  original_price: number
  discount_rate: number
  image_url: string
  stock: number
  category: string
  is_active: number
  seller_name: string
  seller_id: number
}

const WishlistPage: React.FC = () => {
  const navigate = useNavigate()
  const [wishlists, setWishlists] = useState<WishlistItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userId, setUserId] = useState<number | null>(null)

  useEffect(() => {
    // 사용자 ID 가져오기
    const userSession = localStorage.getItem('user_session_token')
    const storedUserId = localStorage.getItem('user_id')
    
    if (!userSession || !storedUserId) {
      // 로그인 필요
      toast.info('로그인이 필요합니다.')
      localStorage.setItem('loginReturnUrl', window.location.pathname)
      navigate('/login')
      return
    }

    setUserId(parseInt(storedUserId))
    loadWishlists(parseInt(storedUserId))
  }, [navigate])

  // 위시리스트 로드
  const loadWishlists = async (uid: number) => {
    try {
      setLoading(true)
      const response = await axios.get(`/api/wishlists/${uid}`)
      
      if (response.data.success) {
        setWishlists(response.data.data.items)
      } else {
        throw new Error(response.data.error)
      }
    } catch (err: any) {
      console.error('[Wishlist] Load error:', err)
      setError(err.response?.data?.error || '위시리스트를 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // 상품 클릭
  const handleProductClick = (productId: number) => {
    navigate(`/product/${productId}`)
  }

  // 장바구니 추가
  const handleAddToCart = async (item: WishlistItem, e: React.MouseEvent) => {
    e.stopPropagation()

    if (item.stock === 0) {
      toast.info('품절된 상품입니다.')
      return
    }

    try {
      const response = await axios.post('/api/cart', {
        userId,
        productId: item.product_id,
        quantity: 1,
        priceSnapshot: item.price
      })

      if (response.data.success) {
        toast.success('장바구니에 추가되었습니다.')
      }
    } catch (error: any) {
      console.error('[Wishlist] Add to cart error:', error)
      toast.error(error.response?.data?.error || '장바구니 추가에 실패했습니다.')
    }
  }

  // 위시리스트에서 제거 (하트 버튼 토글 시)
  const handleWishlistToggle = (productId: number, isWishlisted: boolean) => {
    if (!isWishlisted) {
      // 위시리스트에서 제거됨 - 목록 새로고침
      if (userId) {
        loadWishlists(userId)
      }
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500 mx-auto mb-4"></div>
          <p className="text-gray-600">위시리스트를 불러오는 중...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <button
            onClick={() => userId && loadWishlists(userId)}
            className="px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
          >
            다시 시도
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto min-h-screen max-w-md bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* 헤더 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">위시리스트</h1>
          <p className="text-gray-600">찜한 상품 {wishlists.length}개</p>
        </div>

        {/* 위시리스트 그리드 */}
        {wishlists.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-12 text-center">
            <svg
              className="w-20 h-20 text-gray-300 mx-auto mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
              />
            </svg>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">찜한 상품이 없습니다</h2>
            <p className="text-gray-600 mb-6">마음에 드는 상품을 찜해보세요!</p>
            <button
              onClick={() => navigate('/')}
              className="px-6 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
            >
              쇼핑 계속하기
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 lg:gap-6">
            {wishlists.map((item) => (
              <div
                key={item.id}
                onClick={() => handleProductClick(item.product_id)}
                className="bg-white rounded-lg shadow-sm overflow-hidden cursor-pointer hover:shadow-md transition-shadow group"
              >
                {/* 상품 이미지 */}
                <div className="relative aspect-square bg-gray-100">
                  <img
                    src={item.image_url || '/placeholder.png'}
                    alt={item.product_name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement
                      target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23f3f4f6" width="200" height="200"/%3E%3Ctext fill="%239ca3af" font-family="sans-serif" font-size="14" x="50%25" y="50%25" text-anchor="middle" dominant-baseline="middle"%3ENo Image%3C/text%3E%3C/svg%3E'
                    }}
                  />

                  {/* 하트 버튼 (우측 상단) */}
                  <div className="absolute top-2 right-2 z-10">
                    <WishlistButton
                      productId={item.product_id}
                      userId={userId}
                      initialWishlisted={true}
                      size="md"
                      className="bg-white rounded-full p-2 shadow-md"
                      onToggle={(isWishlisted) => handleWishlistToggle(item.product_id, isWishlisted)}
                    />
                  </div>

                  {/* 품절 배지 */}
                  {item.stock === 0 && (
                    <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                      <span className="bg-white text-gray-900 px-4 py-2 rounded-full font-semibold">품절</span>
                    </div>
                  )}

                  {/* 할인율 배지 */}
                  {item.discount_rate > 0 && (
                    <div className="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded">
                      {item.discount_rate}%
                    </div>
                  )}
                </div>

                {/* 상품 정보 */}
                <div className="p-3">
                  <p className="text-xs text-gray-500 mb-1">{item.seller_name}</p>
                  <h3 className="text-sm font-medium text-gray-900 mb-2 line-clamp-2 min-h-[2.5rem]">
                    {item.product_name}
                  </h3>

                  {/* 가격 */}
                  <div className="mb-3">
                    {item.discount_rate > 0 ? (
                      <>
                        <p className="text-xs text-gray-400 line-through">
                          {item.original_price.toLocaleString()}원
                        </p>
                        <p className="text-lg font-bold text-red-500">
                          {item.price.toLocaleString()}원
                        </p>
                      </>
                    ) : (
                      <p className="text-lg font-bold text-gray-900">
                        {item.price.toLocaleString()}원
                      </p>
                    )}
                  </div>

                  {/* 장바구니 버튼 */}
                  <button
                    onClick={(e) => handleAddToCart(item, e)}
                    disabled={item.stock === 0}
                    className={`
                      w-full py-2 rounded-lg text-sm font-medium transition-colors
                      ${item.stock === 0
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        : 'bg-red-500 text-white hover:bg-red-600'
                      }
                    `}
                  >
                    {item.stock === 0 ? '품절' : '장바구니'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default WishlistPage
