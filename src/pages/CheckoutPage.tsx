import { useEffect, useState, lazy, Suspense } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import api from '@/lib/api'
import { handleApiError, showErrorToast } from '@/lib/errorHandler'
import { Button } from '@/components/ui/button'
import { ArrowLeft, AlertCircle, Package, MapPin, Plus, ChevronRight } from 'lucide-react'
import { requireLogin, getUserId, getUserIdSync, isLoggedIn, isLoggedInSync } from '@/utils/auth'
import { generateOrderId } from '@/utils/orderIdGenerator'
// ✅ Zustand 직접 사용
import { useAuthKR } from '@/shared/stores/useAuthKR'
import { useAuthWorld } from '@/shared/stores/useAuthWorld'
import { CustomModal, useModal } from '@/components/CustomModal'
import { isKorea } from '@/config/region'
import { captureError, captureMessage } from '@/lib/sentry'

// 🔥 Region-based lazy loading for payment components
const TossPaymentWidget = lazy(() => 
  import('@/components/payments/TossPaymentWidget').then(m => ({ default: m.TossPaymentWidget }))
)
const StripeCheckout = lazy(() => 
  import('@/components/payments/StripeCheckout').then(m => ({ default: m.StripeCheckout }))
)

// 🚨 중요: 결제위젯 SDK는 HTML에서 로드됨 (index.html 참고)
// window.PaymentWidget 전역 함수 사용 (V1 공식 샘플 방식)
declare global {
  interface Window {
    PaymentWidget: (clientKey: string, customerKey: string) => any
    daum: any
  }
}

