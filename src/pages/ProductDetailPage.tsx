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
import SEO, { productJsonLd } from '@/components/SEO'
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
      <p className="text-xs text-pink-500 mb-3 font-medium">🎁 텍스트 50딜 · 사진 100딜 · 영상 200딜 리워드 지급!</p>
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
        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:border-blue-400"
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
                if (res.data.reward) alert('리뷰가 등록되었습니다! 🎁 딜 포인트가 지급되었습니다.')
              } else {
                alert(res.data.error || '리뷰 작성 실패')
              }
            } catch (err: any) {
              alert(err?.response?.data?.error || '리뷰 작성에 실패했습니다')
            } finally { setSubmitting(false) }
          }}
          className="flex-[2] py-2 bg-blue-600 text-white text-sm rounded-lg font-bold disabled:opacity-40"
        >
          {submitting ? '등록 중...' : '리뷰 등록'}
        </button>
      </div>
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
          {reviews.map((r: any) => (
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
    if (!isLoggedIn) {
      showToast('로그인이 필요합니다.', 'error')
      localStorage.setItem('loginReturnUrl', window.location.pathname)
      setTimeout(() => navigate('/login'), 1000)
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
          seller: (product as any).seller_name,
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

        <Separator />

        {/* Product Info */}
        <ProductHeader
          name={product.name}
          price={displayPrice}
          originalPrice={product.original_price || undefined}
          discountRate={product.discount_rate || undefined}
        />

        {/* Product Description */}
        {product.description && (
          <div className="px-5 py-3">
            <p className="text-[13px] text-gray-400 leading-relaxed whitespace-pre-wrap">
              {product.description}
            </p>
          </div>
        )}

        {/* Product Details - Vertical Images */}
        {detailImages.length > 0 && (
          <>
            <Separator />
            <div className="px-0">
              <h2 className="text-sm font-bold text-gray-900 px-5 py-4">상세 이미지</h2>
              <div className="flex flex-col">
                {detailImages.map((src, idx) => (
                  <img
                    key={idx}
                    src={src}
                    alt={`Product detail ${idx + 1}`}
                    className="w-full h-auto block"
                    loading={idx === 0 ? 'eager' : 'lazy'}
                  />
                ))}
              </div>
            </div>
          </>
        )}

        {/* 공동구매 진행률 (식사권일 때만) */}
        {product.category === 'meal_voucher' && (product.group_buy_target ?? 0) > 0 && (
          <div className="px-5 py-4 bg-white border-b border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-bold text-gray-900">공동구매 진행 중</span>
              <span className="text-xs text-pink-400 font-bold">
                {product.group_buy_current || 0}/{product.group_buy_target}명
              </span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-pink-500 to-red-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, ((product.group_buy_current || 0) / product.group_buy_target!) * 100)}%` }}
              />
            </div>
            {product.group_buy_deadline && (
              <GroupBuyCountdown deadline={product.group_buy_deadline} />
            )}
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

        {/* 상품 정보 — 아코디언 */}
        <AccordionSection title="상품 정보">
          <ProductInfoGrid items={[
            { label: '재고', value: `${product.stock ?? product.stock_quantity ?? 0}개` },
            ...(product.sold_count !== undefined && product.sold_count > 0 ? [{ label: '판매량', value: `${product.sold_count}개` }] : []),
            ...(product.category ? [{ label: '카테고리', value: product.category }] : []),
          ]} />
        </AccordionSection>

        {/* 안내 정보 */}
        <AccordionSection title="안내 정보">
          <ProductNoticeSection />
        </AccordionSection>

        {/* 친구 초대 공동구매 */}
        <ReferralSection productId={product.id} />

        {/* 상품 리뷰 */}
        <AccordionSection title={`리뷰`} defaultOpen={true}>
          <ProductReviews productId={product.id} />
        </AccordionSection>

        {/* 교환 및 반품 */}
        <AccordionSection title="교환 및 반품 안내">
          <ReturnPolicySection />
        </AccordionSection>

        {/* 배송안내 */}
        <AccordionSection title="배송 안내">
          <div className="space-y-2.5 text-xs text-gray-500">
            <div className="flex"><span className="w-16 shrink-0 text-gray-400">배송업체</span><span>택배사 (추후 안내)</span></div>
            <div className="flex"><span className="w-16 shrink-0 text-gray-400">배송지역</span><span>대한민국 전 지역</span></div>
            <div className="flex"><span className="w-16 shrink-0 text-gray-400">배송비용</span><span>3,000원 / 50,000원 이상 무료</span></div>
            <div className="flex"><span className="w-16 shrink-0 text-gray-400">배송기간</span><span>주말·공휴일 제외 2-5일</span></div>
          </div>
        </AccordionSection>
      </main>

      {/* Floating Cart / Purchase Bar */}
      <Suspense fallback={<div className="fixed bottom-0 left-0 right-0 h-16 bg-gray-100 animate-pulse" />}>
        <FloatingActionBar
          onAddToCart={handleAddToCart}
          onBuyNow={handleBuyNow}
          disabled={product.stock === 0 && product.stock_quantity === 0}
          isWishlisted={isWishlisted}
          onToggleWishlist={handleToggleWishlist}
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

function ReferralSection({ productId }: { productId: number | string }) {
  const navigate = useNavigate()
  const [groups, setGroups] = useState<any[]>([])
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    api.get(`/api/referral/product/${productId}`)
      .then(r => { if (r.data.success) setGroups(r.data.data || []) })
      .catch(() => {})
  }, [productId])

  const handleCreate = async () => {
    setCreating(true)
    try {
      const res = await api.post('/api/referral/create', { product_id: Number(productId), target_count: 3, discount_percent: 10 })
      if (res.data.success) {
        navigate(`/referral/${res.data.data.invite_code}`)
      } else {
        alert(res.data.error || '그룹 생성 실패')
      }
    } catch (err: any) {
      alert(err?.response?.data?.error || '로그인이 필요합니다')
    } finally { setCreating(false) }
  }

  return (
    <div className="bg-gradient-to-r from-pink-50 to-red-50 rounded-2xl p-4 mx-4 mb-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">👫</span>
        <h3 className="text-sm font-bold text-gray-900">친구 초대 공동구매</h3>
        <span className="text-xs bg-red-100 text-red-600 font-bold px-1.5 py-0.5 rounded">10% 할인</span>
      </div>
      <p className="text-xs text-gray-500 mb-3">3명이 모이면 10% 추가 할인! 카카오로 친구를 초대하세요.</p>

      {groups.length > 0 && (
        <div className="space-y-2 mb-3">
          {groups.slice(0, 2).map((g: any) => (
            <button
              key={g.id}
              onClick={() => navigate(`/referral/${g.invite_code}`)}
              className="w-full flex items-center justify-between p-2.5 bg-white rounded-xl text-left"
            >
              <div>
                <p className="text-xs font-medium text-gray-900">{g.creator_name}님의 그룹</p>
                <p className="text-[10px] text-gray-400">{g.current_count}/{g.target_count}명 참여</p>
              </div>
              <div className="h-1.5 w-16 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-pink-500 rounded-full" style={{ width: `${(g.current_count / g.target_count) * 100}%` }} />
              </div>
            </button>
          ))}
        </div>
      )}

      <button
        onClick={handleCreate}
        disabled={creating}
        className="w-full py-2.5 bg-gradient-to-r from-pink-500 to-red-500 text-white text-sm font-bold rounded-xl active:scale-[0.98] disabled:opacity-50"
      >
        {creating ? '생성 중...' : '공동구매 그룹 만들기'}
      </button>
    </div>
  )
}
