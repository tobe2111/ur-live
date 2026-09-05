import { useEffect, useState, lazy, Suspense } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Gift, ChevronRight, ChevronLeft, Map, Bookmark, AlertTriangle } from 'lucide-react'
import api from '@/lib/api'
import { getUserId, getUserIdSync, hasConsumerSession } from '@/utils/auth'
import { TOPUP_DISABLED } from '@/shared/feature-flags'
import { resolveProductFlow, canonicalDetailPath } from '@/shared/product-flow'
import { buildDirectPurchaseItem } from './product-detail/buildDirectPurchaseItem'
// ✅ Zustand 직접 사용
import { useAuthKR } from '@/shared/stores/useAuthKR'
import { isKorea } from '@/config/region'
// ✅ React Query Hook (Product, ProductOption 타입도 여기서 가져옴)
import { useProduct, useProductOptions } from '@/hooks/useProduct'
import { useInvalidateMyVouchers } from '@/hooks/queries'
import type { ProductOption } from '@/hooks/useProduct'

// Import KREAM-style components
import { MobileHeader } from '@/components/product/mobile-header'
import { ProductHeader } from '@/components/product/product-header'
import SEO, { productJsonLd } from '@/components/SEO'
import KakaoShareButton from '@/components/KakaoShareButton'
import { ProductInfoGrid } from '@/components/product/ProductInfoGrid'
import { ProductNoticeSection } from '@/components/product/ProductNoticeSection'
import { ReturnPolicySection } from '@/components/product/ReturnPolicySection'
import BrandLoader from '@/components/brand/BrandLoader'
import { cfImage, cfImageOnError } from '@/utils/cf-image'
import { formatNumber } from '@/utils/format'
import { safeDate } from '@/utils/safe-date'
import { resolveDetailDisplay } from './product-detail/detail-display'
import AccordionSection from './product-detail/AccordionSection'
import ProductReviews from './product-detail/ProductReviews'
import ReferralSection from './product-detail/ReferralSection'
import PurchasePicker from './product-detail/PurchasePicker'
import { isMallProduct, mallRedirectPathFor } from '@/shared/mall/resolve'
import { PickupNotice, DeliveryNotice, hasPickupInfo, pickupSummaryLine } from '@/pages/product-detail/ReceiveMethodNotice'
import { readMallOrigin } from '@/shared/mall/origin'
import { parseUTCDate } from '@/utils/date'
import { storeAffiliateRef, arrivedViaSomeoneElsesRef } from '@/utils/affiliate-track'
import { useProductViewBeacon } from '@/hooks/useProductViewBeacon'
import { effectiveAffiliateRate } from '@/shared/affiliate-rate'

// 🛡️ 2026-05-02: TD-018 분할 — ReviewForm/ProductReviews/ReferralSection/AccordionSection 을
//   ./product-detail/ 로 추출. 미사용 imports (Separator, ProgressiveImage, SharePrompt, toast,
//   Users, Clock, Product type, lucide 일부) 제거.
//   🗓️ 2026-09-04: 함께 추출했던 GroupBuyCountdown 은 마감 개념 제거로 파일째 삭제됐다.

// Lazy load heavy components
const ProductImageCarousel = lazy(() => import('@/components/product/product-image-carousel').then(m => ({ default: m.ProductImageCarousel })))
const FloatingActionBar = lazy(() => import('@/components/product/floating-action-bar').then(m => ({ default: m.FloatingActionBar })))
const GiftSendModal = lazy(() => import('@/components/gift/GiftSendModal'))


