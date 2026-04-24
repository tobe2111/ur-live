import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import SEO from '@/components/SEO'
import api from '@/lib/api'
import { handleApiError } from '@/lib/errorHandler'
import { Button } from '@/components/ui/button'
import { ArrowLeft, AlertCircle } from 'lucide-react'
import { getUserIdSync } from '@/utils/auth'
import { useAuthKR } from '@/shared/stores/useAuthKR'
import { useAuthWorld } from '@/shared/stores/useAuthWorld'
import { isKorea } from '@/config/region'
import { captureError, addBreadcrumb } from '@/lib/sentry'
import { toast } from '@/hooks/useToast'
import { CartItem } from '@/types/cart'

import { ShippingAddress, GroupBuyTier, NewAddressForm } from '@/components/checkout/checkout-types'
import {
  buildSellerGroups,
  calcTotalShippingFee,
  calcTotalGroupBuyDiscount,
  calcGroupShippingFee,
  getAffiliateRef,
} from '@/components/checkout/checkout-helpers'
import { SelectedAddressDisplay, AddressSelectModal, NewAddressFormModal } from '@/components/checkout/AddressSection'
import { OrderItemsSection } from '@/components/checkout/OrderItemsSection'
import { CouponSection } from '@/components/checkout/CouponSection'
import { PaymentSection } from '@/components/checkout/PaymentSection'
import { OrderSummarySection } from '@/components/checkout/OrderSummarySection'

// 토스 SDK 프리로드 — 체크아웃 진입 전에 로드 시작
if (typeof window !== 'undefined') {
  import('@tosspayments/tosspayments-sdk').catch((_e) => { if (import.meta.env.DEV) console.warn(_e) })
}

declare global {
  interface Window {
    daum: { Postcode: new (options: Record<string, unknown>) => { embed: (el: HTMLElement | null) => void; open: () => void } }
  }
}

