import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { CartItem } from '@/types/cart'
import type { ShippingAddress, GroupBuyTier, SellerGroup } from './checkout/types'
import SEO from '@/components/SEO'
import api from '@/lib/api'
import { handleApiError, getUserFriendlyError } from '@/lib/errorHandler'
import { Button } from '@/components/ui/button'
import { AlertCircle } from 'lucide-react'
import { getUserIdSync } from '@/utils/auth'
import { useAuthKR } from '@/shared/stores/useAuthKR'
import { useAuthWorld } from '@/shared/stores/useAuthWorld'
import { isKorea } from '@/config/region'
import { captureError } from '@/lib/sentry'
import { toast } from '@/hooks/useToast'
import { useForceLightTheme } from '@/hooks/useForceLightTheme'
// 🛡️ 2026-05-01: TD-018 점진 분할 — sub-components.
import CheckoutHeader from './checkout/CheckoutHeader'
import OrderItemsList from './checkout/OrderItemsList'
import CheckoutCouponSection from './checkout/CheckoutCouponSection'
import CheckoutOrderSummary from './checkout/CheckoutOrderSummary'
import PaymentSection from './checkout/PaymentSection'
// TD-018 final pass: 배송지 복합 컴포넌트 (ShippingSection + modals)
import CheckoutAddressSection from './checkout/CheckoutAddressSection'
import { useBeforePayment } from './checkout/useBeforePayment'

// 🛡️ 2026-05-23 토스 SDK preload — 모듈 evaluate 즉시 CDN download 시작.
//   import 만 해도 startPreload() 자동 실행 (src/lib/toss-preload.ts).
import { getTossClientKey } from '@/lib/toss-preload'

const clientKey = getTossClientKey()

