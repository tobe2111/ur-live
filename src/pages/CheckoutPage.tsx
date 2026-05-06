import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import SEO from '@/components/SEO'
import api from '@/lib/api'
import { handleApiError, getUserFriendlyError } from '@/lib/errorHandler'
import { Button } from '@/components/ui/button'
import { AlertCircle } from 'lucide-react'
import { getUserIdSync } from '@/utils/auth'
// ✅ Zustand 직접 사용
import { useAuthKR } from '@/shared/stores/useAuthKR'
import { useAuthWorld } from '@/shared/stores/useAuthWorld'
import { isKorea } from '@/config/region'
import { captureError } from '@/lib/sentry'
import { toast } from '@/hooks/useToast'
// 🛡️ 2026-05-01: TD-018 점진 분할 — sub-components.
import CheckoutHeader from './checkout/CheckoutHeader'
import OrderItemsList from './checkout/OrderItemsList'
import CheckoutCouponSection from './checkout/CheckoutCouponSection'
import CheckoutOrderSummary from './checkout/CheckoutOrderSummary'
import PaymentSection from './checkout/PaymentSection'
// TD-018 final pass: 배송지 복합 컴포넌트 (ShippingSection + modals)
import CheckoutAddressSection from './checkout/CheckoutAddressSection'
import { useBeforePayment } from './checkout/useBeforePayment'

// TossPaymentWidget / StripeCheckout 은 ./checkout/PaymentSection 내부에서 lazy 마운트.

// 토스 SDK 프리로드 — 체크아웃 진입 전에 로드 시작
if (typeof window !== 'undefined') {
  import('@tosspayments/tosspayments-sdk').catch((_e) => { if (import.meta.env.DEV) console.warn(_e) })
}

const clientKey = import.meta.env.VITE_TOSS_CLIENT_KEY

import { CartItem } from '@/types/cart'
import { formatNumber } from '@/utils/format'
import type { ShippingAddress } from './checkout/types'

interface GroupBuyTier {
  count: number
  discount: number
}

