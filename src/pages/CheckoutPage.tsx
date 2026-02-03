import { useEffect, useState } from 'react'
import { useNavigate, Link, useLocation } from 'react-router-dom'
import axios from 'axios'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  ArrowLeft, 
  MapPin, 
  ChevronRight, 
  CreditCard, 
  Shield,
  CheckCircle2,
  AlertCircle
} from 'lucide-react'

interface CartItem {
  id: number
  product_id: number
  product_name: string
  image_url: string
  quantity: number
  price_snapshot: number
  option_value?: string
}

interface ShippingAddress {
  id: number
  recipient_name: string
  phone: string
  postal_code?: string
  address: string
  address_detail?: string
  is_default: boolean
}

export default function CheckoutPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [shippingAddresses, setShippingAddresses] = useState<ShippingAddress[]>([])
  const [selectedAddress, setSelectedAddress] = useState<ShippingAddress | null>(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [showAddressModal, setShowAddressModal] = useState(false)
  const [newAddress, setNewAddress] = useState({
    recipient_name: '',
    phone: '',
    postal_code: '',
    address: '',
    address_detail: '',
    is_default: false
  })

  // Get user ID from session/localStorage
  const getUserId = () => {
    // TODO: Get from actual session
    const userId = localStorage.getItem('user_id')
    return userId || '1'
  }

  useEffect(() => {
    loadCheckoutData()
  }, [])

  async function loadCheckoutData() {
    try {
      const userId = getUserId()
      
      // Load cart items
      const cartResponse = await axios.get(`/api/cart/${userId}`)
      if (cartResponse.data.success) {
        const items = cartResponse.data.data || []
        setCartItems(items)
        
        if (items.length === 0) {
          // No items in cart, redirect to home
          navigate('/')
          return
        }
      }

      // Load shipping addresses
      const addressResponse = await axios.get(`/api/shipping-addresses/${userId}`)
      if (addressResponse.data.success) {
        const addresses = addressResponse.data.data || []
        setShippingAddresses(addresses)
        
        // Set default address
        const defaultAddr = addresses.find((addr: ShippingAddress) => addr.is_default)
        setSelectedAddress(defaultAddr || addresses[0] || null)
      }
    } catch (error) {
      console.error('Failed to load checkout data:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleAddAddress() {
    if (!newAddress.recipient_name || !newAddress.phone || !newAddress.address) {
      alert('받는 분 성함, 연락처, 주소를 모두 입력해주세요.')
      return
    }

    try {
      const userId = getUserId()
      
      const response = await axios.post('/api/shipping-addresses', {
        userId: parseInt(userId),
        ...newAddress
      })

      if (response.data.success) {
        // Reload addresses
        const addressResponse = await axios.get(`/api/shipping-addresses/${userId}`)
        if (addressResponse.data.success) {
          const addresses = addressResponse.data.data || []
          setShippingAddresses(addresses)
          
          // Select the new address
          const newAddr = addresses.find((addr: ShippingAddress) => addr.id === response.data.data.id)
          if (newAddr) {
            setSelectedAddress(newAddr)
          }
        }
        
        // Reset form and close modal
        setNewAddress({
          recipient_name: '',
          phone: '',
          postal_code: '',
          address: '',
          address_detail: '',
          is_default: false
        })
        setShowAddressModal(false)
      }
    } catch (error) {
      console.error('Failed to add address:', error)
      alert('배송지 추가에 실패했습니다.')
    }
  }

  async function handleCheckout() {
    if (!selectedAddress) {
      alert('배송지를 선택해주세요.')
      return
    }

    if (cartItems.length === 0) {
      alert('장바구니가 비어있습니다.')
      return
    }

    setProcessing(true)

    try {
      const userId = getUserId()
      
      const orderData = {
        userId: parseInt(userId),
        cartItemIds: cartItems.map(item => item.id),
        shippingInfo: {
          name: selectedAddress.recipient_name,
          phone: selectedAddress.phone,
          address: `${selectedAddress.address} ${selectedAddress.address_detail || ''}`.trim(),
          postalCode: selectedAddress.postal_code || ''
        }
      }

      const response = await axios.post('/api/orders', orderData)

      if (response.data.success) {
        // Order created successfully
        alert(`주문이 완료되었습니다!\n주문번호: ${response.data.data.orderNumber}`)
        navigate('/my-orders')
      } else {
        alert('주문에 실패했습니다: ' + response.data.error)
      }
    } catch (error: any) {
      console.error('Checkout failed:', error)
      alert('주문 처리 중 오류가 발생했습니다: ' + (error.response?.data?.error || error.message))
    } finally {
      setProcessing(false)
    }
  }

  const totalAmount = cartItems.reduce((sum, item) => sum + item.price_snapshot * item.quantity, 0)
  const shippingFee = totalAmount >= 30000 ? 0 : 3000
  const finalAmount = totalAmount + shippingFee

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fbfbfd] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#007aff] mx-auto mb-4"></div>
          <p className="text-[17px] text-[#6e6e73]">주문서 준비 중...</p>
        </div>
      </div>
    )
  }

  if (cartItems.length === 0) {
    return (
      <div className="min-h-screen bg-[#fbfbfd] flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-24 h-24 bg-[#f5f5f7] rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="h-12 w-12 text-[#6e6e73]" />
          </div>
          <h2 className="text-[28px] font-semibold text-[#1d1d1f] mb-4">
            장바구니가 비어있습니다
          </h2>
          <p className="text-[17px] text-[#6e6e73] mb-8">
            라이브를 시청하며 상품을 담아보세요
          </p>
          <Button className="apple-button" asChild>
            <Link to="/">홈으로 돌아가기</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#fbfbfd]">
      {/* Header */}
      <header className="apple-glass sticky top-0 z-50 border-b border-[#e5e5ea]">
        <div className="max-w-[980px] mx-auto px-4 sm:px-6">
          <div className="flex h-[52px] items-center justify-between">
            <Link 
              to="/my-orders"
              className="flex items-center space-x-2 text-[#1d1d1f] hover:opacity-60 transition-opacity"
            >
              <ArrowLeft className="h-5 w-5" />
              <span className="text-[14px] font-normal hidden sm:inline">뒤로</span>
            </Link>
            <h1 className="text-[17px] font-semibold text-[#1d1d1f]">
              주문서
            </h1>
            <div className="w-16"></div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[980px] mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="grid lg:grid-cols-[1fr_400px] gap-8">
          {/* Left Column - Forms */}
          <div className="space-y-6">
            {/* Shipping Address Section */}
            <section className="apple-card p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-[#007aff]/10 rounded-full flex items-center justify-center">
                    <MapPin className="h-5 w-5 text-[#007aff]" />
                  </div>
                  <h2 className="text-[21px] font-semibold text-[#1d1d1f]">
                    배송지
                  </h2>
                </div>
                <button
                  onClick={() => setShowAddressModal(true)}
                  className="text-[15px] text-[#007aff] hover:opacity-60 transition-opacity font-medium"
                >
                  + 새 배송지
                </button>
              </div>

              {shippingAddresses.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-[15px] text-[#6e6e73] mb-4">
                    등록된 배송지가 없습니다
                  </p>
                  <button
                    onClick={() => setShowAddressModal(true)}
                    className="apple-button"
                  >
                    배송지 추가하기
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {shippingAddresses.map(address => (
                    <div
                      key={address.id}
                      onClick={() => setSelectedAddress(address)}
                      className={`
                        p-4 rounded-xl border-2 transition-all cursor-pointer
                        ${selectedAddress?.id === address.id 
                          ? 'border-[#007aff] bg-[#007aff]/5' 
                          : 'border-[#e5e5ea] hover:border-[#007aff]/30'
                        }
                      `}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-[15px] font-semibold text-[#1d1d1f]">
                              {address.recipient_name}
                            </span>
                            {address.is_default && (
                              <Badge className="bg-[#007aff] text-white border-0 px-2 py-0.5">
                                <span className="text-[11px] font-semibold">기본</span>
                              </Badge>
                            )}
                          </div>
                          <p className="text-[14px] text-[#6e6e73] mb-1">
                            {address.phone}
                          </p>
                          <p className="text-[14px] text-[#1d1d1f]">
                            {address.address}
                          </p>
                          {address.address_detail && (
                            <p className="text-[14px] text-[#6e6e73]">
                              {address.address_detail}
                            </p>
                          )}
                          {address.postal_code && (
                            <p className="text-[13px] text-[#8e8e93] mt-1">
                              ({address.postal_code})
                            </p>
                          )}
                        </div>
                        {selectedAddress?.id === address.id && (
                          <CheckCircle2 className="h-5 w-5 text-[#007aff] flex-shrink-0" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Payment Method Section */}
            <section className="apple-card p-6">
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-10 h-10 bg-[#34c759]/10 rounded-full flex items-center justify-center">
                  <CreditCard className="h-5 w-5 text-[#34c759]" />
                </div>
                <h2 className="text-[21px] font-semibold text-[#1d1d1f]">
                  결제 수단
                </h2>
              </div>

              <div className="p-4 rounded-xl border-2 border-[#007aff] bg-[#007aff]/5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center">
                      <Shield className="h-6 w-6 text-[#007aff]" />
                    </div>
                    <div>
                      <p className="text-[15px] font-semibold text-[#1d1d1f]">
                        NICE 페이먼츠
                      </p>
                      <p className="text-[13px] text-[#6e6e73]">
                        카드 / 계좌이체 / 간편결제
                      </p>
                    </div>
                  </div>
                  <CheckCircle2 className="h-5 w-5 text-[#007aff]" />
                </div>
              </div>

              <div className="mt-4 p-3 bg-[#f5f5f7] rounded-xl">
                <p className="text-[13px] text-[#6e6e73] leading-relaxed">
                  <Shield className="h-3.5 w-3.5 inline mr-1.5" />
                  안전한 결제를 위해 SSL 암호화 통신을 사용합니다
                </p>
              </div>
            </section>

            {/* Order Items Section */}
            <section className="apple-card p-6">
              <h2 className="text-[21px] font-semibold text-[#1d1d1f] mb-6">
                주문 상품 ({cartItems.length}개)
              </h2>
              
              <div className="space-y-4">
                {cartItems.map(item => (
                  <div key={item.id} className="flex gap-4 pb-4 border-b border-[#e5e5ea] last:border-0 last:pb-0">
                    <img
                      src={item.image_url || 'https://via.placeholder.com/80'}
                      alt={item.product_name}
                      className="w-20 h-20 rounded-xl object-cover flex-shrink-0"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://via.placeholder.com/80'
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] font-semibold text-[#1d1d1f] mb-1 line-clamp-2">
                        {item.product_name}
                      </p>
                      {item.option_value && (
                        <p className="text-[13px] text-[#6e6e73] mb-2">
                          옵션: {item.option_value}
                        </p>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-[13px] text-[#6e6e73]">
                          수량: {item.quantity}개
                        </span>
                        <span className="text-[17px] font-semibold text-[#1d1d1f]">
                          {(item.price_snapshot * item.quantity).toLocaleString()}원
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Right Column - Order Summary */}
          <div className="lg:sticky lg:top-[68px] h-fit">
            <div className="apple-card p-6">
              <h2 className="text-[21px] font-semibold text-[#1d1d1f] mb-6">
                결제 금액
              </h2>
              
              <div className="space-y-4 pb-6 border-b border-[#e5e5ea]">
                <div className="flex justify-between">
                  <span className="text-[15px] text-[#6e6e73]">상품 금액</span>
                  <span className="text-[15px] font-medium text-[#1d1d1f]">
                    {totalAmount.toLocaleString()}원
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[15px] text-[#6e6e73]">배송비</span>
                  <span className="text-[15px] font-medium text-[#1d1d1f]">
                    {shippingFee === 0 ? '무료' : `${shippingFee.toLocaleString()}원`}
                  </span>
                </div>
                {totalAmount < 30000 && (
                  <p className="text-[13px] text-[#6e6e73] bg-[#f5f5f7] p-3 rounded-lg">
                    {(30000 - totalAmount).toLocaleString()}원 더 구매하시면 무료배송
                  </p>
                )}
              </div>

              <div className="flex justify-between items-baseline pt-6 mb-6">
                <span className="text-[17px] font-semibold text-[#1d1d1f]">
                  총 결제 금액
                </span>
                <div className="text-right">
                  <span className="text-[28px] font-bold text-[#1d1d1f]">
                    {finalAmount.toLocaleString()}
                  </span>
                  <span className="text-[17px] font-medium text-[#6e6e73]">원</span>
                </div>
              </div>

              <button
                onClick={handleCheckout}
                disabled={processing || !selectedAddress}
                className={`
                  w-full py-4 rounded-xl font-semibold text-[17px] transition-all
                  ${processing || !selectedAddress
                    ? 'bg-[#e5e5ea] text-[#8e8e93] cursor-not-allowed'
                    : 'apple-button'
                  }
                `}
              >
                {processing ? (
                  <span className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    처리 중...
                  </span>
                ) : (
                  '결제하기'
                )}
              </button>

              <div className="mt-4 space-y-2">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[#34c759] mt-0.5 flex-shrink-0" />
                  <p className="text-[13px] text-[#6e6e73]">
                    안전한 SSL 암호화 결제
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[#34c759] mt-0.5 flex-shrink-0" />
                  <p className="text-[13px] text-[#6e6e73]">
                    14일 이내 무료 반품
                  </p>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-[#34c759] mt-0.5 flex-shrink-0" />
                  <p className="text-[13px] text-[#6e6e73]">
                    구매 보호 프로그램 적용
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Add Address Modal */}
      {showAddressModal && (
        <div 
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowAddressModal(false)}
        >
          <div 
            className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-[#e5e5ea] px-6 py-4 rounded-t-3xl">
              <div className="flex items-center justify-between">
                <h3 className="text-[21px] font-semibold text-[#1d1d1f]">
                  새 배송지 추가
                </h3>
                <button
                  onClick={() => setShowAddressModal(false)}
                  className="text-[#007aff] text-[17px] font-medium hover:opacity-60 transition-opacity"
                >
                  취소
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-[14px] font-medium text-[#1d1d1f] mb-2">
                  받는 분 성함 *
                </label>
                <input
                  type="text"
                  value={newAddress.recipient_name}
                  onChange={(e) => setNewAddress({ ...newAddress, recipient_name: e.target.value })}
                  placeholder="홍길동"
                  className="w-full px-4 py-3 bg-[#f5f5f7] border-0 rounded-xl text-[15px] text-[#1d1d1f] placeholder:text-[#6e6e73] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
                />
              </div>

              <div>
                <label className="block text-[14px] font-medium text-[#1d1d1f] mb-2">
                  연락처 *
                </label>
                <input
                  type="tel"
                  value={newAddress.phone}
                  onChange={(e) => setNewAddress({ ...newAddress, phone: e.target.value })}
                  placeholder="010-1234-5678"
                  className="w-full px-4 py-3 bg-[#f5f5f7] border-0 rounded-xl text-[15px] text-[#1d1d1f] placeholder:text-[#6e6e73] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
                />
              </div>

              <div>
                <label className="block text-[14px] font-medium text-[#1d1d1f] mb-2">
                  우편번호
                </label>
                <input
                  type="text"
                  value={newAddress.postal_code}
                  onChange={(e) => setNewAddress({ ...newAddress, postal_code: e.target.value })}
                  placeholder="12345"
                  className="w-full px-4 py-3 bg-[#f5f5f7] border-0 rounded-xl text-[15px] text-[#1d1d1f] placeholder:text-[#6e6e73] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
                />
              </div>

              <div>
                <label className="block text-[14px] font-medium text-[#1d1d1f] mb-2">
                  주소 *
                </label>
                <input
                  type="text"
                  value={newAddress.address}
                  onChange={(e) => setNewAddress({ ...newAddress, address: e.target.value })}
                  placeholder="서울시 강남구 테헤란로 123"
                  className="w-full px-4 py-3 bg-[#f5f5f7] border-0 rounded-xl text-[15px] text-[#1d1d1f] placeholder:text-[#6e6e73] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
                />
              </div>

              <div>
                <label className="block text-[14px] font-medium text-[#1d1d1f] mb-2">
                  상세 주소
                </label>
                <input
                  type="text"
                  value={newAddress.address_detail}
                  onChange={(e) => setNewAddress({ ...newAddress, address_detail: e.target.value })}
                  placeholder="101동 1001호"
                  className="w-full px-4 py-3 bg-[#f5f5f7] border-0 rounded-xl text-[15px] text-[#1d1d1f] placeholder:text-[#6e6e73] focus:outline-none focus:ring-2 focus:ring-[#007aff]"
                />
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <input
                  type="checkbox"
                  id="is_default"
                  checked={newAddress.is_default}
                  onChange={(e) => setNewAddress({ ...newAddress, is_default: e.target.checked })}
                  className="w-5 h-5 rounded border-[#e5e5ea] text-[#007aff] focus:ring-[#007aff]"
                />
                <label htmlFor="is_default" className="text-[15px] text-[#1d1d1f]">
                  기본 배송지로 설정
                </label>
              </div>
            </div>

            <div className="sticky bottom-0 bg-white border-t border-[#e5e5ea] p-6 rounded-b-3xl">
              <button
                onClick={handleAddAddress}
                className="apple-button w-full py-4"
              >
                추가하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
