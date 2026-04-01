import { useEffect, useState, lazy, Suspense } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { getUserId } from '@/utils/auth'
// ✅ Zustand 직접 사용
import { useAuthKR } from '@/shared/stores/useAuthKR'
import { useAuthWorld } from '@/shared/stores/useAuthWorld'
import { isKorea } from '@/config/region'
// ✅ React Query Hook (Product, ProductOption 타입도 여기서 가져옴)
import { useProduct, useProductOptions } from '@/hooks/useProduct'
import type { Product, ProductOption } from '@/hooks/useProduct'

// Import KREAM-style components
import { MobileHeader } from '@/components/product/mobile-header'
import { ProductHeader } from '@/components/product/product-header'
import { ProductInfoGrid } from '@/components/product/ProductInfoGrid'
import { ProductNoticeSection } from '@/components/product/ProductNoticeSection'
import { ReturnPolicySection } from '@/components/product/ReturnPolicySection'
import { Separator } from '@/components/ui/separator'
import { ProductDetailSkeleton } from '@/components/ui/skeleton'
import { ProgressiveImage } from '@/components/ui/progressive-image'

// Lazy load heavy components
const ProductImageCarousel = lazy(() => import('@/components/product/product-image-carousel').then(m => ({ default: m.ProductImageCarousel })))
const FloatingActionBar = lazy(() => import('@/components/product/floating-action-bar').then(m => ({ default: m.FloatingActionBar })))

