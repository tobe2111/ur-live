/**
 * 🏁 2026-06-12 (전수조사 🔴 G6): 유저 반품 신청 모달.
 *   서버 POST /api/returns/request 는 완비돼 있었는데 프론트 호출자 0 — 구매자 입구가 없던 갭.
 *   서버 스펙: { order_id, reason(필수), detail_reason? } / 게이트: 본인 주문 + DELIVERED + 7일 이내.
 */
import { useState } from 'react'
import { X, AlertCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'

interface Props {
  orderId: number | string
  orderNumber: string
  onClose: () => void
  onSubmitted: () => void
}

export default function ReturnRequestModal({ orderId, orderNumber, onClose, onSubmitted }: Props) {
  const { t } = useTranslation()
  const [reason, setReason] = useState('')
  const [detail, setDetail] = useState('')
  const [processing, setProcessing] = useState(false)

  async function submit() {
    if (!reason.trim()) {
      toast.error(t('returnRequest.reasonRequired', { defaultValue: '반품 사유를 선택해주세요' }))
      return
    }
    setProcessing(true)
    try {
      const res = await api.post('/api/returns/request', {
        order_id: Number(orderId),
        reason: reason.trim(),
        ...(detail.trim() ? { detail_reason: detail.trim().slice(0, 1000) } : {}),
      })
      if (res.data?.success) {
        toast.success(t('returnRequest.success', { defaultValue: '반품 신청이 접수되었습니다' }))
        onSubmitted()
      } else {
        toast.error(res.data?.error || t('returnRequest.fail', { defaultValue: '반품 신청에 실패했습니다' }))
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } }
      toast.error(e?.response?.data?.error || t('returnRequest.fail', { defaultValue: '반품 신청에 실패했습니다' }))
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fadeIn">
      <div
        className="bg-white dark:bg-[#0A0A0A] rounded-3xl shadow-2xl max-w-md w-full p-6 animate-slideUp"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">
            {t('returnRequest.title', { defaultValue: '반품/교환 신청' })}
          </h3>
          <button
            onClick={onClose}
            aria-label={t('common.close', { defaultValue: '닫기' })}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="mb-4 p-4 bg-gray-50 dark:bg-[#121212] rounded-xl">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">{t('cancelOrder.orderNumber', { defaultValue: '주문번호' })}</p>
          <p className="font-semibold text-gray-900 dark:text-white">{orderNumber}</p>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">
            {t('returnRequest.reasonLabel', { defaultValue: '반품 사유' })} <span className="text-red-500">*</span>
          </label>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 dark:border-[#3A3A3A] rounded-xl text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          >
            <option value="">{t('returnRequest.reasonPlaceholder', { defaultValue: '반품 사유를 선택해주세요' })}</option>
            <option value="단순 변심">{t('returnRequest.reason1', { defaultValue: '단순 변심' })}</option>
            <option value="상품 불량/파손">{t('returnRequest.reason2', { defaultValue: '상품 불량/파손' })}</option>
            <option value="상품 정보 불일치">{t('returnRequest.reason3', { defaultValue: '상품 정보 불일치' })}</option>
            <option value="오배송">{t('returnRequest.reason4', { defaultValue: '오배송' })}</option>
            <option value="기타">{t('returnRequest.reason5', { defaultValue: '기타' })}</option>
          </select>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">
            {t('returnRequest.detailLabel', { defaultValue: '상세 사유 (선택)' })}
          </label>
          <textarea
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            rows={3}
            maxLength={1000}
            placeholder={t('returnRequest.detailPlaceholder', { defaultValue: '상세한 사유를 입력하면 처리가 빨라져요' })}
            className="w-full px-4 py-3 border border-gray-300 dark:border-[#3A3A3A] rounded-xl text-sm text-gray-900 dark:text-white resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          />
        </div>

        <div className="mb-6 p-4 bg-blue-50 rounded-xl">
          <div className="flex items-start gap-2">
            <AlertCircle className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-700">
              <p className="font-medium mb-1">{t('returnRequest.noticeTitle', { defaultValue: '반품 안내' })}</p>
              <p className="text-blue-600">• {t('returnRequest.notice1', { defaultValue: '배송완료 후 7일 이내에만 신청할 수 있습니다.' })}</p>
              <p className="text-blue-600">• {t('returnRequest.notice2', { defaultValue: '판매자 승인 후 회수 송장을 등록해주세요. 진행 상황은 내 반품에서 확인할 수 있어요.' })}</p>
              <p className="text-blue-600">• {t('returnRequest.notice3', { defaultValue: '검수 완료 후 결제 수단으로 환불됩니다.' })}</p>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 px-4 bg-gray-50 dark:bg-[#121212] text-gray-600 dark:text-gray-300 font-medium rounded-full hover:bg-gray-100 dark:hover:bg-[#1A1A1A] transition-colors"
            disabled={processing}
          >
            {t('common.close', { defaultValue: '닫기' })}
          </button>
          <button
            onClick={submit}
            disabled={processing || !reason.trim()}
            className="flex-1 py-3 px-4 bg-gray-900 text-white font-medium rounded-full hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {processing ? t('common.processing', { defaultValue: '처리중...' }) : t('returnRequest.submit', { defaultValue: '반품 신청' })}
          </button>
        </div>
      </div>
    </div>
  )
}