export default function CheckoutPage() {
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
  }, {} as Record<number, {
    seller_id: number
    seller_name: string
    items: CartItem[]
    subtotal: number
    shipping_fee: number
    free_shipping_threshold: number
  }>)

  // 소계 및 배송비 계산
  const subtotal = cartItems.reduce((sum, item) => sum + (item.price_snapshot ?? item.price ?? 0) * item.quantity, 0)
  const totalShippingFee = Object.values(sellerGroups).reduce((total, group) => {
    if (group.free_shipping_threshold > 0 && group.subtotal >= group.free_shipping_threshold) return total
    return total + group.shipping_fee
  }, 0)

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

  useEffect(() => { document.title = t('checkoutPage.docTitle') }, [t])

  // v36 FIX: 결제 진행 중 페이지 이탈 경고
  const isSubmittingRef = useRef(false)
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
    Promise.all(
      uniqueProductIds.map(pid =>
        api.get(`/api/referral/discount/${pid}`)
          .then(r => {
            if (r.data?.success && r.data.data?.discount_percent > 0) {
              return { pid, percent: r.data.data.discount_percent, tier: r.data.data.unlocked_tier }
            }
            return null
          })
          .catch(() => null)
      )
    ).then(results => {
      const map: Record<number, { percent: number; tier: GroupBuyTier | null }> = {}
      results.forEach(r => { if (r) map[r.pid] = { percent: r.percent, tier: r.tier } })
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

    // Daum Postcode SDK (CheckoutAddressSection 에서도 사용)
    const DAUM_SRC = '//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js'
    const existingScript = document.querySelector(`script[src="${DAUM_SRC}"]`)
    let script: HTMLScriptElement | null = null
    if (!existingScript) {
      script = document.createElement('script')
      script.src = DAUM_SRC
      script.async = true
      document.head.appendChild(script)
    }
    return () => { if (script && document.head.contains(script)) document.head.removeChild(script) }
  }, [navigate, urlParamsProcessed])

  // 식사권 여부 확인
  const isMealVoucher = cartItems.some(item => (item as CartItem & { category?: string }).category === 'meal_voucher')

  const handlePayWithDeals = async () => {
    if (!selectedAddress) { toast.error(t('common.addressRequired')); return }
    setPayingWithDeals(true)
    try {
      const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
      if (isDirectPurchase) sessionStorage.setItem('directPurchase', 'true')
      const res = await api.post('/api/points/pay', {
        order_number: orderNumber, total_amount: totalAmount,
        items: cartItems.map(item => ({
          product_id: String(item.product_id), product_name: item.product_name || t('checkoutPage.fallbackProduct'),
          quantity: item.quantity, price: item.price_snapshot ?? item.price ?? 0,
          seller_id: item.seller_id ? String(item.seller_id) : undefined,
        })),
        shipping: {
          name: selectedAddress.recipient_name, phone: selectedAddress.phone,
          postal_code: selectedAddress.postal_code, address1: selectedAddress.address,
          address2: selectedAddress.address_detail || '',
        },
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

  const handleBeforePayment = async (orderId: string): Promise<void> => {
    if (isSubmittingRef.current) throw new Error(t('payment.errors.paymentInProgress'))
    isSubmittingRef.current = true
    try {
      if (!isMealVoucher && !selectedAddress) {
        throw new Error(t('payment.errors.selectAddress'))
      }
      if (isDirectPurchase) sessionStorage.setItem('directPurchase', 'true')
      else sessionStorage.removeItem('directPurchase')

      const shippingAddress = isMealVoucher ? {
        postal_code: '00000',
        address1: t('checkoutPage.voucherAddress'),
        address2: '',
        country: 'KR',
        recipient_name: t('checkoutPage.voucherRecipient'),
      } : {
        postal_code: selectedAddress!.postal_code,
        address1: selectedAddress!.address,
        address2: selectedAddress!.address_detail || '',
        country: 'KR',
        recipient_name: selectedAddress!.recipient_name,
      }

      for (const group of Object.values(sellerGroups)) {
        const groupShippingFee = (group.free_shipping_threshold > 0 && group.subtotal >= group.free_shipping_threshold)
          ? 0
          : group.shipping_fee
        addBreadcrumb('order', 'creating', { orderId, sellerId: group.seller_id, itemCount: group.items.length, total: group.subtotal + groupShippingFee })
        const response = await api.post('/api/orders', {
          seller_id: group.seller_id ? String(group.seller_id) : '',
          order_number: orderId,
          items: group.items.map(item => ({
            product_id: String(item.product_id),
            quantity: item.quantity,
            ...(item.option_value ? { options: { value: item.option_value } } : {}),
          })),
          shipping_address: shippingAddress,
          shipping_name: isMealVoucher ? t('checkoutPage.voucherRecipient') : selectedAddress!.recipient_name,
          shipping_phone: isMealVoucher ? '' : selectedAddress!.phone,
          shipping_fee: groupShippingFee,
          idempotency_key: `${orderId}_${group.seller_id}`,
          referrer_id: (() => {
            const ref = localStorage.getItem('affiliate_ref')
            const expires = localStorage.getItem('affiliate_ref_expires')
            if (ref && expires && Date.now() < Number(expires)) return ref
            const cookie = document.cookie.match(/affiliate_ref=([^;]+)/)
            return cookie?.[1] || undefined
          })(),
          group_buy_discounts: groupBuyDiscounts,
          coupon_id: couponId || undefined,
          coupon_discount: couponDiscount || undefined,
          discount_amount: (couponDiscount || 0) + (totalGroupBuyDiscount || 0) + (dealToUse || 0),
          deal_used: dealToUse || undefined,
        })
        if (!response.data.success) throw new Error(response.data.error || t('payment.errors.orderCreateFailed'))
        if (couponId && couponDiscount > 0 && response.data.data?.order_id) {
          try {
            await api.post('/api/coupons/use', { coupon_id: couponId, order_id: response.data.data.order_id, discount_amount: couponDiscount })
          } catch (couponErr) {
            captureError(couponErr as Error, { context: 'CheckoutPage.couponUse', couponId })
          }
        }
      }
    } finally {
      isSubmittingRef.current = false
    }
  }

  // ✅ BUG #3 FIX: Auth-guard and loading checks rendered here (after all hooks)
  const isSessionUser = localStorage.getItem('user_type') === 'user' && localStorage.getItem('user_id')
  if (!isSessionUser && (!isAuthReady || authLoading)) {
    return (
      <div className="min-h-screen bg-[#fbfbfd] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#ff6b35] mx-auto mb-4"></div>
          <p className="text-gray-400 dark:text-gray-500">로딩 중...</p>
        </div>
      </div>
    )
  }

  if (!user && !isSessionUser) return null

  if (loading || tokenRefreshing) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-400 dark:text-gray-500">
            {tokenRefreshing ? t('payment.errors.securityAuthInProgress') : t('payment.errors.loading')}
          </p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="w-full p-4 sm:p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <p className="text-red-800">{error}</p>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={() => window.location.reload()} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg">다시 시도</button>
            <Button onClick={() => navigate('/cart')} variant="outline">장바구니로 돌아가기</Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f4f4f4]">
      <SEO title={t('checkoutPage.seoTitle')} description={t('checkoutPage.seoDesc')} url="/checkout" noindex />
      <CheckoutHeader onBack={() => navigate('/cart')} />

      <main className="ur-content-narrow pb-52" style={{ background: '#F4F4F4' }}>
        <div className="flex flex-col">
          <div className="flex flex-1 flex-col lg:rounded-3xl">
            {/* 배송지 + 모달 (TD-018 final pass 추출) */}
            <CheckoutAddressSection
              userId={userId}
              navigateToLogin={() => navigate('/login')}
              selectedAddress={selectedAddress}
              onAddressSelected={setSelectedAddress}
            />

            <div className="h-[6px] bg-gray-100 dark:bg-[#1A1A1A]" />

            {/* 주문 상품 정보 */}
            <OrderItemsList sellerGroups={sellerGroups} totalItemCount={cartItems.length} />

            {/* 쿠폰 적용 */}
            <CheckoutCouponSection
              couponCode={couponCode}
              setCouponCode={setCouponCode}
              couponDiscount={couponDiscount}
              totalAmount={totalAmount}
              onApplied={(discount, id) => { setCouponDiscount(discount); setCouponId(id) }}
            />

            <div className="h-[6px] bg-gray-100 dark:bg-[#1A1A1A]" />

            {/* 결제 수단 */}
            <PaymentSection
              paymentMethod={paymentMethod}
              setPaymentMethod={setPaymentMethod}
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
              clientKey={clientKey}
              selectedAddressOk={!!selectedAddress}
              onBeforePayment={handleBeforePayment}
              onTossPaymentSuccess={(orderId, paymentKey, amount) => {
                navigate(`/payment/success?orderId=${orderId}&paymentKey=${paymentKey}&amount=${amount}`)
              }}
              onStripePaymentSuccess={(orderId, paymentIntentId, amount) => {
                navigate(`/payment/success?orderId=${orderId}&paymentIntentId=${paymentIntentId}&amount=${amount}`)
              }}
            />
          </div>
        </div>

        {/* 결제 예정금액 요약 */}
        <CheckoutOrderSummary
          subtotal={subtotal}
          totalShippingFee={totalShippingFee}
          couponDiscount={couponDiscount}
          totalGroupBuyDiscount={totalGroupBuyDiscount}
          dealToUse={dealToUse}
          totalAmount={totalAmount}
        />
      </main>
    </div>
  )
}
