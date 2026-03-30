import { useEffect, useState, lazy, Suspense } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import api from '@/lib/api'
import { handleApiError, showErrorToast } from '@/lib/errorHandler'
import { Button } from '@/components/ui/button'
import { ArrowLeft, AlertCircle, Package, MapPin, Plus, ChevronRight } from 'lucide-react'
import { getUserIdSync } from '@/utils/auth'
// ✅ Zustand 직접 사용
import { useAuthKR } from '@/shared/stores/useAuthKR'
import { useAuthWorld } from '@/shared/stores/useAuthWorld'
import { CustomModal, useModal } from '@/components/CustomModal'
import { isKorea } from '@/config/region'
import { captureError, captureMessage } from '@/lib/sentry'
import { toast } from '@/hooks/useToast'

// 🔥 Region-based lazy loading for payment components
const TossPaymentWidget = lazy(() => 
  import('@/components/payments/TossPaymentWidget').then(m => ({ default: m.TossPaymentWidget }))
)
const StripeCheckout = lazy(() => 
  import('@/components/payments/StripeCheckout').then(m => ({ default: m.StripeCheckout }))
)

declare global {
  interface Window {
    daum: any
  }
}

const clientKey = import.meta.env.VITE_TOSS_CLIENT_KEY || 'test_gck_P9BRQmyarYPA5lOO6OXaVJ07KzLN'

import { CartItem } from '@/types/cart'

interface ShippingAddress {
  id: number
  recipient_name: string
  phone: string
  postal_code: string
  address: string
  address_detail: string
  is_default: number
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
  const [searchParams] = useSearchParams()
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [userId, setUserId] = useState<string | null>(null)
  const [urlParamsProcessed, setUrlParamsProcessed] = useState(false)  // URL 파라미터 처리 완료 플래그
  const [tokenRefreshing, setTokenRefreshing] = useState(false)  // 토큰 갱신 중 플래그
  
  // 배송지 관련 상태
  const [addresses, setAddresses] = useState<ShippingAddress[]>([])
  const [selectedAddress, setSelectedAddress] = useState<ShippingAddress | null>(null)
  const [showAddressModal, setShowAddressModal] = useState(false)
  const [showNewAddressForm, setShowNewAddressForm] = useState(false)
  const [showPostcodePopup, setShowPostcodePopup] = useState(false)
  
  // 새 배송지 입력 폼
  const [newAddress, setNewAddress] = useState({
    recipient_name: '',
    phone: '',
    postal_code: '',
    address: '',
    address_detail: '',
    is_default: 0
  })
  
  // ✅ BUG #3 FIX: All hooks must be called unconditionally before any early return.
  // Guard conditions (isAuthReady, user) are now evaluated AFTER all hooks.
  // The loading/redirect state is rendered at the JSX level below.

