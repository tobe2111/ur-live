import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { handleApiError, showErrorToast } from '@/lib/errorHandler'
import { Button } from '@/components/ui/button'
import { ArrowLeft, AlertCircle, Package, MapPin, Plus, ChevronRight } from 'lucide-react'
import { requireLogin, getUserId, isLoggedIn } from '@/utils/auth'
import { loadTossPayments } from '@tosspayments/tosspayments-sdk'
import { CustomModal, useModal } from '@/components/CustomModal'

// 토스페이먼츠 클라이언트 키
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

function generateRandomString() {
  return window.btoa(Math.random().toString()).slice(0, 20)
}

export default function CheckoutPage() {
  const navigate = useNavigate()
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [userId, setUserId] = useState<string | null>(null)
  
  // 토스페이먼츠 위젯 상태
  const [widgets, setWidgets] = useState<any>(null)
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
        
        // SDK 로드
        const tossPayments = await loadTossPayments(clientKey)
        
        // customerKey 생성 (고유한 사용자 식별자)
        const customerKey = `customer_${userId}`
        
        // widgets 인스턴스 생성 (brandpay 옵션 제거!)
        const widgetsInstance = tossPayments.widgets({ 
          customerKey
        })
        
        setWidgets(widgetsInstance)
        console.log('[TossPayments] ✅ Step 1 완료: widgets 인스턴스 생성')
      } catch (err) {
        console.error('[TossPayments] ❌ Step 1 실패:', err)
        setError('결제 시스템을 불러올 수 없습니다.')
      }
    }

    fetchPaymentWidgets()
  }, [userId, cartItems])

  // 🎯 Step 2: 결제 UI 렌더링
  useEffect(() => {
    async function renderPaymentWidgets() {
      if (widgets == null) {
        return
      }

      try {
        console.log('[TossPayments] Step 2: 결제 UI 렌더링 시작')
        
        // DOM 요소가 존재하는지 100ms 대기
        await new Promise(resolve => setTimeout(resolve, 100))
        
        const paymentMethodEl = document.getElementById('payment-method')
        const agreementEl = document.getElementById('agreement')
        
        if (!paymentMethodEl || !agreementEl) {
          console.error('[TossPayments] ❌ DOM 요소를 찾을 수 없음')
          setError('결제 UI를 불러올 수 없습니다.')
          return
        }
        
        // 금액 설정 (반드시 렌더링 전에 호출!)
        await widgets.setAmount({
          currency: 'KRW',
          value: totalAmount
        })
        
        // 결제 수단 UI 렌더링
        await widgets.renderPaymentMethods({
          selector: '#payment-method'
          // variantKey는 생략 (기본값 사용)
        })
        
        // 이용약관 UI 렌더링
        await widgets.renderAgreement({
          selector: '#agreement'
          // variantKey는 생략 (기본값 사용)
        })
        
        setReady(true)
        console.log('[TossPayments] ✅ Step 2 완료: UI 렌더링 성공')
      } catch (err) {
        console.error('[TossPayments] ❌ Step 2 실패:', err)
        setError('결제 UI 렌더링에 실패했습니다.')
      }
    }

    renderPaymentWidgets()
  }, [widgets, totalAmount])

  // 🎯 Step 3: 금액 변경 시 업데이트
  useEffect(() => {
    if (widgets == null || !ready) {
      return
    }

    async function updateAmount() {
      try {
        await widgets.setAmount({
          currency: 'KRW',
          value: totalAmount
        })
        console.log('[TossPayments] ✅ Step 3: 금액 업데이트', totalAmount)
      } catch (err) {
        console.error('[TossPayments] ❌ Step 3 실패:', err)
      }
    }

    updateAmount()
  }, [totalAmount, widgets, ready])

  // 초기 데이터 로드
  useEffect(() => {
    const uid = getUserId()
    
    if (!isLoggedIn()) {
      requireLogin()
      return
    }

    if (!uid) {
      setError('사용자 정보를 확인할 수 없습니다.')
      setLoading(false)
      return
    }

    setUserId(uid)

    const loadData = async () => {
      try {
        // 장바구니 조회
        const cartResponse = await axios.get(`/api/cart/${uid}`)
        if (cartResponse.data.success && cartResponse.data.data.length > 0) {
          setCartItems(cartResponse.data.data)
        } else {
          setError('장바구니가 비어있습니다.')
          setTimeout(() => navigate('/cart'), 2000)
        }

        // 배송지 조회
        const addressResponse = await axios.get(`/api/shipping-addresses/${uid}`)
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
        handleApiError(err, '데이터 로드 실패')
        setError('데이터를 불러올 수 없습니다.')
      } finally {
        setLoading(false)
      }
    }

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
  const handlePayment = async () => {
    // 중복 실행 방지
    if (isProcessing) {
      console.log('[Payment] ⚠️ 이미 결제 진행 중')
      return
    }

    // 위젯 준비 확인
    if (!widgets || !ready) {
      showErrorToast('결제 시스템을 불러오는 중입니다. 잠시 후 다시 시도해주세요.')
      return
    }

    // 배송지 선택 확인
    if (!selectedAddress) {
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

      // 주문 번호 생성
      const orderId = `ORDER_${Date.now()}_${generateRandomString()}`
      
      // 주문명 생성
      const firstItem = cartItems[0]
      const orderName = cartItems.length > 1 
        ? `${firstItem.product_name} 외 ${cartItems.length - 1}건`
        : firstItem.product_name

      console.log('[Payment] requestPayment 호출:', { orderId, orderName, totalAmount })

      // 결제 요청
      await widgets.requestPayment({
        orderId,
        orderName,
        successUrl: `${window.location.origin}/payment/success`,
        failUrl: `${window.location.origin}/payment/fail`,
        customerEmail: 'customer@example.com',
        customerName: selectedAddress.recipient_name,
        customerMobilePhone: selectedAddress.phone.replace(/-/g, '')
      })
    } catch (err: any) {
      console.error('[Payment] ❌ 결제 요청 실패:', err)
      
      // 팝업 차단 에러는 무시
      if (err.code === 'POPUP_BLOCKED') {
        showErrorToast('팝업이 차단되었습니다. 팝업 차단을 해제해주세요.')
      } 
      // 사용자 취소는 조용히 처리
      else if (err.code === 'USER_CANCEL') {
        console.log('[Payment] 사용자가 결제를 취소했습니다.')
      } 
      // 그 외 에러
      else {
        showErrorToast('결제 요청에 실패했습니다.')
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
      <div className="max-w-4xl mx-auto p-6">
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
    <div className="max-w-6xl mx-auto p-6">
      {/* 헤더 */}
      <div className="mb-6">
        <button
          onClick={() => navigate('/cart')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>장바구니로 돌아가기</span>
        </button>
        <h1 className="text-3xl font-bold">주문/결제</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 좌측: 주문 정보 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 배송지 정보 */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-blue-600" />
                <h2 className="text-xl font-bold">배송지 정보</h2>
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
              <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-red-800 font-bold text-lg">⚠️ 배송지를 선택해주세요 (필수)</p>
                    <p className="text-red-700 mt-1">배송지를 선택하셔야 결제가 가능합니다.</p>
                  </div>
                </div>
              </div>
            )}

            {selectedAddress && (
              <div className="space-y-2 bg-blue-50 rounded-lg p-4 border border-blue-200">
                <p className="font-semibold text-lg">{selectedAddress.recipient_name}</p>
                <p className="text-gray-700">{selectedAddress.phone}</p>
                <p className="text-gray-600">
                  [{selectedAddress.postal_code}] {selectedAddress.address}
                </p>
                {selectedAddress.address_detail && (
                  <p className="text-gray-600">{selectedAddress.address_detail}</p>
                )}
              </div>
            )}
          </div>

          {/* 주문 상품 정보 */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <Package className="w-5 h-5 text-blue-600" />
              <h2 className="text-xl font-bold">주문 상품</h2>
            </div>

            <div className="space-y-4">
              {Object.values(sellerGroups).map((group) => (
                <div key={group.seller_id} className="border border-gray-200 rounded-lg p-4">
                  <p className="text-sm font-semibold text-gray-700 mb-3">
                    {group.seller_name}
                  </p>
                  
                  {group.items.map((item) => (
                    <div key={item.id} className="flex gap-4 py-3 border-t border-gray-100 first:border-t-0">
                      <img
                        src={item.image_url || '/placeholder.png'}
                        alt={item.product_name}
                        className="w-20 h-20 object-cover rounded"
                      />
                      <div className="flex-1">
                        <p className="font-medium">{item.product_name}</p>
                        {item.option_value && (
                          <p className="text-sm text-gray-500">{item.option_value}</p>
                        )}
                        <p className="text-sm text-gray-600 mt-1">
                          {item.price_snapshot.toLocaleString()}원 × {item.quantity}개
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">
                          {(item.price_snapshot * item.quantity).toLocaleString()}원
                        </p>
                      </div>
                    </div>
                  ))}

                  {/* 배송비 정보 */}
                  <div className="mt-3 pt-3 border-t border-gray-200 flex justify-between text-sm">
                    <span className="text-gray-600">배송비</span>
                    <span className="font-semibold">
                      {group.free_shipping_threshold > 0 && group.subtotal >= group.free_shipping_threshold
                        ? '무료'
                        : `${group.shipping_fee.toLocaleString()}원`}
                    </span>
                  </div>
                  {group.free_shipping_threshold > 0 && group.subtotal < group.free_shipping_threshold && (
                    <p className="text-xs text-gray-500 mt-1">
                      {(group.free_shipping_threshold - group.subtotal).toLocaleString()}원 추가 시 무료배송
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* 결제 수단 선택 */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-bold mb-4">결제 수단</h2>
            
            {/* 토스페이먼츠 위젯 렌더링 영역 */}
            <div id="payment-method"></div>
            <div id="agreement" className="mt-4"></div>
          </div>
        </div>

        {/* 우측: 결제 요약 */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg border border-gray-200 p-6 sticky top-6">
            <h2 className="text-xl font-bold mb-4">결제 금액</h2>
            
            <div className="space-y-3">
              <div className="flex justify-between text-gray-600">
                <span>상품 금액</span>
                <span>{subtotal.toLocaleString()}원</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>배송비</span>
                <span>{totalShippingFee.toLocaleString()}원</span>
              </div>
              <div className="border-t border-gray-200 pt-3 flex justify-between text-lg font-bold">
                <span>총 결제 금액</span>
                <span className="text-blue-600">{totalAmount.toLocaleString()}원</span>
              </div>
            </div>

            <Button
              onClick={handlePayment}
              className="w-full mt-6 py-6 text-lg font-bold"
              disabled={!ready || !selectedAddress || isProcessing}
              style={{
                backgroundColor: !ready || !selectedAddress ? '#e5e7eb' : undefined,
                cursor: !ready || !selectedAddress || isProcessing ? 'not-allowed' : 'pointer'
              }}
            >
              {isProcessing 
                ? '처리 중...'
                : !selectedAddress 
                  ? '⚠️ 배송지를 선택해주세요'
                  : !ready 
                    ? '결제 준비 중...'
                    : '결제하기'}
            </Button>

            {!selectedAddress && (
              <div className="mt-3 p-3 bg-amber-50 border border-amber-300 rounded-lg">
                <p className="text-sm text-amber-800 text-center">
                  ⚠️ 배송지를 선택하셔야 결제가 가능합니다
                </p>
              </div>
            )}
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
  )
}
