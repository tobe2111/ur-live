import { useEffect, useState, lazy, Suspense } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { Users, Gift, Clock, ChevronRight } from 'lucide-react'
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
import SEO, { productJsonLd } from '@/components/SEO'
import KakaoShareButton from '@/components/KakaoShareButton'
import SharePrompt from '@/components/SharePrompt'
import { ProductInfoGrid } from '@/components/product/ProductInfoGrid'
import { ProductNoticeSection } from '@/components/product/ProductNoticeSection'
import { ReturnPolicySection } from '@/components/product/ReturnPolicySection'
import { Separator } from '@/components/ui/separator'
import { ProductDetailSkeleton } from '@/components/ui/skeleton'
import { ProgressiveImage } from '@/components/ui/progressive-image'

// Lazy load heavy components
const ProductImageCarousel = lazy(() => import('@/components/product/product-image-carousel').then(m => ({ default: m.ProductImageCarousel })))
const FloatingActionBar = lazy(() => import('@/components/product/floating-action-bar').then(m => ({ default: m.FloatingActionBar })))

function ReviewForm({ productId, onSubmitted }: { productId: string | number; onSubmitted: () => void }) {
  const [open, setOpen] = useState(false)
  const [rating, setRating] = useState(5)
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [showSharePrompt, setShowSharePrompt] = useState(false)

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="w-full py-2.5 mt-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50">
        리뷰 작성하기
      </button>
    )
  }

  return (
    <div className="mt-3 border border-gray-200 rounded-xl p-4">
      <h3 className="text-sm font-bold text-gray-900 mb-1">리뷰 작성</h3>
      <div className="rounded-xl px-3 py-2.5 mb-3 flex items-center gap-2 bg-pink-50">
        <span className="text-sm">🎁</span>
        <span className="text-[11px] font-semibold text-pink-700">텍스트 50딜 · 사진 100딜 · 영상 200딜 리워드</span>
      </div>
      {/* 별점 */}
      <div className="flex gap-1 mb-3">
        {[1, 2, 3, 4, 5].map(s => (
          <button key={s} onClick={() => setRating(s)} className={`text-xl ${s <= rating ? 'text-yellow-400' : 'text-gray-200'}`}>★</button>
        ))}
      </div>
      {/* 내용 */}
      <textarea
        value={content}
        onChange={e => setContent(e.target.value)}
        placeholder="상품은 어떠셨나요? 최소 10자 이상 작성해주세요."
        rows={3}
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 resize-none focus:outline-none focus:border-blue-400"
      />
      <div className="flex gap-2 mt-3">
        <button onClick={() => setOpen(false)} className="flex-1 py-2 bg-gray-100 text-gray-600 text-sm rounded-lg font-medium">취소</button>
        <button
          disabled={content.length < 10 || submitting}
          onClick={async () => {
            setSubmitting(true)
            try {
              const res = await api.post('/api/reviews', { product_id: Number(productId), rating, content })
              if (res.data.success) {
                setOpen(false); setContent(''); setRating(5)
                onSubmitted()
                if (res.data.reward) setShowSharePrompt(true)
              } else {
                alert(res.data.error || '리뷰 작성 실패')
              }
            } catch (err: unknown) {
              const err_ = err as { message?: string };
              const msg = err instanceof Error ? err.message : '리뷰 작성에 실패했습니다'
              alert(msg)
            } finally { setSubmitting(false) }
          }}
          className="flex-[2] py-2 bg-blue-600 text-white text-sm rounded-lg font-bold disabled:opacity-40"
        >
          {submitting ? '등록 중...' : '리뷰 등록'}
        </button>
      </div>
      {showSharePrompt && (
        <SharePrompt
          title="리뷰가 등록되었습니다! 🎁"
          message="딜 포인트가 지급되었어요. 이 상품을 친구에게 추천해보세요!"
          shareTitle="이 상품 추천해요!"
          shareDescription="유어딜에서 좋은 상품을 발견했어요"
          shareLink={`/products/${productId}`}
          shareButtonText="상품 보러가기"
          onClose={() => setShowSharePrompt(false)}
        />
      )}
    </div>
  )
}

