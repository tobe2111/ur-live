import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import axios from 'axios'
import { handleApiError, showErrorToast } from '@/lib/errorHandler'
import { Button } from '@/components/ui/button'
import { ArrowLeft, AlertCircle, Package, MapPin, Plus, ChevronRight } from 'lucide-react'
import { requireLogin, getUserId, isLoggedIn } from '@/utils/auth'
import { CustomModal, useModal } from '@/components/CustomModal'

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

interface CartItem {
  id: number
  product_id: number
  product_name: string
  image_url: string
  quantity: number
  price_snapshot: number
  option_value?: string
  seller_id?: number
  seller_name?: string
  shipping_fee?: number
  free_shipping_threshold?: number
}

interface ShippingAddress {
  id: number
  recipient_name: string
  phone: string
  postal_code: string
  address: string
  address_detail: string
  is_default: number
}

declare global {
  interface Window {
    daum: any
  }
}

function generateRandomString() {
  return window.btoa(Math.random().toString()).slice(0, 20)
}

export default function CheckoutPage() {
  console.log('🚀🚀🚀 CheckoutPage 컴포넌트 마운트됨 - ' + new Date().toISOString())
  const navigate = useNavigate()
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [userId, setUserId] = useState<string | null>(null)
  
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

  // 셀러별 장바구니 그룹화 및 배송비 계산
  const sellerGroups = cartItems.reduce((groups, item) => {
    const sellerId = item.seller_id || 0
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
    groups[sellerId].subtotal += item.price_snapshot * item.quantity
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
  const subtotal = cartItems.reduce((sum, item) => sum + item.price_snapshot * item.quantity, 0)
  
  const totalShippingFee = Object.values(sellerGroups).reduce((total, group) => {
    if (group.free_shipping_threshold > 0 && group.subtotal >= group.free_shipping_threshold) {
      return total
    }
    return total + group.shipping_fee
  }, 0)

  const totalAmount = subtotal + totalShippingFee

  // 🎯 Step 1: 토스페이먼츠 SDK 초기화 및 위젯 인스턴스 생성
  useEffect(() => {
    async function fetchPaymentWidgets() {
      if (!userId || cartItems.length === 0) {
        console.log('[TossPayments] Step 1 대기 중: userId 또는 cartItems 없음')
        return
      }

      try {
        console.log('[TossPayments] Step 1: SDK 초기화 시작')
        console.log('[TossPayments] window.PaymentWidget 존재 여부:', typeof window.PaymentWidget)
        
        // 전역 객체에서 SDK 로드 확인
        if (typeof window.PaymentWidget === 'undefined') {
          throw new Error('결제위젯 SDK가 로드되지 않았습니다. index.html을 확인하세요.')
        }
        
        // 결제위젯 초기화 (Version 1 공식 샘플 방식 - new 키워드 없음)
        const customerKey = `customer_${userId}`  // 고유한 구매자 ID
        const widgetsInstance = window.PaymentWidget(clientKey, customerKey)
        console.log('[TossPayments] ✅ PaymentWidget 인스턴스 생성 완료 (V1 함수 호출 방식)')
        
        setWidgets(widgetsInstance)
        console.log('[TossPayments] ✅ Step 1 완료: widgets 인스턴스 생성')
      } catch (err) {
        console.error('[TossPayments] ❌ Step 1 실패:', err)
        setError('결제 시스템을 불러올 수 없습니다.')
      }
    }

    fetchPaymentWidgets()
  }, [userId, cartItems])

  // 🎯 Step 2: 결제 UI 렌더링 (한 번만 실행, 금액은 Step 3에서 업데이트)
  useEffect(() => {
    async function renderPaymentWidgets() {
      if (widgets == null) {
        console.log('[TossPayments] Step 2: widgets 없음, 대기 중')
        return
      }
      
      // 이미 렌더링되었다면 중복 실행 방지
      if (ready) {
        console.log('[TossPayments] Step 2: 이미 렌더링됨, 스킵')
        return
      }

      try {
        console.log('[TossPayments] Step 2: 결제 UI 렌더링 시작')
        console.log('[TossPayments] totalAmount:', totalAmount)
        console.log('[TossPayments] cartItems:', cartItems.length)
        
        // DOM 요소가 존재할 때까지 대기 (최적화: 최대 5초)
        let paymentMethodEl = null
        let agreementEl = null
        let attempts = 0
        const maxAttempts = 50  // 50번 시도 (5초) - 최적화
        
        while (attempts < maxAttempts) {
          paymentMethodEl = document.getElementById('payment-method')
          agreementEl = document.getElementById('agreement')
          
          if (paymentMethodEl && agreementEl) {
            console.log('[TossPayments] ✅ DOM 요소 발견! (', attempts * 100, 'ms)')
            
            // 모바일에서 높이 강제 설정
            if (/Mobile|Android|iPhone/i.test(navigator.userAgent)) {
              paymentMethodEl.style.minHeight = '350px'
              console.log('[TossPayments] 📱 모바일 최소 높이 설정: 350px')
            }
            
            break
          }
          
          console.log('[TossPayments] ⏳ DOM 대기 중... (', attempts * 100, 'ms)')
          await new Promise(resolve => setTimeout(resolve, 100))
          attempts++
        }
        
        if (!paymentMethodEl || !agreementEl) {
          console.error('[TossPayments] ❌ DOM 요소를 찾을 수 없음 (10초 초과)')
          console.error('[TossPayments] payment-method:', paymentMethodEl)
          console.error('[TossPayments] agreement:', agreementEl)
          console.error('[TossPayments] 디버그 - document.body.innerHTML 길이:', document.body.innerHTML.length)
          setError('결제 UI를 불러올 수 없습니다. 페이지를 새로고침해주세요.')
          return
        }
        
        // 결제 수단 UI 렌더링 전 로그
        console.log('[TossPayments] renderPaymentMethods 호출 직전')
        console.log('[TossPayments] widgets:', widgets)
        console.log('[TossPayments] widgets.renderPaymentMethods:', typeof widgets.renderPaymentMethods)
        console.log('[TossPayments] 모바일 환경:', /Mobile|Android|iPhone/i.test(navigator.userAgent))
        console.log('[TossPayments] 화면 크기:', window.innerWidth, 'x', window.innerHeight)
        
        // 결제 수단 UI 렌더링 (Version 1 - 동기 메서드, 반환값 저장)
        console.log('[TossPayments] 초기 금액으로 렌더링:', totalAmount)
        
        // 모바일 환경에서 추가 대기 시간
        if (/Mobile|Android|iPhone/i.test(navigator.userAgent)) {
          console.log('[TossPayments] 📱 모바일 환경 - 500ms 추가 대기')
          await new Promise(resolve => setTimeout(resolve, 500))
        }
        
        const paymentMethodWidgetInstance = widgets.renderPaymentMethods(
          '#payment-method',
          { value: totalAmount },
          { variantKey: 'DEFAULT' }
        )
        
        console.log('[TossPayments] renderPaymentMethods 완료, 반환값:', paymentMethodWidgetInstance)
        console.log('[TossPayments] renderPaymentMethods.on:', typeof paymentMethodWidgetInstance?.on)
        
        // 이용약관 UI 렌더링 (Version 1 - 동기 메서드)
        console.log('[TossPayments] renderAgreement 호출')
        widgets.renderAgreement(
          '#agreement',
          { variantKey: 'AGREEMENT' }
        )
        console.log('[TossPayments] renderAgreement 완료')
        
        // V1 공식: 'ready' 이벤트로 렌더링 완료 확인
        if (paymentMethodWidgetInstance && typeof paymentMethodWidgetInstance.on === 'function') {
          console.log('[TossPayments] ready 이벤트 리스너 등록')
          paymentMethodWidgetInstance.on('ready', function() {
            console.log('[TossPayments] 🎉 ready 이벤트 발생!')
            setPaymentMethodWidget(paymentMethodWidgetInstance)  // 저장
            setReady(true)
            console.log('[TossPayments] ✅ Step 2 완료: UI 렌더링 준비됨 (ready 이벤트)')
          })
        } else {
          console.error('[TossPayments] ❌ paymentMethodWidgetInstance.on이 함수가 아님')
          console.error('[TossPayments] paymentMethodWidgetInstance:', paymentMethodWidgetInstance)
        }
      } catch (err: any) {
        console.error('[TossPayments] ❌ Step 2 실패:', err)
        console.error('[TossPayments] 에러 메시지:', err.message)
        console.error('[TossPayments] 에러 스택:', err.stack)
        setError('결제 UI 렌더링에 실패했습니다: ' + err.message)
      }
    }

    renderPaymentWidgets()
  }, [widgets, totalAmount, cartItems])  // totalAmount와 cartItems 추가하여 변경 시 재렌더링

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

  // 초기 데이터 로드
  useEffect(() => {
    console.log('[CheckoutPage] 🎯 초기 데이터 로드 useEffect 실행됨')
    const uid = getUserId()
    console.log('[CheckoutPage] userId:', uid)
    console.log('[CheckoutPage] isLoggedIn:', isLoggedIn())
    
    if (!isLoggedIn()) {
      console.log('[CheckoutPage] ❌ 로그인 필요 - requireLogin() 호출')
      requireLogin(navigate, '결제를 진행하려면 로그인이 필요합니다.')
      return
    }

    if (!uid) {
      console.log('[CheckoutPage] ❌ userId 없음')
      setError('사용자 정보를 확인할 수 없습니다.')
      setLoading(false)
      return
    }

    console.log('[CheckoutPage] ✅ userId 설정:', uid)
    setUserId(uid)

    const loadData = async () => {
      try {
        console.log('[CheckoutPage] 📡 장바구니 API 호출 시작: /api/cart/' + uid)
        // 장바구니 조회
        const cartResponse = await axios.get(`/api/cart/${uid}`)
        console.log('[CheckoutPage] 장바구니 응답:', cartResponse.data)
        if (cartResponse.data.success && cartResponse.data.data.length > 0) {
          console.log('[CheckoutPage] ✅ 장바구니 데이터 설정:', cartResponse.data.data.length, '개 상품')
          setCartItems(cartResponse.data.data)
        } else {
          console.log('[CheckoutPage] ❌ 장바구니 비어있음')
          setError('장바구니가 비어있습니다.')
          setTimeout(() => navigate('/cart'), 2000)
        }

        // 배송지 조회
        console.log('[CheckoutPage] 📡 배송지 API 호출 시작: /api/shipping-addresses/' + uid)
        const addressResponse = await axios.get(`/api/shipping-addresses/${uid}`)
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
        handleApiError(err, '데이터 로드 실패')
        setError('데이터를 불러올 수 없습니다.')
      } finally {
        console.log('[CheckoutPage] 로딩 완료')
        setLoading(false)
      }
    }

    console.log('[CheckoutPage] loadData() 호출')
    loadData()

    // Daum 우편번호 스크립트 로드
    const script = document.createElement('script')
    script.src = '//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js'
    script.async = true
    document.head.appendChild(script)
  }, [navigate])

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
      showErrorToast('로그인이 필요합니다.')
      return
    }

    if (!newAddress.recipient_name || !newAddress.phone || !newAddress.postal_code || !newAddress.address) {
      showErrorToast('모든 필수 항목을 입력해주세요.')
      return
    }

    try {
      const response = await axios.post('/api/shipping-addresses', {
        user_id: userId,
        ...newAddress
      })

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
      handleApiError(err, '배송지 저장 실패')
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

    // 처리 중 플래그 설정
    setIsProcessing(true)
    console.log('[Payment] ✅ 결제 시작:', { totalAmount, selectedAddress })

    try {
      // 배송지 정보를 localStorage에 저장 (PaymentSuccessPage에서 사용)
      localStorage.setItem('checkoutShippingAddress', selectedAddress.address)
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

      // 주문 번호 생성
      const orderId = `ORDER_${Date.now()}_${generateRandomString()}`
      
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">로딩 중...</p>
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
    <div className="w-full min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6">
        {/* 헤더 */}
        <div className="mb-4 sm:mb-6">
          <button
            onClick={() => navigate('/cart')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-3 sm:mb-4 text-sm sm:text-base"
          >
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            <span>장바구니로 돌아가기</span>
          </button>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold">주문/결제</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* 좌측: 주문 정보 */}
        <div className="lg:col-span-2 space-y-4 sm:space-y-6">
          {/* 배송지 정보 */}
          <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                <h2 className="text-base sm:text-lg lg:text-xl font-bold">배송지 정보</h2>
              </div>
              <Button
                onClick={() => setShowAddressModal(true)}
                variant="outline"
                size="sm"
              >
                {selectedAddress ? '변경' : '선택'}
              </Button>
            </div>

            {!selectedAddress && (
              <div className="bg-red-50 border-2 border-red-300 rounded-lg p-3 sm:p-4">
                <div className="flex items-start gap-2 sm:gap-3">
                  <AlertCircle className="w-5 h-5 sm:w-6 sm:h-6 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-red-800 font-bold text-sm sm:text-base lg:text-lg">⚠️ 배송지를 선택해주세요</p>
                    <p className="text-red-700 text-xs sm:text-sm mt-1">배송지를 선택하셔야 결제가 가능합니다.</p>
                  </div>
                </div>
              </div>
            )}

            {selectedAddress && (
              <div className="space-y-2 bg-blue-50 rounded-lg p-3 sm:p-4 border border-blue-200">
                <p className="font-semibold text-sm sm:text-base lg:text-lg">{selectedAddress.recipient_name}</p>
                <p className="text-gray-700 text-sm sm:text-base">{selectedAddress.phone}</p>
                <p className="text-gray-600 text-xs sm:text-sm">
                  [{selectedAddress.postal_code}] {selectedAddress.address}
                </p>
                {selectedAddress.address_detail && (
                  <p className="text-gray-600 text-xs sm:text-sm">{selectedAddress.address_detail}</p>
                )}
              </div>
            )}
          </div>

          {/* 주문 상품 정보 */}
          <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-3 sm:mb-4">
              <Package className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
              <h2 className="text-base sm:text-lg lg:text-xl font-bold">주문 상품</h2>
            </div>

            <div className="space-y-3 sm:space-y-4">
              {Object.values(sellerGroups).map((group) => (
                <div key={group.seller_id} className="border border-gray-200 rounded-lg p-3 sm:p-4">
                  <p className="text-xs sm:text-sm font-semibold text-gray-700 mb-2 sm:mb-3">
                    {group.seller_name}
                  </p>
                  
                  {group.items.map((item) => (
                    <div key={item.id} className="flex gap-2 sm:gap-4 py-2 sm:py-3 border-t border-gray-100 first:border-t-0">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm sm:text-base truncate">{item.product_name}</p>
                        {item.option_value && (
                          <p className="text-xs sm:text-sm text-gray-500">{item.option_value}</p>
                        )}
                        <p className="text-xs sm:text-sm text-gray-600 mt-1">
                          {item.price_snapshot.toLocaleString()}원 × {item.quantity}개
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-bold text-sm sm:text-base">
                          {(item.price_snapshot * item.quantity).toLocaleString()}원
                        </p>
                      </div>
                    </div>
                  ))}

                  {/* 배송비 정보 */}
                  <div className="mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-gray-200 flex justify-between text-xs sm:text-sm">
                    <span className="text-gray-600">배송비</span>
                    <span className="font-semibold">
                      {group.free_shipping_threshold > 0 && group.subtotal >= group.free_shipping_threshold
                        ? '무료'
                        : `${group.shipping_fee.toLocaleString()}원`}
                    </span>
                  </div>
                  {group.free_shipping_threshold > 0 && group.subtotal < group.free_shipping_threshold && (
                    <p className="text-[10px] sm:text-xs text-gray-500 mt-1">
                      {(group.free_shipping_threshold - group.subtotal).toLocaleString()}원 추가 시 무료배송
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 결제 수단 선택 */}
          <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6">
            <h2 className="text-base sm:text-lg font-bold mb-3 sm:mb-4">결제 수단</h2>
            
            {/* 토스페이먼츠 위젯 렌더링 영역 - 모바일 최적화 */}
            {/* 모바일: min-h-[350px], PC: min-h-[300px] */}
            <div 
              id="payment-method" 
              className="min-h-[350px] sm:min-h-[300px] w-full"
              style={{
                minHeight: '350px', // 모바일 기본값
                width: '100%',
                maxWidth: '100%',
                overflow: 'visible'
              }}
            ></div>
            <div 
              id="agreement" 
              className="mt-4 w-full"
              style={{
                width: '100%',
                maxWidth: '100%',
                overflow: 'visible'
              }}
            ></div>
            
            {!ready && (
              <div className="flex items-center justify-center py-8 text-gray-500 text-xs sm:text-sm">
                <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-blue-600 mr-3"></div>
                <div className="text-center">
                  <p>결제 수단 불러오는 중...</p>
                  <p className="text-xs text-gray-400 mt-1">최대 10초 소요될 수 있습니다</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 우측: 결제 요약 */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6 lg:sticky lg:top-6">
            <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4">결제 금액</h2>
            
            <div className="space-y-2 sm:space-y-3">
              <div className="flex justify-between text-gray-600 text-sm sm:text-base">
                <span>상품 금액</span>
                <span>{subtotal.toLocaleString()}원</span>
              </div>
              <div className="flex justify-between text-gray-600 text-sm sm:text-base">
                <span>배송비</span>
                <span>{totalShippingFee.toLocaleString()}원</span>
              </div>
              <div className="border-t border-gray-200 pt-2 sm:pt-3 flex justify-between text-base sm:text-lg font-bold">
                <span>총 결제 금액</span>
                <span className="text-blue-600">{totalAmount.toLocaleString()}원</span>
              </div>
            </div>

            <Button
              onClick={handlePayment}
              onTouchEnd={(e) => {
                // 모바일 터치 이벤트 지원
                e.preventDefault()
                if (!isProcessing && ready && selectedAddress) {
                  handlePayment(e)
                }
              }}
              className="w-full mt-4 sm:mt-6 py-4 sm:py-6 text-base sm:text-lg font-bold touch-manipulation"
              disabled={!ready || !selectedAddress || isProcessing || !widgets}
              style={{
                backgroundColor: !ready || !selectedAddress || !widgets ? '#e5e7eb' : undefined,
                cursor: !ready || !selectedAddress || isProcessing || !widgets ? 'not-allowed' : 'pointer',
                touchAction: 'manipulation', // 모바일 더블탭 줌 방지
                WebkitTapHighlightColor: 'transparent' // iOS 탭 하이라이트 제거
              }}
            >
              {isProcessing 
                ? '결제 진행 중...'
                : !widgets
                  ? '결제 시스템 로딩 중...'
                  : !selectedAddress 
                    ? '⚠️ 배송지를 선택해주세요'
                    : !ready 
                      ? '결제 UI 준비 중...'
                      : '결제하기'}
            </Button>

            {!selectedAddress && (
              <div className="mt-3 p-2 sm:p-3 bg-amber-50 border border-amber-300 rounded-lg">
                <p className="text-xs sm:text-sm text-amber-800 text-center">
                  ⚠️ 배송지를 선택하셔야 결제가 가능합니다
                </p>
              </div>
            )}

            {/* 약관 링크 */}
            <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-gray-200">
              <p className="text-[10px] sm:text-xs text-gray-500 text-center mb-2">
                결제 진행 시 아래 약관에 동의한 것으로 간주됩니다
              </p>
              <div className="flex justify-center gap-2 sm:gap-3 text-[10px] sm:text-xs">
                <Link 
                  to="/terms" 
                  target="_blank"
                  className="text-blue-600 hover:text-blue-800 underline"
                >
                  이용약관
                </Link>
                <span className="text-gray-300">|</span>
                <Link 
                  to="/privacy" 
                  target="_blank"
                  className="text-blue-600 hover:text-blue-800 underline"
                >
                  개인정보 처리방침
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 배송지 선택 모달 */}
      <CustomModal
        isOpen={showAddressModal}
        onClose={() => setShowAddressModal(false)}
        title="배송지 선택"
      >
        <div className="space-y-4">
          {addresses.length === 0 ? (
            <p className="text-gray-500 text-center py-4">등록된 배송지가 없습니다.</p>
          ) : (
            addresses.map((addr) => (
              <div
                key={addr.id}
                className={`border rounded-lg p-4 cursor-pointer hover:bg-gray-50 transition ${
                  selectedAddress?.id === addr.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                }`}
                onClick={() => {
                  setSelectedAddress(addr)
                  setShowAddressModal(false)
                }}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold">{addr.recipient_name}</p>
                    <p className="text-sm text-gray-600 mt-1">{addr.phone}</p>
                    <p className="text-sm text-gray-600 mt-1">
                      [{addr.postal_code}] {addr.address}
                    </p>
                    {addr.address_detail && (
                      <p className="text-sm text-gray-600">{addr.address_detail}</p>
                    )}
                  </div>
                  {addr.is_default === 1 && (
                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                      기본배송지
                    </span>
                  )}
                </div>
              </div>
            ))
          )}

          <Button
            onClick={() => setShowNewAddressForm(true)}
            className="w-full"
            variant="outline"
          >
            <Plus className="w-4 h-4 mr-2" />
            새 배송지 추가
          </Button>
        </div>
      </CustomModal>

      {/* 새 배송지 추가 모달 */}
      <CustomModal
        isOpen={showNewAddressForm}
        onClose={() => setShowNewAddressForm(false)}
        title="새 배송지 추가"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">수령인 이름 *</label>
            <input
              type="text"
              value={newAddress.recipient_name}
              onChange={(e) => setNewAddress({ ...newAddress, recipient_name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="수령인 이름"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">연락처 *</label>
            <input
              type="tel"
              value={newAddress.phone}
              onChange={(e) => setNewAddress({ ...newAddress, phone: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="010-1234-5678"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">우편번호 *</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newAddress.postal_code}
                readOnly
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                placeholder="우편번호"
              />
              <Button
                onClick={() => setShowPostcodePopup(true)}
                variant="outline"
              >
                주소 검색
              </Button>
            </div>
          </div>

          {showPostcodePopup && (
            <div
              id="daum-postcode-container"
              style={{ width: '100%', height: '400px' }}
            ></div>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">주소 *</label>
            <input
              type="text"
              value={newAddress.address}
              readOnly
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
              placeholder="주소"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">상세주소</label>
            <input
              type="text"
              value={newAddress.address_detail}
              onChange={(e) => setNewAddress({ ...newAddress, address_detail: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              placeholder="상세주소 (선택)"
            />
          </div>

          <div className="flex gap-2">
            <Button onClick={handleSaveNewAddress} className="flex-1">
              저장
            </Button>
            <Button
              onClick={() => {
                setShowNewAddressForm(false)
                setShowPostcodePopup(false)
              }}
              variant="outline"
              className="flex-1"
            >
              취소
            </Button>
          </div>
        </div>
      </CustomModal>
      </div>
    </div>
  )
}
