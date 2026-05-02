import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import SEO from '@/components/SEO'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import MobileFooter from '@/components/MobileFooter'
import { CartTab } from '@/components/mypage/CartTab'
import { LargeTitle, WalletPageWrapper } from '@/components/wallet/WalletAtoms'
import { walletTokens } from '@/components/wallet/walletTokens'
import { OrdersTab } from '@/components/mypage/OrdersTab'
import {
  ArrowLeft,
  Package,
  ShoppingCart,
  AlertCircle,
} from 'lucide-react'
import { getUserIdSync, isLoggedInSync, requireLogin } from '@/utils/auth'
import type { Order } from '@/types/order'
import type { CartItem } from '@/types/cart'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import OrderDetailModal from './my-orders/OrderDetailModal'
import CancelOrderModal from './my-orders/CancelOrderModal'

// 🛡️ 2026-05-02: TD-018 분할 — Order/Cancel 모달을 ./my-orders/ 디렉토리로 추출.
//   미사용 import (Badge, X, Truck, ChevronRight, formatKST, formatNumber,
//   getTrackingUrl, OrderItem) 정리.

type TabType = 'cart' | 'orders'

export default function MyOrdersPage() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<TabType>('cart')
  const [cartItems, setCartItems] = useState<CartItem[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  useEscapeKey(() => { if (selectedOrder) setSelectedOrder(null) })
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
  const [isPartialCancel, setIsPartialCancel] = useState(false)
  const [cancelAmount, setCancelAmount] = useState('')
  // ✅ UX C5 FIX: 에러 상태로 재시도 UI 제공 (리다이렉트 루프 방지)
  const [error, setError] = useState<string | null>(null)

  // Check login status (통합 인증 사용)
  const userId = getUserIdSync()

  // ✅ BUG #25 FIX: A ref-based flag prevents concurrent loadData() calls.
  // Previously, switching tabs AND triggering handleUpdateQuantity/handleRemoveItem
  // at roughly the same time fired two simultaneous loadData() calls.  The second
  // call would overwrite the state of the first with stale server data because
  // both read `activeTab` from the closure at the same point in time.
  const isLoadingRef = useRef(false)

  useEffect(() => { document.title = '주문내역 - 유어딜' }, [])

  // ✅ UX C5 FIX: 로그인 체크는 최초 마운트 시에만 (activeTab 변경 시 리다이렉트 루프 방지)
  useEffect(() => {
    if (!isLoggedInSync() || !userId) {
      requireLogin(navigate, '로그인이 필요합니다.')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ✅ UX C5 FIX: 데이터 로드는 activeTab 변경 시. 401 시 리다이렉트 대신 에러 표시.
  useEffect(() => {
    if (!isLoggedInSync() || !userId) return
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, userId])

  async function loadData() {
    // ✅ BUG #25 FIX: Guard against concurrent calls
    if (isLoadingRef.current) {
      return
    }
    isLoadingRef.current = true
    setLoading(true)
    setError(null)
    try {
      const uid = userId || getUserIdSync()

      if (!uid) {
        if (import.meta.env.DEV) console.error('No user ID available')
        return
      }

      if (activeTab === 'cart') {
        const response = await api.get('/api/cart')
        if (response.data.success) {
          const d = response.data.data
          setCartItems(Array.isArray(d) ? d : (d?.items || []))
        }
      } else if (activeTab === 'orders') {
        const response = await api.get('/api/orders')
        if (response.data.success) {
          const d = response.data.data
          setOrders(Array.isArray(d) ? d : (d?.items || d?.orders || []))
        }
      }
    } catch (err: unknown) {
      if (import.meta.env.DEV) console.error('Failed to load data:', err)
      const e = err as { response?: { status?: number } }
      if (e?.response?.status === 401) {
        setError('세션이 만료되었습니다. 다시 로그인해주세요.')
      } else {
        setError(activeTab === 'cart' ? '장바구니를 불러올 수 없습니다.' : '주문 목록을 불러올 수 없습니다.')
      }
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
      if (import.meta.env.DEV) console.error('Failed to update quantity:', error)
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
      if (import.meta.env.DEV) console.error('Failed to remove item:', error)
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

  async function handleConfirmOrder(orderId: number | string, orderNumber: string) {
    if (!confirm(`주문 ${orderNumber}을(를) 구매확정 하시겠습니까?\n구매확정 후에는 취소할 수 없습니다.`)) return
    setProcessing(true)
    try {
      const response = await api.post(`/api/orders/${orderId}/confirm`)
      if (response.data.success) {
        toast.success('구매확정이 완료되었습니다.')
        loadData()
      } else {
        toast.error(response.data.error || '구매확정에 실패했습니다.')
      }
    } catch (error: unknown) {
      const error_ = error as { response?: { data?: { error?: string }; status?: number } }
      toast.error(error_.response?.data?.error || '구매확정 중 오류가 발생했습니다.')
    } finally {
      setProcessing(false)
    }
  }

  async function handleCancelOrder(orderId: number | string, orderNumber: string) {
    setCancelModal({ isOpen: true, orderId, orderNumber })
    setCancelReason('')
    setIsPartialCancel(false)
    setCancelAmount('')
  }

  async function confirmCancelOrder() {
    const { orderId } = cancelModal
    if (!orderId) return
    if (!cancelReason.trim()) {
      toast.error('취소 사유를 입력해주세요.')
      return
    }
    if (isPartialCancel && (!cancelAmount || Number(cancelAmount) <= 0)) {
      toast.error('부분 취소 금액을 입력해주세요.')
      return
    }
    setProcessing(true)
    try {
      const response = await api.post(`/api/orders/${orderId}/cancel`, {
        reason: cancelReason,
        ...(isPartialCancel && cancelAmount ? { cancel_amount: Number(cancelAmount) } : {}),
      })
      if (response.data.success) {
        toast.success('주문이 취소되었습니다.')
        setCancelModal({ isOpen: false, orderId: null, orderNumber: '' })
        setCancelReason('')
        setIsPartialCancel(false)
        setCancelAmount('')
        loadData()
      } else {
        toast.error(response.data.error || '주문 취소에 실패했습니다.')
      }
    } catch (error: unknown) {
      const error_ = error as { response?: { data?: { error?: string; message?: string }; status?: number } };
      if (import.meta.env.DEV) console.error('Failed to cancel order:', error)
      toast.error(error_.response?.data?.error || '주문 취소 중 오류가 발생했습니다.')
    } finally {
      setProcessing(false)
    }
  }


  // 🛡️ 2026-04-30: CLAUDE.md 규칙 — /my-orders 는 화이트 테마 (쇼핑/결제 플로우)
  // 이전엔 dark Wallet wrapper 였는데 내부 CartTab/OrdersTab 는 모두 화이트라 시각적 충돌.
  const theme = 'light' as const
  const tk = walletTokens[theme]

  return (
    <WalletPageWrapper theme={theme}>
      <SEO title="주문내역 - 유어딜" description="주문 내역과 배송 현황을 확인하세요" url="/my-orders" noindex />
      {/* 상단 chrome — 뒤로가기 */}
      <div className="sticky top-0 z-30 px-2 pt-3 pb-2 flex items-center"
        style={{ background: tk.chrome, borderBottom: `0.5px solid ${tk.separator}` }}>
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 flex items-center justify-center rounded-full"
          style={{ background: tk.fillSoft, color: tk.label }}
          aria-label="뒤로가기"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
      </div>

      <LargeTitle theme={theme} title="주문내역" />

      {/* Tab Navigation — underline 탭 */}
      <div className="px-4 mb-4">
        <div className="flex relative" style={{ borderBottom: `1px solid ${tk.separator}` }}>
          <button
            onClick={() => setActiveTab('cart')}
            className="flex-1 py-3 px-4 transition-colors relative flex items-center justify-center gap-2"
            style={{
              fontSize: 15,
              fontWeight: activeTab === 'cart' ? 800 : 600,
              color: activeTab === 'cart' ? tk.label : tk.tertiary,
              letterSpacing: '-0.01em',
            }}
            aria-pressed={activeTab === 'cart'}
          >
            <ShoppingCart className="h-4 w-4" />
            장바구니
            {activeTab === 'cart' && (
              <div className="absolute bottom-0 left-0 right-0" style={{ height: 2, background: tk.label }} />
            )}
          </button>
          <button
            onClick={() => setActiveTab('orders')}
            className="flex-1 py-3 px-4 transition-colors relative flex items-center justify-center gap-2"
            style={{
              fontSize: 15,
              fontWeight: activeTab === 'orders' ? 800 : 600,
              color: activeTab === 'orders' ? tk.label : tk.tertiary,
              letterSpacing: '-0.01em',
            }}
            aria-pressed={activeTab === 'orders'}
          >
            <Package className="h-4 w-4" />
            주문내역
            {activeTab === 'orders' && (
              <div className="absolute bottom-0 left-0 right-0" style={{ height: 2, background: tk.label }} />
            )}
          </button>
        </div>
      </div>

      {/* Content */}
      <main className="ur-content-medium px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
              <p className="text-[17px] text-gray-500 dark:text-gray-400">로딩 중...</p>
            </div>
          </div>
        ) : error ? (
          /* ✅ UX C5 FIX: 에러 상태 + 재시도 버튼 (리다이렉트 루프 방지) */
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <p className="text-[15px] text-gray-900 dark:text-white mb-4">{error}</p>
              <button
                onClick={() => loadData()}
                className="px-6 py-2 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors font-semibold"
              >
                다시 시도
              </button>
            </div>
          </div>
        ) : (
          <>
            {activeTab === 'cart' && (
              <CartTab 
                cartItems={cartItems as unknown as { id: number; product_id: number; product_name: string; quantity: number; price_snapshot: number; option_value?: string }[]}
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
                onConfirmOrder={handleConfirmOrder}
              />
            )}
            
          </>
        )}
      </main>

      {/* Order Detail Modal — extracted to ./my-orders/OrderDetailModal */}
      {selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onCancel={handleCancelOrder}
        />
      )}

      {/* Cancel Order Modal — extracted to ./my-orders/CancelOrderModal */}
      {cancelModal.isOpen && (
        <CancelOrderModal
          orderNumber={cancelModal.orderNumber}
          reason={cancelReason}
          onReasonChange={setCancelReason}
          isPartialCancel={isPartialCancel}
          onPartialCancelChange={setIsPartialCancel}
          cancelAmount={cancelAmount}
          onCancelAmountChange={setCancelAmount}
          processing={processing}
          onClose={() => { setCancelModal({ isOpen: false, orderId: null, orderNumber: '' }); setCancelReason(''); setIsPartialCancel(false); setCancelAmount('') }}
          onConfirm={confirmCancelOrder}
        />
      )}

      {/* Mobile Footer */}
      <MobileFooter />
    </WalletPageWrapper>
  )
}
