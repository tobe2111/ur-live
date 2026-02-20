import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import api from '@/lib/api'
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
      const response = await api.post('/api/shipping-addresses', {
        user_id: userId,
        ...newAddress
      })
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
          <div className="flex flex-1 flex-col lg:overflow-hidden lg:rounded-3xl">
            {/* 배송지 정보 */}
            <section className="bg-white px-5 py-6">
              <div className="flex items-center justify-between">
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
                  className="flex items-center text-[14px] sm:text-[15px] lg:text-[16px] font-semibold text-blue-600 transition-all hover:text-blue-700 hover:underline active:scale-95 cursor-pointer px-3 py-2 -mr-2 touch-manipulation"
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
                              {(item.price_snapshot * item.quantity).toLocaleString()}원
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
              
              {/* TossPayments widget - DO NOT MODIFY */}
              <div 
                id="payment-method" 
                className="w-full"
                style={{
                  minHeight: '120px',
                  width: '100%',
                  maxWidth: '100%',
                  overflow: 'visible'
                }}
              />
              
              {!ready && (
                <div className="flex items-center justify-center py-6 text-gray-500 text-sm">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-2"></div>
                  <p>결제 수단 불러오는 중...</p>
                </div>
              )}
              
              {/* 약관 동의 위젯 */}
              <div 
                id="agreement" 
                className="w-full mt-0.5"
                style={{
                  width: '100%',
                  maxWidth: '100%',
                  overflow: 'visible'
                }}
              />
            </section>
          </div>

          {/* Right column - Order summary (desktop only) */}
          <div className="hidden lg:block lg:w-[360px]">
            <div className="sticky top-20 overflow-hidden rounded-3xl">
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

                {/* Desktop payment button */}
                <div className="mt-6">
                  <button
                    type="button"
                    onClick={handlePayment}
                    disabled={!ready || !selectedAddress || isProcessing || !widgets}
                    className="flex w-full items-center justify-center rounded-2xl bg-blue-600 py-[18px] text-[16px] font-bold text-white transition-all hover:brightness-95 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {isProcessing ? (
                      <div className="flex items-center gap-2">
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                        <span>결제 처리중</span>
                      </div>
                    ) : !widgets ? (
                      '결제 시스템 로딩 중...'
                    ) : !selectedAddress ? (
                      '⚠️ 배송지를 선택해주세요'
                    ) : !ready ? (
                      '결제 UI 준비 중...'
                    ) : (
                      <span>{totalAmount.toLocaleString()}원 결제하기</span>
                    )}
                  </button>
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

      {/* Mobile pay bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 lg:hidden z-50">
        <button
          type="button"
          onClick={handlePayment}
          onTouchEnd={(e) => {
            // 모바일 터치 이벤트 지원
            e.preventDefault()
            if (!isProcessing && ready && selectedAddress) {
              handlePayment(e)
            }
          }}
          disabled={!ready || !selectedAddress || isProcessing || !widgets}
          className="w-full flex items-center justify-center rounded-2xl bg-blue-600 py-4 text-[16px] font-bold text-white transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed touch-manipulation"
          style={{
            backgroundColor: !ready || !selectedAddress || !widgets ? '#e5e7eb' : undefined,
            color: !ready || !selectedAddress || !widgets ? '#9ca3af' : undefined,
            touchAction: 'manipulation',
            WebkitTapHighlightColor: 'transparent'
          }}
        >
          {isProcessing ? (
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              <span>결제 처리중</span>
            </div>
          ) : !widgets ? (
            '결제 시스템 로딩 중...'
          ) : !selectedAddress ? (
            '⚠️ 배송지를 선택해주세요'
          ) : !ready ? (
            '결제 UI 준비 중...'
          ) : (
            <span>{totalAmount.toLocaleString()}원 결제하기</span>
          )}
        </button>

      {/* 약관 링크 - 최하단 (모바일만) */}
      <div className="bg-gray-50 py-4 border-t border-gray-200 lg:hidden">
        <div className="mx-auto max-w-lg px-5">
          <p className="text-[11px] text-gray-500 text-center mb-2">
            결제 진행 시 아래 약관에 동의한 것으로 간주됩니다
          </p>
          <div className="flex justify-center gap-2 text-[11px]">
            <Link 
              to="/terms" 
              target="_blank"
              className="text-gray-600 hover:text-blue-600 underline"
            >
              이용약관
            </Link>
            <span className="text-gray-300">|</span>
            <Link 
              to="/privacy" 
              target="_blank"
              className="text-gray-600 hover:text-blue-600 underline"
            >
              개인정보 처리방침
            </Link>
          </div>
        </div>
      </div>

      {/* 배송지 선택 모달 */}
      {console.log('[CheckoutPage] 배송지 모달 렌더링 - showAddressModal:', showAddressModal, 'addresses:', addresses.length)}
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
    </div>
  )
}
