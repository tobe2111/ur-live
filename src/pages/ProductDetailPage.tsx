import { useEffect, useState, lazy, Suspense } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Gift, ChevronRight, ChevronLeft } from 'lucide-react'
import api from '@/lib/api'
import { getUserId } from '@/utils/auth'
import { VOUCHER_CATEGORY_SET } from '@/shared/constants/voucher-categories'
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
import { formatNumber } from '@/utils/format'
import AccordionSection from './product-detail/AccordionSection'
import GroupBuyCountdown from './product-detail/GroupBuyCountdown'
import ProductReviews from './product-detail/ProductReviews'
import ReferralSection from './product-detail/ReferralSection'

// 🛡️ 2026-05-02: TD-018 분할 — ReviewForm/ProductReviews/ReferralSection/AccordionSection/
//   GroupBuyCountdown 을 ./product-detail/ 로 추출. 미사용 imports (Separator, ProgressiveImage,
//   SharePrompt, toast, Users, Clock, Product type, lucide 일부) 제거.

// Lazy load heavy components
const ProductImageCarousel = lazy(() => import('@/components/product/product-image-carousel').then(m => ({ default: m.ProductImageCarousel })))
const FloatingActionBar = lazy(() => import('@/components/product/floating-action-bar').then(m => ({ default: m.FloatingActionBar })))
const GiftSendModal = lazy(() => import('@/components/gift/GiftSendModal'))