// 토스페이먼츠 클라이언트 키 (결제위젯 연동 키)
// ✅ widgets() 메서드 사용을 위해 test_gck_ 키 필수
// MID 매칭은 토스 개발자센터 > 결제 UI 설정에서 관리
// https://docs.tosspayments.com/reference/widget-sdk
const clientKey = 'test_gck_P9BRQmyarYPA5lOO6OXaVJ07KzLN' // ✅ 결제위젯 클라이언트 키

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
  console.log('🚀🚀🚀 CheckoutPage 컴포넌트 마운트됨 - ' + new Date().toISOString())
  
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
  const [agreedToPrivacy, setAgreedToPrivacy] = useState(false)  // 개인정보 수집 동의
  const [tokenRefreshing, setTokenRefreshing] = useState(false)  // 토큰 갱신 중 플래그
  
  // 토스페이먼츠 위젯 상태
  const [widgets, setWidgets] = useState<any>(null)
  const [paymentMethodWidget, setPaymentMethodWidget] = useState<any>(null)  // V1: renderPaymentMethods 반환값
  const [ready, setReady] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

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
      console.log('[CheckoutPage] ✅ URL 파라미터 정리 완료')
    }
    
    // ✅ URL 파라미터 처리 완료 표시 (data-load effect gate)
    setUrlParamsProcessed(true)
  }, [searchParams])

  // 🔐 Step 0: Firebase 인증 상태 체크 (로그인되지 않으면 리다이렉트)
  useEffect(() => {
    async function checkFirebaseAuth() {
      // ✅ BUG #21 FIX: isLoggedIn() is an async function returning Promise<boolean>.
      // Calling it without `await` evaluated the Promise object itself (always
      // truthy), so the auth guard NEVER redirected unauthenticated users —
      // they could reach the checkout page without any valid session.
      const loggedIn = await isLoggedIn()
      if (!loggedIn) {
        console.log('[Firebase Auth] 로그인되지 않음, 로그인 페이지로 이동')
        requireLogin(navigate)
        return
      }
      
      // Firebase는 자동으로 ID Token을 갱신하므로 별도의 갱신 로직 불필요
      console.log('[Firebase Auth] ✅ 인증 상태 확인 완료 - Firebase 자동 토큰 갱신')
    }

    checkFirebaseAuth()
  }, [navigate]) // 컴포넌트 마운트 시 한 번만 실행

  /* ====================================================================
   * 🔥 LEGACY: Toss Payment 관련 로직 제거됨
   * TossPaymentWidget 컴포넌트로 이동됨 (Region 기반 lazy loading)
   * ==================================================================== */
  
  // 🎯 Step 3: 금액 변경 시 업데이트 (V1 - 동기 메서드)
  useEffect(() => {
    if (paymentMethodWidget == null || !ready) {
      console.log('[TossPayments] Step 3: 대기 중 (paymentMethodWidget:', !!paymentMethodWidget, 'ready:', ready, ')')
      return
    }

    try {
      // V1 공식: paymentMethodWidget.updateAmount() 사용
      console.log('[TossPayments] Step 3: 금액 업데이트 시도', totalAmount)
      paymentMethodWidget.updateAmount(totalAmount)
      console.log('[TossPayments] ✅ Step 3: 금액 업데이트 성공', totalAmount)
    } catch (err) {
      console.error('[TossPayments] ❌ Step 3 실패:', err)
      // 금액 업데이트 실패는 치명적이지 않으므로 계속 진행
    }
  }, [totalAmount, paymentMethodWidget, ready])

  // 초기 데이터 로드 (URL 파라미터 처리 완료 후에만 실행)
  useEffect(() => {
    // ⏳ URL 파라미터 처리가 완료될 때까지 대기
    if (!urlParamsProcessed) {
      console.log('[CheckoutPage] ⏳ URL 파라미터 처리 대기 중...')
      return
    }
    
    console.log('[CheckoutPage] 🎯 초기 데이터 로드 useEffect 실행됨')
    
    // 🔥 Fix: Use Firebase UID directly if getUserId() returns null
    let uid = getUserIdSync()
    
    // Fallback to Firebase UID if userId is not in localStorage
    if (!uid && user) {
      console.log('[CheckoutPage] ⚠️ localStorage에 userId 없음, Firebase UID 사용:', user.uid)
      uid = user.uid
      // Save Firebase UID as user_id for future use
      localStorage.setItem('user_id', user.uid)
    }
    
    console.log('[CheckoutPage] 👤 userId:', uid)
    console.log('[CheckoutPage] 🔍 localStorage 전체 확인:', {
      user_id: localStorage.getItem('user_id'),
      userId: localStorage.getItem('userId'),
      firebase_token: localStorage.getItem('firebase_token')?.substring(0, 20) + '...',
      user_name: localStorage.getItem('user_name'),
      user_type: localStorage.getItem('user_type'),
      firebase_uid: user?.uid
    })
    console.log('[CheckoutPage] isLoggedIn:', isLoggedInSync())
    
    if (!isLoggedInSync()) {
      console.log('[CheckoutPage] ❌ 로그인 필요 - requireLogin() 호출')
      requireLogin(navigate, '결제를 진행하려면 로그인이 필요합니다.')
      return
    }

    if (!uid) {
      console.log('[CheckoutPage] ❌ userId 없음')
      captureError(new Error('CheckoutPage: userId 없음'), { context: 'CheckoutPage.loadData' })
      setError('사용자 정보를 확인할 수 없습니다.')
      setLoading(false)
      return
    }

    console.log('[CheckoutPage] ✅ userId 설정:', uid)
    setUserId(uid)

    const loadData = async () => {
      try {
        console.log('[CheckoutPage] 📡 장바구니 API 호출 시작: /api/cart')
        // 장바구니 조회 (requireAuth 미들웨어가 userId 자동 추출)
        const cartResponse = await api.get('/api/cart')
        console.log('[CheckoutPage] 장바구니 응답:', cartResponse.data)
        if (cartResponse.data.success && cartResponse.data.data.length > 0) {
          console.log('[CheckoutPage] ✅ 장바구니 데이터 설정:', cartResponse.data.data.length, '개 상품')
          setCartItems(cartResponse.data.data)
        } else {
          console.log('[CheckoutPage] ❌ 장바구니 비어있음')
          setError('장바구니가 비어있습니다.')
          setTimeout(() => navigate('/cart'), 2000)
        }

        // 배송지 조회 (requireAuth 미들웨어가 userId 자동 추출)
        console.log('[CheckoutPage] 📡 배송지 API 호출 시작: /api/shipping-addresses')
        const addressResponse = await api.get('/api/shipping-addresses')
        console.log('[CheckoutPage] 배송지 응답:', addressResponse.data)
        if (addressResponse.data.success) {
          const addressList = addressResponse.data.data
          setAddresses(addressList)
          console.log('[CheckoutPage] ✅ 배송지 데이터 설정:', addressList.length, '개')
          
          // 기본 배송지 자동 선택
          const defaultAddr = addressList.find((addr: ShippingAddress) => addr.is_default === 1)
          if (defaultAddr) {
            console.log('[CheckoutPage] ✅ 기본 배송지 선택:', defaultAddr)
            setSelectedAddress(defaultAddr)
          }
        }
      } catch (err) {
        console.error('[CheckoutPage] ❌ API 에러:', err)
        captureError(err as Error, { context: 'CheckoutPage.loadData', userId: uid })
        handleApiError(err)
        setError('데이터를 불러올 수 없습니다.')
      } finally {
        console.log('[CheckoutPage] 로딩 완료')
        setLoading(false)
      }
    }

    console.log('[CheckoutPage] loadData() 호출')
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
    console.log('[CheckoutPage] 💾 handleSaveNewAddress 함수 실행됨')
    console.log('[CheckoutPage] userId:', userId)
    console.log('[CheckoutPage] newAddress:', newAddress)
    
    if (!userId) {
      console.error('[CheckoutPage] ❌ userId 없음')
      alert('로그인이 필요합니다.')
      return
    }

    if (!newAddress.recipient_name || !newAddress.phone || !newAddress.postal_code || !newAddress.address) {
      console.error('[CheckoutPage] ❌ 필수 항목 누락:', {
        recipient_name: newAddress.recipient_name,
        phone: newAddress.phone,
        postal_code: newAddress.postal_code,
        address: newAddress.address
      })
      alert('모든 필수 항목을 입력해주세요.')
      return
    }
    
    console.log('[CheckoutPage] ✅ 유효성 검사 통과, API 호출 시작')

    try {
      console.log('[CheckoutPage] 📡 API 호출: /api/shipping-addresses')
      
      // 첫 번째 배송지는 자동으로 기본 배송지로 설정
      const isFirstAddress = addresses.length === 0
      const addressData = {
        user_id: userId,
        ...newAddress,
        is_default: isFirstAddress ? 1 : 0  // 첫 배송지면 기본으로 설정
      }
      
      console.log('[CheckoutPage] 배송지 데이터:', addressData)
      console.log('[CheckoutPage] 첫 번째 배송지 여부:', isFirstAddress)
      
      const response = await api.post('/api/shipping-addresses', addressData)
      console.log('[CheckoutPage] API 응답:', response.data)

      if (response.data.success) {
        console.log('[CheckoutPage] ✅ 배송지 저장 성공')
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

  // 🎯 결제하기 버튼 클릭
  const handlePayment = async (e?: React.MouseEvent | React.TouchEvent) => {
    // 이벤트 전파 방지 (모바일 터치 이벤트 중복 방지)
    if (e) {
      e.preventDefault()
      e.stopPropagation()
    }

    console.log('[Payment] 🔘 버튼 클릭 감지:', {
      isProcessing,
      ready,
      hasWidgets: !!widgets,
      hasAddress: !!selectedAddress
    })

    // 중복 실행 방지
    if (isProcessing) {
      console.log('[Payment] ⚠️ 이미 결제 진행 중')
      return
    }

    // 위젯 준비 확인
    if (!widgets || !ready) {
      console.error('[Payment] ❌ 위젯 미준비:', { widgets: !!widgets, ready })
      showErrorToast('결제 시스템을 불러오는 중입니다. 잠시 후 다시 시도해주세요.')
      return
    }

    // 배송지 선택 확인
    if (!selectedAddress) {
      console.log('[Payment] ⚠️ 배송지 미선택')
      alert('배송지를 선택해주세요.')
      setShowAddressModal(true)  // 자동으로 배송지 선택 모달 열기
      return
    }

    // 개인정보 수집 동의 확인
    if (!agreedToPrivacy) {
      console.log('[Payment] ⚠️ 개인정보 수집 동의 미체크')
      alert('개인정보 수집 및 이용에 동의해주세요.')
      return
    }

    // ✅ 약관 동의 자동 체크 (결제하기 버튼 클릭 시)
    try {
      const agreementCheckbox = document.querySelector('#agreement input[type="checkbox"]') as HTMLInputElement
      if (agreementCheckbox && !agreementCheckbox.checked) {
        console.log('[Payment] ✅ 약관 동의 자동 체크')
        agreementCheckbox.checked = true
        // 체크박스 변경 이벤트 트리거 (Toss Payments 위젯에 알림)
        agreementCheckbox.dispatchEvent(new Event('change', { bubbles: true }))
      }
    } catch (err) {
      console.warn('[Payment] 약관 체크박스 자동 체크 실패:', err)
    }

    // 처리 중 플래그 설정
    setIsProcessing(true)
    console.log('[Payment] ✅ 결제 시작:', { totalAmount, selectedAddress })

    try {
      // 배송지 정보를 localStorage에 저장 (PaymentSuccessPage에서 사용)
      // ✅ BUG #23 FIX: CheckoutPage was storing `checkoutShippingAddress` (street)
      // and `checkoutRecipientName/Phone`, but PaymentSuccessPage also tried to read
      // `checkoutShippingAddressDetail` (apartment/floor/unit) which was NEVER
      // written here.  The detail field was silently discarded, causing the full
      // shipping address to be incomplete in the order record.
      localStorage.setItem('checkoutShippingAddress', selectedAddress.address)
      localStorage.setItem('checkoutShippingAddressDetail', selectedAddress.address_detail || '')
      localStorage.setItem('checkoutRecipientName', selectedAddress.recipient_name)
      localStorage.setItem('checkoutRecipientPhone', selectedAddress.phone)

      // 💾 장바구니 데이터를 localStorage에 백업 (결제 승인 시 사용)
      const cartBackup = cartItems.map(item => ({
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.quantity,
        price_snapshot: item.price_snapshot,
        option_value: item.option_value || null
      }))
      localStorage.setItem('checkoutCartBackup', JSON.stringify(cartBackup))
      console.log('[Payment] 💾 장바구니 백업 완료:', cartBackup.length, '개 상품')

      // ✅ 주문 번호 생성 (Toss Payments 규격 준수)
      const orderId = generateOrderId(userId || undefined)
      console.log('[Payment] ✅ Generated orderId:', orderId, 'Length:', orderId.length)
      
      // 주문명 생성
      const firstItem = cartItems[0]
      const orderName = cartItems.length > 1 
        ? `${firstItem.product_name} 외 ${cartItems.length - 1}건`
        : firstItem.product_name

      console.log('[Payment] requestPayment 호출:', { orderId, orderName, totalAmount })

      // 결제 요청 옵션 (Version 1 - 모바일/PC 자동 감지)
      // ✅ V1은 자동으로 환경을 감지하여 최적화된 UI 제공 (flowMode 불필요)
      const requestOptions: any = {
        orderId,
        orderName,
        successUrl: `${window.location.origin}/payment/success`,
        failUrl: `${window.location.origin}/payment/fail`,
        customerEmail: 'customer@example.com',
        customerName: selectedAddress.recipient_name,
        customerMobilePhone: selectedAddress.phone.replace(/-/g, '')
      }

      console.log('[Payment] 최종 요청 옵션 (V1 - 자동 모바일/PC 감지):', requestOptions)

      // 결제 요청
      // ⚠️ V1에서 successUrl/failUrl을 설정하면 리다이렉트 방식으로 작동
      // 모바일: 카드사 앱으로 이동 후 successUrl/failUrl로 리다이렉트
      // PC: iframe 내에서 처리 후 successUrl/failUrl로 리다이렉트
      // await를 사용하지 않음 (리다이렉트 방식이므로 Promise 반환 안됨)
      widgets.requestPayment(requestOptions)
    } catch (err: any) {
      console.error('[Payment] ❌ 결제 요청 실패:', err)
      
      // 약관 미동의 에러
      if (err.code === 'NEED_AGREEMENT' || err.message?.includes('약관') || err.message?.includes('동의')) {
        alert('필수 약관에 동의해주세요.')
        return
      }
      // Intent URL 에러 (카드사 앱 실행 실패)
      if (err.message && err.message.includes('intent://')) {
        console.log('[Payment] ⚠️ Intent URL 에러 발생 - 모바일 앱 실행 실패')
        showErrorToast('카드사 앱을 실행할 수 없습니다. 다른 결제 수단을 이용해주세요.')
      }
      // 팝업 차단 에러
      else if (err.code === 'POPUP_BLOCKED') {
        showErrorToast('팝업이 차단되었습니다. 팝업 차단을 해제해주세요.')
      } 
      // 사용자 취소는 조용히 처리
      else if (err.code === 'USER_CANCEL') {
        console.log('[Payment] 사용자가 결제를 취소했습니다.')
      } 
      // 그 외 에러
      else {
        showErrorToast('결제 요청에 실패했습니다. 다시 시도해주세요.')
      }
    } finally {
      // 2초 후 플래그 해제 (중복 클릭 방지)
      setTimeout(() => {
        setIsProcessing(false)
      }, 2000)
    }
  }

  // ✅ BUG #3 FIX: Auth-guard and loading checks rendered here (after all hooks)
  if (!isAuthReady || authLoading) {
    console.log('[CheckoutPage] ⏳ 인증 초기화 대기 중...', { authLoading, isAuthReady })
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
    console.log('[CheckoutPage] ❌ 사용자 없음 - 로그인 필요')
    requireLogin(navigate, '결제를 진행하려면 로그인이 필요합니다.')
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
                    console.log('[CheckoutPage] 배송지 변경 버튼 클릭')
                    console.log('[CheckoutPage] 현재 showAddressModal:', showAddressModal)
                    console.log('[CheckoutPage] 배송지 목록:', addresses)
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
                    cartItems={cartItems}
                    totalAmount={subtotal}
                    shippingFee={totalShippingFee}
                    onPaymentSuccess={(orderId, paymentKey, amount) => {
                      console.log('[CheckoutPage] 결제 성공:', { orderId, paymentKey, amount })
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
                      console.log('[CheckoutPage] Payment success:', { orderId, paymentIntentId, amount })
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
          console.log('[CheckoutPage] 배송지 모달 닫기')
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
                  console.log('[CheckoutPage] 배송지 아이템 클릭:', addr.id)
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
              console.log('[CheckoutPage] 새 배송지 추가 버튼 클릭')
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
                console.log('[CheckoutPage] 저장 버튼 클릭')
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
                console.log('[CheckoutPage] 취소 버튼 클릭')
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