  // 셀러별 장바구니 그룹화 및 배송비 계산
  const sellerGroups = cartItems.reduce((groups, item) => {
    const sellerId = Number(item.seller_id) || 0
    if (!groups[sellerId]) {
      groups[sellerId] = {
        seller_id: sellerId,
        seller_name: item.seller_name || '판매자',
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
    if (group.free_shipping_threshold > 0 && group.subtotal >= group.free_shipping_threshold) {
      return total
    }
    return total + group.shipping_fee
  }, 0)

  const totalAmount = subtotal + totalShippingFee

  // ✅ BUG #18 FIX: There were TWO separate useEffect blocks both cleaning URL
  // params on `searchParams` change.  The first (lines 143-162) fired replaceState
  // but never called setUrlParamsProcessed(true), meaning the data-load effect
  // gated on `urlParamsProcessed` was still delayed by a render cycle even though
  // the URL was already clean.  Additionally, both effects called replaceState
  // in the same render cycle, causing a double history push.
  // Fix: merge into one authoritative effect that handles legacy localStorage
  // cleanup AND sets the processed flag atomically.
  useEffect(() => {
    const paramsToClean = ['access_token', 'refresh_token', 'userId', 'userEmail', 'firebase_token', 'userName', 'login', 'session']
    
    if (paramsToClean.some(param => searchParams.has(param))) {
      console.warn('[CheckoutPage] 🧹 URL 파라미터 정리 중...', {
        params: Array.from(searchParams.keys())
      })
      window.history.replaceState({}, '', window.location.pathname)
      // 레거시 JWT 키도 정리
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
    }
    
    // ✅ URL 파라미터 처리 완료 표시 (data-load effect gate)
    setUrlParamsProcessed(true)
  }, [searchParams])

  // 🔐 Step 0: 인증 확인 로그만 (리다이렉트는 ProtectedRoute + 렌더 가드에서 처리)
  useEffect(() => {
    if (!isAuthReady) return
    if (user) {
    }
  }, [isAuthReady, user])

  // 초기 데이터 로드 (URL 파라미터 처리 완료 후에만 실행)
  useEffect(() => {
    // ⏳ URL 파라미터 처리가 완료될 때까지 대기
    if (!urlParamsProcessed) {
      return
    }

    // 🔥 Fix: Use Firebase UID directly if getUserId() returns null
    let uid = getUserIdSync()
    
    // Fallback to Firebase UID if userId is not in localStorage
    if (!uid && user) {
      uid = user.uid
      // Save Firebase UID as user_id for future use
      localStorage.setItem('user_id', user.uid)
    }

    if (!uid) {
      captureError(new Error('CheckoutPage: userId 없음'), { context: 'CheckoutPage.loadData' })
      setError('사용자 정보를 확인할 수 없습니다.')
      setLoading(false)
      return
    }

    setUserId(uid)

    const loadData = async () => {
      try {
        // 장바구니 조회 (requireAuth 미들웨어가 userId 자동 추출)
        const cartResponse = await api.get('/api/cart')
        
        // ✅ API 응답 파싱: { success: true, data: { items: [...], summary: {...} } }
        let cartItemsData: CartItem[] = []
        if (cartResponse.data?.success) {
          const resData = cartResponse.data.data
          if (resData?.items && Array.isArray(resData.items)) {
            // 현재 구조: data.items
            cartItemsData = resData.items
          } else if (Array.isArray(resData)) {
            // 이전 구조 호환: data가 배열
            cartItemsData = resData
          }
        } else if (Array.isArray(cartResponse.data)) {
          cartItemsData = cartResponse.data
        }
        
        if (cartItemsData.length > 0) {
          setCartItems(cartItemsData)
        } else {
          setError('장바구니가 비어있습니다.')
          setTimeout(() => navigate('/cart'), 2000)
        }

        // 배송지 조회 (requireAuth 미들웨어가 userId 자동 추출)
        const addressResponse = await api.get('/api/shipping-addresses')
        if (addressResponse.data.success) {
          const addressList = addressResponse.data.data
          setAddresses(addressList)

          // 기본 배송지 자동 선택
          const defaultAddr = addressList.find((addr: ShippingAddress) => addr.is_default === 1)
          if (defaultAddr) {
            setSelectedAddress(defaultAddr)
          }
        }
      } catch (err) {
        console.error('[CheckoutPage] ❌ API 에러:', err)
        captureError(err as Error, { context: 'CheckoutPage.loadData', userId: uid })
        handleApiError(err)
        setError('데이터를 불러올 수 없습니다.')
      } finally {
        setLoading(false)
      }
    }

    loadData()

    // ✅ BUG #14 FIX: Daum postcode script was appended to <head> unconditionally
    // on every mount without a cleanup function or duplicate-tag guard.
    // Each React navigation to CheckoutPage added another <script> tag → memory
    // leak and duplicate SDK initializations.
    // Fix: check for an existing tag first; return a cleanup that removes the tag
    // on unmount so it's only present while the page is mounted.
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
  }, [navigate, urlParamsProcessed])  // ✅ urlParamsProcessed 추가

  // Daum 우편번호 팝업
  useEffect(() => {
    if (showPostcodePopup && window.daum && window.daum.Postcode) {
      const container = document.getElementById('daum-postcode-container')
      if (!container) return

      new window.daum.Postcode({
        oncomplete: (data: any) => {
          setNewAddress({
            ...newAddress,
            postal_code: data.zonecode,
            address: data.roadAddress || data.jibunAddress
          })
          setShowPostcodePopup(false)
        },
        width: '100%',
        height: '100%'
      }).embed(container)
    }
  }, [showPostcodePopup])

  // 배송지 저장
  const handleSaveNewAddress = async () => {
    if (!userId) {
      toast.info('로그인이 필요합니다.')
      return
    }

    if (!newAddress.recipient_name || !newAddress.phone || !newAddress.postal_code || !newAddress.address) {
      toast.error('모든 필수 항목을 입력해주세요.')
      return
    }

    try {
      // 첫 번째 배송지는 자동으로 기본 배송지로 설정
      const isFirstAddress = addresses.length === 0
      const addressData = {
        user_id: userId,
        ...newAddress,
        is_default: isFirstAddress ? 1 : 0  // 첫 배송지면 기본으로 설정
      }
      
      const response = await api.post('/api/shipping-addresses', addressData)

      if (response.data.success) {
        const newId = response.data.data.id
        const savedAddress = { ...newAddress, id: newId }
        
        setAddresses([...addresses, savedAddress as ShippingAddress])
        setSelectedAddress(savedAddress as ShippingAddress)
        setShowNewAddressForm(false)
        setShowAddressModal(false)
        
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
      console.error('[CheckoutPage] ❌ 배송지 저장 실패:', err)
      handleApiError(err)
    }
  }

  /**
   * 결제 전 주문 생성: Toss redirect 전에 DB에 주문을 먼저 기록합니다.
   * 배송지 미선택 시 예외를 throw하여 TossPaymentWidget이 결제를 중단합니다.
   *
   * 주문 생성 시 각 셀러별 금액(상품 소계 + 배송비)을 함께 저장하여
   * 결제 승인(confirm) 단계에서 DB 금액 기반 검증이 가능하도록 합니다.
   */
  const handleBeforePayment = async (orderId: string): Promise<void> => {
    if (!selectedAddress) {
      setShowAddressModal(true)
      throw new Error('배송지를 선택해주세요')
    }

    const shippingAddress = {
      postal_code: selectedAddress.postal_code,
      address1: selectedAddress.address,
      address2: selectedAddress.address_detail || '',
      country: 'KR',
      recipient_name: selectedAddress.recipient_name,
    }

    for (const group of Object.values(sellerGroups)) {
      // 셀러 그룹별 배송비 계산
      const groupShippingFee = (group.free_shipping_threshold > 0 && group.subtotal >= group.free_shipping_threshold)
        ? 0
        : group.shipping_fee

      const response = await api.post('/api/orders', {
        // seller_id가 0(null에서 변환)이면 빈 문자열 → order route의 seller 검증 skip
        seller_id: group.seller_id ? String(group.seller_id) : '',
        order_number: orderId,
        items: group.items.map(item => ({
          product_id: String(item.product_id),
          quantity: item.quantity,
          ...(item.option_value ? { options: { value: item.option_value } } : {}),
        })),
        shipping_address: shippingAddress,
        shipping_name: selectedAddress.recipient_name,
        shipping_phone: selectedAddress.phone,
        shipping_fee: groupShippingFee,
        idempotency_key: `${orderId}_${group.seller_id}`,
      })

      if (!response.data.success) {
        throw new Error(response.data.error || '주문 생성에 실패했습니다')
      }
    }
  }

  // ✅ BUG #3 FIX: Auth-guard and loading checks rendered here (after all hooks)
  if (!isAuthReady || authLoading) {
    return (
      <div className="min-h-screen bg-[#fbfbfd] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#ff6b35] mx-auto mb-4"></div>
          <p className="text-gray-600">로딩 중...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    // ProtectedRoute가 /login 으로 리다이렉트하므로 여기서는 null만 반환
    return null
  }

  if (loading || tokenRefreshing) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">
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
          <Button 
            onClick={() => navigate('/cart')} 
            className="mt-4"
          >
            장바구니로 돌아가기
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* 헤더 */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="mx-auto max-w-lg lg:max-w-5xl px-5 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/cart')}
              className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-gray-100 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-[18px] font-bold">주문/결제</h1>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-lg pb-52 lg:max-w-5xl lg:pb-6">
        <div className="flex flex-col lg:flex-row lg:items-start lg:gap-5 lg:px-5 lg:py-6">

          {/* Left column */}
          <div className="flex flex-1 flex-col lg:rounded-3xl">{/* overflow-hidden 제거 */}
            {/* 배송지 정보 */}
            <section className="bg-white px-5 py-6">
              <div className="flex items-center justify-between relative">
                <h2 className="text-[17px] font-bold text-gray-900">배송지</h2>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setShowAddressModal(true)
                  }}
                  className="flex items-center text-[14px] sm:text-[15px] lg:text-[16px] font-semibold text-blue-600 transition-all hover:text-blue-700 hover:underline active:scale-95 cursor-pointer px-3 py-2 -mr-2 touch-manipulation relative z-10"
                  style={{ pointerEvents: 'auto' }}
                >
                  {selectedAddress ? '변경' : '선택'}
                  <ChevronRight className="h-5 w-5 ml-0.5" />
                </button>
              </div>

              {!selectedAddress ? (
                <div className="mt-4 bg-red-50 border border-red-200 rounded-2xl p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-red-800 font-semibold text-[14px]">⚠️ 배송지를 선택해주세요</p>
                      <p className="text-red-700 text-[13px] mt-1">배송지를 선택하셔야 결제가 가능합니다.</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-4 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[15px] font-semibold text-gray-900">{selectedAddress.recipient_name}</span>
                    {selectedAddress.is_default === 1 && (
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-600">
                        기본
                      </span>
                    )}
                  </div>
                  <p className="text-[14px] leading-relaxed text-gray-600">{selectedAddress.phone}</p>
                  <p className="text-[14px] leading-relaxed text-gray-900">
                    [{selectedAddress.postal_code}] {selectedAddress.address} {selectedAddress.address_detail}
                  </p>
                </div>
              )}
            </section>
            
            {/* Divider */}
            <div className="h-2 bg-gray-100" />

            {/* 주문 상품 정보 */}
            <section className="bg-white px-5 py-6">
              <div className="flex items-center justify-between">
                <h2 className="text-[17px] font-bold text-gray-900">주문 상품</h2>
                <span className="text-[13px] text-gray-600">
                  {cartItems.length}개
                </span>
              </div>

              <div className="mt-5 flex flex-col gap-5">
                {Object.values(sellerGroups).map((group) => (
                  <div key={group.seller_id} className="border border-gray-200 rounded-2xl p-4">
                    <p className="text-[13px] font-semibold text-gray-700 mb-3">
                      {group.seller_name}
                    </p>
                    
                    {group.items.map((item) => (
                      <div key={item.id} className="flex gap-4 py-3 border-t border-gray-100 first:border-t-0">
                        {/* 이미지 or 아이콘 */}
                        <div className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-2xl bg-gray-100">
                          {item.image_url ? (
                            <img
                              src={item.image_url}
                              alt={item.product_name}
                              className="object-cover w-full h-full"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              <Package className="h-7 w-7 text-gray-400" />
                            </div>
                          )}
                        </div>
                        
                        {/* 상품 정보 */}
                        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1">
                          <p className="truncate text-[14px] leading-snug text-gray-900">
                            {item.product_name}
                          </p>
                          {item.option_value && (
                            <p className="text-[13px] text-gray-600">
                              {item.option_value} / {item.quantity}개
                            </p>
                          )}
                          <div className="flex items-center gap-1.5">
                            <span className="text-[15px] font-bold text-gray-900">
                              {((item.price_snapshot ?? 0) * item.quantity).toLocaleString()}원
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* 배송비 정보 */}
                    <div className="mt-3 pt-3 border-t border-gray-200 flex justify-between text-[13px]">
                      <span className="text-gray-600">배송비</span>
                      <span className="font-semibold text-gray-900">
                        {group.free_shipping_threshold > 0 && group.subtotal >= group.free_shipping_threshold
                          ? <span className="text-blue-600 font-medium">무료</span>
                          : `${group.shipping_fee.toLocaleString()}원`}
                      </span>
                    </div>
                    {group.free_shipping_threshold > 0 && group.subtotal < group.free_shipping_threshold && (
                      <p className="text-[12px] text-gray-500 mt-1">
                        {(group.free_shipping_threshold - group.subtotal).toLocaleString()}원 추가 시 무료배송
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </section>
            
            {/* Divider */}
            <div className="h-2 bg-gray-100" />

            {/* 결제 수단 및 약관 동의 (통합) */}
            <section className="bg-white px-5 py-4">
              <h2 className="text-[17px] font-bold text-gray-900 mb-3">결제 수단</h2>
              
              {/* 🔥 Region-based payment widget */}
              {isKorea() ? (
                /* 한국: Toss Payments */
                <Suspense fallback={
                  <div className="flex items-center justify-center py-12 text-gray-500 text-sm">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-2"></div>
                    <p>결제 수단 불러오는 중...</p>
                  </div>
                }>
                  <TossPaymentWidget
                    userId={userId || ''}
                    clientKey={clientKey}
                    cartItems={cartItems}
                    totalAmount={subtotal}
                    shippingFee={totalShippingFee}
                    onBeforePayment={handleBeforePayment}
                    onPaymentSuccess={(orderId, paymentKey, amount) => {
                      navigate(`/payment/success?orderId=${orderId}&paymentKey=${paymentKey}&amount=${amount}`)
                    }}
                    onPaymentError={(error) => {
                      console.error('[CheckoutPage] 결제 실패:', error)
                      showErrorToast(error)
                    }}
                  />
                </Suspense>
              ) : (
                /* 글로벌: Stripe */
                <Suspense fallback={
                  <div className="flex items-center justify-center py-12 text-gray-500 text-sm">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-2"></div>
                    <p>Loading payment method...</p>
                  </div>
                }>
                  <StripeCheckout
                    userId={userId || ''}
                    cartItems={cartItems}
                    totalAmount={subtotal}
                    shippingFee={totalShippingFee}
                    onPaymentSuccess={(orderId, paymentIntentId, amount) => {
                      navigate(`/payment/success?orderId=${orderId}&paymentIntentId=${paymentIntentId}&amount=${amount}`)
                    }}
                    onPaymentError={(error) => {
                      console.error('[CheckoutPage] Payment failed:', error)
                      showErrorToast(error)
                    }}
                  />
                </Suspense>
              )}
            </section>
          </div>

          {/* Right column - Order summary (desktop only) */}
          <div className="hidden lg:block lg:w-[360px]">
            <div className="sticky top-20 rounded-3xl">{/* overflow-hidden 제거 */}
              <section className="bg-white px-5 py-6">
                <h2 className="text-[17px] font-bold text-gray-900">결제 금액</h2>

                <div className="mt-5 flex flex-col gap-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[14px] text-gray-600">상품금액</span>
                    <span className="text-[14px] text-gray-900">
                      {subtotal.toLocaleString()}원
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[14px] text-gray-600">배송비</span>
                    <span className="text-[14px] text-gray-900">
                      {totalShippingFee === 0 ? (
                        <span className="font-medium text-blue-600">무료</span>
                      ) : (
                        `${totalShippingFee.toLocaleString()}원`
                      )}
                    </span>
                  </div>
                </div>

                <div className="my-5 h-px bg-gray-200" />

                <div className="flex items-end justify-between">
                  <span className="text-[15px] font-semibold text-gray-900">총 결제금액</span>
                  <div className="flex items-baseline gap-0.5">
                    <span className="text-[26px] font-bold tracking-tight text-gray-900">
                      {totalAmount.toLocaleString()}
                    </span>
                    <span className="text-[15px] font-semibold text-gray-900">원</span>
                  </div>
                </div>

                {/* Payment button is inside TossPaymentWidget */}
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

        {/* Mobile order summary */}
        <div className="lg:hidden">
          <div className="h-2 bg-gray-100" />
          <section className="bg-white px-5 py-6">
            <h2 className="text-[17px] font-bold text-gray-900">결제 금액</h2>

            <div className="mt-5 flex flex-col gap-3.5">
              <div className="flex items-center justify-between">
                <span className="text-[14px] text-gray-600">상품금액</span>
                <span className="text-[14px] text-gray-900">
                  {subtotal.toLocaleString()}원
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[14px] text-gray-600">배송비</span>
                <span className="text-[14px] text-gray-900">
                  {totalShippingFee === 0 ? (
                    <span className="font-medium text-blue-600">무료</span>
                  ) : (
                    `${totalShippingFee.toLocaleString()}원`
                  )}
                </span>
              </div>
            </div>

            <div className="my-5 h-px bg-gray-200" />

            <div className="flex items-end justify-between">
              <span className="text-[15px] font-semibold text-gray-900">총 결제금액</span>
              <div className="flex items-baseline gap-0.5">
                <span className="text-[26px] font-bold tracking-tight text-gray-900">
                  {totalAmount.toLocaleString()}
                </span>
                <span className="text-[15px] font-semibold text-gray-900">원</span>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Mobile payment button removed - now inside TossPaymentWidget */}
      {/* Terms section removed as it's now inside TossPaymentWidget's agreement component */}

      {/* 배송지 선택 모달 */}
      <CustomModal
        isOpen={showAddressModal}
        onClose={() => {
          setShowAddressModal(false)
        }}
        title="배송지 선택"
        type="custom"
        maxWidth="lg"
      >
        <div className="space-y-3">
          {addresses.length === 0 ? (
            <div className="py-12 text-center">
              <MapPin className="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <p className="text-[15px] text-gray-500">등록된 배송지가 없습니다.</p>
              <p className="text-[13px] text-gray-400 mt-1">새 배송지를 추가해주세요.</p>
            </div>
          ) : (
            addresses.map((addr) => (
              <div
                key={addr.id}
                className={`border rounded-2xl p-4 cursor-pointer transition-all ${
                  selectedAddress?.id === addr.id 
                    ? 'border-blue-500 bg-blue-50 shadow-sm' 
                    : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                }`}
                onClick={(e) => {
                  e.stopPropagation()
                  setSelectedAddress(addr)
                  setShowAddressModal(false)
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <p className="text-[15px] font-semibold text-gray-900">{addr.recipient_name}</p>
                      {addr.is_default === 1 && (
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-600">
                          기본
                        </span>
                      )}
                    </div>
                    <p className="text-[14px] text-gray-600 mb-1">{addr.phone}</p>
                    <p className="text-[14px] text-gray-700 leading-relaxed">
                      [{addr.postal_code}] {addr.address}
                    </p>
                    {addr.address_detail && (
                      <p className="text-[14px] text-gray-700 leading-relaxed mt-0.5">
                        {addr.address_detail}
                      </p>
                    )}
                  </div>
                  {selectedAddress?.id === addr.id && (
                    <div className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center mt-1">
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setShowAddressModal(false)
              setTimeout(() => setShowNewAddressForm(true), 100)
            }}
            className="w-full flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 py-4 text-[15px] font-semibold text-gray-600 transition-all hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600 cursor-pointer touch-manipulation active:scale-[0.98]"
          >
            <Plus className="w-5 h-5" />
            <span>새 배송지 추가</span>
          </button>
        </div>
      </CustomModal>

      {/* 새 배송지 추가 모달 */}
      <CustomModal
        isOpen={showNewAddressForm}
        onClose={() => {
          setShowNewAddressForm(false)
          setShowPostcodePopup(false)
        }}
        title="새 배송지 추가"
        type="custom"
        maxWidth="lg"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-[14px] font-semibold text-gray-900 mb-2">
              수령인 이름 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={newAddress.recipient_name}
              onChange={(e) => setNewAddress({ ...newAddress, recipient_name: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-2xl text-[15px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              placeholder="받으실 분의 이름을 입력하세요"
            />
          </div>

          <div>
            <label className="block text-[14px] font-semibold text-gray-900 mb-2">
              연락처 <span className="text-red-500">*</span>
            </label>
            <input
              type="tel"
              value={newAddress.phone}
              onChange={(e) => setNewAddress({ ...newAddress, phone: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-2xl text-[15px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              placeholder="010-1234-5678"
            />
          </div>

          <div>
            <label className="block text-[14px] font-semibold text-gray-900 mb-2">
              우편번호 <span className="text-red-500">*</span>
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newAddress.postal_code}
                readOnly
                className="flex-1 px-4 py-3 border border-gray-300 rounded-2xl bg-gray-50 text-[15px] text-gray-600"
                placeholder="우편번호"
              />
              <button
                onClick={() => setShowPostcodePopup(true)}
                className="px-5 py-3 border border-gray-300 rounded-2xl text-[14px] font-semibold text-gray-700 hover:bg-gray-50 transition-all whitespace-nowrap"
              >
                주소 검색
              </button>
            </div>
          </div>

          {showPostcodePopup && (
            <div className="rounded-2xl overflow-hidden border border-gray-200">
              <div
                id="daum-postcode-container"
                style={{ width: '100%', height: '400px' }}
              ></div>
            </div>
          )}

          <div>
            <label className="block text-[14px] font-semibold text-gray-900 mb-2">
              주소 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={newAddress.address}
              readOnly
              className="w-full px-4 py-3 border border-gray-300 rounded-2xl bg-gray-50 text-[15px] text-gray-600"
              placeholder="주소 검색 후 자동 입력됩니다"
            />
          </div>

          <div>
            <label className="block text-[14px] font-semibold text-gray-900 mb-2">
              상세주소
            </label>
            <input
              type="text"
              value={newAddress.address_detail}
              onChange={(e) => setNewAddress({ ...newAddress, address_detail: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-2xl text-[15px] focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              placeholder="동/호수, 건물명 등 (선택)"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                handleSaveNewAddress()
              }}
              className="flex-1 py-4 bg-blue-600 text-white rounded-2xl text-[16px] font-bold hover:bg-blue-700 hover:shadow-lg transition-all active:scale-[0.98] cursor-pointer touch-manipulation"
            >
              저장
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setShowNewAddressForm(false)
                setShowPostcodePopup(false)
              }}
              className="flex-1 py-4 bg-gray-100 text-gray-700 rounded-2xl text-[16px] font-bold hover:bg-gray-200 transition-all active:scale-[0.98] cursor-pointer touch-manipulation"
            >
              취소
            </button>
          </div>
        </div>
      </CustomModal>
    </div>
  )
}
