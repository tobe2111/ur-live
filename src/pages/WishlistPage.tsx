import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import SEO from '@/components/SEO'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { isLoggedInSync, getUserIdSync } from '@/utils/auth'
import WishlistButton from '../components/WishlistButton'
import { ChevronLeft, Heart } from 'lucide-react'

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

  const loadWishlists = async (_uid: number) => {
    try {
      setLoading(true)
      // ✅ UX C3 FIX: auth-implicit endpoint (IDOR 방지, URL에 userId 노출 금지)
      // 🛡️ 2026-04-22 배치 137: axios → api (auth interceptor 적용되어야 requireAuth 통과)
      const response = await api.get('/api/wishlists')

      if (response.data.success) {
        setWishlists(response.data.data.items)
      } else {
        throw new Error(response.data.error)
      }
    } catch (err: unknown) {
      const err_ = err as { response?: { data?: { error?: string; message?: string }; status?: number } };
      if (import.meta.env.DEV) console.error('[Wishlist] Load error:', err)
      setError(err_.response?.data?.error || '위시리스트를 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleProductClick = (productId: number) => {
    navigate(`/products/${productId}`)
  }

  const handleAddToCart = async (item: WishlistItem, e: React.MouseEvent) => {
    e.stopPropagation()

    if (item.stock === 0) {
      toast.info('품절된 상품입니다.')
      return
    }

    try {
      // ✅ UX C3 FIX: snake_case + userId 미포함 (서버 미들웨어가 세션에서 추출)
      const response = await api.post('/api/cart', {
        product_id: item.product_id,
        quantity: 1,
        price_snapshot: item.price,
      })

      if (response.data.success) {
        toast.success('장바구니에 추가되었습니다.')
      }
    } catch (error: unknown) {
      const error_ = error as { response?: { data?: { error?: string; message?: string }; status?: number } };
      if (import.meta.env.DEV) console.error('[Wishlist] Add to cart error:', error)
      toast.error(error_.response?.data?.error || '장바구니 추가에 실패했습니다.')
    }
  }

  const handleWishlistToggle = (productId: number, isWishlisted: boolean) => {
    if (!isWishlisted) {
      if (userId) {
        loadWishlists(userId)
      }
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500 mx-auto mb-4"></div>
          <p className="text-gray-500">위시리스트를 불러오는 중...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <button
            onClick={() => userId && loadWishlists(userId)}
            className="px-6 py-2 bg-pink-500 text-white rounded-xl hover:bg-pink-600 transition-colors"
          >
            다시 시도
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white pb-20">
      <SEO title="위시리스트 - 유어딜" description="관심 상품을 모아보세요" url="/wishlist" noindex />

      {/* Header */}
      <div className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-gray-100">
        <div className="flex items-center justify-between px-5 py-3">
          <button onClick={() => navigate(-1)} className="text-gray-900">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-gray-900 font-bold text-[15px]">위시리스트</h1>
          <div className="w-6" />
        </div>
      </div>

      <div className="px-4 py-4">
        <p className="text-gray-500 text-sm mb-4">찜한 상품 {wishlists.length}개</p>

        {wishlists.length === 0 ? (
          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-12 text-center">
            <Heart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">찜한 상품이 없습니다</h2>
            <p className="text-gray-500 mb-6">마음에 드는 상품을 찜해보세요!</p>
            <button
              onClick={() => navigate('/')}
              className="px-6 py-3 bg-pink-500 text-white rounded-xl hover:bg-pink-600 transition-colors font-semibold"
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
                className="bg-white border border-gray-200 rounded-2xl overflow-hidden cursor-pointer group hover:shadow-md transition-shadow"
              >
                {/* 상품 이미지 */}
                <div className="relative aspect-square bg-gray-100">
                  <img
                    src={item.image_url || '/placeholder.png'}
                    alt={item.product_name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement
                      target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23F3F4F6" width="200" height="200"/%3E%3Ctext fill="%239CA3AF" font-family="sans-serif" font-size="14" x="50%25" y="50%25" text-anchor="middle" dominant-baseline="middle"%3ENo Image%3C/text%3E%3C/svg%3E'
                    }}
                  />

                  <div className="absolute top-2 right-2 z-10">
                    <WishlistButton
                      productId={item.product_id}
                      userId={userId}
                      initialWishlisted={true}
                      size="md"
                      className="bg-white/90 rounded-full p-2 backdrop-blur-sm shadow-sm"
                      onToggle={(isWishlisted) => handleWishlistToggle(item.product_id, isWishlisted)}
                    />
                  </div>

                  {item.stock === 0 && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <span className="bg-white text-gray-900 px-4 py-2 rounded-full font-semibold text-sm">품절</span>
                    </div>
                  )}

                  {item.discount_rate > 0 && (
                    <div className="absolute top-2 left-2 bg-red-500 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-md">
                      -{item.discount_rate}%
                    </div>
                  )}
                </div>

                {/* 상품 정보 */}
                <div className="p-3">
                  <p className="text-[10px] text-gray-400 mb-1">@{item.seller_name}</p>
                  <h3 className="text-[12px] font-medium text-gray-900 mb-2 line-clamp-2 min-h-[2.5rem] leading-tight">
                    {item.product_name}
                  </h3>

                  <div className="mb-3">
                    {item.discount_rate > 0 ? (
                      <>
                        <p className="text-[10px] text-gray-400 line-through">
                          {item.original_price.toLocaleString()}원
                        </p>
                        <div className="flex items-baseline gap-1">
                          <span className="text-[13px] font-extrabold text-red-500">{item.discount_rate}%</span>
                          <span className="text-[13px] font-extrabold text-gray-900">
                            {item.price.toLocaleString()}원
                          </span>
                        </div>
                      </>
                    ) : (
                      <p className="text-[13px] font-extrabold text-gray-900">
                        {item.price.toLocaleString()}원
                      </p>
                    )}
                  </div>

                  <button
                    onClick={(e) => handleAddToCart(item, e)}
                    disabled={item.stock === 0}
                    className={`
                      w-full py-2 rounded-xl text-sm font-medium transition-colors
                      ${item.stock === 0
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-gray-900 text-white hover:bg-gray-800'
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