export default function CheckoutPage() {
  // 🛡️ 2026-05-19: 결제 페이지는 라이트 테마 고정 (사용자 요청 + 가독성).
  //   영수증 / 금액 / 카드 입력 정보의 명료성이 최우선.
  useForceLightTheme()
  const { t } = useTranslation()
  // ✅ Region 기반 Store 선택
  const isKR = isKorea()
  const krUser = useAuthKR(state => state.user)
  const krAuthLoading = useAuthKR(state => state.isLoading)
  const krIsAuthReady = useAuthKR(state => state.isAuthReady)
  const worldUser = useAuthWorld(state => state.user)
  const worldAuthLoading = useAuthWorld(state => state.isLoading)
  const worldIsAuthReady = useAuthWorld(state => state.isAuthReady)

  // ✅ Selector로 필요한 상태만 구독
  const user = isKR ? krUser : worldUser
  const authLoading = isKR ? krAuthLoading : worldAuthLoading
  const isAuthReady = isKR ? krIsAuthReady : worldIsAuthReady

  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [userId, setUserId] = useState<string | null>(null)
  const [urlParamsProcessed, setUrlParamsProcessed] = useState(false)
  const [tokenRefreshing] = useState(false)

  // 바로구매 모드: navigate state로 전달된 상품만 결제
  const directPurchaseItems = (location.state as { directPurchase?: CartItem[] } | null)?.directPurchase
  const isDirectPurchase = !!directPurchaseItems?.length

  // 결제 수단 선택
  const [paymentMethod, setPaymentMethod] = useState<'toss' | 'deal'>('toss')
  // 🛡️ 2026-05-21: 사용자 지적 — 교환권 (deal_only=1) 만 담겼으면 토스 결제 불요.
  //   모든 item 이 deal_only=1 → 강제 'deal' 모드 + 토스 옵션 숨김 + 결제 수단 선택 단계 생략.
  //   별도 useState 가 아닌 derived state: cartItems 변경 시 자동 재계산.
  const [couponCode, setCouponCode] = useState('')
  const [couponDiscount, setCouponDiscount] = useState(0)
  const [couponId, setCouponId] = useState<number | null>(null)
  const [autoCoupon, setAutoCoupon] = useState<{ type: string; value: number; max_discount: number } | null>(null)
  const [dealBalance, setDealBalance] = useState(0)
  const [dealToUse, setDealToUse] = useState(0)
  const [payingWithDeals, setPayingWithDeals] = useState(false)
  const [groupBuyDiscounts, setGroupBuyDiscounts] = useState<Record<number, { percent: number; tier: GroupBuyTier | null }>>({})

  // 배송지 — CheckoutAddressSection 이 관리, 부모는 selectedAddress 만 보관
  const [selectedAddress, setSelectedAddress] = useState<ShippingAddress | null>(null)

  // 🛡️ 2026-05-23 v2 (revert + 회귀 방어): server clientKey 다시 fetch — env 미스매치 영구 차단.
  //   배경: 이전 commit (eb29a060) 에서 VITE env 만 사용으로 바꿨는데, 운영자가 빌드 env 미설정 시
  //         클라이언트가 빈/잘못된 키로 SDK 호출 → "결제위젯 연동 키는 지원하지 않습니다" 등 에러 회귀.
  //   복원: server `TOSS_CLIENT_KEY` 단일 진실원천. server env 만 갱신해도 즉시 반영.
  //   회귀 방어: clientKey 가 비어있으면 TossPaymentWidget 자체를 렌더 안 함 (race condition 차단).
  //   SDK preload 는 그대로 유지 (toss-preload.ts 가 VITE env 로 미리 로드 — 서버 키와 같으면 cache hit).
  // 🛡️ 2026-05-23 v3 (race condition 영구 fix): server 응답 받기 전엔 PaymentSection 렌더 X.
  //   v2 버그: VITE 키로 즉시 mount → server key 도착 → key prop 변경 → useEffect cleanup →
  //   hasInitialized.current==true 라 재초기화 안 됨 → 영원히 loading.
  //   v3: clientKeyLoaded 초기 false 강제 → server fetch 끝나고 한 번만 mount.
  const [serverClientKey, setServerClientKey] = useState<string>('')
  const [clientKeyLoaded, setClientKeyLoaded] = useState<boolean>(false)
  useEffect(() => {
    api.get('/api/payments/client-key')
      .then(r => {
        const key = r.data?.data?.clientKey || r.data?.clientKey
        if (key && typeof key === 'string') {
          setServerClientKey(key)
        } else if (clientKey) {
          setServerClientKey(clientKey)
        }
        setClientKeyLoaded(true)
      })
      .catch((err) => {
        if (import.meta.env.DEV) console.warn('[Checkout] server clientKey 로드 실패, env fallback:', err)
        if (clientKey) setServerClientKey(clientKey)
        setClientKeyLoaded(true)
      })
  }, [])

  useEffect(() => {
    api.get('/api/points/balance')
      .then(r => { if (r.data.success) setDealBalance(r.data.data.balance) })
      .catch(err => { if (import.meta.env.DEV) console.warn('[Checkout] 딜 잔액 로드 실패:', err) })
    api.get('/api/coupons/my')
      .then(r => {
        if (r.data.success && r.data.data?.length > 0) {
          const best = r.data.data.reduce((a: Record<string, unknown>, b: Record<string, unknown>) =>
            ((a.value as number) || 0) > ((b.value as number) || 0) ? a : b
          )
          if (best) {
            setCouponCode(best.code as string)
            setCouponId(best.id as number)
            setAutoCoupon({
              type: best.type as string,
              value: best.value as number,
              max_discount: best.max_discount as number || 0,
            })
          }
        }
      })
      .catch(err => { if (import.meta.env.DEV) console.warn('[Checkout] 쿠폰 로드 실패:', err) })
  }, [])

  // Recalculate auto-applied coupon discount when cart items load
  useEffect(() => {
    if (!autoCoupon || cartItems.length === 0) return
    const currentSubtotal = cartItems.reduce((sum, item) => sum + (item.price_snapshot ?? item.price ?? 0) * item.quantity, 0)
    if (currentSubtotal <= 0) return
    const discount = autoCoupon.type === 'percent'
      ? Math.round(currentSubtotal * autoCoupon.value / 100)
      : autoCoupon.value
    setCouponDiscount(Math.min(discount, autoCoupon.max_discount || discount))
  }, [autoCoupon, cartItems])

  // 셀러별 장바구니 그룹화 및 배송비 계산
  const sellerGroups = cartItems.reduce((groups, item) => {
    const sellerId = Number(item.seller_id) || 0
    if (!groups[sellerId]) {
      groups[sellerId] = {
        seller_id: sellerId,
        seller_name: item.seller_name || t('checkoutPage.fallbackSeller'),
        items: [],
        subtotal: 0,
        shipping_fee: item.shipping_fee || 3000,
        free_shipping_threshold: item.free_shipping_threshold || 0,
      }
    }
    groups[sellerId].items.push(item)
    groups[sellerId].subtotal += (item.price_snapshot ?? item.price ?? 0) * item.quantity
    return groups
  }, {} as Record<number, SellerGroup>)

  // 소계 및 배송비 계산
  const subtotal = cartItems.reduce((sum, item) => sum + (item.price_snapshot ?? item.price ?? 0) * item.quantity, 0)
  const totalShippingFee = Object.values(sellerGroups).reduce((total, group) => {
    // 🛡️ 2026-05-19 (사용자 신고: 교환권 배송비 치명적 버그):
    //   KT Alpha 교환권 (deal_only=1) 은 휴대폰 MMS 발송이라 배송비 불요.
    //   그룹의 모든 item 이 deal_only=1 이면 shipping_fee 무시.
    const allVoucher = group.items.length > 0 && group.items.every(i => Number((i as { deal_only?: number }).deal_only) === 1)
    if (allVoucher) return total
    if (group.free_shipping_threshold > 0 && group.subtotal >= group.free_shipping_threshold) return total
    return total + group.shipping_fee
  }, 0)

  // 🛡️ 2026-05-21: 교환권만 담긴 주문 — 토스 결제 옵션 자체 숨김 + 'deal' 강제 + dealToUse 자동 채움.
  const isAllDealOnly = cartItems.length > 0
    && cartItems.every(i => Number((i as { deal_only?: number }).deal_only) === 1)

  // 공동구매 할인 계산
  const totalGroupBuyDiscount = cartItems.reduce((sum, item) => {
    const pid = Number(item.product_id)
    const discount = groupBuyDiscounts[pid]
    if (!discount || !discount.percent) return sum
    const itemPrice = item.price_snapshot ?? item.price ?? 0
    return sum + Math.floor(itemPrice * item.quantity * discount.percent / 100)
  }, 0)

  const totalBeforeDeal = subtotal + totalShippingFee - couponDiscount - totalGroupBuyDiscount
  const totalAmount = totalBeforeDeal - dealToUse

  // 🛡️ 2026-05-21: 교환권만 담겼으면 paymentMethod='deal' 강제 + dealToUse 자동 풀충전.
  //   잔액 부족하면 충전 CTA 가 PaymentSection 에서 별도 노출.
  useEffect(() => {
    if (!isAllDealOnly) return
    if (paymentMethod !== 'deal') setPaymentMethod('deal')
    const needed = Math.min(dealBalance, totalBeforeDeal)
    if (needed > 0 && dealToUse !== needed) setDealToUse(needed)
  }, [isAllDealOnly, paymentMethod, dealBalance, totalBeforeDeal, dealToUse])

  useEffect(() => { document.title = t('checkoutPage.docTitle') }, [t])

  // v36 FIX: 결제 진행 중 페이지 이탈 경고 (isSubmittingRef는 useBeforePayment 훅에서 반환)
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isSubmittingRef.current) {
        e.preventDefault()
        e.returnValue = t('payment.errors.leaveConfirm')
        return e.returnValue
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [])

  // 공동구매 할인 조회 (cartItems 로드 후)
  useEffect(() => {
    if (cartItems.length === 0) return
    const uniqueProductIds = Array.from(new Set(cartItems.map(item => Number(item.product_id)).filter(Boolean)))
    if (uniqueProductIds.length === 0) return
    Promise.allSettled(
      uniqueProductIds.map(pid =>
        api.get(`/api/referral/discount/${pid}`)
          .then(r => {
            if (r.data?.success && r.data.data?.discount_percent > 0) {
              return { pid, percent: r.data.data.discount_percent, tier: r.data.data.unlocked_tier }
            }
            return null
          })
      )
    ).then(results => {
      const map: Record<number, { percent: number; tier: GroupBuyTier | null }> = {}
      results.forEach(r => {
        if (r.status === 'fulfilled' && r.value) map[r.value.pid] = { percent: r.value.percent, tier: r.value.tier }
      })
      setGroupBuyDiscounts(map)
    })
  }, [cartItems])

  // ✅ BUG #18 FIX: URL 파라미터 정리 (레거시 토큰 제거)
  useEffect(() => {
    const paramsToClean = ['access_token', 'refresh_token', 'userId', 'userEmail', 'firebase_token', 'userName', 'login', 'session']
    if (paramsToClean.some(param => searchParams.has(param))) {
      if (import.meta.env.DEV) console.warn('[CheckoutPage] 🧹 URL 파라미터 정리 중...')
      window.history.replaceState({}, '', window.location.pathname)
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
    }
    setUrlParamsProcessed(true)
  }, [searchParams])

  // 초기 데이터 로드
  useEffect(() => {
    if (!urlParamsProcessed) return
    const uid = getUserIdSync()
    if (!uid) {
      captureError(new Error('CheckoutPage: userId 없음'), { context: 'CheckoutPage.loadData' })
      setError(t('payment.errors.invalidUser'))
      setLoading(false)
      return
    }
    setUserId(uid)

    const fromCart = (location.state as { fromCart?: boolean } | null)?.fromCart
    const cartItemsFromState = (location.state as { cartItems?: CartItem[] } | null)?.cartItems

    const loadData = async () => {
      try {
        if (fromCart && Array.isArray(cartItemsFromState) && cartItemsFromState.length > 0) {
          setCartItems(cartItemsFromState)
        } else if (isDirectPurchase && directPurchaseItems) {
          setCartItems(directPurchaseItems)
        } else {
          const cartResponse = await api.get('/api/cart')
          let cartItemsData: CartItem[] = []
          if (cartResponse.data?.success) {
            const resData = cartResponse.data.data
            if (resData?.items && Array.isArray(resData.items)) cartItemsData = resData.items
            else if (Array.isArray(resData)) cartItemsData = resData
          } else if (Array.isArray(cartResponse.data)) {
            cartItemsData = cartResponse.data
          }
          if (cartItemsData.length > 0) setCartItems(cartItemsData)
          else setError(t('payment.errors.emptyCart'))
        }
      } catch (err) {
        if (import.meta.env.DEV) console.error('[CheckoutPage] ❌ API 에러:', err)
        captureError(err as Error, { context: 'CheckoutPage.loadData', userId: uid })
        handleApiError(err)
        setError(t('payment.errors.loadDataFailed'))
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [navigate, urlParamsProcessed])

  // 식사권 여부 확인
  const isMealVoucher = cartItems.some(item => (item as CartItem & { category?: string }).category === 'meal_voucher')

  // 결제 전 주문 생성 훅 (TD-018 final pass 분리)
  const { handleBeforePayment, isSubmittingRef } = useBeforePayment({
    isMealVoucher,
    isDirectPurchase,
    selectedAddress,
    sellerGroups,
    groupBuyDiscounts,
    couponId,
    couponDiscount,
    totalGroupBuyDiscount,
    dealToUse,
  })

  const handlePayWithDeals = async () => {
    // 🛡️ 2026-05-21: 교환권만 담긴 주문은 휴대폰 MMS 발송 — 배송지 불필요.
    //   백엔드 KT Alpha 자동 발송이 users.phone 으로 직접 발송. 클라이언트 주소 입력 skip.
    if (!isAllDealOnly && !selectedAddress) { toast.error(t('common.addressRequired')); return }
    setPayingWithDeals(true)
    try {
      const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
      if (isDirectPurchase) sessionStorage.setItem('directPurchase', 'true')
      const shippingPayload = isAllDealOnly
        ? { name: '', phone: '', postal_code: '', address1: '교환권 — 휴대폰 MMS 발송', address2: '' }
        : {
            name: selectedAddress!.recipient_name, phone: selectedAddress!.phone,
            postal_code: selectedAddress!.postal_code, address1: selectedAddress!.address,
            address2: selectedAddress!.address_detail || '',
          }
      const res = await api.post('/api/points/pay', {
        order_number: orderNumber, total_amount: totalAmount,
        items: cartItems.map(item => ({
          product_id: String(item.product_id), product_name: item.product_name || t('checkoutPage.fallbackProduct'),
          quantity: item.quantity, price: item.price_snapshot ?? item.price ?? 0,
          seller_id: item.seller_id ? String(item.seller_id) : undefined,
        })),
        shipping: shippingPayload,
      })
      if (res.data.success) {
        if (couponId && couponDiscount > 0) {
          api.post('/api/coupons/use', { coupon_id: couponId, order_id: res.data.data?.order_id || 0, discount_amount: couponDiscount })
            .catch(() => { toast.error(t('common.couponApplyFailed')) })
        }
        navigate(`/payment/success?orderId=${orderNumber}&method=deal&amount=${totalAmount}`)
      } else {
        toast.error(res.data.error || t('payment.errors.paymentFailed'))
      }
    } catch (err: unknown) {
      toast.error(getUserFriendlyError(err, t('payment.errors.dealPaymentFailed')))
    } finally { setPayingWithDeals(false) }
  }

  // ✅ BUG #3 FIX: Auth/loading guards (all hooks called above this line)
  const isSessionUser = localStorage.getItem('user_type') === 'user' && localStorage.getItem('user_id')
  if (!isSessionUser && (!isAuthReady || authLoading))
    return <div className="min-h-screen bg-[#fbfbfd] flex items-center justify-center"><div className="text-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#ff6b35] mx-auto mb-4" /><p className="text-gray-400 dark:text-gray-500">{t('common.loading', { defaultValue: '로딩 중...' })}</p></div></div>
  if (!user && !isSessionUser) return null
  if (loading || tokenRefreshing)
    return <div className="flex items-center justify-center min-h-screen"><div className="text-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" /><p className="mt-4 text-gray-400 dark:text-gray-500">{tokenRefreshing ? t('payment.errors.securityAuthInProgress') : t('payment.errors.loading')}</p></div></div>
  if (error) return (
    <div className="w-full p-4 sm:p-6">
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-lg p-4">
        <div className="flex items-center gap-2"><AlertCircle className="w-5 h-5 text-red-600" /><p className="text-red-800">{error}</p></div>
        <div className="flex gap-2 mt-4">
          <button onClick={() => window.location.reload()} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg">{t('common.retry', { defaultValue: '다시 시도' })}</button>
          <Button onClick={() => navigate('/cart', { replace: true })} variant="outline">{t('checkout.backToCart', { defaultValue: '장바구니로 돌아가기' })}</Button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#f4f4f4] overflow-x-hidden">
      <SEO title={t('checkoutPage.seoTitle')} description={t('checkoutPage.seoDesc')} url="/checkout" noindex />
      {/* 🛡️ 2026-05-21: 뒤로가기 무한 루프 영구 fix.
            기존: navigate('/cart') → new history entry → [prev, /cart, /checkout, /cart].
            결과: /cart 에서 뒤로 → /checkout (사용자 의도와 반대).
            영구: navigate(-1) → browser back → history stack 안 늘어남.
            예외: 첫 진입 (history.length<=1) 이면 /cart 로 명시 (외부 링크 진입 대응). */}
      <CheckoutHeader onBack={() => {
        if (window.history.length > 1) navigate(-1)
        else navigate('/cart', { replace: true })
      }} />

      <main className="ur-content-narrow pb-52" style={{ background: '#F4F4F4' }}>
        {/* 🛡️ 2026-05-21: cartItems 로드 전엔 결제 섹션 자체 렌더 금지 — race condition 영구 fix.
              로딩 도중 paymentMethod 가 'toss' 기본값이면 일반 상품 흐름으로 잠깐 보였다가
              isAllDealOnly 로 전환되며 깜빡임 발생. 로딩 중엔 빈 화면 + 스피너만 노출. */}
        {cartItems.length === 0 ? (
          <div className="flex items-center justify-center py-24">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : (
          <div className="flex flex-col">
            <div className="flex flex-1 flex-col lg:rounded-3xl">
              {/* 🛡️ 2026-05-21: 교환권만 담긴 주문 — 배송지/쿠폰 섹션 숨김.
                    KT Alpha 자동 발송이 users.phone 으로 직접 처리 → 사용자 주소 입력 불요.
                    쿠폰도 deal_only 상품엔 적용 안 됨 (백엔드 차단). */}
              {!isAllDealOnly && (
                <>
                  <CheckoutAddressSection
                    userId={userId}
                    navigateToLogin={() => navigate('/login')}
                    selectedAddress={selectedAddress}
                    onAddressSelected={setSelectedAddress}
                  />
                  <div className="h-[6px] bg-gray-100 dark:bg-[#1A1A1A]" />
                </>
              )}

              {isAllDealOnly && (
                <section className="bg-white dark:bg-[#0A0A0A] px-5 py-4">
                  <h2 className="text-[15px] font-bold text-gray-900 dark:text-white mb-3">발송 방법</h2>
                  <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-900/10 p-3 flex items-start gap-3">
                    <span className="text-2xl shrink-0">📱</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-bold text-emerald-700 dark:text-emerald-300">휴대폰 MMS 즉시 발송</p>
                      <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 leading-relaxed">
                        결제 완료 즉시 가입하신 휴대폰 번호로 교환권이 발송됩니다. 배송지 입력은 필요 없습니다.
                      </p>
                    </div>
                  </div>
                </section>
              )}

              {/* 주문 상품 정보 */}
              <OrderItemsList sellerGroups={sellerGroups} totalItemCount={cartItems.length} />

              {/* 쿠폰 — 교환권 전용은 적용 불가 */}
              {!isAllDealOnly && (
                <CheckoutCouponSection
                  couponCode={couponCode}
                  setCouponCode={setCouponCode}
                  couponDiscount={couponDiscount}
                  totalAmount={totalAmount}
                  onApplied={(discount, id) => { setCouponDiscount(discount); setCouponId(id) }}
                />
              )}

              <div className="h-[6px] bg-gray-100 dark:bg-[#1A1A1A]" />

              {/* 결제 수단 — 교환권만 담겼으면 토스 옵션 숨김 (강제 'deal').
                  🛡️ 2026-05-23 v2: clientKey 로드 끝나기 전엔 스피너만 — TossPaymentWidget 이
                  빈/잘못된 키로 init 시도해 에러 토스트 띄우는 회귀 영구 차단. */}
              {!isAllDealOnly && !clientKeyLoaded ? (
                <section className="bg-white dark:bg-[#0A0A0A] px-5 py-8 flex items-center justify-center">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
                  <span className="ml-3 text-sm text-gray-500">결제 시스템 준비 중...</span>
                </section>
              ) : (
              <PaymentSection
                paymentMethod={paymentMethod}
                setPaymentMethod={setPaymentMethod}
                dealOnly={isAllDealOnly}
                dealBalance={dealBalance}
                dealToUse={dealToUse}
                setDealToUse={setDealToUse}
                totalBeforeDeal={totalBeforeDeal}
                totalAmount={totalAmount}
                payingWithDeals={payingWithDeals}
                onPayWithDeals={handlePayWithDeals}
                userId={userId || ''}
                cartItems={cartItems}
                totalShippingFee={totalShippingFee}
                clientKey={serverClientKey}
                selectedAddressOk={isAllDealOnly || !!selectedAddress}
                onBeforePayment={handleBeforePayment}
                onTossPaymentSuccess={(orderId, paymentKey, amount) => {
                  navigate(`/payment/success?orderId=${orderId}&paymentKey=${paymentKey}&amount=${amount}`)
                }}
                onStripePaymentSuccess={(orderId, paymentIntentId, amount) => {
                  navigate(`/payment/success?orderId=${orderId}&paymentIntentId=${paymentIntentId}&amount=${amount}`)
                }}
              />
              )}
            </div>
          </div>
        )}

        {/* 결제 예정금액 요약 — 교환권은 배송비/쿠폰 제거된 단순 요약 */}
        {cartItems.length > 0 && (
          <CheckoutOrderSummary
            subtotal={subtotal}
            totalShippingFee={isAllDealOnly ? 0 : totalShippingFee}
            couponDiscount={isAllDealOnly ? 0 : couponDiscount}
            totalGroupBuyDiscount={totalGroupBuyDiscount}
            dealToUse={dealToUse}
            totalAmount={totalAmount}
          />
        )}
      </main>
    </div>
  )
}