export default function CheckoutPage() {
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

  // 바로구매 모드: navigate state로 전달된 상품만 결제
  const directPurchaseItems = (location.state as { directPurchase?: CartItem[] } | null)?.directPurchase
  const isDirectPurchase = !!directPurchaseItems?.length
  const [tokenRefreshing] = useState(false)

  // 결제 수단 선택
  const [couponCode, setCouponCode] = useState('')
  const [couponDiscount, setCouponDiscount] = useState(0)
  const [couponId, setCouponId] = useState<number | null>(null)
  const [autoCoupon, setAutoCoupon] = useState<{ type: string; value: number; max_discount: number } | null>(null)
  const [dealBalance, setDealBalance] = useState(0)
  const [dealToUse, setDealToUse] = useState(0)
  const [groupBuyDiscounts, setGroupBuyDiscounts] = useState<Record<number, { percent: number; tier: GroupBuyTier | null }>>({})

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
              max_discount: (best.max_discount as number) || 0,
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

  // 배송지 관련 상태
  const [addresses, setAddresses] = useState<ShippingAddress[]>([])
  const [selectedAddress, setSelectedAddress] = useState<ShippingAddress | null>(null)
  const [showAddressModal, setShowAddressModal] = useState(false)
  const [showNewAddressForm, setShowNewAddressForm] = useState(false)
  const [showPostcodePopup, setShowPostcodePopup] = useState(false)

  // 새 배송지 입력 폼
  const [newAddress, setNewAddress] = useState<NewAddressForm>({
    recipient_name: '',
    phone: '',
    postal_code: '',
    address: '',
    address_detail: '',
    is_default: 0
  })

  // ✅ BUG #3 FIX: All hooks must be called unconditionally before any early return.

  // 셀러별 장바구니 그룹화 및 배송비 계산
  const sellerGroups = buildSellerGroups(cartItems)

  // 소계 및 배송비 계산
  const subtotal = cartItems.reduce((sum, item) => sum + (item.price_snapshot ?? item.price ?? 0) * item.quantity, 0)
  const totalShippingFee = calcTotalShippingFee(sellerGroups)
  const totalGroupBuyDiscount = calcTotalGroupBuyDiscount(cartItems, groupBuyDiscounts)

  const totalBeforeDeal = subtotal + totalShippingFee - couponDiscount - totalGroupBuyDiscount
  const totalAmount = totalBeforeDeal - dealToUse

  useEffect(() => { document.title = '주문/결제 - 유어딜' }, [])

  // v36 FIX: 결제 진행 중 페이지 이탈(새로고침/탭 닫기/뒤로가기) 경고
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isSubmittingRef.current) {
        e.preventDefault()
        e.returnValue = '결제가 진행 중입니다. 페이지를 벗어나시겠습니까?'
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
      results.forEach(r => {
        if (r) map[r.pid] = { percent: r.percent, tier: r.tier }
      })
      setGroupBuyDiscounts(map)
    })
  }, [cartItems])

  // ✅ BUG #18 FIX: 단일 URL 파라미터 정리 effect
  useEffect(() => {
    const paramsToClean = ['access_token', 'refresh_token', 'userId', 'userEmail', 'firebase_token', 'userName', 'login', 'session']

    if (paramsToClean.some(param => searchParams.has(param))) {
      if (import.meta.env.DEV) console.warn('[CheckoutPage] 🧹 URL 파라미터 정리 중...', {
        params: Array.from(searchParams.keys())
      })
      window.history.replaceState({}, '', window.location.pathname)
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
    }

    setUrlParamsProcessed(true)
  }, [searchParams])

  // 🔐 Step 0: 인증 확인 로그만
  useEffect(() => {
    if (!isAuthReady) return
    if (user) {
      // 인증 완료
    }
  }, [isAuthReady, user])

  // 초기 데이터 로드
  useEffect(() => {
    if (!urlParamsProcessed) return

    const uid = getUserIdSync()

    if (!uid) {
      captureError(new Error('CheckoutPage: userId 없음'), { context: 'CheckoutPage.loadData' })
      setError('사용자 정보를 확인할 수 없습니다.')
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
            if (resData?.items && Array.isArray(resData.items)) {
              cartItemsData = resData.items
            } else if (Array.isArray(resData)) {
              cartItemsData = resData
            }
          } else if (Array.isArray(cartResponse.data)) {
            cartItemsData = cartResponse.data
          }

          if (cartItemsData.length > 0) {
            setCartItems(cartItemsData)
          } else {
            setError('장바구니가 비어있습니다.')
          }
        }

        const addressResponse = await api.get('/api/shipping-addresses')
        if (addressResponse.data.success) {
          const addressList = addressResponse.data.data
          setAddresses(addressList)

          const defaultAddr = addressList.find((addr: ShippingAddress) => addr.is_default === 1)
          if (defaultAddr) {
            setSelectedAddress(defaultAddr)
          }
        }
      } catch (err) {
        if (import.meta.env.DEV) console.error('[CheckoutPage] ❌ API 에러:', err)
        captureError(err as Error, { context: 'CheckoutPage.loadData', userId: uid })
        handleApiError(err)
        setError('데이터를 불러올 수 없습니다.')
      } finally {
        setLoading(false)
      }
    }

    loadData()

    // ✅ BUG #14 FIX: Daum postcode script 중복 방지
    const DAUM_SRC = '//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js'
    const existingScript = document.querySelector(`script[src="${DAUM_SRC}"]`)
    let script: HTMLScriptElement | null = null
    if (!existingScript) {
      script = document.createElement('script')
      script.src = DAUM_SRC
      script.async = true
      document.head.appendChild(script)
    }
    return () => {
      if (script && document.head.contains(script)) {
        document.head.removeChild(script)
      }
    }
  }, [navigate, urlParamsProcessed])

  // 배송지 저장
  const handleSaveNewAddress = async () => {
    if (!userId) {
      toast.info('로그인이 필요합니다.')
      localStorage.setItem('loginReturnUrl', window.location.pathname)
      navigate('/login')
      return
    }

    if (!newAddress.recipient_name || !newAddress.phone || !newAddress.postal_code || !newAddress.address) {
      toast.error('모든 필수 항목을 입력해주세요.')
      return
    }

    const phoneClean = newAddress.phone.replace(/[^0-9]/g, '')
    if (phoneClean.length < 10 || phoneClean.length > 11) {
      toast.error('올바른 전화번호를 입력해주세요.')
      return
    }

    try {
      const isFirstAddress = addresses.length === 0
      const addressData = {
        user_id: userId,
        ...newAddress,
        is_default: isFirstAddress ? 1 : 0
      }

      const response = await api.post('/api/shipping-addresses', addressData)

      if (response.data.success) {
        const newId = response.data.data.id
        const savedAddress = { ...newAddress, id: newId }

        setAddresses([...addresses, savedAddress as ShippingAddress])
        setSelectedAddress(savedAddress as ShippingAddress)
        setShowNewAddressForm(false)
        setShowAddressModal(false)
        setShowPostcodePopup(false)

        setNewAddress({
          recipient_name: '',
          phone: '',
          postal_code: '',
          address: '',
          address_detail: '',
          is_default: 0
        })
      }
    } catch (err) {
      if (import.meta.env.DEV) console.error('[CheckoutPage] ❌ 배송지 저장 실패:', err)
      handleApiError(err)
    }
  }

  // 식사권 여부 확인
  const isMealVoucher = cartItems.some(item => (item as CartItem & { category?: string }).category === 'meal_voucher')

  // ✅ UX H7 FIX: 더블 서브밋 방지 ref 가드
  const isSubmittingRef = useRef(false)

  const handleBeforePayment = async (orderId: string): Promise<void> => {
    if (isSubmittingRef.current) {
      throw new Error('이미 결제가 진행 중입니다')
    }
    isSubmittingRef.current = true
    try {
      if (!isMealVoucher && !selectedAddress) {
        setShowAddressModal(true)
        throw new Error('배송지를 선택해주세요')
      }

      if (isDirectPurchase) {
        sessionStorage.setItem('directPurchase', 'true')
      } else {
        sessionStorage.removeItem('directPurchase')
      }

      const shippingAddress = isMealVoucher ? {
        postal_code: '00000',
        address1: '식사권 (배송 불필요)',
        address2: '',
        country: 'KR',
        recipient_name: '식사권 구매자',
      } : {
        postal_code: selectedAddress!.postal_code,
        address1: selectedAddress!.address,
        address2: selectedAddress!.address_detail || '',
        country: 'KR',
        recipient_name: selectedAddress!.recipient_name,
      }

      for (const group of Object.values(sellerGroups)) {
        const groupShippingFee = calcGroupShippingFee(group)

        addBreadcrumb('order', 'creating', {
          orderId,
          sellerId: group.seller_id,
          itemCount: group.items.length,
          total: group.subtotal + groupShippingFee,
        })

        const response = await api.post('/api/orders', {
          seller_id: group.seller_id ? String(group.seller_id) : '',
          order_number: orderId,
          items: group.items.map(item => ({
            product_id: String(item.product_id),
            quantity: item.quantity,
            ...(item.option_value ? { options: { value: item.option_value } } : {}),
          })),
          shipping_address: shippingAddress,
          shipping_name: isMealVoucher ? '식사권 구매자' : selectedAddress!.recipient_name,
          shipping_phone: isMealVoucher ? '' : selectedAddress!.phone,
          shipping_fee: groupShippingFee,
          idempotency_key: `${orderId}_${group.seller_id}`,
          referrer_id: getAffiliateRef(),
          group_buy_discounts: groupBuyDiscounts,
          coupon_id: couponId || undefined,
          coupon_discount: couponDiscount || undefined,
          discount_amount: (couponDiscount || 0) + (totalGroupBuyDiscount || 0) + (dealToUse || 0),
          deal_used: dealToUse || undefined,
        })

        if (!response.data.success) {
          throw new Error(response.data.error || '주문 생성에 실패했습니다')
        }

        if (couponId && couponDiscount > 0 && response.data.data?.order_id) {
          try {
            await api.post('/api/coupons/use', {
              coupon_id: couponId,
              order_id: response.data.data.order_id,
              discount_amount: couponDiscount,
            })
          } catch (couponErr) {
            captureError(couponErr as Error, { context: 'CheckoutPage.couponUse', couponId })
          }
        }
      }
    } finally {
      isSubmittingRef.current = false
    }
  }

  // ✅ BUG #3 FIX: Auth-guard and loading checks rendered after all hooks
  const isSessionUser = localStorage.getItem('user_type') === 'user' && localStorage.getItem('user_id')
  if (!isSessionUser && (!isAuthReady || authLoading)) {
    return (
      <div className="min-h-screen bg-[#fbfbfd] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#ff6b35] mx-auto mb-4"></div>
          <p className="text-gray-400">로딩 중...</p>
        </div>
      </div>
    )
  }

  if (!user && !isSessionUser) {
    return null
  }

  if (loading || tokenRefreshing) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-400">
            {tokenRefreshing ? '보안 인증 중...' : '로딩 중...'}
          </p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="w-full p-4 sm:p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <p className="text-red-800">{error}</p>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={() => window.location.reload()} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg">다시 시도</button>
            <Button
              onClick={() => navigate('/cart')}
              variant="outline"
            >
              장바구니로 돌아가기
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f4f4f4]">
      <SEO title="주문/결제 - 유어딜" description="주문 정보를 확인하고 안전하게 결제하세요" url="/checkout" noindex />

      {/* 헤더 */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="mx-auto max-w-md flex items-center justify-between px-3 py-3">
          <button onClick={() => navigate('/cart')} aria-label="장바구니로 돌아가기" className="w-9 h-9 flex items-center justify-center">
            <ArrowLeft className="w-5 h-5 text-gray-900" />
          </button>
          <h1 className="text-[15px] font-extrabold text-gray-900">주문 · 결제</h1>
          <div className="w-9" />
        </div>
      </div>

      <main className="mx-auto max-w-md pb-52" style={{ background: '#F4F4F4' }}>
        <div className="flex flex-col">
          <div className="flex flex-1 flex-col lg:rounded-3xl">

            {/* 배송지 */}
            <SelectedAddressDisplay
              selectedAddress={selectedAddress}
              onChangeClick={() => setShowAddressModal(true)}
            />

            <div className="h-[6px] bg-gray-100" />

            {/* 주문 상품 */}
            <OrderItemsSection
              cartItems={cartItems}
              sellerGroups={sellerGroups}
            />

            {/* 쿠폰 */}
            <CouponSection
              couponCode={couponCode}
              couponDiscount={couponDiscount}
              totalAmount={totalAmount}
              onCouponCodeChange={setCouponCode}
              onCouponApplied={(discount, id) => {
                setCouponDiscount(discount)
                setCouponId(id)
              }}
            />

            <div className="h-[6px] bg-gray-100" />

            {/* 결제 수단 */}
            <PaymentSection
              userId={userId || ''}
              cartItems={cartItems}
              selectedAddress={selectedAddress}
              dealBalance={dealBalance}
              dealToUse={dealToUse}
              totalBeforeDeal={totalBeforeDeal}
              totalAmount={totalAmount}
              totalShippingFee={totalShippingFee}
              couponId={couponId}
              couponDiscount={couponDiscount}
              isDirectPurchase={isDirectPurchase}
              onDealToUseChange={setDealToUse}
              onBeforePayment={handleBeforePayment}
            />
          </div>

          {/* Right column (desktop) — hidden on mobile */}
          <div className="hidden">
            <div className="sticky top-20 rounded-3xl">
              <section className="bg-white px-5 py-6">
                <h2 className="text-[15px] font-bold text-gray-900">결제 금액</h2>
                <div className="mt-5 flex flex-col gap-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[14px] text-gray-400">상품금액</span>
                    <span className="text-[14px] text-gray-900">{subtotal.toLocaleString()}원</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[14px] text-gray-400">배송비</span>
                    <span className="text-[14px] text-gray-900">
                      {totalShippingFee === 0 ? (
                        <span className="font-medium text-blue-600">무료</span>
                      ) : `${totalShippingFee.toLocaleString()}원`}
                    </span>
                  </div>
                  {couponDiscount > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-[14px] text-gray-400">쿠폰 할인</span>
                      <span className="text-[14px] font-medium text-red-500">-{couponDiscount.toLocaleString()}원</span>
                    </div>
                  )}
                  {totalGroupBuyDiscount > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-[14px] text-gray-400">🎁 공동구매 할인</span>
                      <span className="text-[14px] font-medium text-gray-900">-{totalGroupBuyDiscount.toLocaleString()}원</span>
                    </div>
                  )}
                  {dealToUse > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-[14px] text-gray-400">딜 포인트</span>
                      <span className="text-[14px] font-medium text-pink-500">-{dealToUse.toLocaleString()}딜</span>
                    </div>
                  )}
                </div>
                <div className="my-5 h-px bg-[#333]" />
                <div className="flex items-end justify-between">
                  <span className="text-[15px] font-semibold text-gray-900">총 결제금액</span>
                  <div className="flex items-baseline gap-0.5">
                    <span className="text-[26px] font-bold tracking-tight text-gray-900">
                      {Math.max(0, totalAmount).toLocaleString()}
                    </span>
                    <span className="text-[15px] font-semibold text-gray-900">원</span>
                  </div>
                </div>
                {!selectedAddress && (
                  <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-xs text-amber-800 text-center">
                      ⚠️ 배송지를 선택하셔야 결제가 가능합니다
                    </p>
                  </div>
                )}
              </section>
            </div>
          </div>
        </div>

        {/* 결제 예정금액 */}
        <OrderSummarySection
          subtotal={subtotal}
          totalShippingFee={totalShippingFee}
          couponDiscount={couponDiscount}
          totalGroupBuyDiscount={totalGroupBuyDiscount}
          dealToUse={dealToUse}
          totalAmount={totalAmount}
        />
      </main>

      {/* 배송지 선택 모달 */}
      <AddressSelectModal
        isOpen={showAddressModal}
        addresses={addresses}
        selectedAddress={selectedAddress}
        onClose={() => setShowAddressModal(false)}
        onSelect={(addr) => {
          setSelectedAddress(addr)
          setShowAddressModal(false)
        }}
        onAddNew={() => {
          setShowAddressModal(false)
          setTimeout(() => setShowNewAddressForm(true), 100)
        }}
      />

      {/* 새 배송지 추가 모달 */}
      <NewAddressFormModal
        isOpen={showNewAddressForm}
        newAddress={newAddress}
        showPostcodePopup={showPostcodePopup}
        onClose={() => {
          setShowNewAddressForm(false)
          setShowPostcodePopup(false)
        }}
        onChangeField={(field, value) => setNewAddress(prev => ({ ...prev, [field]: value }))}
        onOpenPostcode={() => setShowPostcodePopup(true)}
        onSave={handleSaveNewAddress}
      />
    </div>
  )
}