function ProductReviews({ productId }: { productId: number | string }) {
  const [summary, setSummary] = useState<any>(null)
  const [reviews, setReviews] = useState<any[]>([])

  useEffect(() => {
    api.get(`/api/reviews/product/${productId}/summary`).then(r => {
      if (r.data.success) setSummary(r.data.data)
    }).catch(() => {})
    api.get(`/api/reviews/product/${productId}?limit=5`).then(r => {
      if (r.data.success) setReviews(r.data.data.reviews)
    }).catch(() => {})
  }, [productId])

  const avgRating = summary?.avg_rating ?? 0
  const totalCount = summary?.total_count ?? 0

  return (
    <div>
      <h2 className="text-sm font-bold text-foreground mb-4">
        리뷰 {totalCount > 0 && <span className="text-muted-foreground font-normal">({totalCount})</span>}
      </h2>

      {/* 평점 요약 */}
      {totalCount > 0 ? (
        <div className="flex items-center gap-4 mb-4">
          <div className="text-center">
            <p className="text-3xl font-bold text-foreground">{avgRating}</p>
            <div className="flex gap-0.5 mt-1">
              {[1, 2, 3, 4, 5].map(s => (
                <span key={s} className={`text-sm ${s <= Math.round(avgRating) ? 'text-yellow-400' : 'text-gray-200'}`}>
                  ★
                </span>
              ))}
            </div>
          </div>
          <div className="flex-1 space-y-1">
            {[5, 4, 3, 2, 1].map(s => {
              const count = summary?.[`star_${s}`] ?? 0
              const pct = totalCount > 0 ? (count / totalCount) * 100 : 0
              return (
                <div key={s} className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground w-3">{s}</span>
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-yellow-400 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground py-6 text-center">아직 리뷰가 없습니다.</p>
      )}

      {/* 리뷰 목록 */}
      {reviews.length > 0 && (
        <div className="space-y-3 mt-3">
          {reviews.map((r: any) => (
            <div key={r.id} className="border border-border/50 rounded-xl p-3">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map(s => (
                      <span key={s} className={`text-xs ${s <= r.rating ? 'text-yellow-400' : 'text-gray-200'}`}>★</span>
                    ))}
                  </div>
                  <span className="text-[10px] text-muted-foreground">{r.user_name}</span>
                </div>
                <span className="text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleDateString('ko-KR')}</span>
              </div>
              {r.content && <p className="text-xs text-foreground leading-relaxed">{r.content}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  
  // ✅ Region 기반 Store 선택
  const krUser = useAuthKR(state => state.user)
  const worldUser = useAuthWorld(state => state.user)
  
  // ✅ Selector로 필요한 상태만 구독
  const user = isKorea() ? krUser : worldUser
  const isLoggedIn = !!user
  
  // 🔥 React Query로 데이터 fetching (자동 캐싱 + 재시도)
  const { data: product, isLoading, error } = useProduct(id)
  const { data: options = [] } = useProductOptions(id)
  
  const [selectedOptions, setSelectedOptions] = useState<{ [key: string]: number }>({})
  const [quantity, setQuantity] = useState(1)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [isWishlisted, setIsWishlisted] = useState(false)
  const [wishlistLoading, setWishlistLoading] = useState(false)

  useEffect(() => {
    const referrer = document.referrer
    if (referrer && !referrer.includes('/login') && !referrer.includes('/auth/kakao')) {
      try {
        const referrerPath = new URL(referrer).pathname
        sessionStorage.setItem('productDetailReferrer', referrerPath)
      } catch (e) {
        console.error('Failed to parse referrer URL:', e)
      }
    }
  }, [id])

  // Check wishlist status when product loads
  useEffect(() => {
    if (!id || !isLoggedIn) return
    api.get('/api/wishlists').then(r => {
      if (r.data.success && r.data.data?.items) {
        const found = r.data.data.items.some((item: any) => String(item.product_id) === String(id))
        setIsWishlisted(found)
      }
    }).catch(() => {})
  }, [id, isLoggedIn])

  async function handleToggleWishlist() {
    if (!isLoggedIn) {
      showToast('로그인이 필요합니다.', 'error')
      localStorage.setItem('loginReturnUrl', window.location.pathname)
      setTimeout(() => navigate('/login'), 1000)
      return
    }
    if (!id || wishlistLoading) return
    setWishlistLoading(true)
    try {
      const res = await api.post('/api/wishlists/toggle', { product_id: Number(id) })
      if (res.data.success) {
        const nowWishlisted = res.data.data?.isWishlisted ?? res.data.action === 'added'
        setIsWishlisted(nowWishlisted)
        showToast(nowWishlisted ? '찜 목록에 추가되었습니다.' : '찜 목록에서 삭제되었습니다.', 'success')
      }
    } catch {
      showToast('찜하기에 실패했습니다.', 'error')
    } finally {
      setWishlistLoading(false)
    }
  }

  function showToast(message: string, type: 'success' | 'error' = 'success') {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  async function handleAddToCart() {
    if (import.meta.env.DEV) {
      console.log('[ProductDetail] 🛒 담기 버튼 클릭, isLoggedIn:', isLoggedIn)
      console.log('[ProductDetail] 🔍 localStorage 확인:', {
        user_id: localStorage.getItem('user_id'),
        firebase_token: localStorage.getItem('firebase_token')?.substring(0, 20) + '...'
      })
    }
    
    if (!isLoggedIn) {
      showToast('로그인이 필요합니다.', 'error')
      localStorage.setItem('loginReturnUrl', window.location.pathname)
      setTimeout(() => navigate('/login'), 1000)
      return
    }

    try {
      if (import.meta.env.DEV) {
        console.log('[ProductDetail] 📡 POST /api/cart 호출 중...')
      }
      await api.post('/api/cart', {
        product_id: product!.id,
        quantity,
        price_snapshot: product!.price,
        options: Object.values(selectedOptions)[0] ? JSON.stringify(selectedOptions) : null
      })
      if (import.meta.env.DEV) {
        console.log('[ProductDetail] ✅ 장바구니 추가 성공')
      }
      showToast('장바구니에 추가되었습니다.', 'success')
      localStorage.setItem('hasCartItems', 'true')
      
      // ✅ 장바구니 페이지로 이동
      setTimeout(() => navigate('/cart'), 1000)
    } catch (err: any) {
      if (import.meta.env.DEV) {
        console.error('[ProductDetail] ❌ 장바구니 추가 실패:', err)
      }
      const errorMessage = err instanceof Error ? err.message : (err.response?.data?.error || '장바구니 추가에 실패했습니다.')
      showToast(errorMessage, 'error')
    }
  }

  async function handleBuyNow() {
    if (!isLoggedIn) {
      showToast('로그인이 필요합니다.', 'error')
      localStorage.setItem('loginReturnUrl', window.location.pathname)
      setTimeout(() => navigate('/login'), 1000)
      return
    }

    if (!product) return

    // 바로구매: 장바구니 거치지 않고 해당 상품만 결제
    navigate('/checkout', {
      state: {
        directPurchase: [{
          id: `direct_${product.id}_${Date.now()}`,
          product_id: product.id,
          product_name: product.name,
          product_description: product.description,
          product_price: product.price,
          product_image: product.image_url,
          image_url: product.image_url,
          quantity,
          price_snapshot: product.price,
          price: product.price,
          item_total: product.price * quantity,
          seller_id: (product as any).seller_id ?? null,
          seller_name: (product as any).seller_name ?? null,
          shipping_fee: 3000,
          free_shipping_threshold: 0,
          option_id: Object.values(selectedOptions)[0] || null,
          option_value: null,
        }]
      }
    })
  }

  function handleShare() {
    if (!product) return

    const shareText = `${product.name} - ${displayPrice.toLocaleString()}원`
    const shareUrl = window.location.href

    if (navigator.share) {
      navigator.share({
        title: product.name,
        text: shareText,
        url: shareUrl
      }).catch(() => {
        // Share was cancelled by user
      })
    } else {
      navigator.clipboard.writeText(shareUrl).then(() => {
        showToast('링크가 복사되었습니다.', 'success')
      })
    }
  }

  if (isLoading) {
    return <ProductDetailSkeleton />
  }

  if (error || !product) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">{error?.message || '상품을 찾을 수 없습니다.'}</p>
          <button 
            onClick={() => navigate('/')}
            className="mt-4 px-6 py-2 bg-foreground text-background rounded-lg text-sm font-semibold"
          >
            홈으로 돌아가기
          </button>
        </div>
      </div>
    )
  }

  const displayPrice = product.current_price || product.price

  // Parse detail images
  let detailImages: string[] = []
  if (product.detail_images) {
    try {
      detailImages = typeof product.detail_images === 'string' 
        ? JSON.parse(product.detail_images)
        : product.detail_images
    } catch (e) {
      console.error('Failed to parse detail images:', e)
      detailImages = []
    }
  }

  // All product images for carousel (main image + detail images)
  const allImages = [product.image_url, ...detailImages].filter(Boolean)

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header */}
      <MobileHeader
        onShare={handleShare}
        isWishlisted={isWishlisted}
        onToggleWishlist={handleToggleWishlist}
      />

      <main className="pb-20">
        {/* Product Images Carousel */}
        <Suspense fallback={<div className="w-full h-96 bg-gray-100 animate-pulse" />}>
          <ProductImageCarousel images={allImages} />
        </Suspense>

        <Separator />

        {/* Product Info */}
        <ProductHeader name={product.name} price={displayPrice} />

        {/* Product Description */}
        {product.description && (
          <>
            <Separator />
            <div className="px-5 py-6">
              <h2 className="text-sm font-bold text-foreground">상품 설명</h2>
              <p className="mt-3 text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {product.description}
              </p>
            </div>
          </>
        )}

        {/* Product Details - Vertical Images */}
        {detailImages.length > 0 && (
          <>
            <Separator />
            <div className="px-0">
              <h2 className="text-sm font-bold text-foreground px-5 py-4">상세 이미지</h2>
              <div className="flex flex-col gap-0">
                {detailImages.map((src, idx) => (
                  <ProgressiveImage
                    key={idx}
                    src={src}
                    alt={`Product detail ${idx + 1}`}
                    className="h-auto w-full block"
                    width={800}
                    priority={idx === 0}
                  />
                ))}
              </div>
            </div>
          </>
        )}

        {/* Product Info Section */}
        <Separator />
        <div className="px-5 py-6">
          <h2 className="text-sm font-bold text-foreground">상품 정보</h2>
          <div className="mt-3">
            <ProductInfoGrid items={[
              { label: '판매자', value: product.seller_name ?? '-' },
              { label: '재고', value: `${product.stock ?? product.stock_quantity ?? 0}개` },
              ...(product.sold_count !== undefined && product.sold_count > 0 ? [{ label: '판매량', value: `${product.sold_count}개` }] : []),
              ...(product.category ? [{ label: '카테고리', value: product.category }] : []),
            ]} />
          </div>
        </div>

        {/* 안내 정보 */}
        <Separator />
        <div className="px-5 py-6">
          <h2 className="text-sm font-bold text-foreground">안내 정보</h2>
          <div className="mt-3">
            <ProductNoticeSection />
          </div>
        </div>

        {/* 상품 리뷰 */}
        <Separator />
        <div className="px-5 py-6">
          <ProductReviews productId={product.id} />
        </div>

        {/* 교환 및 반품 안내 (상세) */}
        <Separator />
        <div className="px-5 py-6">
          <ReturnPolicySection />
        </div>

        {/* 배송안내 */}
        <Separator />
        <div className="px-5 py-6">
          <h2 className="text-sm font-bold text-foreground mb-4">배송안내</h2>
          
          <div className="space-y-4">
            <div>
              <h3 className="text-xs font-semibold text-foreground mb-2">배송 업체</h3>
              <p className="text-[11px] text-muted-foreground">OO배송물류 (1544-7772)</p>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-foreground mb-2">배송 지역</h3>
              <p className="text-[11px] text-muted-foreground">대한민국 전 지역</p>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-foreground mb-2">배송 비용</h3>
              <p className="text-[11px] text-muted-foreground">3,000원 / 구매 금액 50,000원 이상 시 무료 배송/도서산간 지역 별도 추가 금액 발생</p>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-foreground mb-2">배송 기간</h3>
              <p className="text-[11px] text-muted-foreground">주말·공휴일 제외 2-5일</p>
            </div>

            <div className="pt-3 border-t border-border/50">
              <h3 className="text-xs font-semibold text-foreground mb-2">유의 사항</h3>
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <span className="text-[11px] text-muted-foreground">•</span>
                  <p className="text-[11px] text-muted-foreground leading-relaxed flex-1">
                    주문 폭주 및 공휴 사정으로 인하여 지연 및 품절이 발생될 수 있습니다.
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-[11px] text-muted-foreground">•</span>
                  <p className="text-[11px] text-muted-foreground leading-relaxed flex-1">
                    기본 배송기간 이상 소요되는 상품이거나, 품절 상품은 개별 연락을 드립니다.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Floating Cart / Purchase Bar */}
      <Suspense fallback={<div className="fixed bottom-0 left-0 right-0 h-16 bg-gray-100 animate-pulse" />}>
        <FloatingActionBar 
          onAddToCart={handleAddToCart}
          onBuyNow={handleBuyNow}
          disabled={product.stock === 0 && product.stock_quantity === 0}
        />
      </Suspense>

      {/* Toast Notification */}
      {toast && (
        <div 
          className={`fixed top-20 left-1/2 -translate-x-1/2 z-[60] px-4 py-2.5 rounded-lg shadow-lg max-w-sm transition-all ${
            toast.type === 'success' 
              ? 'bg-foreground text-background' 
              : 'bg-destructive text-white'
          }`}
        >
          <p className="text-sm font-medium text-center">{toast.message}</p>
        </div>
      )}
    </div>
  )
}
