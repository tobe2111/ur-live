import { lazy, Suspense, useEffect, useState } from 'react'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import SEO from '@/components/SEO'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import MobileFooter from '@/components/MobileFooter'
import { OrdersTab } from '@/components/mypage/OrdersTab'
import { ArrowLeft, AlertCircle } from 'lucide-react'
import { getUserIdSync, isLoggedInSync, requireLogin } from '@/utils/auth'
import type { Order } from '@/types/order'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import { useMyOrders } from '@/hooks/queries/useMyData'
import { useMyReturns } from '@/hooks/queries/useMyReturns'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/hooks/queries/queryKeys'
// 🛡️ 2026-05-27 (loading P1): 모달 ~10-15KB lazy — 사용자가 상세 클릭 시만 fetch.
const OrderDetailModal = lazy(() => import('./my-orders/OrderDetailModal'))
// 🏁 2026-06-12 (전수조사 🔴 G6): 반품 신청 입구 — 배송완료 주문에서 진입.
const ReturnRequestModal = lazy(() => import('./my-orders/ReturnRequestModal'))
import CancelOrderModal from './my-orders/CancelOrderModal'

// 🛡️ 2026-05-02: TD-018 분할 — Order/Cancel 모달을 ./my-orders/ 디렉토리로 추출.
//   미사용 import (Badge, X, Truck, ChevronRight, formatKST, formatNumber,
//   getTrackingUrl, OrderItem) 정리.

