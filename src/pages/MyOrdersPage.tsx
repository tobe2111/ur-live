import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import MobileFooter from '@/components/MobileFooter'
import { 
  ArrowLeft, 
  Package, 
  ShoppingCart,
  MapPin,
  CreditCard,
  Truck,
  CheckCircle2,
  Clock,
  AlertCircle,
  ChevronRight,
  User,
  Settings,
  LogOut,
  Plus,
  Minus,
  Trash2,
  X
} from 'lucide-react'
import { getUserId, getUserName, getUserEmail, isLoggedIn, requireLogin } from '@/utils/auth'

interface CartItem {
  id: number
  product_id: number
  product_name: string
  image_url: string
  quantity: number
  price_snapshot: number
  option_value?: string
}

interface OrderItem {
  id: number
  product_id: number
  product_name: string
  image_url: string
  quantity: number
  price_snapshot: number
  option_value?: string
}

interface Order {
  id: number
  order_number: string
  user_id: number
  total_amount: number
  status: string
  payment_method: string
  shipping_address: string
  shipping_address_detail: string
  shipping_postal_code: string
  shipping_name: string
  shipping_phone: string
  courier?: string
  tracking_number?: string
  shipped_at?: string
  delivered_at?: string
  created_at: string
  updated_at: string
  items: OrderItem[]
}

type TabType = 'cart' | 'orders' | 'profile'