function GroupBuyCountdown({ deadline }: { deadline: string }) {
  const [remaining, setRemaining] = useState('')
  useEffect(() => {
    const update = () => {
      const diff = new Date(deadline).getTime() - Date.now()
      if (diff <= 0) { setRemaining('마감됨'); return }
      const d = Math.floor(diff / 86400000)
      const h = Math.floor((diff % 86400000) / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      setRemaining(d > 0 ? `${d}일 ${h}시간 남음` : `${h}시간 ${m}분 남음`)
    }
    update()
    const interval = setInterval(update, 60000)
    return () => clearInterval(interval)
  }, [deadline])
  return <p className="text-[11px] text-red-400 font-medium mt-1.5">⏰ {remaining}</p>
}

function AccordionSection({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <>
      <div className="border-t border-gray-200">
        <button
          onClick={() => setOpen(!open)}
          className="w-full flex items-center justify-between px-5 py-4 text-left"
        >
          <span className="text-sm font-semibold text-gray-900">{title}</span>
          <svg className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        {open && <div className="px-5 pb-5">{children}</div>}
      </div>
    </>
  )
}

function ProductReviews({ productId }: { productId: number | string }) {
  interface ReviewSummary {
    avg_rating: number
    total_count: number
    star_1?: number
    star_2?: number
    star_3?: number
    star_4?: number
    star_5?: number
    [key: string]: number | undefined
  }

  interface Review {
    id: number | string
    rating: number
    content?: string
    user_name?: string
    created_at: string
  }

  const [summary, setSummary] = useState<ReviewSummary | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])

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
      <h2 className="text-sm font-bold text-gray-900 mb-4">
        리뷰 {totalCount > 0 && <span className="text-gray-500 font-normal">({totalCount})</span>}
      </h2>

      {/* 평점 요약 */}
      {totalCount > 0 ? (
        <div className="flex items-center gap-4 mb-4">
          <div className="text-center">
            <p className="text-3xl font-bold text-gray-900">{avgRating}</p>
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
                  <span className="text-[10px] text-gray-500 w-3">{s}</span>
                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-yellow-400 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <p className="text-xs text-gray-500 py-6 text-center">아직 리뷰가 없습니다.</p>
      )}

      {/* 리뷰 작성 */}
      <ReviewForm productId={productId} onSubmitted={() => {
        api.get(`/api/reviews/product/${productId}?limit=5`).then(r => { if (r.data.success) setReviews(r.data.data.reviews) })
        api.get(`/api/reviews/product/${productId}/summary`).then(r => { if (r.data.success) setSummary(r.data.data) })
      }} />

      {/* 리뷰 목록 */}
      {reviews.length > 0 && (
        <div className="space-y-3 mt-3">
          {reviews.map((r) => (
            <div key={r.id} className="border border-gray-200/50 rounded-xl p-3">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <div className="flex gap-0.5">
                    {[1, 2, 3, 4, 5].map(s => (
                      <span key={s} className={`text-xs ${s <= r.rating ? 'text-yellow-400' : 'text-gray-200'}`}>★</span>
                    ))}
                  </div>
                  <span className="text-[10px] text-gray-500">{r.user_name}</span>
                </div>
                <span className="text-[10px] text-gray-500">{new Date(r.created_at).toLocaleDateString('ko-KR')}</span>
              </div>
              {r.content && <p className="text-xs text-gray-900 leading-relaxed">{r.content}</p>}
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
  const [searchParams] = useSearchParams()

  // 추천 링크 ref 파라미터 저장 (24시간 유효)
  useEffect(() => {
    const ref = searchParams.get('ref')
    if (ref) {
      localStorage.setItem('affiliate_ref', ref)
      localStorage.setItem('affiliate_ref_expires', String(Date.now() + 24 * 60 * 60 * 1000))
      // 쿠키로도 저장 (다른 탭/세션에서도 유지)
      document.cookie = `affiliate_ref=${ref}; path=/; max-age=86400; SameSite=Lax`
    }
  }, [searchParams])
  
  // ✅ Region 기반 Store 선택
  const krUser = useAuthKR(state => state.user)
  const worldUser = useAuthWorld(state => state.user)
  
  // ✅ Selector로 필요한 상태만 구독
  const user = isKorea() ? krUser : worldUser
  const isLoggedIn = !!user || (localStorage.getItem('user_type') === 'user' && !!localStorage.getItem('user_id'))
  
  // 🔥 React Query로 데이터 fetching (자동 캐싱 + 재시도)
  const { data: product, isLoading, error } = useProduct(id)
  const { data: options = [] } = useProductOptions(id)
  
  const [selectedOptions, setSelectedOptions] = useState<{ [key: string]: number }>({})
  const [quantity, setQuantity] = useState(1)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [isWishlisted, setIsWishlisted] = useState(false)
  const [wishlistLoading, setWishlistLoading] = useState(false)
  const [reviewSummary, setReviewSummary] = useState<{ avg_rating: number; total_count: number } | null>(null)

  useEffect(() => {
    window.scrollTo(0, 0)
    if (id) {
      api.get(`/api/reviews/product/${id}/summary`).then(r => {
        if (r.data.success) setReviewSummary(r.data.data)
      }).catch(() => {})
    }
  }, [id])

  // 최근 본 상품 저장
  useEffect(() => {
    if (!product) return
    try {
      const raw = JSON.parse(localStorage.getItem('recently_viewed') || '[]')
      const filtered = raw.filter((p: { id: string | number }) => p.id !== product.id)
      filtered.unshift({ id: product.id, name: product.name, price: product.price, image: product.image_url })
      localStorage.setItem('recently_viewed', JSON.stringify(filtered.slice(0, 20)))
    } catch {}
  }, [product])

  useEffect(() => {
    if (product) {
      document.title = product.name + ' - 유어딜'
    }
  }, [product])

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
        const found = r.data.data.items.some((item: { product_id: string | number }) => String(item.product_id) === String(id))
        setIsWishlisted(found)
      }
    }).catch(() => {})
  }, [id, isLoggedIn])

  async function handleToggleWishlist() {
    if (!isLoggedIn) {
      showToast('로그인이 필요합니다.', 'error')
      localStorage.setItem('loginReturnUrl', window.location.pathname)
      navigate('/login')
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
    if (!isLoggedIn) {
      showToast('로그인이 필요합니다.', 'error')
      localStorage.setItem('loginReturnUrl', window.location.pathname)
      navigate('/login')
      return
    }

    try {
      await api.post('/api/cart', {
        product_id: product!.id,
        quantity,
        price_snapshot: product!.price,
        options: Object.values(selectedOptions)[0] ? JSON.stringify(selectedOptions) : null
      })
      showToast('장바구니에 추가되었습니다.', 'success')
      localStorage.setItem('hasCartItems', 'true')
      try {
        const g = (window as any).gtag
        if (typeof g === 'function') g('event', 'add_to_cart', { currency: 'KRW', value: product!.price, items: [{ item_id: product!.id, item_name: product!.name }] })
      } catch {}
      
      // ✅ 장바구니 페이지로 이동
      navigate('/cart')
    } catch (err: unknown) {
      const err_ = err as { message?: string };
      if (import.meta.env.DEV) {
        console.error('[ProductDetail] ❌ 장바구니 추가 실패:', err)
      }
      const errorMessage = err instanceof Error ? err.message : '장바구니 추가에 실패했습니다.'
      showToast(errorMessage, 'error')
    }
  }

  async function handleBuyNow() {
    if (!isLoggedIn) {
      showToast('로그인이 필요합니다.', 'error')
      localStorage.setItem('loginReturnUrl', window.location.pathname)
      navigate('/login')
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
          seller_id: product.seller_id ?? null,
          seller_name: product.seller_name ?? null,
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
      <div className="flex min-h-screen items-center justify-center bg-white p-4">
        <div className="text-center">
          <p className="text-sm text-gray-500">{error?.message || '상품을 찾을 수 없습니다.'}</p>
          <button onClick={() => window.location.reload()} className="mt-3 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg">다시 시도</button>
          <button
            onClick={() => navigate('/')}
            className="mt-4 ml-2 px-6 py-2 bg-foreground text-background rounded-lg text-sm font-semibold"
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
    <div className="min-h-screen bg-white">
      <SEO
        title={product.name}
        description={product.description?.slice(0, 160) || `${product.name} - 유어딜에서 최저가로 구매하세요`}
        image={product.image_url}
        url={`/products/${product.id}`}
        type="product"
        jsonLd={productJsonLd({
          name: product.name,
          price: product.price,
          image: product.image_url,
          description: product.description,
          url: `/products/${product.id}`,
          seller: product.seller_name,
          originalPrice: product.original_price,
          stock: product.stock,
          sku: product.id,
          rating: reviewSummary?.avg_rating,
          reviewCount: reviewSummary?.total_count,
        })}
      />
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

        {/* Product Info */}
        <ProductHeader
          name={product.name}
          price={displayPrice}
          originalPrice={product.original_price || undefined}
          discountRate={product.discount_rate || undefined}
          sellerName={product.seller_name}
          sellerId={product.seller_id}
          soldCount={product.sold_count}
          reviewCount={reviewSummary?.total_count}
          avgRating={reviewSummary?.avg_rating}
        />

        {/* v4: description은 상세정보 섹션에서 통합 표시 */}

        {/* v4 상세 정보 (이미지 + 설명 + 펼쳐보기) */}
        <div style={{ height: 8, background: '#F9FAFB' }} />
        <section className="px-5 py-5">
          <p className="text-[13px] font-bold text-gray-900 mb-3">상세 정보</p>
          {detailImages.length > 0 && (
            <div className="rounded-xl overflow-hidden mb-3" style={{ background: '#F9FAFB' }}>
              <img src={detailImages[0]} alt="" className="w-full" style={{ aspectRatio: '4/5', objectFit: 'cover' }} />
            </div>
          )}
          {product.long_description && (
            <p className="text-[12px] text-gray-700 leading-relaxed">{product.long_description.slice(0, 200)}</p>
          )}
          {(detailImages.length > 1 || (product.long_description && product.long_description.length > 200)) && (
            <button className="w-full mt-4 py-3 rounded-xl border border-gray-200 bg-white text-[12px] font-semibold text-gray-700 active:bg-gray-50">
              상세정보 펼쳐보기
            </button>
          )}
        </section>

        {/* v4 공동구매 배너 (다크 카드) */}
        {product.category === 'meal_voucher' && (product.group_buy_target ?? 0) > 0 && (
          <div className="px-5 py-5">
            <div className="rounded-2xl p-4 bg-gray-900 text-white">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 bg-red-500 text-[9px] font-extrabold tracking-wide mb-2">공동구매 참여하기</span>
                  <p className="text-[15px] font-bold">추가 15% 할인</p>
                </div>
                <ChevronRight className="w-4 h-4 text-white/60" />
              </div>
              <div className="flex items-center justify-between mb-1 text-[11px] text-white/70">
                <span>{product.group_buy_current || 0}명 참여 · {product.group_buy_target}명 목표</span>
                {product.group_buy_deadline && <GroupBuyCountdown deadline={product.group_buy_deadline} />}
              </div>
              <div className="w-full rounded-full overflow-hidden h-1 bg-white/15">
                <div className="h-full rounded-full bg-gradient-to-r from-red-500 to-pink-500 transition-all duration-500"
                  style={{ width: `${Math.min(100, ((product.group_buy_current || 0) / product.group_buy_target!) * 100)}%` }} />
              </div>
            </div>
          </div>
        )}

        {/* 식당 정보 (식사권일 때만) */}
        {product.category === 'meal_voucher' && product.restaurant_name && (
          <AccordionSection title="식당 정보" defaultOpen={true}>
            <div className="space-y-2.5 text-xs text-gray-500">
              <div className="flex"><span className="w-16 shrink-0 text-gray-400">식당명</span><span className="text-gray-900 font-medium">{product.restaurant_name}</span></div>
              {product.restaurant_address && (
                <div className="flex"><span className="w-16 shrink-0 text-gray-400">주소</span><span>{product.restaurant_address}</span></div>
              )}
              {product.restaurant_phone && (
                <div className="flex"><span className="w-16 shrink-0 text-gray-400">전화</span><span>{product.restaurant_phone}</span></div>
              )}
              {product.voucher_terms && (
                <div className="flex"><span className="w-16 shrink-0 text-gray-400">이용조건</span><span>{product.voucher_terms}</span></div>
              )}
              {product.voucher_expiry && (
                <div className="flex"><span className="w-16 shrink-0 text-gray-400">유효기간</span><span>{new Date(product.voucher_expiry).toLocaleDateString('ko-KR')}까지</span></div>
              )}
            </div>
          </AccordionSection>
        )}

        {/* v4 옵션 선택 */}
        <div style={{ height: 8, background: '#F9FAFB' }} />
        <section className="px-5 py-5">
          <p className="text-[13px] font-bold text-gray-900 mb-3">옵션 선택</p>
          {options.length > 0 ? (
            <div className="space-y-2">
              {options.map((opt: ProductOption) => (
                <button key={opt.id} onClick={() => setSelectedOptions({ option: Number(opt.id) })}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${
                    selectedOptions.option === opt.id ? 'border-gray-900 bg-gray-50' : 'border-gray-200'
                  }`}>
                  <span className="text-[12px] text-gray-900">{opt.option_value}</span>
                  {opt.price_adjustment !== 0 && (
                    <span className="text-[11px] text-red-500 font-bold">
                      {(opt.price_adjustment || 0) > 0 ? '+' : ''}{(opt.price_adjustment || 0).toLocaleString()}원
                    </span>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <button className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-gray-200">
              <span className="text-[12px] text-gray-500">옵션을 선택해주세요</span>
              <svg className="w-3.5 h-3.5 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9" /></svg>
            </button>
          )}
          <div className="flex items-center gap-2 mt-3">
            <span className="text-[11px] text-gray-400">포인트 적립</span>
            <span className="text-[11px] font-bold text-pink-500">최대 {Math.round(displayPrice * 0.03).toLocaleString()}딜</span>
          </div>
        </section>
        <div style={{ height: 8, background: '#F9FAFB' }} />

        {/* 공유 + 추천 링크 */}
        <div className="px-5 py-3 space-y-2">
          {isLoggedIn && (
            <button
              onClick={() => {
                const userId = getUserId()
                const url = `https://live.ur-team.com/products/${product.id}?ref=${userId}`
                navigator.clipboard.writeText(url)
                showToast('추천 링크가 복사되었습니다!', 'success')
              }}
              className="w-full py-3 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 active:scale-[0.98]"
            >
              🔗 추천 링크 복사 (판매 당 2% 무한 적립)
            </button>
          )}
          <KakaoShareButton
            title={product.name}
            description={`${displayPrice.toLocaleString()}원 ${product.original_price && product.original_price > product.price ? `(${Math.round((1 - product.price / product.original_price) * 100)}% 할인)` : ''}`}
            imageUrl={product.image_url || undefined}
            link={`/products/${product.id}`}
            buttonText="상품 보러가기"
          />
        </div>

        {/* v4 배송 정보 카드 */}
        <div className="px-5 py-3">
          <div className="flex items-center gap-2 py-3 px-3 rounded-xl bg-gray-50">
            <svg className="w-3.5 h-3.5 text-blue-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
            <span className="text-[12px] font-semibold text-gray-900">내일 도착 예정</span>
            <span className="text-[11px] text-gray-500">· 5만원 이상 무료</span>
          </div>
        </div>

        {/* 친구 초대 공동구매 */}
        <ReferralSection
          productId={product.id}
          productTiers={product.group_buy_tiers}
          isLoggedIn={isLoggedIn}
          showToast={showToast}
        />

        {/* v4: 안내정보는 하단 아코디언으로 이동 */}

        {/* v4 리뷰 섹션 (독립) */}
        <div style={{ height: 8, background: '#F9FAFB' }} />
        <section className="px-5 py-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[13px] font-bold text-gray-900">
              리뷰 <span className="text-gray-400 font-normal">({(reviewSummary?.total_count || 0).toLocaleString()})</span>
            </p>
            <button className="flex items-center gap-0.5 text-[11px] text-gray-400">
              전체보기 <ChevronRight className="w-2.5 h-2.5" />
            </button>
          </div>
          <ProductReviews productId={product.id} />
        </section>

        {/* v4 아코디언 — 3개 표준 섹션 */}
        <div className="border-t border-gray-100">
          <AccordionSection title="상품 정보 고시">
            <ProductInfoGrid items={[
              { label: '재고', value: `${product.stock ?? 0}개` },
              ...(product.sold_count ? [{ label: '판매량', value: `${product.sold_count}개` }] : []),
              ...(product.category ? [{ label: '카테고리', value: product.category }] : []),
            ]} />
          </AccordionSection>
          <AccordionSection title="배송 · 교환 · 반품 안내">
            <ReturnPolicySection />
          </AccordionSection>
          <AccordionSection title="유의사항">
            <ProductNoticeSection />
          </AccordionSection>
        </div>

        {/* v4: 배송 안내는 하단 아코디언 "배송·교환·반품"에 통합됨 */}
      </main>

      {/* Floating Cart / Purchase Bar */}
      <Suspense fallback={<div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] h-16 bg-gray-100 animate-pulse" />}>
        <FloatingActionBar
          onAddToCart={handleAddToCart}
          onBuyNow={handleBuyNow}
          disabled={product.stock === 0 && product.stock_quantity === 0}
          isWishlisted={isWishlisted}
          onToggleWishlist={handleToggleWishlist}
          price={product.price}
          originalPrice={product.original_price}
        />
      </Suspense>

      {/* Toast Notification */}
      {toast && (
        <div 
          className={`fixed top-20 left-1/2 -translate-x-1/2 z-[60] px-4 py-2.5 rounded-lg shadow-lg max-w-sm transition-all ${
            toast.type === 'success' 
              ? 'bg-foreground text-background' 
              : 'bg-destructive text-gray-900'
          }`}
        >
          <p className="text-sm font-medium text-center">{toast.message}</p>
        </div>
      )}
    </div>
  )
}

interface GroupTier {
  count: number
  discount: number
}

interface ActiveGroup {
  id?: number | string
  invite_code: string
  creator_name: string
  current_count: number
  target_count: number
  tiers?: GroupTier[]
  expires_at?: string
  unlocked_tier?: GroupTier | null
}

const DEFAULT_TIERS: GroupTier[] = [
  { count: 2, discount: 10 },
  { count: 5, discount: 20 },
  { count: 10, discount: 30 },
]

function parseTiers(raw: unknown): GroupTier[] {
  if (!raw) return DEFAULT_TIERS
  try {
    const arr = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (Array.isArray(arr) && arr.length > 0) {
      return arr
        .filter((t: unknown): t is GroupTier => {
          const item = t as Record<string, unknown>
          return typeof item?.count === 'number' && typeof item?.discount === 'number'
        })
        .sort((a: GroupTier, b: GroupTier) => a.count - b.count)
    }
  } catch {
    // fall through
  }
  return DEFAULT_TIERS
}

function formatTimeRemaining(expiresAt?: string): string {
  if (!expiresAt) return ''
  const diff = new Date(expiresAt).getTime() - Date.now()
  if (diff <= 0) return '마감됨'
  const d = Math.floor(diff / 86400000)
  const h = Math.floor((diff % 86400000) / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  if (d > 0) return `${d}일 ${h}시간 남음`
  if (h > 0) return `${h}시간 ${m}분 남음`
  return `${m}분 남음`
}

function ReferralSection({
  productId,
  productTiers,
  isLoggedIn,
  showToast,
}: {
  productId: number | string
  productTiers?: unknown
  isLoggedIn: boolean
  showToast: (message: string, type?: 'success' | 'error') => void
}) {
  const navigate = useNavigate()
  const [groups, setGroups] = useState<ActiveGroup[]>([])
  const [loadingGroups, setLoadingGroups] = useState(true)
  const [creating, setCreating] = useState(false)

  const tiers = parseTiers(productTiers)

  useEffect(() => {
    let cancelled = false
    setLoadingGroups(true)
    api.get(`/api/referral/product/${productId}`)
      .then(r => {
        if (cancelled) return
        if (r.data.success) setGroups((r.data.data || []) as ActiveGroup[])
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingGroups(false) })
    return () => { cancelled = true }
  }, [productId])

  const handleCreate = async () => {
    if (!isLoggedIn) {
      showToast('로그인 후 시작할 수 있습니다.', 'error')
      localStorage.setItem('loginReturnUrl', window.location.pathname)
      navigate('/login')
      return
    }
    setCreating(true)
    try {
      const maxTier = tiers[tiers.length - 1]
      const res = await api.post('/api/referral/create', {
        product_id: Number(productId),
        target_count: maxTier.count,
        discount_percent: maxTier.discount,
        tiers,
      })
      if (res.data.success) {
        navigate(`/referral/${res.data.data.invite_code}`)
      } else {
        showToast(res.data.error || '공동구매 생성에 실패했습니다.', 'error')
      }
    } catch (err: unknown) {
      const err_ = err as { message?: string };
      const msg = err instanceof Error ? err.message : '공동구매 생성에 실패했습니다.'
      showToast(msg, 'error')
    } finally {
      setCreating(false)
    }
  }

  const tierPreview = tiers.map(t => `${t.count}명: ${t.discount}%할인`).join(' → ')

  return (
    <div className="mx-4 mb-3 bg-white rounded-xl border border-gray-200 p-4">
      {/* 헤더 */}
      <div className="flex items-center gap-2 mb-1.5">
        <Gift className="w-4 h-4 text-gray-900" />
        <h3 className="text-sm font-bold text-gray-900">공동구매로 더 싸게</h3>
      </div>
      <p className="text-xs text-gray-600 leading-relaxed mb-3">
        친구를 초대할수록 더 큰 할인! 모집 인원에 따라 단계별 할인이 적용됩니다.
      </p>

      {/* 티어 미리보기 */}
      <div className="mb-3 rounded-lg bg-gray-50 border border-gray-100 px-3 py-2.5">
        <p className="text-[11px] text-gray-500 mb-1">할인 단계</p>
        <p className="text-xs font-semibold text-gray-900 leading-snug break-keep">
          {tierPreview}
        </p>
      </div>

      {/* 시작 버튼 */}
      <button
        onClick={handleCreate}
        disabled={creating}
        className="w-full py-3 bg-gray-900 text-white text-sm font-bold rounded-xl active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-1.5"
      >
        <Users className="w-4 h-4" />
        {creating ? '생성 중...' : '공동구매 시작하기'}
      </button>

      {/* 진행 중인 그룹 */}
      {loadingGroups ? (
        <div className="mt-3 space-y-2">
          <div className="h-14 rounded-lg bg-gray-50 animate-pulse" />
        </div>
      ) : groups.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold text-gray-900 mb-2">진행 중인 공동구매</p>
          <div className="space-y-2">
            {groups.map((g) => {
              const progress = g.target_count > 0 ? (g.current_count / g.target_count) * 100 : 0
              const unlockedDiscount = g.unlocked_tier?.discount ?? 0
              const timeLeft = formatTimeRemaining(g.expires_at)
              return (
                <button
                  key={g.invite_code}
                  onClick={() => navigate(`/referral/${g.invite_code}`)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-200 bg-white text-left hover:bg-gray-50 active:scale-[0.99] transition"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      <p className="text-xs font-semibold text-gray-900 truncate">
                        {g.creator_name}님의 공동구매
                      </p>
                      {unlockedDiscount > 0 && (
                        <span className="text-[10px] font-bold text-gray-900 bg-gray-100 px-1.5 py-0.5 rounded">
                          {unlockedDiscount}% 할인 중
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mb-1.5 text-[11px] text-gray-500">
                      <Users className="w-3 h-3" />
                      <span>{g.current_count}/{g.target_count}명</span>
                      {timeLeft && (
                        <>
                          <span className="text-gray-300">·</span>
                          <Clock className="w-3 h-3" />
                          <span>{timeLeft}</span>
                        </>
                      )}
                    </div>
                    <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gray-900 rounded-full transition-all"
                        style={{ width: `${Math.min(100, progress)}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex flex-col items-center gap-0.5 shrink-0">
                    <span className="text-[11px] font-bold text-gray-900">참여</span>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
