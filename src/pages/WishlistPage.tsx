import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import SEO from '@/components/SEO'
import axios from 'axios'
import { toast } from '@/hooks/useToast'
import { isLoggedInSync, getUserIdSync } from '@/utils/auth'
import WishlistButton from '../components/WishlistButton'
import { ChevronLeft } from 'lucide-react'

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
    if (!isLoggedInSync()) {
      toast.info('로그인이 필요합니다.')
      localStorage.setItem('loginReturnUrl', window.location.pathname)
      navigate('/login')
      return
    }

    const uid = getUserIdSync()
    if (uid) {
      setUserId(parseInt(uid))
      loadWishlists(parseInt(uid))
    }
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
    } catch (err: unknown) {
      const err_ = err as { response?: { data?: { error?: string; message?: string }; status?: number } };
      console.error('[Wishlist] Load error:', err)
      setError(err_.response?.data?.error || '위시리스트를 불러오는데 실패했습니다.')
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
    } catch (error: unknown) {
      const error_ = error as { response?: { data?: { error?: string; message?: string }; status?: number } };
      console.error('[Wishlist] Add to cart error:', error)
      toast.error(error_.response?.data?.error || '장바구니 추가에 실패했습니다.')
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
      <div className="min-h-screen bg-[#020202] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500 mx-auto mb-4"></div>
          <p className="text-gray-400">위시리스트를 불러오는 중...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#020202] flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button
            onClick={() => userId && loadWishlists(userId)}
            className="px-6 py-2 bg-pink-500 text-white rounded-lg hover:bg-pink-600 transition-colors"
          >
            다시 시도
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#020202] pb-20">
      <SEO title="위시리스트 - 유어딜" description="관심 상품을 모아보세요" url="/wishlist" />

      {/* Header */}
      <div className="sticky top-0 z-50 bg-[#020202]/90 backdrop-blur border-b border-[#1A1A1A]">
        <div className="flex items-center justify-between px-5 py-3">
          <button onClick={() => navigate(-1)} className="text-white">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-white font-bold text-[15px]">위시리스트</h1>
          <div className="w-6" />
        </div>
      </div>

      <div className="px-4 py-4">
        {/* 카운트 */}
        <p className="text-gray-400 text-sm mb-4">찜한 상품 {wishlists.length}개</p>

        {/* 위시리스트 그리드 */}
        {wishlists.length === 0 ? (
          <div className="bg-[#121212] border border-[#2A2A2A] rounded-2xl p-12 text-center">
            <svg
              className="w-20 h-20 text-gray-600 mx-auto mb-4"
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
            <h2 className="text-xl font-semibold text-white mb-2">찜한 상품이 없습니다</h2>
            <p className="text-gray-400 mb-6">마음에 드는 상품을 찜해보세요!</p>
            <button
              onClick={() => navigate('/')}
              className="px-6 py-3 bg-pink-500 text-white rounded-lg hover:bg-pink-600 transition-colors"
            >
              쇼핑 계속하기
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {wishlists.map((item) => (
              <div
                key={item.id}
                onClick={() => handleProductClick(item.product_id)}
                className="bg-[#121212] border border-[#2A2A2A] rounded-2xl overflow-hidden cursor-pointer group"
              >
                {/* 상품 이미지 */}
                <div className="relative aspect-square bg-[#1A1A1A]">
                  <img
                    src={item.image_url || '/placeholder.png'}
                    alt={item.product_name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement
                      target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%231A1A1A" width="200" height="200"/%3E%3Ctext fill="%23666" font-family="sans-serif" font-size="14" x="50%25" y="50%25" text-anchor="middle" dominant-baseline="middle"%3ENo Image%3C/text%3E%3C/svg%3E'
                    }}
                  />

                  {/* 하트 버튼 (우측 상단) */}
                  <div className="absolute top-2 right-2 z-10">
                    <WishlistButton
                      productId={item.product_id}
                      userId={userId}
                      initialWishlisted={true}
                      size="md"
                      className="bg-[#020202]/60 rounded-full p-2 backdrop-blur-sm"
                      onToggle={(isWishlisted) => handleWishlistToggle(item.product_id, isWishlisted)}
                    />
                  </div>

                  {/* 품절 배지 */}
                  {item.stock === 0 && (
                    <div className="absolute inset-0 bg-black bg-opacity-60 flex items-center justify-center">
                      <span className="bg-[#121212] text-white px-4 py-2 rounded-full font-semibold text-sm">품절</span>
                    </div>
                  )}

                  {/* 할인율 배지 */}
                  {item.discount_rate > 0 && (
                    <div className="absolute top-2 left-2 bg-pink-500 text-white text-xs font-bold px-2 py-1 rounded">
                      {item.discount_rate}%
                    </div>
                  )}
                </div>

                {/* 상품 정보 */}
                <div className="p-3">
                  <p className="text-xs text-gray-500 mb-1">{item.seller_name}</p>
                  <h3 className="text-sm font-medium text-white mb-2 line-clamp-2 min-h-[2.5rem]">
                    {item.product_name}
                  </h3>

                  {/* 가격 */}
                  <div className="mb-3">
                    {item.discount_rate > 0 ? (
                      <>
                        <p className="text-xs text-gray-500 line-through">
                          {item.original_price.toLocaleString()}원
                        </p>
                        <p className="text-lg font-bold text-pink-400">
                          {item.price.toLocaleString()}원
                        </p>
                      </>
                    ) : (
                      <p className="text-lg font-bold text-white">
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
                        ? 'bg-[#1A1A1A] text-gray-500 cursor-not-allowed'
                        : 'bg-white text-[#020202] hover:bg-gray-200'
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