// 🛡️ 2026-06-18: 첫 페인트 스켈레톤 — 검색바 + 탭 + 카드 3개 형태 (스피너-온리 금지).
function OrdersSkeleton() {
  return (
    <div className="space-y-4 animate-pulse" aria-hidden="true">
      <div className="h-11 rounded-xl bg-gray-100 dark:bg-[#161616]" />
      <div className="flex gap-5 border-b border-gray-100 dark:border-[#1A1A1A] pb-2.5">
        {[40, 32, 44, 32].map((w, i) => (
          <div key={i} className="h-4 rounded bg-gray-100 dark:bg-[#161616]" style={{ width: w }} />
        ))}
      </div>
      <div className="space-y-3">
        {[0, 1, 2].map(i => (
          <div key={i} className="rounded-2xl border border-gray-100 dark:border-[#1A1A1A] p-4">
            <div className="h-3 w-16 rounded bg-gray-100 dark:bg-[#161616] mb-3" />
            <div className="flex gap-3">
              <div className="w-16 h-16 rounded-lg bg-gray-100 dark:bg-[#161616] shrink-0" />
              <div className="flex-1 space-y-2 py-0.5">
                <div className="h-3.5 w-3/4 rounded bg-gray-100 dark:bg-[#161616]" />
                <div className="h-3 w-1/3 rounded bg-gray-100 dark:bg-[#161616]" />
                <div className="h-3.5 w-1/4 rounded bg-gray-100 dark:bg-[#161616]" />
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-gray-100 dark:border-[#1A1A1A] flex justify-between">
              <div className="h-5 w-20 rounded bg-gray-100 dark:bg-[#161616]" />
              <div className="h-5 w-24 rounded bg-gray-100 dark:bg-[#161616]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function MyOrdersPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  // 🛡️ 2026-05-28 (사용자 요청 A): /my-orders 는 주문내역 전용. 장바구니는 /cart (CartPage) 하나로 일원화
  //   (이전엔 cart/orders 탭 — /cart 와 중복 + 디자인 불일치). 헤더는 쇼핑 페이지 표준 스타일.
  // 🛡️ 2026-06-01 Tier2: 수동 loadData → useMyOrders 재사용(RQ 중복요청 dedup → isLoadingRef 불필요).
  const { data: ordersRaw = [], isLoading: loading, isError, refetch } = useMyOrders()
  const orders = ordersRaw as unknown as Order[]
  // 🏁 2026-06-12 (전수조사 🔴 G6): 반품 진행 상태 표시 + 중복 신청 차단용 본인 반품 목록.
  const qc = useQueryClient()
  const { data: myReturns = [] } = useMyReturns()
  const returnsByOrder: Record<string, string> = {}
  for (const r of myReturns) {
    if (r.order_id != null && !['rejected', 'cancelled'].includes(r.status)) {
      returnsByOrder[String(r.order_id)] = r.status
    }
  }
  const [returnModal, setReturnModal] = useState<{ orderId: number | string; orderNumber: string } | null>(null)
  const [processing, setProcessing] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  useEscapeKey(() => { if (selectedOrder) setSelectedOrder(null) })
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
  // 🛡️ 2026-06-01 Tier2: 에러는 useMyOrders 의 isError 로 대체(훅이 실패 시 캐시 fallback).
  const error = isError ? t('myOrders.errorOrders') : null

  // Check login status (통합 인증 사용)
  const userId = getUserIdSync()

  useEffect(() => { document.title = t('myOrders.docTitle') }, [t])

  // ✅ UX C5 FIX: 로그인 체크는 최초 마운트 시에만 (activeTab 변경 시 리다이렉트 루프 방지)
  useEffect(() => {
    if (!isLoggedInSync() || !userId) {
      requireLogin(navigate, t('myOrders.loginRequired'))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // mutation(구매확정/취소) 후 목록 갱신용
  function loadData() { refetch() }

  async function handleConfirmOrder(orderId: number | string, orderNumber: string) {
    if (!(await confirmDialog({ message: t('myOrders.confirmPurchasePrompt', { orderNumber, defaultValue: `주문 ${orderNumber}을(를) 구매확정 하시겠습니까?\n구매확정 후에는 취소할 수 없습니다.` }), danger: true }))) return
    setProcessing(true)
    try {
      const response = await api.post(`/api/orders/${orderId}/confirm`)
      if (response.data.success) {
        toast.success(t('myOrders.confirmSuccess'))
        loadData()
      } else {
        toast.error(response.data.error || t('myOrders.confirmFail'))
      }
    } catch (error: unknown) {
      const error_ = error as { response?: { data?: { error?: string }; status?: number } }
      toast.error(error_.response?.data?.error || t('myOrders.confirmError'))
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
      toast.error(t('myOrders.cancelReasonRequired'))
      return
    }
    if (isPartialCancel && (!cancelAmount || Number(cancelAmount) <= 0)) {
      toast.error(t('myOrders.cancelAmountRequired'))
      return
    }
    setProcessing(true)
    try {
      const response = await api.post(`/api/orders/${orderId}/cancel`, {
        reason: cancelReason,
        ...(isPartialCancel && cancelAmount ? { cancel_amount: Number(cancelAmount) } : {}),
      })
      if (response.data.success) {
        toast.success(t('myOrders.cancelSuccess'))
        setCancelModal({ isOpen: false, orderId: null, orderNumber: '' })
        setCancelReason('')
        setIsPartialCancel(false)
        setCancelAmount('')
        loadData()
      } else {
        toast.error(response.data.error || t('myOrders.cancelFail'))
      }
    } catch (error: unknown) {
      const error_ = error as { response?: { data?: { error?: string; message?: string }; status?: number } };
      if (import.meta.env.DEV) console.error('Failed to cancel order:', error)
      toast.error(error_.response?.data?.error || t('myOrders.cancelError'))
    } finally {
      setProcessing(false)
    }
  }


  // 🛡️ 2026-05-28 (사용자 요청 A): 헤더/레이아웃을 CartPage(/cart) 와 동일한 쇼핑 페이지 표준
  //   스타일로 통일 — 화이트 테마 + 스티키 헤더(뒤로가기 + 가운데 제목). Wallet/LargeTitle chrome 제거.
  return (
    <div className="min-h-screen bg-white dark:bg-[#0A0A0A] pb-safe-nav md:pb-20">
      <SEO title={t('myOrders.docTitle')} description={t('myOrders.seoDesc')} url="/my-orders" noindex />

      {/* 헤더 — 무신사 스타일: 뒤로가기 + 좌측 large title */}
      <div className="sticky top-0 z-10 bg-white dark:bg-[#0A0A0A] border-b border-gray-100 dark:border-[#1A1A1A]">
        <div className="ur-content-medium flex items-center gap-1 px-4 py-3">
          <button type="button" onClick={() => navigate(-1)} aria-label={t('notifications.back', { defaultValue: '뒤로' })} className="w-9 h-9 -ml-2 flex items-center justify-center">
            <ArrowLeft className="h-5 w-5 text-gray-900 dark:text-white" aria-hidden="true" />
          </button>
          <h1 className="text-[18px] font-extrabold text-gray-900 dark:text-white">{t('myOrders.title')}</h1>
        </div>
      </div>

      {/* Content */}
      <main className="ur-content-medium px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
        {loading ? (
          /* 🛡️ 2026-06-18: 스피너 → 스켈레톤 카드 (CLAUDE.md 첫 페인트 표준) */
          <OrdersSkeleton />
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
                {t('common.retry', { defaultValue: '다시 시도' })}
              </button>
            </div>
          </div>
        ) : (
          <OrdersTab
            orders={orders}
            onCancelOrder={handleCancelOrder}
            onSelectOrder={(order) => setSelectedOrder(order)}
            onConfirmOrder={handleConfirmOrder}
            onRequestReturn={(orderId, orderNumber) => setReturnModal({ orderId, orderNumber })}
            returnsByOrder={returnsByOrder}
          />
        )}
      </main>

      {/* Order Detail Modal — extracted to ./my-orders/OrderDetailModal */}
      {selectedOrder && (
        <Suspense fallback={null}>
          <OrderDetailModal
            order={selectedOrder}
            onClose={() => setSelectedOrder(null)}
            onCancel={handleCancelOrder}
          />
        </Suspense>
      )}

      {/* 반품 신청 모달 — 🏁 2026-06-12 G6 */}
      {returnModal && (
        <Suspense fallback={null}>
          <ReturnRequestModal
            orderId={returnModal.orderId}
            orderNumber={returnModal.orderNumber}
            onClose={() => setReturnModal(null)}
            onSubmitted={() => {
              setReturnModal(null)
              qc.invalidateQueries({ queryKey: queryKeys.myReturns() })
            }}
          />
        </Suspense>
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
    </div>
  )
}