export default function ProductDetailPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  // 👁️ 홈 인기순의 클릭 신호 — 세션당 1회(훅이 가드).
  useProductViewBeacon(id)
  const navigate = useNavigate()
  const invalidateVouchers = useInvalidateMyVouchers()
  const [searchParams] = useSearchParams()

  // 추천 링크 ?ref/?aff 저장 — 공유 헬퍼(affiliate-track SSOT, 7d TTL·키·쿠키 동일).
  //   📡 2026-08-09: 인라인 저장(중복 구현)이라 이 페이지만 유입 클릭(inflow_clicks) 미적재 +
  //   숫자 검증·본인링크 skip 누락이던 것 → GroupBuyDetail/VoucherDetail 과 동일 경로로 통일.
  useEffect(() => { storeAffiliateRef(searchParams.get('aff') || searchParams.get('ref')) }, [searchParams])
  
  // ✅ Region 기반 Store 선택
  const krUser = useAuthKR(state => state.user)
  
  // ✅ Selector로 필요한 상태만 구독
  const user = krUser // 🔥 2026-08-04: GLOBAL 스토어 제거(#804)
  const isLoggedIn = !!user || hasConsumerSession()
  
  // 🔥 React Query로 데이터 fetching (자동 캐싱 + 재시도)
  const { data: product, isLoading, error } = useProduct(id)
  const { data: options = [] } = useProductOptions(id)
  
  const [selectedOptions, setSelectedOptions] = useState<{ [key: string]: number }>({})
  const [quantity, setQuantity] = useState(1)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  // 🛡️ 2026-05-24: 리뷰 전체보기 토글 — 기본 5개, 클릭 시 100 (사실상 전체).
  const [showAllReviews, setShowAllReviews] = useState(false)
  // 🧭 2026-06-22: 상세 정보 전체 펼치기 (이전엔 토글 버튼이 dead — 첫 이미지/200자만 노출되고 나머지 도달 불가).
  const [detailExpanded, setDetailExpanded] = useState(false)
  const [isWishlisted, setIsWishlisted] = useState(false)
  const [giftModalOpen, setGiftModalOpen] = useState(false)  // 🛡️ 2026-04-28: 선물하기 모달
  // 🏭 2026-06-05 (사용자 요청): 딜 교환 확인 — 네이티브 confirm → 서비스 내 모달.
  const [dealConfirm, setDealConfirm] = useState<{ total: number } | null>(null)
  const [dealBuying, setDealBuying] = useState(false)
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

  // 🧭 2026-06-22: 상품 종류별 정규(canonical) 상세 페이지로 정렬 — /products 는 온라인 일반 상품 전용.
  //   교환권 → /vouchers, 공구(voucher 카테고리) → /group-buy. 분류/경로는 canonicalDetailPath SSOT.
  //   ?ref= 는 위 useEffect 가 이미 localStorage/cookie 에 저장하지만, query 도 보존해 목적지 페이지가 URL 에서도 읽도록.
  useEffect(() => {
    if (!product) return
    const dest = mallRedirectPathFor(product) ?? canonicalDetailPath(product)
    if (dest) navigate(`${dest}${window.location.search}`, { replace: true })
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
  // 🗑️ 2026-07-07 (로딩 낭비 감사): 전체 위시리스트를 받아 .some() 하던 것 → 타깃 check 엔드포인트로.
  //   위시리스트가 커질수록 페이로드/스캔이 커지던 상품별 오버페치 제거(하트 아이콘 1개용).
  useEffect(() => {
    if (!id || !isLoggedIn) return
    const uid = getUserIdSync()
    if (!uid) return
    let cancelled = false
    api.get(`/api/wishlists/check/${uid}/${id}`).then(r => {
      if (cancelled) return
      if (r.data.success) setIsWishlisted(!!r.data.data?.isWishlisted)
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
    // 🏭 2026-06-05 (사용자 신고 — 옵션 기능): 옵션 있는 상품은 선택 필수 + 옵션 가격조정 반영.
    if (options.length > 0 && !selectedOptions.option) {
      showToast(t('productDetail.optionPlaceholder', { defaultValue: '옵션을 선택해주세요' }), 'error')
      return
    }
    const optAdj = options.find((o: ProductOption) => Number(o.id) === selectedOptions.option)?.price_adjustment || 0

    try {
      await api.post('/api/cart', {
        product_id: product!.id,
        quantity,
        price_snapshot: (product!.price || 0) + optAdj,
        // 🛡️ 2026-07-02 (쇼핑 전수조사): option_id 를 실제로 전송 — 이전엔 options JSON 문자열만 보내
        //   서버가 무시(option_id NULL) → 서로 다른 옵션이 한 행으로 병합·옵션 표시/변경 불가.
        option_id: selectedOptions.option || null,
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
    // 🏭 2026-06-05 (사용자 신고 — 옵션 기능): 옵션 있는 상품은 선택 필수 + 가격조정 반영.
    if (options.length > 0 && !selectedOptions.option) {
      showToast(t('productDetail.optionPlaceholder', { defaultValue: '옵션을 선택해주세요' }), 'error')
      return
    }
    const optAdj = options.find((o: ProductOption) => Number(o.id) === selectedOptions.option)?.price_adjustment || 0
    const optValue = options.find((o: ProductOption) => Number(o.id) === selectedOptions.option)?.option_value || null
    const unitPrice = (product.price || 0) + optAdj

    // 🛡️ 2026-05-23: getProductFlow SSOT 사용 (voucher_deal flow → 딜 결제).
    const { flow } = resolveProductFlow(product)
    if (flow === 'voucher_deal') {
      // 🏭 2026-06-05 (사용자 요청 — 네이티브 confirm 이 디자인 해침): 서비스 내 스타일 모달로 확인.
      setDealConfirm({ total: product.price * quantity })
      return
    }

    // 바로구매: 장바구니 거치지 않고 해당 상품만 결제
    navigate('/checkout', {
      state: {
        directPurchase: [buildDirectPurchaseItem(product, unitPrice, quantity, selectedOptions.option || null, optValue)],
      }
    })
  }

  // 🏭 2026-06-05: 딜 교환 실제 실행 (모달 '확인' 시 호출). 기존 join 로직 + 잔액부족은 toast+이동(네이티브 confirm 제거).
  async function runVoucherDealPurchase() {
    if (!product || dealBuying) return
    setDealBuying(true)
    try {
      const { getTrackedSellerId } = await import('@/lib/seller-tracking')
      const ref = getTrackedSellerId() || undefined
      const res = await api.post(`/api/group-buy/join/${product.id}`, { quantity, payment_method: 'deal', ref })
      if (res.data?.success) {
        setDealConfirm(null)
        showToast(t('groupBuy.joinSuccess', { defaultValue: '교환 완료! 바우처가 발급됐어요.' }), 'success')
        invalidateVouchers()
        navigate('/my-gifticons')  // 🎟️ 2026-08-31 지갑 분리 — 딜 교환(교환권)은 교환권 보관함으로
      } else {
        showToast(res.data?.error || t('common.error'), 'error')
      }
    } catch (err: unknown) {
      const e = err as { response?: { status?: number; data?: { error?: string; code?: string } } }
      const code = e?.response?.data?.code
      if (code === 'INSUFFICIENT_POINTS') {
        setDealConfirm(null)
        // 🛡️ 2026-07-18 (대표 "충전 자체를 빼자"): 충전 유도 → 적립 안내 (TOPUP_DISABLED)
        if (TOPUP_DISABLED) {
          showToast(t('groupBuy.insufficientDealEarn', { defaultValue: '딜이 부족해요. 딜은 친구 초대·유어샵 추천으로 모을 수 있어요.' }), 'error')
          return
        }
        showToast(t('groupBuy.insufficientDeal', { defaultValue: '딜이 부족해요. 충전 페이지로 이동합니다.' }), 'error')
        localStorage.setItem('loginReturnUrl', window.location.pathname)
        setTimeout(() => navigate('/points/charge'), 900)
        return
      }
      if (e?.response?.status === 429) {
        showToast(t('groupBuy.tooManyAttempts', { defaultValue: '잠시 후 다시 시도해주세요.' }), 'error')
        return
      }
      showToast(e?.response?.data?.error || t('common.error'), 'error')
    } finally {
      setDealBuying(false)
    }
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
    // 📌 2026-09-05: 기본값이 `0.05` 하드코딩이었다 — 라이브 기본은 **2%**(2026-06-17 대표 결정)라
    //   공유 문구가 실제보다 2.5배 많은 적립을 약속하고 있었다. 해석은 SSOT 하나로.
    const rateRatio = effectiveAffiliateRate({
      referral_commission_rate: product.referral_commission_rate as number | null | undefined,
      referral_enabled: (product as { referral_enabled?: number | null }).referral_enabled,
    }) ?? 0
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
    // 🎨 2026-07-01 (대표 "로더 전면 통일"): 유어딜 BrandLoader(SSOT)로 통일.
    return <BrandLoader fullScreen />
  }

  if (error || !product) {
    const mallOrigin = readMallOrigin()
    return (
      <div className="flex min-h-screen items-center justify-center bg-white dark:bg-[#11141C] p-4">
        <div className="text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">{error?.message || t('productDetailPage.notFound')}</p>
          <button onClick={() => window.location.reload()} className="mt-3 px-4 py-2 bg-gray-900 text-white text-sm rounded-lg">{t('productDetail.retry')}</button>
          {/* 🏬 2026-08-02 — 여기선 상품을 못 읽어 `mall_id` 를 모른다. 그래서 **어디서 왔는지**를
              쓴다: 몰 홈이 남긴 흔적이 있으면 그 가게로 돌려보낸다. 흔적이 없으면 기존대로 유어딜 홈
              — 즉 **본진 손님의 동작은 불변**이고, 몰 손님만 자기 가게로 간다.
              (품절·삭제된 상품 링크가 단톡방에 남아 있는 상황이 실제로 흔하다.) */}
          {mallOrigin ? (
            <button
              onClick={() => navigate(`/${mallOrigin}`)}
              className="mt-4 ml-2 px-6 py-2 bg-foreground text-background rounded-lg text-sm font-semibold"
            >
              가게로 돌아가기
            </button>
          ) : (
            <button
              onClick={() => navigate('/')}
              className="mt-4 ml-2 px-6 py-2 bg-foreground text-background rounded-lg text-sm font-semibold"
            >
              {t('common.backToHome', { defaultValue: '홈으로 돌아가기' })}
            </button>
          )}
        </div>
      </div>
    )
  }

  const displayPrice = product.current_price || product.price

  // 🏬 2026-08-02 — 이 화면이 **두 종류의 손님**에게 열린다는 사실을 여기서 한 번만 판정한다.
  //   두 신호는 **다른 질문**이라 일부러 분리했다(하나로 합치면 반드시 한쪽이 틀린다):
  //     ① `mallProduct` = "이 손님은 몰 손님인가" → 유어딜로 데려가는 것을 안 그린다(기준 ⑤)
  //     ② 픽업 여부   = "이 상품은 배송이 아닌가" → `ReceiveMethodNotice` 의 두 형제가
  //        **같은 `pickup` 입력**을 읽어 배타적으로 그린다(여기서 판정하지 않는 것이 요점).
  const mallProduct = isMallProduct(product.mall_id)
  const pickupProduct = hasPickupInfo(product.pickup)

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

  // 🧭 2026-06-22: 상세 정보 노출 결정 (펼쳐보기 토글) — pure helper SSOT.
  const detail = resolveDetailDisplay(detailImages, product.long_description, detailExpanded)

  // 🛡️ 2026-05-19: deal_only (KT Alpha 교환권) 상품은 간단한 전용 디자인 (카카오/캐시비 스타일).
  if (Number(product.deal_only) === 1) {
    const brandName = (product as unknown as { brand_name?: string }).brand_name || product.category || ''
    return (
      <div className="min-h-screen bg-white dark:bg-[#11141C] pb-24">
        <SEO
          title={product.name}
          description={`${product.name} - 유어딜 교환권`}
          image={product.image_url}
          url={`/products/${product.id}`}
        />
        {/* 노란 헤더 */}
        <div className="sticky top-0 z-40 bg-amber-400 text-gray-900 dark:text-white">
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
            <img src={cfImage(product.image_url, { width: 384, quality: 85, format: 'auto' }) || product.image_url} alt={product.name} className="w-48 h-48 object-contain" loading="lazy" onError={(e) => cfImageOnError(e.currentTarget, product.image_url)} />
          ) : (
            <div className="w-48 h-48 bg-gray-100 dark:bg-[#1D1F29] rounded" />
          )}
        </div>

        {/* 이름 + 가격 */}
        <div className="px-5 text-center">
          {brandName && <p className="text-[13px] text-gray-500 dark:text-gray-400 mb-1">{brandName}</p>}
          <h2 className="text-[18px] font-bold text-gray-900 dark:text-white leading-tight">{product.name}</h2>
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
                <img src={cfImage(brandIcon, { width: 96, quality: 80, format: 'auto' }) || brandIcon} alt={brandName} className="w-12 h-12 rounded-lg object-cover bg-white dark:bg-[#11141C] border border-amber-100" loading="lazy" onError={(e) => cfImageOnError(e.currentTarget, brandIcon)} />
              ) : (
                <div className="w-12 h-12 bg-white dark:bg-[#11141C] rounded-lg flex items-center justify-center text-[10px] text-gray-400 font-bold border border-amber-100">
                  {brandName.slice(0, 4)}
                </div>
              )}
              <div className="flex-1">
                <p className="text-[11px] text-gray-500 dark:text-gray-400">브랜드 상품 더 보러가기</p>
                <p className="text-[14px] font-bold text-gray-900 dark:text-white">{brandName} <span className="text-amber-600">›</span></p>
              </div>
            </div>
          )
        })()}

        {/* 상세 정보 */}
        <div className="mx-5 mt-6 divide-y divide-gray-100 dark:divide-[#2C2F35] border-t border-gray-100 dark:border-[#2C2F35]">
          <div className="flex justify-between py-4">
            <span className="text-[14px] text-gray-700 dark:text-gray-200">유효기간</span>
            <span className="text-[14px] font-bold text-gray-900 dark:text-white">30일</span>
          </div>
          <details className="py-4 group">
            <summary className="flex justify-between items-center cursor-pointer list-none">
              <span className="text-[14px] text-gray-700 dark:text-gray-200">{brandName ? `${brandName} 유의사항 안내` : '유의사항 안내'}</span>
              <span className="text-gray-400 group-open:rotate-180 transition-transform">⌄</span>
            </summary>
            <div className="mt-3 text-[12px] text-gray-600 dark:text-gray-300 whitespace-pre-line leading-relaxed">
              {product.description || '본 교환권은 발행일로부터 30일간 유효합니다. 발송 후 환불/취소가 불가합니다. 본인 명의 휴대폰으로만 발송됩니다.'}
            </div>
          </details>
        </div>

        {/* 함께 보면 좋은 소식 (선택) */}

        {/* 하단 노란 CTA */}
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-amber-400 app-frame-bar">
          <button onClick={handleBuyNow}
            className="w-full py-4 text-center text-[16px] font-bold text-gray-900 dark:text-white active:bg-amber-500"
            style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
          >
            딜로 교환하기
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#11141C]">
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
        productId={product?.id ? Number(product.id) : undefined}
        productPrice={product?.price ? Number(product.price) : undefined}
      />

      <main className="pb-28 ur-content-wide lg:px-8">
        {/* PC 좌우 2단: lg 이상에서 좌(이미지) / 우(상품헤더 sticky).
            mobile: 기존 세로 1열 그대로 (sm/md). */}
        <div className="lg:grid lg:grid-cols-5 lg:gap-8 lg:pt-6">
          <div className="lg:col-span-3">
            {/* Product Images Carousel */}
            <Suspense fallback={<div className="w-full h-96 bg-gray-100 dark:bg-[#1D1F29] animate-pulse" />}>
              <ProductImageCarousel images={allImages} />
            </Suspense>
          </div>
          <div className="lg:col-span-2 lg:sticky lg:top-20 lg:self-start">
            {/* 🛡️ 2026-05-19: 딜 교환 전용 배지 (KT Alpha 직판 상품). */}
            {Number(product.deal_only) === 1 && (
              <div className="mb-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-100 border border-amber-300 rounded-full">
                <span className="text-[11px] font-extrabold text-amber-800">딜 교환 전용</span>
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
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* v4: description은 상세정보 섹션에서 통합 표시 */}

        {/* 🛡️ 2026-05-24: 사용자 요청 — 옵션 선택을 상세 정보 위로 이동.
            구매 의도 단계에서 옵션 우선 노출 → 결정 후 상세 정보 확인 패턴.
            🏬 2026-08-02: 마크업을 `product-detail/PurchasePicker` 로 이동(로직 불변) — 시안 A-2 의
            픽업 벌을 여기 인라인으로 더하면 978줄 동결 파일이 두 배로 자란다. */}
        {!pickupProduct && <div className="h-2 bg-gray-50 dark:bg-[#161616]" />}
        <PurchasePicker
          options={options}
          selectedOptionId={selectedOptions.option}
          onSelectOption={(oid) => setSelectedOptions({ option: oid })}
          quantity={quantity}
          onQuantity={setQuantity}
          maxQuantity={Math.max((product.stock ?? 0), (product.stock_quantity ?? 0), 1)}
          displayPrice={displayPrice}
          variant={pickupProduct ? 'pickup' : 'default'}
          notice={<PickupNotice pickup={product.pickup} />}
        />

        {/* v4 상세 정보 (이미지 + 설명 + 펼쳐보기) */}
        <div className="h-2 bg-gray-50 dark:bg-[#161616]" />
        <section className="px-5 py-5">
          <p className="text-[13px] font-bold text-gray-900 dark:text-white mb-3">{t('productDetail.detailInfo')}</p>
          {detail.images.length > 0 && (
            detailExpanded ? (
              <div className="space-y-2 mb-3">
                {detail.images.map((img, i) => (
                  <img key={i} src={cfImage(img, { width: 800, quality: 85, format: 'auto' }) || img} alt={product.name || t('productDetailPage.altDetail')} loading="lazy" decoding="async" fetchPriority={i === 0 ? 'high' : 'auto'} className="w-full rounded-xl" onError={(e) => cfImageOnError(e.currentTarget, img)} />
                ))}
              </div>
            ) : (
              <div className="rounded-xl overflow-hidden mb-3 bg-gray-50 dark:bg-[#1D1F29]">
                <img src={cfImage(detail.images[0], { width: 800, quality: 85, format: 'auto' }) || detail.images[0]} alt={product.name || t('productDetailPage.altDetail')} loading="lazy" decoding="async" fetchPriority="high" className="w-full" style={{ aspectRatio: '4/5', objectFit: 'cover' }} onError={(e) => cfImageOnError(e.currentTarget, detail.images[0])} />
              </div>
            )
          )}
          {detail.text && (
            <p className="text-[12px] text-gray-700 dark:text-gray-200 leading-relaxed whitespace-pre-line">
              {detail.text}{detail.truncated ? '…' : ''}
            </p>
          )}
          {!detailExpanded && detail.canExpand && (
            <button onClick={() => setDetailExpanded(true)} className="w-full mt-4 py-3 rounded-xl border border-gray-200 dark:border-[#2C2F35] bg-white dark:bg-[#11141C] text-[12px] font-semibold text-gray-700 dark:text-gray-200 active:bg-gray-50 dark:active:bg-[#1D1F29]">
              {t('productDetail.expandDetails', { defaultValue: '상세정보 펼쳐보기' })}
            </button>
          )}
        </section>

        {/* v4 공동구매 배너 (다크 카드) */}
        {product.category === 'meal_voucher' && (product.group_buy_target ?? 0) > 0 && (
          <div className="px-5 py-5">
            {/* 🚑 2026-07-02 (상세 리뷰): ChevronRight 로 클릭 유도하면서 onClick 없던 dead 어포던스 → 공구 상세로 배선 */}
            <div className="rounded-2xl p-4 bg-gray-900 text-white cursor-pointer active:scale-[0.99] transition-transform" role="button" tabIndex={0}
              onClick={() => navigate(`/group-buy/${id}`)}
              onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/group-buy/${id}`) }}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <span className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 bg-red-500 text-[9px] font-extrabold tracking-wide mb-2">{t('productDetail.groupBuyJoin')}</span>
                  <p className="text-[15px] font-bold">{t('productDetail.extraDiscount')}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-white/60" />
              </div>
              <div className="flex items-center justify-between mb-1 text-[11px] text-white/70">
                <span>{t('productDetail.groupBuyProgress', { current: product.group_buy_current || 0, target: product.group_buy_target, defaultValue: `${product.group_buy_current || 0}명 참여 · ${product.group_buy_target}명 목표` })}</span>
              </div>
              <div className="w-full rounded-full overflow-hidden h-1 bg-white dark:bg-[#11141C]/15">
                <div className="h-full rounded-full bg-white dark:bg-white transition-all duration-500"
                  style={{ width: `${Math.min(100, ((product.group_buy_current || 0) / product.group_buy_target!) * 100)}%` }} />
              </div>
            </div>
          </div>
        )}

        {/* 식당 정보 (이용권일 때만) */}
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
                <div className="flex"><span className="w-16 shrink-0 text-gray-400 dark:text-gray-500">{t('productDetail.voucherExpiry')}</span><span>{safeDate(product.voucher_expiry)?.toLocaleDateString('ko-KR')}까지</span></div>
              )}

              {/* 지도 + 외부 연결 버튼 */}
              {product.restaurant_address && (
                <div className="grid grid-cols-3 gap-2 pt-2">
                  <button type="button"
                    onClick={() => navigate(`/map?q=${encodeURIComponent(product.restaurant_address || '')}`)}
                    className="py-2 bg-gray-100 dark:bg-[#1D1F29] hover:bg-gray-200 dark:hover:bg-[#2C2F35] text-gray-700 dark:text-gray-200 text-xs font-semibold rounded-lg flex items-center justify-center gap-1">
                    {<><Map className="w-3.5 h-3.5" strokeWidth={2} aria-hidden />{t('productDetail.mapLink', { defaultValue: '지도' })}</>}
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

        {/* 🛡️ 2026-05-27 (사용자 idea): 큐레이터 CTA — 1판매당 적립액 명확 표시.
              로그인 사용자: "📌 담기 + 추천 링크 복사" 통합 버튼 + 적립액 부제
              비로그인: 회원가입 유도 (적립액 미리 표시 — 가입 동기 ↑)
            🏬 2026-08-02 — **몰 상품엔 안 그린다**(대표 UX 기준 ⑤ 본진 입구 금지).
              반찬가게 단톡방에서 온 손님에게 이 자리가 보여 주던 것은
              *"🎁 회원가입하고 1판매당 N원 적립받기 / 내 유어샵에 담아 친구에게 추천만 해도 수익"* 였다.
              몰 홈은 `powered by 유어딜` 조차 클릭 못 하게 막아 뒀는데 카드 한 번 누르면 여기였다.
              공유(KakaoShareButton)는 **남긴다** — 단톡방 확산은 운영자에게 이득이고 유어딜 영입이 아니다. */}
        <div className="px-5 py-3 space-y-2">
          {/* 🛡️ 2026-09-04 (대표): **남의 추천 링크로 들어왔으면 이 자리를 안 그린다.**
                A 가 공유한 링크로 온 B 에게 "내 유어샵에 담기 + 추천 링크 복사" 를 보여 주면
                B 가 A 의 손님을 그대로 가져간다 — 소개의 결과를 소개받은 사람이 가로챈다.
                담기는 **유어딜에서 직접 발견했을 때만**. (몰 상품 제외와 같은 성격의 게이트.)
                ⚠️ 저장된 ref(구매 귀속)는 그대로다 — B 가 사면 매출은 A 에게 간다. */}
          {!mallProduct && !arrivedViaSomeoneElsesRef() && (() => {
            // 1판매당 큐레이터 적립액 = 가격 × 2% (platform_settings.curator_affiliate_pct default).
            // 🛡️ 추후 dynamic-policy 동기화 가능 (현재 default 2% — referralCopy 기존 라벨과 일관).
            const commissionPct = 2
            const commissionAmount = Math.floor(displayPrice * commissionPct / 100)
            const isDeal = Number(product.deal_only) === 1
            const unit = isDeal ? '딜' : '원'
            const amountStr = `${formatNumber(commissionAmount)}${unit}`

            if (isLoggedIn) {
              return (
                <button
                  onClick={async () => {
                    const userId = getUserId()
                    const url = `https://urdeal.kr/products/${product.id}?ref=${userId}`
                    // 1) clipboard 복사 (즉시)
                    try { await navigator.clipboard.writeText(url) } catch { /* fallback 무시 */ }
                    // 2) 자동 핀 추가 (idempotent — ALREADY_PINNED graceful)
                    let pinAdded = false
                    try {
                      const res = await api.post('/api/curator/me/pins', { product_id: product.id })
                      if (res.data?.success) pinAdded = true
                    } catch { /* silent */ }
                    showToast(
                      pinAdded
                        ? '링크 복사 + 내 유어샵에 추가됨'
                        : t('productDetailPage.shareLinkCopied'),
                      'success'
                    )
                  }}
                  className="w-full py-3.5 bg-gradient-to-r from-gray-800 to-gray-900 text-white rounded-xl flex flex-col items-center justify-center gap-0.5 active:scale-[0.98]"
                >
                  <span className="flex items-center gap-1.5 text-[15px] font-bold"><Bookmark className="w-4 h-4 shrink-0" strokeWidth={2} aria-hidden />내 유어샵에 담기 + 추천 링크 복사</span>
                  <span className="text-[11px] opacity-90">손님이 사서 <b>쓰면</b> {amountStr} 적립 · 친구 공유 가능</span>
                </button>
              )
            }
            // 비로그인 — 회원가입 유도 (적립액 미리 보여서 동기 ↑)
            return (
              <button
                onClick={() => navigate(`/login?returnUrl=${encodeURIComponent(window.location.pathname)}`)}
                className="w-full py-3.5 bg-gray-900 hover:bg-black text-white rounded-xl flex flex-col items-center justify-center gap-0.5 active:scale-[0.98]"
              >
                <span className="text-[15px] font-bold">회원가입하고 손님이 쓸 때마다 {amountStr} 받기</span>
                <span className="text-[11px] opacity-90">내 유어샵에 담아 친구에게 추천만 해도 수익</span>
              </button>
            )
          })()}
          <KakaoShareButton
            title={product.name}
            description={`${formatNumber(displayPrice)}${Number(product.deal_only) === 1 ? ' 딜' : '원'} ${product.original_price && product.original_price > product.price ? `(${Math.round((1 - product.price / product.original_price) * 100)}% 할인)` : ''}`}
            imageUrl={product.image_url || undefined}
            link={`/products/${product.id}`}
            buttonText={t('productDetailPage.viewProductCta')}
            {...(Number(product.deal_only) === 1 ? {} : {
              // 💰 원화 상품만 커머스 카드(딜 결제 상품은 '원' 표기 부적합 → 기본 카드)
              regularPrice: product.original_price && product.original_price > product.price ? product.original_price : undefined,
              salePrice: product.price,
              secondaryButtonText: '자세히 보기',
            })}
          />
        </div>

        <DeliveryNotice pickup={product.pickup} />

        {/* 친구 초대 공동구매 — 🏬 유어딜 추천 레일이라 몰 상품엔 미노출(기준 ⑤). */}
        {!mallProduct && (
          <ReferralSection
            productId={product.id}
            productTiers={product.group_buy_tiers}
            isLoggedIn={isLoggedIn}
            showToast={showToast}
          />
        )}

        {/* v4: 안내정보는 하단 아코디언으로 이동 */}

        {/* v4 리뷰 섹션 (독립) */}
        {/* 🛡️ 2026-05-24: 전체보기 토글 — 클릭 시 limit 100 으로 재요청 (사실상 전체). */}
        <div className="h-2 bg-gray-50 dark:bg-[#161616]" />
        <section className="px-5 py-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[13px] font-bold text-gray-900 dark:text-white">
              {t('productDetail.reviewsLabel', { defaultValue: '리뷰' })} <span className="text-gray-400 dark:text-gray-500 font-normal">({formatNumber(reviewSummary?.total_count || 0)})</span>
            </p>
            {!showAllReviews && (reviewSummary?.total_count ?? 0) > 5 && (
              <button onClick={() => setShowAllReviews(true)} className="flex items-center gap-0.5 text-[11px] text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 active:opacity-70">
                {t('productDetail.viewAll', { defaultValue: '전체보기' })} <ChevronRight className="w-2.5 h-2.5" />
              </button>
            )}
          </div>
          <ProductReviews productId={product.id} limit={showAllReviews ? 100 : 5} />
        </section>

        {/* v4 아코디언 — 3개 표준 섹션 */}
        <div className="border-t border-gray-100 dark:border-[#2C2F35]">
          <AccordionSection title={t('productDetailPage.productInfo')}>
            <ProductInfoGrid items={[
              { label: t('productDetailPage.stock'), value: t('productDetailPage.unitCount', { count: product.stock ?? 0 }) },
              ...(product.sold_count ? [{ label: t('productDetailPage.sold'), value: t('productDetailPage.unitCount', { count: product.sold_count }) }] : []),
              ...(product.category ? [{ label: t('productDetailPage.category'), value: product.category }] : []),
            ]} />
          </AccordionSection>
          <AccordionSection title={hasPickupInfo(product.pickup) ? '교환·반품·환불 안내' : t('productDetailPage.shippingExchange')}>
            <ReturnPolicySection />
          </AccordionSection>
          <AccordionSection title={t('productDetailPage.notes')}>
            <ProductNoticeSection />
          </AccordionSection>
        </div>

        {/* v4: 배송 안내는 하단 아코디언 "배송·교환·반품"에 통합됨 */}
      </main>

      {/* Floating Cart / Purchase Bar */}
      <Suspense fallback={<div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] h-16 bg-gray-100 dark:bg-[#1D1F29] animate-pulse" />}>
        <FloatingActionBar
          onAddToCart={handleAddToCart}
          onBuyNow={handleBuyNow}
          disabled={(product.stock ?? 0) <= 0 && (product.stock_quantity ?? 0) <= 0} /* 🚑 2026-07-02: null===0 갭 — 한쪽 컬럼만 쓰는 품절 상품이 구매 가능하던 버그 */
          isWishlisted={isWishlisted}
          onToggleWishlist={handleToggleWishlist}
          price={product.price}
          originalPrice={product.original_price}
          dealOnly={Number(product.deal_only) === 1}
          variant={pickupProduct ? 'pickup' : 'default'}
          summaryLeft={pickupProduct ? pickupSummaryLine(quantity, product.pickup?.date) : undefined}
          summaryTotal={displayPrice * quantity}
        />
      </Suspense>

      {/* 🏭 2026-06-04 (사용자 요청 — 배치/디자인 정리): 선물·담기 보조 액션을 하나의 그룹으로 통합.
           기존: 분리된 floating 핑크 원 + 보라 pill 이 하단 바와 겹침(거의 겹쳐짐). 이모지 📌 아이콘.
           변경: 일관된 라벨 pill(중립 배경 + 컬러 lucide 아이콘) 세로 스택 + 간격 + 바 위로 충분히 띄움.
           위치는 safe-area + 하단 바 높이(~104px) 위로 계산해 겹침 0. */}
      <div
        className="fixed left-0 right-0 z-30 px-4 pr-5 pointer-events-none"
        style={{ bottom: 'calc(env(safe-area-inset-bottom) + 96px)' }}
      >
        <div className="ur-content-wide mx-auto flex flex-col items-end gap-2.5">
          {/* 🧭 2026-06-22: 중복 '담기' floating pill 제거 — 본문의 '📌 내 유어샵에 담기 + 추천 링크 복사'
               CTA(적립액 표시 + 링크 복사 포함)가 정규 담기 진입점. floating 은 보조 액션(선물)만 유지. */}
          <button
            onClick={() => setGiftModalOpen(true)}
            className="pointer-events-auto inline-flex items-center gap-1.5 h-10 pl-3 pr-3.5 rounded-full bg-white dark:bg-[#1D1F29] border border-gray-200 dark:border-[#2C2F35] shadow-lg active:scale-95 transition-transform"
            aria-label={t('productDetailPage.ariaGift')}
          >
            <Gift className="w-4 h-4 text-gray-900 dark:text-white" />
            <span className="text-[12px] font-bold text-gray-900 dark:text-white">선물</span>
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

      {/* 🏭 2026-06-05 (사용자 요청): 딜 교환 확인 — 네이티브 confirm 대체 서비스 내 모달. */}
      {dealConfirm && (
        <div className="fixed inset-0 z-[10600] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => !dealBuying && setDealConfirm(null)}>
          <div className="w-full sm:max-w-sm bg-white dark:bg-[#1D1F29] rounded-t-2xl sm:rounded-2xl p-5 m-0 sm:mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              {product.image_url && (
                <img src={cfImage(product.image_url, { width: 112, quality: 80, format: 'auto' }) || product.image_url} alt="" loading="lazy" decoding="async" className="w-14 h-14 rounded-xl object-cover shrink-0" onError={(e) => cfImageOnError(e.currentTarget, product.image_url)} />
              )}
              <div className="min-w-0">
                <p className="text-[14px] font-bold text-gray-900 dark:text-white line-clamp-2">{product.name}</p>
                <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-0.5">
                  {quantity}장 × {formatNumber(product.price)}딜
                </p>
              </div>
            </div>
            <div className="mt-4 flex items-baseline justify-between">
              <span className="text-[13px] text-gray-500 dark:text-gray-400">결제 금액</span>
              <span className="text-[20px] font-extrabold text-gray-900 dark:text-white">{formatNumber(dealConfirm.total)}딜</span>
            </div>
            <div className="mt-3 flex items-start gap-1.5 rounded-xl px-3 py-2.5 bg-amber-50 dark:bg-amber-500/10">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-500" strokeWidth={2} aria-hidden />
              <p className="text-[12px] text-amber-700 dark:text-amber-300 leading-snug">교환 후에는 환불이 불가합니다. 딜로 즉시 결제됩니다.</p>
            </div>
            <div className="mt-5 flex gap-2">
              <button onClick={() => setDealConfirm(null)} disabled={dealBuying}
                className="flex-1 h-12 rounded-xl text-[14px] font-bold text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-[#2C2F35] active:scale-[0.98] transition-transform disabled:opacity-50">
                취소
              </button>
              <button onClick={runVoucherDealPurchase} disabled={dealBuying}
                className="flex-1 h-12 rounded-xl text-[14px] font-extrabold text-white active:scale-[0.98] transition-transform disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg, #1f2937, #111827)' }}>
                {dealBuying ? '처리 중…' : `${formatNumber(dealConfirm.total)}딜로 교환`}
              </button>
            </div>
          </div>
        </div>
      )}

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
