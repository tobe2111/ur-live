import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { logout as authLogout } from '@/utils/auth'
import { Badge } from '@/components/ui/badge'
import MobileFooter from '@/components/MobileFooter'
import { CartTab } from '@/components/mypage/CartTab'
import { OrdersTab } from '@/components/mypage/OrdersTab'
import { ProfileTab } from '@/components/mypage/ProfileTab'
import { 
  ArrowLeft, 
  Package, 
  ShoppingCart,
  User,
  X,
  AlertCircle
} from 'lucide-react'
import { getUserIdSync, getUserNameSync, getUserEmail, isLoggedInSync, requireLogin } from '@/utils/auth'
import type { Order, OrderItem } from '@/types/order'
import type { CartItem } from '@/types/cart'

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
    orderId: number | string | null
    orderNumber: string
  }>({
    isOpen: false,
    orderId: null,
    orderNumber: ''
  })
  const [cancelReason, setCancelReason] = useState('')

  // Check login status (통합 인증 사용)
  const userId = getUserIdSync()
  const userName = getUserNameSync() || '게스트'
  const userEmail = getUserEmail() || ''

  // ✅ BUG #25 FIX: A ref-based flag prevents concurrent loadData() calls.
  // Previously, switching tabs AND triggering handleUpdateQuantity/handleRemoveItem
  // at roughly the same time fired two simultaneous loadData() calls.  The second
  // call would overwrite the state of the first with stale server data because
  // both read `activeTab` from the closure at the same point in time.
  const isLoadingRef = useRef(false)

  useEffect(() => {
    // Redirect to login if not logged in (통합 인증 체크)
    if (!isLoggedInSync() || !userId) {
      requireLogin(navigate, '로그인이 필요합니다.')
      return
    }
    
    loadData()
  }, [activeTab, userId, navigate])

  async function loadData() {
    // ✅ BUG #25 FIX: Guard against concurrent calls
    if (isLoadingRef.current) {
      console.log('[MyOrdersPage] loadData skipped — already in progress')
      return
    }
    isLoadingRef.current = true
    setLoading(true)
    try {
      const uid = userId || getUserIdSync()
      
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
      isLoadingRef.current = false
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
      toast.error('수량 변경에 실패했습니다.')
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
      toast.error('삭제에 실패했습니다.')
    }
  }

  function handleCheckout() {
    if (cartItems.length === 0) {
      toast.info('장바구니가 비어있습니다.')
      return
    }
    navigate('/checkout')
  }

  async function handleCancelOrder(orderId: number | string, orderNumber: string) {
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
      toast.error('취소 사유를 입력해주세요.')
      return
    }
    setProcessing(true)
    try {
      const response = await api.post(`/api/orders/${orderId}/cancel`, {
        reason: cancelReason
      })
      if (response.data.success) {
        toast.success('주문이 취소되었습니다.')
        setCancelModal({ isOpen: false, orderId: null, orderNumber: '' })
        setCancelReason('')
        loadData()
      } else {
        toast.error(response.data.error || '주문 취소에 실패했습니다.')
      }
    } catch (error: any) {
      console.error('Failed to cancel order:', error)
      toast.error(error.response?.data?.error || '주문 취소 중 오류가 발생했습니다.')
    } finally {
      setProcessing(false)
    }
  }

  function handleLogout() {
    if (confirm('로그아웃 하시겠습니까?')) {
      authLogout()
      navigate('/login')
    }
  }

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
            {activeTab === 'cart' && (
              <CartTab 
                cartItems={cartItems as any}
                onUpdateQuantity={handleUpdateQuantity}
                onRemoveItem={handleRemoveItem}
                onCheckout={handleCheckout}
              />
            )}
            
            {activeTab === 'orders' && (
              <OrdersTab 
                orders={orders}
                onCancelOrder={handleCancelOrder}
                onSelectOrder={(order) => setSelectedOrder(order)}
              />
            )}
            
            {activeTab === 'profile' && (
              <ProfileTab 
                userName={userName}
                userEmail={userEmail}
                userProfileImage={null}
                onLogout={handleLogout}
              />
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
                            {/* ✅ BUG #7 FIX: price_snapshot is optional; guard against undefined→NaN */}
                            {((item.price_snapshot ?? 0) * item.quantity).toLocaleString()}원
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
                      {/* ✅ items가 배열이 아닌 값(object 등)으로 올 경우 .reduce is not a function 방어 */}
                    {(Array.isArray(selectedOrder.items) ? selectedOrder.items : []).reduce((sum, item) => sum + (item.price_snapshot ?? 0) * item.quantity, 0).toLocaleString()}원
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6e6e73]">배송비</span>
                    <span className="font-medium text-[#1d1d1f]">3,000원</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-[#d2d2d7]">
                    <span className="text-[#1d1d1f] font-semibold">총 결제금액</span>
                    <span className="text-[19px] font-bold text-[#007aff]">
                      {/* ✅ BUG #7 FIX: total_amount is optional in Order type; nullish fallback prevents TypeError */}
                      {(selectedOrder.total_amount ?? selectedOrder.amount ?? 0).toLocaleString()}원
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
                    handleCancelOrder(selectedOrder.id, selectedOrder.order_number ?? String(selectedOrder.id))
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