export default function ProductDetailPage() {
  const { t } = useTranslation()
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
  const [giftModalOpen, setGiftModalOpen] = useState(false)  // 🛡️ 2026-04-28: 선물하기 모달
  const [wishlistLoading, setWishlistLoading] = useState(false)
  const [reviewSummary, setReviewSummary] = useState<{ avg_rating: number; total_count: number } | null>(null)

  useEffect(() => {
    window.scrollTo(0, 0)
    if (!id) return
    let cancelled = false
    api.get(`/api/reviews/product/${id}/summary`).then(r => {
      if (!cancelled && r.data.success) setReviewSummary(r.data.data)
    }).catch((_e) => { if (import.meta.env.DEV) console.warn(_e) })
    return () => { cancelled = true }
  }, [id])

  // 최근 본 상품 저장
  useEffect(() => {
    if (!product) return
    try {
      const raw = JSON.parse(localStorage.getItem('recently_viewed') || '[]')
      const filtered = raw.filter((p: { id: string | number }) => p.id !== product.id)
      filtered.unshift({ id: product.id, name: product.name, price: product.price, image: product.image_url, deal_only: product.deal_only })
      localStorage.setItem('recently_viewed', JSON.stringify(filtered.slice(0, 20)))
    } catch {}
  }, [product])

  useEffect(() => {
    if (product) {
      document.title = product.name + t('productDetailPage.docTitleSuffix')
    }
  }, [product])

  // 🛡️ 2026-05-15: voucher 카테고리는 전용 detail page 로 자동 redirect (URL 보존, replace history)
  useEffect(() => {
    if (!product) return
    if (VOUCHER_CATEGORY_SET.has(product.category || '')) {
      navigate(`/group-buy/${product.id}`, { replace: true })
    }
  }, [product, navigate])

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
    let cancelled = false
    api.get('/api/wishlists').then(r => {
      if (cancelled) return
      if (r.data.success && r.data.data?.items) {
        const found = r.data.data.items.some((item: { product_id: string | number }) => String(item.product_id) === String(id))
        setIsWishlisted(found)
      }
    }).catch((_e) => { if (import.meta.env.DEV) console.warn(_e) })
    return () => { cancelled = true }
  }, [id, isLoggedIn])

  async function handleToggleWishlist() {
    if (!isLoggedIn) {
      showToast(t('common.loginRequired'), 'error')
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
        showToast(nowWishlisted ? t('productDetailPage.wishlistAdded') : t('productDetailPage.wishlistRemoved'), 'success')
      }
    } catch {
      showToast(t('productDetailPage.wishlistFailed'), 'error')
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
      showToast(t('common.loginRequired'), 'error')
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
      showToast(t('cart.itemAdded'), 'success')
      try {
        if (typeof gtag === 'function') gtag('event', 'add_to_cart', { currency: 'KRW', value: product!.price, items: [{ item_id: product!.id, item_name: product!.name }] })
      } catch { /* gtag 미로드 무시 */ }
      // ✅ UX H10 FIX: 자동 이동 제거 — 사용자가 계속 쇼핑할 수 있도록 상세 페이지 유지.
      // ✅ UX H14 FIX: localStorage hasCartItems 더티 스토어 제거 (React Query 캐시에 의존).
    } catch (err: unknown) {
      const err_ = err as { message?: string };
      if (import.meta.env.DEV) console.error('[ProductDetail] ❌ 장바구니 추가 실패:', err)
      const errorMessage = err instanceof Error ? err.message : t('productDetailPage.addCartFailed')
      showToast(errorMessage, 'error')
    }
  }

  async function handleBuyNow() {
    if (!isLoggedIn) {
      showToast(t('common.loginRequired'), 'error')
      localStorage.setItem('loginReturnUrl', window.location.pathname)
      navigate('/login')
      return
    }

    if (!product) return

    // 🛡️ 2026-05-15: voucher 카테고리는 group-buy /join API 사용 (딜 결제 + 바우처 발급).
    //   배송 X / 옵션 X / 즉시 발급. 일반 checkout 거치면 group_buy_current 가 안 늘어 공구 미작동.
    if (VOUCHER_CATEGORY_SET.has(product.category || '')) {
      const total = product.price * quantity
      const ok = window.confirm(
        t('groupBuy.confirmJoin', {
          defaultValue: `공구 참여\n\n${product.name}\n${quantity}장 × ${product.price.toLocaleString('ko-KR')}원 = ${total.toLocaleString('ko-KR')}딜\n\n딜로 결제됩니다. 진행할까요?`
        })
      )
      if (!ok) return
      try {
        // 🛡️ 2026-05-21 Phase D: 셀러 트래킹 attribution — sessionStorage 의 ref 전달.
        //   백엔드 join endpoint 의 기존 'ref' 파라미터 재활용.
        const { getTrackedSellerId } = await import('@/lib/seller-tracking')
        const ref = getTrackedSellerId() || undefined
        const res = await api.post(`/api/group-buy/join/${product.id}`, { quantity, payment_method: 'deal', ref })
        if (res.data?.success) {
          showToast(t('groupBuy.joinSuccess', { defaultValue: '공구 참여 완료! 바우처가 발급됐어요.' }), 'success')
          navigate('/my-vouchers')
        } else {
          showToast(res.data?.error || t('common.error'), 'error')
        }
      } catch (err: unknown) {
        const e = err as { response?: { status?: number; data?: { error?: string; code?: string } } }
        const code = e?.response?.data?.code
        if (code === 'INSUFFICIENT_POINTS') {
          const charge = window.confirm(
            t('groupBuy.insufficientDeal', { defaultValue: '딜이 부족합니다. 충전 페이지로 이동할까요?' })
          )
          if (charge) {
            localStorage.setItem('loginReturnUrl', window.location.pathname)
            navigate('/points/charge')
          }
          return
        }
        if (e?.response?.status === 429) {
          showToast(t('groupBuy.tooManyAttempts', { defaultValue: '잠시 후 다시 시도해주세요.' }), 'error')
          return
        }
        showToast(e?.response?.data?.error || t('common.error'), 'error')
      }
      return
    }

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

    // 🛡️ 2026-05-19: 상품이 추천 ON 이고 사용자 로그인 시 → ?ref={my_user_id} 자동 추가.
    //   친구가 이 링크로 들어와 구매하면 affiliate.routes.ts/track 이 본인에게 보상 적립.
    //   추천 OFF 상품 또는 비로그인 → 일반 링크 (보상 없음).
    const myUserId = getUserId()
    const isReferralEligible = Number(product.referral_enabled) === 1 && !!myUserId
    let shareUrl = window.location.href.split('?')[0]  // 기존 쿼리 제거
    if (isReferralEligible) {
      shareUrl += `?ref=${encodeURIComponent(String(myUserId))}`
    }

    // 🛡️ 2026-05-19: 추천 보상률 미리 안내 — 사용자가 "공유하면 얼마 적립" 인지 알 수 있게.
    const rateRatio = product.referral_commission_rate != null
      ? Number(product.referral_commission_rate)
      : 0.05  // platform default 5%
    const rewardPreview = Math.round(displayPrice * rateRatio)
    const shareText = isReferralEligible
      ? `${product.name} - ${formatNumber(displayPrice)}${Number(product.deal_only) === 1 ? ' 딜' : '원'}\n친구가 이 링크로 구매하면 +${formatNumber(rewardPreview)}딜 적립!`
      : `${product.name} - ${formatNumber(displayPrice)}${Number(product.deal_only) === 1 ? ' 딜' : '원'}`

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
        showToast(isReferralEligible
          ? t('productDetailPage.linkCopiedReferral', { reward: formatNumber(rewardPreview), defaultValue: `링크 복사 완료 — 친구 구매 시 +${formatNumber(rewardPreview)}딜 적립` })
          : t('productDetailPage.linkCopied'), 'success')
      })
    }
  }

  if (isLoading) {
    return <ProductDetailSkeleton />
  }

  if (error || !product) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white dark:bg-[#0A0A0A] p-4">
        <div className="text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">{error?.message || t('productDetailPage.notFound')}</p>
          <button onClick={() => window.location.reload()} className="mt-3 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg">{t('productDetail.retry')}</button>
          <button
            onClick={() => navigate('/')}
            className="mt-4 ml-2 px-6 py-2 bg-foreground text-background rounded-lg text-sm font-semibold"
          >
            {t('common.backToHome', { defaultValue: '홈으로 돌아가기' })}
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

  // 🛡️ 2026-05-19: deal_only (KT Alpha 교환권) 상품은 간단한 전용 디자인 (카카오/캐시비 스타일).
  if (Number(product.deal_only) === 1) {
    const brandName = (product as unknown as { brand_name?: string }).brand_name || product.category || ''
    return (
      <div className="min-h-screen bg-white pb-24">
        <SEO
          title={product.name}
          description={`${product.name} - 유어딜 교환권`}
          image={product.image_url}
          url={`/products/${product.id}`}
        />
        {/* 노란 헤더 */}
        <div className="sticky top-0 z-40 bg-amber-400 text-gray-900">
          <div className="flex items-center justify-between px-3 py-3">
            <button onClick={() => navigate(-1)} className="p-1" aria-label="뒤로">
              <ChevronLeft className="w-6 h-6" />
            </button>
            <h1 className="text-[15px] font-bold">모바일 교환권</h1>
            <div className="w-8" />
          </div>
        </div>

        {/* 상품 이미지 */}
        <div className="px-5 pt-10 pb-6 flex justify-center">
          {product.image_url ? (
            <img src={product.image_url} alt={product.name} className="w-48 h-48 object-contain" loading="lazy" />
          ) : (
            <div className="w-48 h-48 bg-gray-100 rounded" />
          )}
        </div>

        {/* 이름 + 가격 */}
        <div className="px-5 text-center">
          {brandName && <p className="text-[13px] text-gray-500 mb-1">{brandName}</p>}
          <h2 className="text-[18px] font-bold text-gray-900 leading-tight">{product.name}</h2>
          <div className="mt-3 inline-flex items-center gap-1.5 bg-amber-50 px-3 py-1.5 rounded-full">
            <span className="w-5 h-5 rounded-full bg-amber-400 text-white text-[10px] font-bold flex items-center justify-center">딜</span>
            <span className="text-[16px] font-extrabold text-amber-700">{formatNumber(displayPrice)} 딜</span>
          </div>
        </div>

        {/* 브랜드 상품 더 보러가기 */}
        {brandName && (() => {
          const brandIcon = (product as unknown as { brand_icon_url?: string | null }).brand_icon_url
          return (
            <div className="mx-5 mt-6 p-3 bg-amber-50 rounded-xl flex items-center gap-3"
              onClick={() => navigate(`/browse?brand=${encodeURIComponent(brandName)}`)}
              role="button" tabIndex={0}>
              {brandIcon ? (
                <img src={brandIcon} alt={brandName} className="w-12 h-12 rounded-lg object-cover bg-white border border-amber-100" loading="lazy" />
              ) : (
                <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center text-[10px] text-gray-400 font-bold border border-amber-100">
                  {brandName.slice(0, 4)}
                </div>
              )}
              <div className="flex-1">
                <p className="text-[11px] text-gray-500">브랜드 상품 더 보러가기</p>
                <p className="text-[14px] font-bold text-gray-900">{brandName} <span className="text-amber-600">›</span></p>
              </div>
            </div>
          )
        })()}

        {/* 상세 정보 */}
        <div className="mx-5 mt-6 divide-y divide-gray-100 border-t border-gray-100 dark:border-[#1A1A1A]">
          <div className="flex justify-between py-4">
            <span className="text-[14px] text-gray-700">유효기간</span>
            <span className="text-[14px] font-bold text-gray-900">30일</span>
          </div>
          <details className="py-4 group">
            <summary className="flex justify-between items-center cursor-pointer list-none">
              <span className="text-[14px] text-gray-700">{brandName ? `${brandName} 유의사항 안내` : '유의사항 안내'}</span>
              <span className="text-gray-400 group-open:rotate-180 transition-transform">⌄</span>
            </summary>
            <div className="mt-3 text-[12px] text-gray-600 whitespace-pre-line leading-relaxed">
              {product.description || '본 교환권은 발행일로부터 30일간 유효합니다. 발송 후 환불/취소가 불가합니다. 본인 명의 휴대폰으로만 발송됩니다.'}
            </div>
          </details>
        </div>

        {/* 함께 보면 좋은 소식 (선택) */}

        {/* 하단 노란 CTA */}
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-amber-400">
          <button onClick={handleBuyNow}
            className="w-full py-4 text-center text-[16px] font-bold text-gray-900 active:bg-amber-500"
            style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
          >
            🎁 딜로 교환하기
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#0A0A0A]">
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

      <main className="pb-20 ur-content-wide lg:px-8">
        {/* PC 좌우 2단: lg 이상에서 좌(이미지) / 우(상품헤더 sticky).
            mobile: 기존 세로 1열 그대로 (sm/md). */}
        <div className="lg:grid lg:grid-cols-5 lg:gap-8 lg:pt-6">
          <div className="lg:col-span-3">
            {/* Product Images Carousel */}
            <Suspense fallback={<div className="w-full h-96 bg-gray-100 dark:bg-[#1A1A1A] animate-pulse" />}>
              <ProductImageCarousel images={allImages} />
            </Suspense>
          </div>
          <div className="lg:col-span-2 lg:sticky lg:top-20 lg:self-start">
            {/* 🛡️ 2026-05-19: 딜 교환 전용 배지 (KT Alpha 직판 상품). */}
            {Number(product.deal_only) === 1 && (
              <div className="mb-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 border border-amber-300 rounded-full">
                <span className="text-[11px] font-extrabold text-amber-800">🎁 딜 교환 전용</span>
                <span className="text-[10px] text-amber-700">· 30일 유효 · 환불 불가</span>
              </div>
            )}
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
            {Number(product.deal_only) === 1 && (
              <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3 text-[11px] text-amber-900 space-y-1">
                <p className="font-bold">ℹ️ 딜 교환 전용 상품 안내</p>
                <ul className="list-disc list-inside space-y-0.5 ml-1">
                  <li>본 상품은 <b>유어딜 딜로만 교환</b> 가능합니다 (카드 결제 불가)</li>
                  <li>결제 즉시 <b>본인 명의 휴대폰</b>으로 MMS 발송</li>
                  <li>유효기간 <b>발행일로부터 30일</b>, 환불/취소/연장 불가</li>
                  <li>(KT Alpha 기프티쇼 B2B 정책)</li>
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* v4: description은 상세정보 섹션에서 통합 표시 */}

        {/* v4 상세 정보 (이미지 + 설명 + 펼쳐보기) */}
        <div style={{ height: 8, background: '#F9FAFB' }} />
        <section className="px-5 py-5">
          <p className="text-[13px] font-bold text-gray-900 dark:text-white mb-3">{t('productDetail.detailInfo')}</p>
          {detailImages.length > 0 && (
            <div className="rounded-xl overflow-hidden mb-3" style={{ background: '#F9FAFB' }}>
              <img src={detailImages[0]} alt={product.name || t('productDetailPage.altDetail')} loading="lazy" decoding="async" fetchPriority="high" className="w-full" style={{ aspectRatio: '4/5', objectFit: 'cover' }} />
            </div>
          )}
          {product.long_description && (
            <p className="text-[12px] text-gray-700 dark:text-gray-200 leading-relaxed">{product.long_description.slice(0, 200)}</p>
          )}
          {(detailImages.length > 1 || (product.long_description && product.long_description.length > 200)) && (
            <button className="w-full mt-4 py-3 rounded-xl border border-gray-200 dark:border-[#2A2A2A] bg-white dark:bg-[#0A0A0A] text-[12px] font-semibold text-gray-700 dark:text-gray-200 active:bg-gray-50 dark:bg-[#121212]">
              {t('productDetail.expandDetails', { defaultValue: '상세정보 펼쳐보기' })}
            </button>
          )}
        </section>

        {/* v4 공동구매 배너 (다크 카드) */}
        {product.category === 'meal_voucher' && (product.group_buy_target ?? 0) > 0 && (
          <div className="px-5 py-5">
            <div className="rounded-2xl p-4 bg-gray-900 text-white">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 bg-red-500 text-[9px] font-extrabold tracking-wide mb-2">{t('productDetail.groupBuyJoin')}</span>
                  <p className="text-[15px] font-bold">{t('productDetail.extraDiscount')}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-white/60" />
              </div>
              <div className="flex items-center justify-between mb-1 text-[11px] text-white/70">
                <span>{t('productDetail.groupBuyProgress', { current: product.group_buy_current || 0, target: product.group_buy_target, defaultValue: `${product.group_buy_current || 0}명 참여 · ${product.group_buy_target}명 목표` })}</span>
                {product.group_buy_deadline && <GroupBuyCountdown deadline={product.group_buy_deadline} />}
              </div>
              <div className="w-full rounded-full overflow-hidden h-1 bg-white dark:bg-[#0A0A0A]/15">
                <div className="h-full rounded-full bg-gradient-to-r from-red-500 to-pink-500 transition-all duration-500"
                  style={{ width: `${Math.min(100, ((product.group_buy_current || 0) / product.group_buy_target!) * 100)}%` }} />
              </div>
            </div>
          </div>
        )}

        {/* 식당 정보 (식사권일 때만) */}
        {product.category === 'meal_voucher' && product.restaurant_name && (
          <AccordionSection title={t('productDetailPage.restaurantInfo')} defaultOpen={true}>
            <div className="space-y-2.5 text-xs text-gray-500 dark:text-gray-400">
              <div className="flex"><span className="w-16 shrink-0 text-gray-400 dark:text-gray-500">{t('productDetail.restaurantName')}</span><span className="text-gray-900 dark:text-white font-medium">{product.restaurant_name}</span></div>
              {product.restaurant_address && (
                <div className="flex"><span className="w-16 shrink-0 text-gray-400 dark:text-gray-500">{t('productDetail.restaurantAddress')}</span><span>{product.restaurant_address}</span></div>
              )}
              {product.restaurant_phone && (
                <div className="flex items-center">
                  <span className="w-16 shrink-0 text-gray-400 dark:text-gray-500">{t('productDetail.restaurantPhone')}</span>
                  <a href={`tel:${product.restaurant_phone}`} className="text-blue-600 font-medium underline">
                    {product.restaurant_phone}
                  </a>
                </div>
              )}
              {product.voucher_terms && (
                <div className="flex"><span className="w-16 shrink-0 text-gray-400 dark:text-gray-500">{t('productDetail.voucherTerms')}</span><span>{product.voucher_terms}</span></div>
              )}
              {product.voucher_expiry && (
                <div className="flex"><span className="w-16 shrink-0 text-gray-400 dark:text-gray-500">{t('productDetail.voucherExpiry')}</span><span>{new Date(product.voucher_expiry).toLocaleDateString('ko-KR')}까지</span></div>
              )}

              {/* 지도 + 외부 연결 버튼 */}
              {product.restaurant_address && (
                <div className="grid grid-cols-3 gap-2 pt-2">
                  <button type="button"
                    onClick={() => navigate(`/restaurant-map?q=${encodeURIComponent(product.restaurant_address || '')}`)}
                    className="py-2 bg-gray-100 dark:bg-[#1A1A1A] hover:bg-gray-200 dark:hover:bg-[#2A2A2A] text-gray-700 dark:text-gray-200 text-xs font-semibold rounded-lg flex items-center justify-center gap-1">
                    {t('productDetail.mapLink', { defaultValue: '🗺 지도' })}
                  </button>
                  <a href={`https://map.naver.com/v5/search/${encodeURIComponent(product.restaurant_name || product.restaurant_address)}`}
                    target="_blank" rel="noopener noreferrer"
                    className="py-2 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-semibold rounded-lg flex items-center justify-center gap-1">
                    {t('productDetail.naverMap', { defaultValue: '네이버' })}
                  </a>
                  <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((product.restaurant_name || '') + ' ' + (product.restaurant_address || ''))}`}
                    target="_blank" rel="noopener noreferrer"
                    className="py-2 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-semibold rounded-lg flex items-center justify-center gap-1">
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
          <p className="text-[13px] font-bold text-gray-900 dark:text-white mb-3">{t('productDetail.optionSelect')}</p>
          {options.length > 0 ? (
            <div className="space-y-2">
              {options.map((opt: ProductOption) => (
                <button key={opt.id} onClick={() => setSelectedOptions({ option: Number(opt.id) })}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${
                    selectedOptions.option === opt.id ? 'border-gray-900 bg-gray-50 dark:bg-[#121212]' : 'border-gray-200 dark:border-[#2A2A2A]'
                  }`}>
                  <span className="text-[12px] text-gray-900 dark:text-white">{opt.option_value}</span>
                  {opt.price_adjustment !== 0 && (
                    <span className="text-[11px] text-red-500 font-bold">
                      {(opt.price_adjustment || 0) > 0 ? '+' : ''}{t('productDetail.priceWon', { defaultValue: '{{value}}원', value: formatNumber(opt.price_adjustment || 0) })}
                    </span>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <button className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-gray-200 dark:border-[#2A2A2A]">
              <span className="text-[12px] text-gray-500 dark:text-gray-400">{t('productDetail.optionPlaceholder')}</span>
              <svg className="w-3.5 h-3.5 text-gray-900 dark:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9" /></svg>
            </button>
          )}
          <div className="flex items-center gap-2 mt-3">
            <span className="text-[11px] text-gray-400 dark:text-gray-500">{t('productDetail.pointReward')}</span>
            <span className="text-[11px] font-bold text-pink-500">{t('productDetail.maxPointReward', { defaultValue: '최대 {{value}}딜', value: formatNumber(Math.round(displayPrice * 0.03)) })}</span>
          </div>
          {/* 🛡️ 2026-04-22 배치 113: VAT 포함 표시 (한국 부가세 포함 공시) */}
          <div className="mt-1 text-[10.5px] text-gray-400 dark:text-gray-500">{t('productDetail.vatIncluded')}</div>
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
                showToast(t('productDetailPage.shareLinkCopied'), 'success')
              }}
              className="w-full py-3 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 active:scale-[0.98]"
            >
              {t('productDetail.referralCopy', { defaultValue: '🔗 추천 링크 복사 (판매 당 2% 무한 적립)' })}
            </button>
          )}
          <KakaoShareButton
            title={product.name}
            description={`${formatNumber(displayPrice)}${Number(product.deal_only) === 1 ? ' 딜' : '원'} ${product.original_price && product.original_price > product.price ? `(${Math.round((1 - product.price / product.original_price) * 100)}% 할인)` : ''}`}
            imageUrl={product.image_url || undefined}
            link={`/products/${product.id}`}
            buttonText={t('productDetailPage.viewProductCta')}
          />
        </div>

        {/* v4 배송 정보 카드 */}
        <div className="px-5 py-3">
          <div className="flex items-center gap-2 py-3 px-3 rounded-xl bg-gray-50 dark:bg-[#121212]">
            <svg className="w-3.5 h-3.5 text-blue-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
            <span className="text-[12px] font-semibold text-gray-900 dark:text-white">{t('productDetail.tomorrowDelivery')}</span>
            <span className="text-[11px] text-gray-500 dark:text-gray-400">{t('productDetail.freeShippingNote', { defaultValue: '· 5만원 이상 무료' })}</span>
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
            <p className="text-[13px] font-bold text-gray-900 dark:text-white">
              {t('productDetail.reviewsLabel', { defaultValue: '리뷰' })} <span className="text-gray-400 dark:text-gray-500 font-normal">({formatNumber(reviewSummary?.total_count || 0)})</span>
            </p>
            <button className="flex items-center gap-0.5 text-[11px] text-gray-400 dark:text-gray-500">
              {t('productDetail.viewAll', { defaultValue: '전체보기' })} <ChevronRight className="w-2.5 h-2.5" />
            </button>
          </div>
          <ProductReviews productId={product.id} />
        </section>

        {/* v4 아코디언 — 3개 표준 섹션 */}
        <div className="border-t border-gray-100 dark:border-[#1A1A1A]">
          <AccordionSection title={t('productDetailPage.productInfo')}>
            <ProductInfoGrid items={[
              { label: t('productDetailPage.stock'), value: t('productDetailPage.unitCount', { count: product.stock ?? 0 }) },
              ...(product.sold_count ? [{ label: t('productDetailPage.sold'), value: t('productDetailPage.unitCount', { count: product.sold_count }) }] : []),
              ...(product.category ? [{ label: t('productDetailPage.category'), value: product.category }] : []),
            ]} />
          </AccordionSection>
          <AccordionSection title={t('productDetailPage.shippingExchange')}>
            <ReturnPolicySection />
          </AccordionSection>
          <AccordionSection title={t('productDetailPage.notes')}>
            <ProductNoticeSection />
          </AccordionSection>
        </div>

        {/* v4: 배송 안내는 하단 아코디언 "배송·교환·반품"에 통합됨 */}
      </main>

      {/* Floating Cart / Purchase Bar */}
      <Suspense fallback={<div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] h-16 bg-gray-100 dark:bg-[#1A1A1A] animate-pulse" />}>
        <FloatingActionBar
          onAddToCart={handleAddToCart}
          onBuyNow={handleBuyNow}
          disabled={product.stock === 0 && product.stock_quantity === 0}
          isWishlisted={isWishlisted}
          onToggleWishlist={handleToggleWishlist}
          price={product.price}
          originalPrice={product.original_price}
          dealOnly={Number(product.deal_only) === 1}
        />
      </Suspense>

      {/* 🛡️ 2026-04-28: 선물하기 버튼 — KakaoConsultButton 와 같은 우하단 영역.
           KakaoConsultButton 이 bottom-20 (80px) 에 위치하므로 그 위 (bottom-36 = 144px) 로
           배치해 겹침 방지. max-w-[430px] mx-auto 컨테이너로 모바일 정렬도 보존. */}
      <div className="fixed bottom-36 left-0 right-0 z-30 px-4 pr-5 pointer-events-none">
        <div className="ur-content-wide mx-auto flex justify-end">
          <button
            onClick={() => setGiftModalOpen(true)}
            className="pointer-events-auto w-12 h-12 rounded-full bg-pink-500 text-white shadow-lg flex items-center justify-center active:scale-95 transition-transform"
            aria-label={t('productDetailPage.ariaGift')}
          >
            <Gift className="w-5 h-5" />
          </button>
        </div>
      </div>

      {giftModalOpen && (
        <Suspense fallback={null}>
          <GiftSendModal
            open={giftModalOpen}
            onClose={() => setGiftModalOpen(false)}
            productId={Number(product.id)}
            productName={product.name}
            productThumbnail={product.image_url}
            productPrice={product.price}
          />
        </Suspense>
      )}

      {/* Toast Notification */}
      {toast && (
        <div 
          className={`fixed top-20 left-1/2 -translate-x-1/2 z-[60] px-4 py-2.5 rounded-lg shadow-lg max-w-sm transition-all ${
            toast.type === 'success' 
              ? 'bg-foreground text-background' 
              : 'bg-destructive text-gray-900 dark:text-white'
          }`}
        >
          <p className="text-sm font-medium text-center">{toast.message}</p>
        </div>
      )}
    </div>
  )
}
