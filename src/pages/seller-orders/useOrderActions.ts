import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from '@/lib/i18n-lite'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import { askRefundReason, REFUND_REASON_FALLBACK } from './refund-prompt'
import { useStatusText } from './statusHelpers'

/**
 * 🧾 주문 한 건에 하는 일(상태 변경 · 취소·환불 · 운송장) — 셀러 주문 화면(`SellerOrdersPage`)과
 *   마이 주문 시트(`user-profile/my-sales/MyOrdersSheet`)가 **같이** 쓴다(2026-11-03 마이용 시트 신설 때 옮겼다).
 * 🔒 서버 호출·문구는 옮기기 전과 **한 글자도 같다** — 환불은 서버 `POST /api/seller/orders/:n/refund` 가
 *   Toss/딜 환불 + 커미션 역전을 한다(이 파일은 그걸 부르기만 한다). 두 화면이 각자 적으면 한쪽만 고쳐지는 날이 온다.
 * @param onDone 처리 뒤(목록 무효화 다음) — 열려 있는 상세를 닫는 등 화면 쪽 마무리.
 */
export function useOrderActions(onDone?: (orderNumber: string) => void) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const getStatusText = useStatusText()
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState('')
  const [trackingForm, setTrackingForm] = useState({ courier: '', tracking_number: '' })
  const invalidateOrders = () => queryClient.invalidateQueries({ queryKey: ['seller', 'orders'] })

  async function handleStatusChange(orderNumber: string, newStatus: string) {
    if (!(await confirmDialog(t('seller.confirmStatusChange', { status: getStatusText(newStatus) })))) {
      return
    }
    setUpdating(true)
    setError('')
    try {
      // order_number 대신 id를 사용 (API가 둘 다 지원)
      const response = await api.patch(
        `/api/seller/orders/${orderNumber}/status`,
        { status: newStatus }
      )
      if (response.data.success) {
        toast.success(t('seller.statusChanged'))
        invalidateOrders()
        onDone?.(orderNumber)
      }
    } catch (error: unknown) {
      const error_ = error as { response?: { data?: { error?: string; message?: string }; status?: number } };
      if (import.meta.env.DEV) console.error('Failed to update status:', error)
      setError(error_.response?.data?.error || t('seller.statusChangeFailed'))
    } finally {
      setUpdating(false)
    }
  }

  // 🛡️ 2026-06-01 머니플로우 감사: 결제완료 주문 정식 취소·환불 (Toss/딜 환불 + 커미션 역전).
  async function handleRefund(orderNumber: string) {
    // 🧾 2026-10-06 (철거로 잃은 것 ① 복원): 사유를 받는다. 계약·문구는 모듈 하나에 있다
    //   (`seller-orders/refund-prompt.ts` — 선택 · 빈 칸이면 기본값 · 취소는 null).
    const reason = await askRefundReason(t)
    if (reason === null) return
    setUpdating(true)
    setError('')
    try {
      const response = await api.post(`/api/seller/orders/${orderNumber}/refund`, {
        reason: reason.trim() || REFUND_REASON_FALLBACK,
      })
      if (response.data.success) {
        toast.success(t('seller.refundDone', { defaultValue: '취소·환불 처리되었습니다' }))
        invalidateOrders()
        onDone?.(orderNumber)
      }
    } catch (error: unknown) {
      const error_ = error as { response?: { data?: { error?: string } } }
      if (import.meta.env.DEV) console.error('Failed to refund:', error)
      setError(error_.response?.data?.error || t('seller.refundFailed', { defaultValue: '환불 처리에 실패했습니다' }))
    } finally {
      setUpdating(false)
    }
  }

  async function handleTrackingSubmit(e: React.FormEvent, orderNumber: string) {
    e.preventDefault()
    setUpdating(true)
    setError('')
    try {
      const response = await api.put(
        `/api/seller/orders/${orderNumber}/tracking`,
        trackingForm
      )
      if (response.data.success) {
        toast.success(t('seller.trackingRegistered'))
        setTrackingForm({ courier: '', tracking_number: '' })
        invalidateOrders()
        onDone?.(orderNumber)
      }
    } catch (error: unknown) {
      const error_ = error as { response?: { data?: { error?: string; message?: string }; status?: number } };
      if (import.meta.env.DEV) console.error('Failed to update tracking:', error)
      setError(error_.response?.data?.error || t('seller.trackingRegisterFailed'))
    } finally {
      setUpdating(false)
    }
  }

  return { updating, error, setError, trackingForm, setTrackingForm, handleStatusChange, handleRefund, handleTrackingSubmit, invalidateOrders }
}