export default function MyOrdersPage() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<TabType>('cart')
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [cancelModal, setCancelModal] = useState<{
    isOpen: boolean
    orderId: number | null
    orderNumber: string
  }>({
    isOpen: false,
    orderId: null,
    orderNumber: ''
  })
  const [cancelReason, setCancelReason] = useState('')

  // Check login status (통합 인증 사용)
  const userId = getUserId()
  const userName = getUserName() || '게스트'
  const userEmail = getUserEmail() || ''

  useEffect(() => {
    // Redirect to login if not logged in (통합 인증 체크)
    if (!isLoggedIn() || !userId) {
      requireLogin(navigate, '로그인이 필요합니다.')
      return
    }
    
    loadData()
  }, [activeTab, userId, navigate])

  async function loadData() {
    setLoading(true)
    try {
      // \uc0c1\ub2e8\uc5d0\uc11c \uc774\ubbf8 userId\ub97c \uac00\uc838\uc654\uc73c\ubbc0\ub85c \uc7ac\uc0ac\uc6a9
      const uid = userId || getUserId()
      
      if (!uid) {
        console.error('No user ID available')
        return
      }
      
      if (activeTab === 'cart') {
        const response = await api.get('/api/cart')
        if (response.data.success) {
          setCartItems(response.data.data || [])
        }
      } else if (activeTab === 'orders') {
        const response = await api.get('/api/orders')
        if (response.data.success) {
          setOrders(response.data.data || [])
        }
      }
    } catch (error) {
      console.error('Failed to load data:', error)
    } finally {
      setLoading(false)
    }
  }

  async function handleUpdateQuantity(itemId: number, newQuantity: number) {
    if (newQuantity < 1) return

    try {
      const response = await api.put(`/api/cart/${itemId}`, { quantity: newQuantity })
      if (response.data.success) {
        loadData()
      }
    } catch (error) {
      console.error('Failed to update quantity:', error)
      alert('수량 변경에 실패했습니다.')
    }
  }

  async function handleRemoveItem(itemId: number) {
    if (!confirm('장바구니에서 삭제하시겠습니까?')) return

    try {
      const response = await api.delete(`/api/cart/${itemId}`)
      if (response.data.success) {
        loadData()
      }
    } catch (error) {
      console.error('Failed to remove item:', error)
      alert('삭제에 실패했습니다.')
    }
  }

  function handleCheckout() {
    if (cartItems.length === 0) {
      alert('장바구니가 비어있습니다.')
      return
    }
    navigate('/checkout')
  }

  function getTrackingUrl(courier?: string, trackingNumber?: string): string {
    if (!courier || !trackingNumber) return ''
    
    const courierUrls: { [key: string]: string } = {
      'CJ대한통운': `https://www.cjlogistics.com/ko/tool/parcel/tracking?gnbInvNo=${trackingNumber}`,
      '우체국택배': `https://service.epost.go.kr/trace.RetrieveDomRigiTraceList.comm?sid1=${trackingNumber}`,
      '한진택배': `https://www.hanjin.com/kor/CMS/DeliveryMgr/WaybillResult.do?mCode=MN038&schLang=KR&wblnumText2=${trackingNumber}`,
      '로젠택배': `https://www.ilogen.com/web/personal/trace/${trackingNumber}`,
      'GS Postbox 택배': `https://www.cvsnet.co.kr/invoice/tracking.do?invoice_no=${trackingNumber}`,
      '롯데택배': `https://www.lotteglogis.com/home/reservation/tracking/linkView?InvNo=${trackingNumber}`,
      '쿠팡로켓배송': `https://www.coupang.com/my/orders/lookup?q=${trackingNumber}`
    }
    
    return courierUrls[courier] || `https://tracker.delivery/#/${courier}/${trackingNumber}`
  }

  async function handleCancelOrder(orderId: number, orderNumber: string) {
    // 취소 모달 열기
    setCancelModal({
      isOpen: true,
      orderId,
      orderNumber
    })
    setCancelReason('')
  }

  async function confirmCancelOrder() {
    const { orderId } = cancelModal
    if (!orderId) return
    
    if (!cancelReason.trim()) {
      alert('취소 사유를 입력해주세요.')
      return
    }

    setProcessing(true)
    try {
      const response = await api.post(`/api/orders/${orderId}/cancel`, {
        reason: cancelReason
      })
      if (response.data.success) {
        alert('주문이 취소되었습니다.')
        setCancelModal({ isOpen: false, orderId: null, orderNumber: '' })
        setCancelReason('')
        loadData()
      } else {
        alert(response.data.error || '주문 취소에 실패했습니다.')
      }
    } catch (error: any) {
      console.error('Failed to cancel order:', error)
      alert(error.response?.data?.error || '주문 취소 중 오류가 발생했습니다.')
    } finally {
      setProcessing(false)
    }
  }

  function handleLogout() {
    if (confirm('로그아웃 하시겠습니까?')) {
      localStorage.removeItem('user_session_token')
      localStorage.removeItem('user_id')
      localStorage.removeItem('user_name')
      localStorage.removeItem('user_email')
      localStorage.removeItem('user_profile_image')
      navigate('/')
    }
  }

  const totalAmount = cartItems.reduce((sum, item) => sum + item.price_snapshot * item.quantity, 0)

  return (
    <div className="mx-auto min-h-screen max-w-md bg-[#fbfbfd]">
      {/* Header */}
      <header className="apple-glass sticky top-0 z-50 border-b border-[#e5e5ea]">
        <div className="w-full px-4 sm:px-6">
          <div className="flex h-[52px] items-center justify-between">
            <Link 
              to="/"
              className="flex items-center space-x-2 text-[#1d1d1f] hover:opacity-60 transition-opacity"
            >
              <ArrowLeft className="h-5 w-5" />
              <span className="text-[14px] font-normal hidden sm:inline">홈으로</span>
            </Link>
            <h1 className="text-[17px] font-semibold text-[#1d1d1f]">
              마이페이지
            </h1>
            <div className="w-16"></div>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <div className="bg-white border-b border-[#e5e5ea]">
        <div className="w-full px-4 sm:px-6">
          <div className="flex space-x-1">
            <button
              onClick={() => setActiveTab('cart')}
              className={`
                flex-1 py-3 px-4 text-[15px] font-medium transition-all relative
                ${activeTab === 'cart' 
                  ? 'text-[#007aff]' 
                  : 'text-[#6e6e73] hover:text-[#1d1d1f]'
                }
              `}
            >
              <ShoppingCart className="h-4 w-4 inline mr-2" />
              장바구니
              {activeTab === 'cart' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#007aff]"></div>
              )}
            </button>
            <button
              onClick={() => setActiveTab('orders')}
              className={`
                flex-1 py-3 px-4 text-[15px] font-medium transition-all relative
                ${activeTab === 'orders' 
                  ? 'text-[#007aff]' 
                  : 'text-[#6e6e73] hover:text-[#1d1d1f]'
                }
              `}
            >
              <Package className="h-4 w-4 inline mr-2" />
              주문내역
              {activeTab === 'orders' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#007aff]"></div>
              )}
            </button>
            <button
              onClick={() => setActiveTab('profile')}
              className={`
                flex-1 py-3 px-4 text-[15px] font-medium transition-all relative
                ${activeTab === 'profile' 
                  ? 'text-[#007aff]' 
                  : 'text-[#6e6e73] hover:text-[#1d1d1f]'
                }
              `}
            >
              <User className="h-4 w-4 inline mr-2" />
              프로필
              {activeTab === 'profile' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#007aff]"></div>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="w-full px-4 sm:px-6 py-8 sm:py-12">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#007aff] mx-auto mb-4"></div>
              <p className="text-[17px] text-[#6e6e73]">로딩 중...</p>
            </div>
          </div>
        ) : (
          <>
            {/* Cart Tab */}
            {activeTab === 'cart' && (
              <div className="space-y-6">
                {cartItems.length === 0 ? (
                  <div className="apple-card p-12 text-center">
                    <div className="w-24 h-24 bg-[#f5f5f7] rounded-full flex items-center justify-center mx-auto mb-6">
                      <ShoppingCart className="h-12 w-12 text-[#6e6e73]" />
                    </div>
                    <h2 className="text-[28px] font-semibold text-[#1d1d1f] mb-4">
                      장바구니가 비어있습니다
                    </h2>
                    <p className="text-[17px] text-[#6e6e73] mb-8">
                      라이브를 시청하며 상품을 담아보세요
                    </p>
                    <Button className="apple-button" asChild>
                      <Link to="/">라이브 보러가기</Link>
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="apple-card divide-y divide-[#e5e5ea]">
                      {cartItems.map(item => (
                        <div key={item.id} className="p-4 sm:p-6 flex gap-4">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-[15px] sm:text-[17px] font-semibold text-[#1d1d1f] mb-1 line-clamp-2">
                              {item.product_name}
                            </h3>
                            {item.option_value && (
                              <p className="text-[13px] text-[#6e6e73] mb-2">
                                옵션: {item.option_value}
                              </p>
                            )}
                            <p className="text-[19px] sm:text-[21px] font-bold text-[#1d1d1f] mb-3">
                              {(item.price_snapshot * item.quantity).toLocaleString()}원
                            </p>
                            
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                <button
                                  onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                                  disabled={item.quantity <= 1}
                                  className="w-10 h-10 rounded-full bg-[#f5f5f7] flex items-center justify-center hover:bg-[#e5e5ea] transition-colors disabled:opacity-30"
                                >
                                  <Minus className="h-4 w-4 text-[#1d1d1f]" />
                                </button>
                                <span className="text-[15px] font-medium text-[#1d1d1f] w-10 text-center">
                                  {item.quantity}
                                </span>
                                <button
                                  onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                                  className="w-10 h-10 rounded-full bg-[#f5f5f7] flex items-center justify-center hover:bg-[#e5e5ea] transition-colors"
                                >
                                  <Plus className="h-4 w-4 text-[#1d1d1f]" />
                                </button>
                              </div>
                              <button
                                onClick={() => handleRemoveItem(item.id)}
                                className="text-[#ff3b30] text-[14px] font-medium hover:opacity-60 transition-opacity flex items-center"
                              >
                                <Trash2 className="h-4 w-4 mr-1" />
                                삭제
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Cart Summary */}
                    <div className="apple-card p-6">
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
                            {totalAmount >= 30000 ? '무료' : '3,000원'}
                          </span>
                        </div>
                      </div>

                      <div className="flex justify-between items-baseline pt-6 mb-6">
                        <span className="text-[17px] font-semibold text-[#1d1d1f]">
                          총 결제 금액
                        </span>
                        <div className="text-right">
                          <span className="text-[28px] font-bold text-[#1d1d1f]">
                            {(totalAmount + (totalAmount >= 30000 ? 0 : 3000)).toLocaleString()}
                          </span>
                          <span className="text-[17px] font-medium text-[#6e6e73]">원</span>
                        </div>
                      </div>

                      <button
                        onClick={handleCheckout}
                        className="apple-button w-full py-4"
                      >
                        주문하기 ({cartItems.length}개)
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Orders Tab */}
            {activeTab === 'orders' && (
              <div className="space-y-6">
                {/* Status Filter */}
                <div className="flex gap-2 overflow-x-auto pb-2">
                  <button
                    onClick={() => setStatusFilter('all')}
                    className={`px-4 py-2 rounded-full text-[14px] font-medium whitespace-nowrap transition-all ${
                      statusFilter === 'all'
                        ? 'bg-[#007aff] text-white'
                        : 'bg-[#f5f5f7] text-[#6e6e73] hover:bg-[#e5e5ea]'
                    }`}
                  >
                    전체
                  </button>
                  <button
                    onClick={() => setStatusFilter('pending')}
                    className={`px-4 py-2 rounded-full text-[14px] font-medium whitespace-nowrap transition-all ${
                      statusFilter === 'pending'
                        ? 'bg-[#007aff] text-white'
                        : 'bg-[#f5f5f7] text-[#6e6e73] hover:bg-[#e5e5ea]'
                    }`}
                  >
                    결제완료
                  </button>
                  <button
                    onClick={() => setStatusFilter('preparing')}
                    className={`px-4 py-2 rounded-full text-[14px] font-medium whitespace-nowrap transition-all ${
                      statusFilter === 'preparing'
                        ? 'bg-[#007aff] text-white'
                        : 'bg-[#f5f5f7] text-[#6e6e73] hover:bg-[#e5e5ea]'
                    }`}
                  >
                    상품준비중
                  </button>
                  <button
                    onClick={() => setStatusFilter('shipping')}
                    className={`px-4 py-2 rounded-full text-[14px] font-medium whitespace-nowrap transition-all ${
                      statusFilter === 'shipping'
                        ? 'bg-[#007aff] text-white'
                        : 'bg-[#f5f5f7] text-[#6e6e73] hover:bg-[#e5e5ea]'
                    }`}
                  >
                    배송중
                  </button>
                  <button
                    onClick={() => setStatusFilter('delivered')}
                    className={`px-4 py-2 rounded-full text-[14px] font-medium whitespace-nowrap transition-all ${
                      statusFilter === 'delivered'
                        ? 'bg-[#007aff] text-white'
                        : 'bg-[#f5f5f7] text-[#6e6e73] hover:bg-[#e5e5ea]'
                    }`}
                  >
                    배송완료
                  </button>
                  <button
                    onClick={() => setStatusFilter('cancelled')}
                    className={`px-4 py-2 rounded-full text-[14px] font-medium whitespace-nowrap transition-all ${
                      statusFilter === 'cancelled'
                        ? 'bg-[#007aff] text-white'
                        : 'bg-[#f5f5f7] text-[#6e6e73] hover:bg-[#e5e5ea]'
                    }`}
                  >
                    취소/환불
                  </button>
                </div>

                {orders.filter(order => statusFilter === 'all' || order.status === statusFilter).length === 0 ? (
                  <div className="apple-card p-12 text-center">
                    <div className="w-24 h-24 bg-[#f5f5f7] rounded-full flex items-center justify-center mx-auto mb-6">
                      <Package className="h-12 w-12 text-[#6e6e73]" />
                    </div>
                    <h2 className="text-[28px] font-semibold text-[#1d1d1f] mb-4">
                      주문 내역이 없습니다
                    </h2>
                    <p className="text-[17px] text-[#6e6e73] mb-8">
                      라이브에서 마음에 드는 상품을 구매해보세요
                    </p>
                    <Button className="apple-button" asChild>
                      <Link to="/">라이브 보러가기</Link>
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {orders.filter(order => statusFilter === 'all' || order.status === statusFilter).map(order => (
                      <div key={order.id} className="apple-card p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <p className="text-[13px] text-[#6e6e73] mb-1">
                              {new Date(order.created_at).toLocaleDateString('ko-KR', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })}
                            </p>
                            <p className="text-[15px] font-semibold text-[#1d1d1f]">
                              주문번호: {order.order_number}
                            </p>
                          </div>
                          <Badge 
                            className={`
                              border-0 px-3 py-1
                              ${order.status === 'delivered' 
                                ? 'bg-[#34c759] text-white' 
                                : order.status === 'shipping'
                                ? 'bg-[#007aff] text-white'
                                : order.status === 'cancelled'
                                ? 'bg-[#ff3b30] text-white'
                                : order.status === 'preparing'
                                ? 'bg-[#ff9500] text-white'
                                : 'bg-[#8e8e93] text-white'
                              }
                            `}
                          >
                            {order.status === 'delivered' 
                              ? '배송완료' 
                              : order.status === 'shipping'
                              ? '배송중'
                              : order.status === 'cancelled'
                              ? '취소/환불'
                              : order.status === 'preparing'
                              ? '상품준비중'
                              : '결제완료'
                            }
                          </Badge>
                        </div>

                        {/* Order Items */}
                        <div className="space-y-3 mb-4">
                          {order.items?.slice(0, 2).map((item, idx) => (
                            <div key={idx} className="flex gap-3">
                              <div className="flex-1 min-w-0">
                                <p className="text-[14px] font-medium text-[#1d1d1f] line-clamp-1">
                                  {item.product_name}
                                </p>
                                {item.option_value && (
                                  <p className="text-[12px] text-[#6e6e73]">
                                    옵션: {item.option_value}
                                  </p>
                                )}
                                <p className="text-[13px] text-[#6e6e73]">
                                  {item.quantity}개 · {(item.price_snapshot * item.quantity).toLocaleString()}원
                                </p>
                              </div>
                            </div>
                          ))}
                          {order.items && order.items.length > 2 && (
                            <p className="text-[13px] text-[#6e6e73] text-center">
                              외 {order.items.length - 2}개
                            </p>
                          )}
                        </div>

                        {/* Shipping Info */}
                        <div className="p-4 bg-[#f5f5f7] rounded-xl mb-4">
                          <div className="flex items-center gap-2 mb-2">
                            <MapPin className="h-4 w-4 text-[#6e6e73]" />
                            <span className="text-[14px] font-medium text-[#1d1d1f]">
                              {order.shipping_name}
                            </span>
                          </div>
                          <p className="text-[14px] text-[#6e6e73] ml-6">
                            [{order.shipping_postal_code}] {order.shipping_address}
                          </p>
                          {order.shipping_address_detail && (
                            <p className="text-[14px] text-[#6e6e73] ml-6">
                              {order.shipping_address_detail}
                            </p>
                          )}
                          {order.courier && order.tracking_number && (
                            <div className="mt-3 pt-3 border-t border-[#d2d2d7]">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Truck className="h-4 w-4 text-[#007aff]" />
                                  <div className="text-[13px]">
                                    <span className="text-[#6e6e73]">{order.courier} · </span>
                                    <span className="font-medium text-[#1d1d1f]">
                                      {order.tracking_number}
                                    </span>
                                  </div>
                                </div>
                                {getTrackingUrl(order.courier, order.tracking_number) && (
                                  <a
                                    href={getTrackingUrl(order.courier, order.tracking_number)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[13px] text-[#007aff] font-medium hover:opacity-60 transition-opacity flex items-center gap-1"
                                  >
                                    배송조회
                                    <ChevronRight className="h-3 w-3" />
                                  </a>
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-between">
                          <span className="text-[19px] font-bold text-[#1d1d1f]">
                            {order.total_amount.toLocaleString()}원
                          </span>
                          <div className="flex gap-2">
                            {order.status === 'pending' && (
                              <button
                                onClick={() => handleCancelOrder(order.id, order.order_number)}
                                className="px-4 py-2 text-[13px] font-medium text-[#ff3b30] border border-[#ff3b30] rounded-full hover:bg-[#ff3b30] hover:text-white transition-colors"
                              >
                                주문취소
                              </button>
                            )}
                            <button
                              onClick={() => setSelectedOrder(order)}
                              className="flex items-center text-[15px] text-[#007aff] font-medium hover:opacity-60 transition-opacity"
                            >
                              상세보기
                              <ChevronRight className="h-4 w-4 ml-1" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Profile Tab */}
            {activeTab === 'profile' && (
              <div className="space-y-6">
                {/* Profile Card */}
                <div className="apple-card p-6">
                  <div className="flex items-center gap-4 mb-6">
                    <img
                      src={userProfileImage || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(userName)}
                      alt={userName}
                      className="w-20 h-20 rounded-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(userName)
                      }}
                    />
                    <div>
                      <h2 className="text-[21px] font-semibold text-[#1d1d1f] mb-1">
                        {userName}
                      </h2>
                      {userEmail && (
                        <p className="text-[15px] text-[#6e6e73]">
                          {userEmail}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <button 
                      onClick={() => navigate('/shipping-addresses')}
                      className="w-full flex items-center justify-between p-4 rounded-xl hover:bg-[#f5f5f7] transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <MapPin className="h-5 w-5 text-[#6e6e73]" />
                        <span className="text-[15px] font-medium text-[#1d1d1f]">
                          배송지 관리
                        </span>
                      </div>
                      <ChevronRight className="h-5 w-5 text-[#6e6e73]" />
                    </button>

                    <button 
                      onClick={() => navigate('/payment-methods')}
                      className="w-full flex items-center justify-between p-4 rounded-xl hover:bg-[#f5f5f7] transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <CreditCard className="h-5 w-5 text-[#6e6e73]" />
                        <span className="text-[15px] font-medium text-[#1d1d1f]">
                          결제 수단
                        </span>
                      </div>
                      <ChevronRight className="h-5 w-5 text-[#6e6e73]" />
                    </button>

                    <button 
                      onClick={() => navigate('/settings')}
                      className="w-full flex items-center justify-between p-4 rounded-xl hover:bg-[#f5f5f7] transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Settings className="h-5 w-5 text-[#6e6e73]" />
                        <span className="text-[15px] font-medium text-[#1d1d1f]">
                          설정
                        </span>
                      </div>
                      <ChevronRight className="h-5 w-5 text-[#6e6e73]" />
                    </button>
                  </div>
                </div>

                {/* Actions */}
                <div className="apple-card overflow-hidden">
                  <button 
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 p-4 hover:bg-[#f5f5f7] transition-colors text-[#ff3b30]"
                  >
                    <LogOut className="h-5 w-5" />
                    <span className="text-[15px] font-medium">
                      로그아웃
                    </span>
                  </button>
                </div>

                {/* App Info */}
                <div className="text-center pt-4">
                  <p className="text-[13px] text-[#8e8e93]">
                    유어 라이브 커머스 v2.1.0
                  </p>
                  <p className="text-[13px] text-[#8e8e93] mt-1">
                    © 2026 Your Live Commerce
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-[#e5e5ea] p-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-[#1d1d1f]">주문 상세</h3>
              <button
                onClick={() => setSelectedOrder(null)}
                className="text-[#6e6e73] hover:text-[#1d1d1f]"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Order Info */}
              <div>
                <h4 className="text-[15px] font-semibold text-[#1d1d1f] mb-3">주문 정보</h4>
                <div className="space-y-2 text-[14px]">
                  <div className="flex justify-between">
                    <span className="text-[#6e6e73]">주문번호</span>
                    <span className="font-medium text-[#1d1d1f]">{selectedOrder.order_number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6e6e73]">주문일시</span>
                    <span className="font-medium text-[#1d1d1f]">
                      {new Date(selectedOrder.created_at).toLocaleString('ko-KR')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6e6e73]">주문상태</span>
                    <Badge 
                      className={`
                        border-0 px-3 py-1
                        ${selectedOrder.status === 'delivered' 
                          ? 'bg-[#34c759] text-white' 
                          : selectedOrder.status === 'shipping'
                          ? 'bg-[#007aff] text-white'
                          : selectedOrder.status === 'cancelled'
                          ? 'bg-[#ff3b30] text-white'
                          : selectedOrder.status === 'preparing'
                          ? 'bg-[#ff9500] text-white'
                          : 'bg-[#8e8e93] text-white'
                        }
                      `}
                    >
                      {selectedOrder.status === 'delivered' 
                        ? '배송완료' 
                        : selectedOrder.status === 'shipping'
                        ? '배송중'
                        : selectedOrder.status === 'cancelled'
                        ? '취소/환불'
                        : selectedOrder.status === 'preparing'
                        ? '상품준비중'
                        : '결제완료'
                      }
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Order Items */}
              <div>
                <h4 className="text-[15px] font-semibold text-[#1d1d1f] mb-3">주문 상품</h4>
                <div className="space-y-3">
                  {selectedOrder.items?.map((item, idx) => (
                    <div key={idx} className="flex gap-3 p-3 bg-[#f5f5f7] rounded-xl">
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] font-medium text-[#1d1d1f] line-clamp-2">
                          {item.product_name}
                        </p>
                        {item.option_value && (
                          <p className="text-[12px] text-[#6e6e73]">
                            옵션: {item.option_value}
                          </p>
                        )}
                        <div className="flex justify-between items-center mt-1">
                          <p className="text-[13px] text-[#6e6e73]">
                            {item.quantity}개
                          </p>
                          <p className="text-[14px] font-semibold text-[#1d1d1f]">
                            {(item.price_snapshot * item.quantity).toLocaleString()}원
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Shipping Info */}
              <div>
                <h4 className="text-[15px] font-semibold text-[#1d1d1f] mb-3">배송 정보</h4>
                <div className="p-4 bg-[#f5f5f7] rounded-xl space-y-2 text-[14px]">
                  <div className="flex gap-2">
                    <span className="text-[#6e6e73] min-w-[60px]">받는분</span>
                    <span className="font-medium text-[#1d1d1f]">{selectedOrder.shipping_name}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-[#6e6e73] min-w-[60px]">연락처</span>
                    <span className="font-medium text-[#1d1d1f]">{selectedOrder.shipping_phone}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-[#6e6e73] min-w-[60px]">주소</span>
                    <span className="font-medium text-[#1d1d1f]">
                      [{selectedOrder.shipping_postal_code}] {selectedOrder.shipping_address}
                      {selectedOrder.shipping_address_detail && `, ${selectedOrder.shipping_address_detail}`}
                    </span>
                  </div>
                  {selectedOrder.tracking_number && (
                    <div className="flex gap-2 pt-2 border-t border-[#d2d2d7]">
                      <span className="text-[#6e6e73] min-w-[60px]">송장번호</span>
                      <span className="font-medium text-[#007aff]">{selectedOrder.tracking_number}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Payment Info */}
              <div>
                <h4 className="text-[15px] font-semibold text-[#1d1d1f] mb-3">결제 정보</h4>
                <div className="space-y-2 text-[14px]">
                  <div className="flex justify-between">
                    <span className="text-[#6e6e73]">상품 금액</span>
                    <span className="font-medium text-[#1d1d1f]">
                      {selectedOrder.items?.reduce((sum, item) => sum + item.price_snapshot * item.quantity, 0).toLocaleString()}원
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6e6e73]">배송비</span>
                    <span className="font-medium text-[#1d1d1f]">3,000원</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-[#d2d2d7]">
                    <span className="text-[#1d1d1f] font-semibold">총 결제금액</span>
                    <span className="text-[19px] font-bold text-[#007aff]">
                      {selectedOrder.total_amount.toLocaleString()}원
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6e6e73]">결제수단</span>
                    <span className="font-medium text-[#1d1d1f]">{selectedOrder.payment_method || 'Mock 결제'}</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              {selectedOrder.status === 'pending' && (
                <button
                  onClick={() => {
                    setSelectedOrder(null)
                    handleCancelOrder(selectedOrder.id, selectedOrder.order_number)
                  }}
                  className="w-full py-3 text-[15px] font-medium text-[#ff3b30] border border-[#ff3b30] rounded-xl hover:bg-[#ff3b30] hover:text-white transition-colors"
                >
                  주문 취소
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Cancel Order Modal */}
      {cancelModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fadeIn">
          <div 
            className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 animate-slideUp"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900">
                주문 취소
              </h3>
              <button
                onClick={() => setCancelModal({ isOpen: false, orderId: null, orderNumber: '' })}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Order Info */}
            <div className="mb-4 p-4 bg-gray-50 rounded-xl">
              <p className="text-sm text-gray-600 mb-1">주문번호</p>
              <p className="font-semibold text-gray-900">{cancelModal.orderNumber}</p>
            </div>

            {/* Cancel Reason */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                취소 사유 <span className="text-red-500">*</span>
              </label>
              <select
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              >
                <option value="">취소 사유를 선택해주세요</option>
                <option value="단순 변심">단순 변심</option>
                <option value="다른 상품 구매">다른 상품 구매</option>
                <option value="배송 지연">배송 지연</option>
                <option value="상품 정보 불일치">상품 정보 불일치</option>
                <option value="기타">기타</option>
              </select>
            </div>

            {/* Notice */}
            <div className="mb-6 p-4 bg-blue-50 rounded-xl">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-blue-700">
                  <p className="font-medium mb-1">취소 안내</p>
                  <p className="text-blue-600">• 결제완료 상태에서만 취소가 가능합니다.</p>
                  <p className="text-blue-600">• 취소 후 3-5영업일 내 환불됩니다. (PG 연동 후)</p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setCancelModal({ isOpen: false, orderId: null, orderNumber: '' })
                  setCancelReason('')
                }}
                className="flex-1 py-3 px-4 bg-gray-100 text-gray-700 font-medium rounded-full hover:bg-gray-200 transition-colors"
                disabled={processing}
              >
                닫기
              </button>
              <button
                onClick={confirmCancelOrder}
                disabled={processing || !cancelReason.trim()}
                className="flex-1 py-3 px-4 bg-red-500 text-white font-medium rounded-full hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {processing ? '처리중...' : '취소 확정'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Footer */}
      <MobileFooter />
    </div>
  )
}
