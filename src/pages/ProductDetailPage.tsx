import { useEffect, useState, lazy, Suspense } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { getUserId } from '@/utils/auth'
// ✅ Zustand 직접 사용
import { useAuthKR } from '@/shared/stores/useAuthKR'
import { useAuthWorld } from '@/shared/stores/useAuthWorld'
import { isKorea } from '@/config/region'
// ✅ React Query Hook
import { useProduct, useProductOptions } from '@/hooks/useProduct'

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
  
  // ✅ Region 기반 Store 선택
  const useAuth = isKorea() ? useAuthKR : useAuthWorld
  
  // ✅ Selector로 필요한 상태만 구독
  const user = useAuth(state => state.user)
  const isLoggedIn = !!user
  
  // 🔥 React Query로 데이터 fetching (자동 캐싱 + 재시도)
  const { data: product, isLoading, error } = useProduct(id)
  const { data: options = [] } = useProductOptions(id)
  
  const [selectedOptions, setSelectedOptions] = useState<{ [key: string]: number }>({})
  const [quantity, setQuantity] = useState(1)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

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
        productId: product!.id,
        quantity,
        optionId: Object.values(selectedOptions)[0] || null,
        priceSnapshot: product!.price
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
      showToast(err.response?.data?.error || '장바구니 추가에 실패했습니다.', 'error')
    }
  }

  async function handleBuyNow() {
    if (!isLoggedIn) {
      showToast('로그인이 필요합니다.', 'error')
      localStorage.setItem('loginReturnUrl', window.location.pathname)
      setTimeout(() => navigate('/login'), 1000)
      return
    }

    console.log('[ProductDetail] 🛒 구매하기: 장바구니에 추가 후 결제 페이지 이동')
    
    try {
      // 1️⃣ 먼저 장바구니에 추가
      await api.post('/api/cart', {
        productId: product!.id,
        quantity,
        optionId: Object.values(selectedOptions)[0] || null,
        priceSnapshot: product!.price
      })
      console.log('[ProductDetail] ✅ 장바구니 추가 완료')
      
      localStorage.setItem('hasCartItems', 'true')
      
      // 2️⃣ 결제 페이지로 이동
      navigate('/checkout')
    } catch (err: any) {
      console.error('[ProductDetail] ❌ 장바구니 추가 실패:', err)
      showToast(err.response?.data?.error || '구매 진행에 실패했습니다.', 'error')
    }
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
      }).catch(err => {
        console.log('Share cancelled', err)
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
      <MobileHeader onShare={handleShare} />

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
            <div className="px-5 py-6">
              <h2 className="text-sm font-bold text-foreground">상세 이미지</h2>
              <div className="mt-4 flex flex-col gap-1">
                {detailImages.map((src, idx) => (
                  <ProgressiveImage
                    key={idx}
                    src={src}
                    alt={`Product detail ${idx + 1}`}
                    className="h-auto w-full"
                    width={800}
                    priority={idx === 0} // First image priority
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
              { label: '판매자', value: product.seller_name },
              { label: '재고', value: `${product.stock}개` },
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
          disabled={product.stock === 0}
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
