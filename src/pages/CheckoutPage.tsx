import { CustomModal, useModal } from '@/components/CustomModal'
import { useEffect, useState, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import axios from 'axios'
import { handleApiError, showErrorToast } from '@/lib/errorHandler'
import { Button } from '@/components/ui/button'
import { ArrowLeft, AlertCircle, Package, MapPin, Plus, ChevronRight } from 'lucide-react'
import { requireLogin, getUserId, isLoggedIn } from '@/utils/auth'
import { loadTossPayments, ANONYMOUS } from '@tosspayments/tosspayments-sdk'

// 환경변수에서 토스페이먼츠 클라이언트 키 가져오기
// 결제위젯 연동 키 (test_gck_xxx) 사용
const clientKey = import.meta.env.VITE_TOSS_CLIENT_KEY || 'test_gck_P9BRQmyarYPA5lOO6OXaVJ07KzLN'

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

export default function CheckoutPage() {
  const navigate = useNavigate()
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [userId, setUserId] = useState<string | null>(null)
  
  // 토스페이먼츠 결제 위젯 관련 상태
  const widgetsRef = useRef<any>(null)  // TossPayments widgets instance
  const [widgets, setWidgets] = useState<any>(null)  // 상태로 관리
  const [ready, setReady] = useState(false)

  // 배송지 관련 상태
  const [addresses, setAddresses] = useState<ShippingAddress[]>([])
  const [selectedAddress, setSelectedAddress] = useState<ShippingAddress | null>(null)
  const [showAddressModal, setShowAddressModal] = useState(false)
  const [showNewAddressForm, setShowNewAddressForm] = useState(false)
  
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
        shipping_fee: item.shipping_fee || 3000,  // 기본 배송비 3,000원
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

  // 전체 소계 계산
  const subtotal = cartItems.reduce(
    (sum, item) => sum + item.price_snapshot * item.quantity,
    0
  )

  // 셀러별 배송비 계산 (무료배송 조건 체크)
  const totalShippingFee = Object.values(sellerGroups).reduce((sum, group) => {
    // 무료배송 조건: free_shipping_threshold가 0보다 크고, 소계가 조건 이상일 때
    if (group.free_shipping_threshold > 0 && group.subtotal >= group.free_shipping_threshold) {
      return sum  // 무료배송
    }
    return sum + group.shipping_fee  // 배송비 추가
  }, 0)

  // 최종 결제 금액
  const totalAmount = subtotal + totalShippingFee

  useEffect(() => {
    // 통합 인증 체크
    if (!isLoggedIn()) {
      requireLogin(navigate, '결제하려면 로그인이 필요합니다.')
      return
    }
    
    const uid = getUserId()
    if (!uid) {
      requireLogin(navigate, '결제하려면 로그인이 필요합니다.')
      return
    }
    
    setUserId(uid)
    loadCart(uid)
    loadAddresses(uid)
    
    // Daum 우편번호 API 스크립트 로드
    const script = document.createElement('script')
    script.src = '//t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js'
    script.async = true
    document.body.appendChild(script)
    
    return () => {
      document.body.removeChild(script)
    }
  }, [])

  // Toss Payments SDK 로깅 오류 무시
  useEffect(() => {
    const originalError = console.error
    console.error = (...args: any[]) => {
      // log.tosspayments.com 관련 오류는 무시
      if (args[0]?.includes?.('log.tosspayments.com')) {
        return
      }
      originalError.apply(console, args)
    }
    
    return () => {
      console.error = originalError
    }
  }, [])

  // 토스페이먼츠 결제 위젯 초기화 (공식 가이드 기반)
  // Step 1: TossPayments 인스턴스 로드 및 widgets 초기화
  useEffect(() => {
    async function fetchPaymentWidgets() {
      if (!userId || cartItems.length === 0) {
        return
      }

      try {
        // ------ 결제위젯 초기화 ------
        const tossPayments = await loadTossPayments(clientKey)
        
        // 비회원 결제 (브랜드페이 비활성화)
        const widgetsInstance = tossPayments.widgets({ customerKey: ANONYMOUS })
        
        widgetsRef.current = widgetsInstance
        setWidgets(widgetsInstance)  // 상태 업데이트
        console.log('[CheckoutPage] TossPayments widgets 초기화 완료')
      } catch (error) {
        console.error('[CheckoutPage] TossPayments 초기화 실패:', error)
        setError('결제 시스템을 불러올 수 없습니다.')
      }
    }

    fetchPaymentWidgets()
  }, [userId, cartItems.length])

  // Step 2: 결제 금액 설정 및 UI 렌더링
  useEffect(() => {
    async function renderPaymentWidgets() {
      if (widgets == null || totalAmount === 0) {
        return
      }

      try {
        // ------ 주문의 결제 금액 설정 ------
        await widgets.setAmount({
          currency: 'KRW',
          value: totalAmount,
        })

        await Promise.all([
          // ------ 결제 UI 렌더링 ------
          widgets.renderPaymentMethods({
            selector: '#payment-widget',
            variantKey: 'DEFAULT',
          }),
          // ------ 이용약관 UI 렌더링 ------
          widgets.renderAgreement({
            selector: '#agreement',
            variantKey: 'AGREEMENT',
          }),
        ])

        setReady(true)
        console.log('[CheckoutPage] 결제 UI 렌더링 완료 ✅')
      } catch (error) {
        console.error('[CheckoutPage] 결제 UI 렌더링 실패:', error)
        setError('결제 화면을 불러올 수 없습니다.')
      }
    }

    renderPaymentWidgets()
  }, [widgets, totalAmount])

  // Step 3: 금액 변경 시 업데이트
  useEffect(() => {
    if (widgets == null) {
      return
    }

    widgets.setAmount({
      currency: 'KRW',
      value: totalAmount,
    })
  }, [widgets, totalAmount])

  // 결제 요청 처리
  const handlePayment = async () => {
    if (!widgets) {
      alert('결제 위젯이 준비되지 않았습니다.')
      return
    }

    if (!selectedAddress) {
      alert('배송지를 선택해주세요.')
      return
    }

    try {
      // 배송지 정보를 localStorage에 저장 (PaymentSuccessPage에서 사용)
      localStorage.setItem('checkoutShippingAddress', 
        `${selectedAddress.postal_code} ${selectedAddress.address} ${selectedAddress.address_detail || ''}`.trim()
      )
      localStorage.setItem('checkoutRecipientName', selectedAddress.recipient_name)
      localStorage.setItem('checkoutRecipientPhone', selectedAddress.phone)

      // 주문 ID 생성 (timestamp + random)
      const orderId = `ORDER_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
      
      // 주문명 생성
      const orderName = cartItems.length === 1 
        ? cartItems[0].product_name
        : `${cartItems[0].product_name} 외 ${cartItems.length - 1}건`

      // ------ '결제하기' 버튼 누르면 결제창 띄우기 ------
      await widgets.requestPayment({
        orderId,
        orderName,
        successUrl: `${window.location.origin}/payment/success`,
        failUrl: `${window.location.origin}/payment/fail`,
        customerEmail: '',
        customerName: selectedAddress.recipient_name,
        customerMobilePhone: selectedAddress.phone,
      })
    } catch (error: any) {
      console.error('[CheckoutPage] 결제 요청 실패:', error)
      
      // 팝업 차단 에러 감지
      if (error?.code === 'POPUP_BLOCKED' || error?.message?.includes('팝업')) {
        alert('📱 팝업이 차단되었습니다.\n\n브라우저 설정에서 이 사이트의 팝업을 허용해주세요.\n\n[브라우저 주소창 오른쪽의 팝업 차단 아이콘을 클릭하여 허용]')
      } else if (error?.code === 'USER_CANCEL') {
        // 사용자가 결제를 취소한 경우 (정상)
        console.log('[CheckoutPage] 사용자가 결제를 취소했습니다.')
      } else {
        alert('결제 요청 중 오류가 발생했습니다.')
      }
    }
  }

  async function loadCart(uid: string) {
    try {
      const response = await axios.get(`/api/cart/${uid}`)
      
      if (response.data.success) {
        setCartItems(response.data.data || [])
      } else {
        setError('장바구니를 불러올 수 없습니다.')
      }
    } catch (err: any) {
      console.error('Failed to load cart:', err)
      setError('장바구니를 불러오는 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  async function loadAddresses(uid: string) {
    try {
      const response = await axios.get(`/api/shipping-addresses/${uid}`)
      if (response.data.success) {
        const addrs = response.data.data || []
        setAddresses(addrs)
        // 기본 배송지 자동 선택
        const defaultAddr = addrs.find((a: ShippingAddress) => a.is_default === 1)
        if (defaultAddr) {
          setSelectedAddress(defaultAddr)
        } else if (addrs.length > 0) {
          setSelectedAddress(addrs[0])
        }
      }
    } catch (err: any) {
      console.error('Failed to load addresses:', err)
    }
  }

  const [showPostcodePopup, setShowPostcodePopup] = useState(false)

  function openPostcode() {
    if (!window.daum || !window.daum.Postcode) {
      alert('우편번호 서비스를 불러오는 중입니다. 잠시 후 다시 시도해주세요.')
      return
    }

    setShowPostcodePopup(true)
  }

  useEffect(() => {
    if (showPostcodePopup && window.daum && window.daum.Postcode) {
      const container = document.getElementById('daum-postcode-container')
      if (container) {
        new window.daum.Postcode({
          oncomplete: function(data: any) {
            setNewAddress(prev => ({
              ...prev,
              postal_code: data.zonecode,
              address: data.roadAddress || data.jibunAddress
            }))
            setShowPostcodePopup(false)
          },
          width: '100%',
          height: '100%'
        }).embed(container)
      }
    }
  }, [showPostcodePopup])

  async function handleSaveNewAddress() {
    if (!userId) return
    
    if (!newAddress.recipient_name || !newAddress.phone || !newAddress.postal_code || !newAddress.address) {
      alert('모든 필수 항목을 입력해주세요.')
      return
    }

    try {
      const response = await axios.post('/api/shipping-addresses', {
        user_id: parseInt(userId),
        ...newAddress
      })

      if (response.data.success) {
        alert('배송지가 저장되었습니다.')
        await loadAddresses(userId)
        setShowNewAddressForm(false)
        setNewAddress({
          recipient_name: '',
          phone: '',
          postal_code: '',
          address: '',
          address_detail: '',
          is_default: 0
        })
      }
    } catch (err: any) {
      console.error('Failed to save address:', err)
      alert('배송지 저장에 실패했습니다.')
    }
  }

  // subtotal과 totalAmount는 이미 상단에서 정의됨 (중복 제거)

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fbfbfd] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#007aff]"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#fbfbfd] flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-[#1d1d1f] mb-2">오류가 발생했습니다</h2>
          <p className="text-[#6e6e73] mb-6">{error}</p>
          <Button onClick={() => navigate('/')}>메인으로 돌아가기</Button>
        </div>
      </div>
    )
  }

  if (cartItems.length === 0) {
    return (
      <div className="min-h-screen bg-[#fbfbfd] flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <Package className="h-16 w-16 text-[#6e6e73] mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-[#1d1d1f] mb-2">장바구니가 비어있습니다</h2>
          <p className="text-[#6e6e73] mb-6">상품을 담아주세요</p>
          <Button onClick={() => navigate('/')}>쇼핑 계속하기</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#fbfbfd]">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-[#d2d2d7]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16">
            <Link to="/" className="flex items-center space-x-2 text-[#007aff] hover:text-[#0051d5] transition-colors">
              <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="text-sm sm:text-base font-medium">뒤로</span>
            </Link>
            <h1 className="text-base sm:text-lg font-semibold text-[#1d1d1f]">주문 확인</h1>
            <div className="w-20"></div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">

        <div className="grid lg:grid-cols-3 gap-6">
          {/* 주문 상품 목록 */}
          <div className="lg:col-span-2 space-y-6">
            {/* 배송지 섹션 */}
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-[#1d1d1f] flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-[#007aff]" />
                  배송지
                </h2>
                <button
                  onClick={() => setShowAddressModal(true)}
                  className="text-sm text-[#007aff] hover:text-[#0051d5] font-medium flex items-center gap-1"
                >
                  변경
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              {selectedAddress ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-[#1d1d1f]">{selectedAddress.recipient_name}</span>
                    {selectedAddress.is_default === 1 && (
                      <span className="px-2 py-0.5 bg-[#007aff] text-white text-xs rounded-full">
                        기본배송지
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-[#6e6e73]">{selectedAddress.phone}</p>
                  <p className="text-sm text-[#1d1d1f]">
                    [{selectedAddress.postal_code}] {selectedAddress.address}
                  </p>
                  <p className="text-sm text-[#1d1d1f]">{selectedAddress.address_detail}</p>
                </div>
              ) : (
                <button
                  onClick={() => setShowAddressModal(true)}
                  className="w-full py-4 border-2 border-dashed border-[#d2d2d7] rounded-lg text-[#6e6e73] hover:border-[#007aff] hover:text-[#007aff] transition-colors flex items-center justify-center gap-2"
                >
                  <Plus className="h-5 w-5" />
                  배송지를 선택해주세요
                </button>
              )}
            </div>

            <h2 className="text-lg sm:text-xl font-semibold text-[#1d1d1f]">주문 상품</h2>
            
            {cartItems.map((item, index) => (
              <div key={item.id} className="bg-white rounded-xl p-5 shadow-sm border border-[#e5e5e7] hover:border-[#007aff] transition-all">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#007aff] text-white text-xs font-bold">
                        {index + 1}
                      </span>
                      <h3 className="font-semibold text-[#1d1d1f] text-base">{item.product_name}</h3>
                    </div>
                    <div className="ml-8 space-y-1">
                      {item.option_value && (
                        <p className="text-sm text-[#6e6e73]">
                          <span className="font-medium">옵션:</span> {item.option_value}
                        </p>
                      )}
                      <div className="flex items-center gap-4">
                        <span className="text-sm text-[#6e6e73]">
                          <span className="font-medium">수량:</span> {item.quantity}개
                        </span>
                        <span className="text-sm text-[#6e6e73]">
                          <span className="font-medium">단가:</span> {item.price_snapshot.toLocaleString()}원
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right ml-4">
                    <div className="text-lg font-bold text-[#007aff]">
                      {(item.price_snapshot * item.quantity).toLocaleString()}원
                    </div>
                    <div className="text-xs text-[#6e6e73] mt-1">
                      합계
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 결제 금액 및 결제 수단 */}
          <div className="lg:col-span-1">
            <div className="bg-gradient-to-br from-white to-[#f5f5f7] rounded-2xl p-6 shadow-lg border border-[#e5e5e7] sticky top-24">
              <div className="bg-white rounded-xl p-4 mb-4 shadow-sm">
                <h2 className="text-xl font-bold text-[#1d1d1f] mb-4 flex items-center gap-2">
                  <Package className="h-5 w-5 text-[#007aff]" />
                  결제 금액
                </h2>
                
                <div className="space-y-3 mb-4 pb-4 border-b-2 border-[#e5e5e7]">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-[#6e6e73]">상품 금액</span>
                    <span className="text-base font-semibold text-[#1d1d1f]">{subtotal.toLocaleString()}원</span>
                  </div>
                  
                  {/* 셀러별 배송비 상세 */}
                  <div className="flex justify-between items-start">
                    <span className="text-sm font-medium text-[#6e6e73]">배송비</span>
                    <div className="text-right">
                      {Object.values(sellerGroups).map((group, index) => {
                        const isFreeShipping = group.free_shipping_threshold > 0 && group.subtotal >= group.free_shipping_threshold
                        return (
                          <div key={group.seller_id} className="mb-1">
                            <span className="text-xs text-[#86868b] mr-2">{group.seller_name}</span>
                            {isFreeShipping ? (
                              <span className="text-sm font-semibold text-[#34c759]">무료배송</span>
                            ) : (
                              <span className="text-sm font-semibold text-[#1d1d1f]">
                                {group.shipping_fee.toLocaleString()}원
                              </span>
                            )}
                          </div>
                        )
                      })}
                      <div className="text-base font-semibold text-[#1d1d1f] mt-1 pt-1 border-t border-dashed border-[#d2d2d7]">
                        총 {totalShippingFee.toLocaleString()}원
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center text-xs text-[#86868b] pt-2 border-t border-dashed border-[#d2d2d7]">
                    <span>상품 개수</span>
                    <span>{cartItems.length}개</span>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-[#007aff] to-[#0051d5] rounded-xl p-4 mb-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-white/90">총 결제금액</span>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-white">
                        {totalAmount.toLocaleString()}원
                      </div>
                      <div className="text-xs text-white/80 mt-1">
                        VAT 포함
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 토스페이먼츠 결제 위젯 */}
              <div id="payment-widget" className="mb-4"></div>

              {/* 이용약관 UI */}
              <div id="agreement" className="mb-4"></div>

              <Button
                onClick={handlePayment}
                disabled={!ready || !selectedAddress}
                className="w-full bg-gradient-to-r from-[#007aff] to-[#0051d5] hover:from-[#0051d5] hover:to-[#003d99] text-white h-14 rounded-xl text-lg font-bold shadow-lg hover:shadow-xl transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {ready ? '결제하기' : '결제 준비 중...'}
              </Button>

              <div className="mt-4 p-4 bg-[#f5f5f7] rounded-xl">
                <p className="text-xs text-[#6e6e73] text-center mb-1">
                  궁금한 점이 있으신가요?
                </p>
                <p className="text-sm font-semibold text-[#1d1d1f] text-center">
                  📞 고객센터: 0507-0177-0432
                </p>
                <p className="text-xs text-[#86868b] text-center mt-1">
                  평일 09:00 - 18:00
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* 배송지 선택 모달 */}
      {showAddressModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-[#d2d2d7] p-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-[#1d1d1f]">배송지 선택</h3>
              <button
                onClick={() => setShowAddressModal(false)}
                className="text-[#6e6e73] hover:text-[#1d1d1f]"
              >
                ✕
              </button>
            </div>

            <div className="p-4 space-y-3">
              {addresses.map((addr) => (
                <div
                  key={addr.id}
                  onClick={() => {
                    setSelectedAddress(addr)
                    setShowAddressModal(false)
                  }}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    selectedAddress?.id === addr.id
                      ? 'border-[#007aff] bg-blue-50'
                      : 'border-[#d2d2d7] hover:border-[#007aff]'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-medium text-[#1d1d1f]">{addr.recipient_name}</span>
                    {addr.is_default === 1 && (
                      <span className="px-2 py-0.5 bg-[#007aff] text-white text-xs rounded-full">
                        기본배송지
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-[#6e6e73] mb-1">{addr.phone}</p>
                  <p className="text-sm text-[#1d1d1f]">
                    [{addr.postal_code}] {addr.address}
                  </p>
                  {addr.address_detail && (
                    <p className="text-sm text-[#1d1d1f]">{addr.address_detail}</p>
                  )}
                </div>
              ))}

              <button
                onClick={() => {
                  setShowAddressModal(false)
                  setShowNewAddressForm(true)
                }}
                className="w-full py-4 border-2 border-dashed border-[#d2d2d7] rounded-lg text-[#007aff] hover:border-[#007aff] hover:bg-blue-50 transition-all flex items-center justify-center gap-2 font-medium"
              >
                <Plus className="h-5 w-5" />
                새 배송지 추가
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 새 배송지 입력 모달 */}
      {showNewAddressForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-[#d2d2d7] p-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-[#1d1d1f]">새 배송지 추가</h3>
              <button
                onClick={() => setShowNewAddressForm(false)}
                className="text-[#6e6e73] hover:text-[#1d1d1f]"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-[#1d1d1f] mb-2">
                  받는 사람 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newAddress.recipient_name}
                  onChange={(e) => setNewAddress({ ...newAddress, recipient_name: e.target.value })}
                  className="w-full px-4 py-3 border border-[#d2d2d7] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#007aff]"
                  placeholder="받는 분 성함을 입력하세요"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#1d1d1f] mb-2">
                  휴대폰 번호 <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={newAddress.phone}
                  onChange={(e) => setNewAddress({ ...newAddress, phone: e.target.value })}
                  className="w-full px-4 py-3 border border-[#d2d2d7] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#007aff]"
                  placeholder="010-0000-0000"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#1d1d1f] mb-2">
                  우편번호 <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newAddress.postal_code}
                    readOnly
                    className="flex-1 px-4 py-3 border border-[#d2d2d7] rounded-lg bg-[#f5f5f7]"
                    placeholder="우편번호"
                  />
                  <Button
                    onClick={openPostcode}
                    className="bg-[#007aff] hover:bg-[#0051d5] text-white px-6"
                  >
                    주소 검색
                  </Button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[#1d1d1f] mb-2">
                  주소 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newAddress.address}
                  readOnly
                  className="w-full px-4 py-3 border border-[#d2d2d7] rounded-lg bg-[#f5f5f7]"
                  placeholder="주소 검색 버튼을 클릭하세요"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#1d1d1f] mb-2">
                  상세 주소
                </label>
                <input
                  type="text"
                  value={newAddress.address_detail}
                  onChange={(e) => setNewAddress({ ...newAddress, address_detail: e.target.value })}
                  className="w-full px-4 py-3 border border-[#d2d2d7] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#007aff]"
                  placeholder="상세 주소를 입력하세요"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="default-address"
                  checked={newAddress.is_default === 1}
                  onChange={(e) => setNewAddress({ ...newAddress, is_default: e.target.checked ? 1 : 0 })}
                  className="w-4 h-4 text-[#007aff] border-[#d2d2d7] rounded focus:ring-[#007aff]"
                />
                <label htmlFor="default-address" className="text-sm text-[#1d1d1f]">
                  기본 배송지로 설정
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  onClick={() => setShowNewAddressForm(false)}
                  className="flex-1 bg-[#f5f5f7] hover:bg-[#e8e8ed] text-[#1d1d1f]"
                >
                  취소
                </Button>
                <Button
                  onClick={handleSaveNewAddress}
                  className="flex-1 bg-[#007aff] hover:bg-[#0051d5] text-white"
                >
                  저장
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Daum 우편번호 검색 임베디드 팝업 */}
      {showPostcodePopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl h-[600px] flex flex-col">
            <div className="sticky top-0 bg-white border-b border-[#d2d2d7] p-4 flex items-center justify-between rounded-t-2xl">
              <h3 className="text-lg font-semibold text-[#1d1d1f]">우편번호 검색</h3>
              <button
                onClick={() => setShowPostcodePopup(false)}
                className="p-2 hover:bg-[#f5f5f7] rounded-full transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div id="daum-postcode-container" className="flex-1 overflow-hidden"></div>
          </div>
        </div>
      )}
    </div>
  )
}
