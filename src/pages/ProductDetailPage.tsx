import { useEffect, useState, lazy, Suspense } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import api from '@/lib/api'
import { getUserId } from '@/utils/auth'
// ✅ Zustand 직접 사용
import { useAuthKR } from '@/shared/stores/useAuthKR'
import { useAuthWorld } from '@/shared/stores/useAuthWorld'
import { isKorea } from '@/config/region'
// ✅ React Query Hook (Product, ProductOption 타입도 여기서 가져옴)
import { useProduct, useProductOptions } from '@/hooks/useProduct'
import type { ProductOption } from '@/hooks/useProduct'

// Import KREAM-style components
import { MobileHeader } from '@/components/product/mobile-header'
import { ProductHeader } from '@/components/product/product-header'
import SEO, { productJsonLd } from '@/components/SEO'
import KakaoShareButton from '@/components/KakaoShareButton'
import { ProductInfoGrid } from '@/components/product/ProductInfoGrid'
import { ProductNoticeSection } from '@/components/product/ProductNoticeSection'
import { ReturnPolicySection } from '@/components/product/ReturnPolicySection'
import { ProductDetailSkeleton } from '@/components/ui/skeleton'

// Sub-components extracted from this file
import { GroupBuyCountdown } from '@/components/product/GroupBuyCountdown'
import { AccordionSection } from '@/components/product/AccordionSection'
import { ProductReviews } from '@/components/product/ProductReviews'
import { ReferralSection } from '@/components/product/ReferralSection'

// Lazy load heavy components
const ProductImageCarousel = lazy(() => import('@/components/product/product-image-carousel').then(m => ({ default: m.ProductImageCarousel })))
const FloatingActionBar = lazy(() => import('@/components/product/floating-action-bar').then(m => ({ default: m.FloatingActionBar })))

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
      }).catch((_e) => { if (import.meta.env.DEV) console.warn(_e) })
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
        if (import.meta.env.DEV) console.error('Failed to parse referrer URL:', e)
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
    }).catch((_e) => { if (import.meta.env.DEV) console.warn(_e) })
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
      showToast('장바구니에 추가되었습니다. 상단의 장바구니에서 확인하세요.', 'success')
      try {
        const g = (window as any).gtag
        if (typeof g === 'function') g('event', 'add_to_cart', { currency: 'KRW', value: product!.price, items: [{ item_id: product!.id, item_name: product!.name }] })
      } catch {}
      // ✅ UX H10 FIX: 자동 이동 제거 — 사용자가 계속 쇼핑할 수 있도록 상세 페이지 유지.
      // ✅ UX H14 FIX: localStorage hasCartItems 더티 스토어 제거 (React Query 캐시에 의존).
    } catch (err: unknown) {
      const err_ = err as { message?: string };
      if (import.meta.env.DEV) {
        if (import.meta.env.DEV) console.error('[ProductDetail] ❌ 장바구니 추가 실패:', err)
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
      if (import.meta.env.DEV) console.error('Failed to parse detail images:', e)
      detailImages = []
    }
  }

  // All product images for carousel (main image + detail images)
  const allImages = [product.image_url, ...detailImages].filter(Boolean)

  return (
    <div className="min-h-screen bg-white">
      <SEO
        title={product.name}
        description={product.description?.slice(0, 160) || `${product.name} - 유어딜에서 만나보세요`}
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
              <img src={detailImages[0]} alt={product.name || '상품 상세 이미지'} loading="lazy" className="w-full" style={{ aspectRatio: '4/5', objectFit: 'cover' }} />
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
                <div className="flex items-center">
                  <span className="w-16 shrink-0 text-gray-400">전화</span>
                  <a href={`tel:${product.restaurant_phone}`} className="text-blue-600 font-medium underline">
                    {product.restaurant_phone}
                  </a>
                </div>
              )}
              {product.voucher_terms && (
                <div className="flex"><span className="w-16 shrink-0 text-gray-400">이용조건</span><span>{product.voucher_terms}</span></div>
              )}
              {product.voucher_expiry && (
                <div className="flex"><span className="w-16 shrink-0 text-gray-400">유효기간</span><span>{new Date(product.voucher_expiry).toLocaleDateString('ko-KR')}까지</span></div>
              )}

              {/* 지도 + 외부 연결 버튼 */}
              {product.restaurant_address && (
                <div className="grid grid-cols-3 gap-2 pt-2">
                  <button type="button"
                    onClick={() => navigate(`/restaurant-map?q=${encodeURIComponent(product.restaurant_address || '')}`)}
                    className="py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg flex items-center justify-center gap-1">
                    🗺 지도
                  </button>
                  <a href={`https://map.naver.com/v5/search/${encodeURIComponent(product.restaurant_name || product.restaurant_address)}`}
                    target="_blank" rel="noopener noreferrer"
                    className="py-2 bg-green-50 hover:bg-green-100 text-green-700 text-xs font-semibold rounded-lg flex items-center justify-center gap-1">
                    네이버
                  </a>
                  <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((product.restaurant_name || '') + ' ' + (product.restaurant_address || ''))}`}
                    target="_blank" rel="noopener noreferrer"
                    className="py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-lg flex items-center justify-center gap-1">
                    Google
                  </a>
                </div>
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
          {/* 🛡️ 2026-04-22 배치 113: VAT 포함 표시 (한국 부가세 포함 공시) */}
          <div className="mt-1 text-[10.5px] text-gray-400">부가세 포함 (VAT 10%)</div>
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
