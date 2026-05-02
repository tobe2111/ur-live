/**
 * 🛡️ 2026-04-28: 선물 보내기 모달
 *
 * 사용처: ProductDetailPage, LivePageV2 의 "선물하기" 버튼에서 호출.
 *
 * 흐름:
 *   1) 수신자 정보 입력 (전화번호 + 이름 옵션)
 *   2) 메시지 입력 (200자, optional)
 *   3) 가격 확인 + "결제하기" 버튼
 *   4) POST /api/gifts → claim_token 받음
 *   5) PointsChargePage 또는 토스 결제 흐름으로 이동 (gift_id 파라미터)
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { X, Gift, Sparkles, Loader2 } from 'lucide-react'
import { useEscapeKey } from '@/hooks/useEscapeKey'
import { useFocusTrap } from '@/hooks/useFocusTrap'
import { formatNumber } from '@/utils/format'

interface Props {
  open: boolean
  onClose: () => void
  productId: number
  productName: string
  productThumbnail?: string | null
  productPrice: number
}

const MAX_MESSAGE = 200

export default function GiftSendModal({ open, onClose, productId, productName, productThumbnail, productPrice }: Props) {
  const { t } = useTranslation()
  useEscapeKey(() => { if (open) onClose() })
  const dialogRef = useFocusTrap<HTMLDivElement>(open)
  const navigate = useNavigate()
  const [recipientPhone, setRecipientPhone] = useState('')
  const [recipientName, setRecipientName] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (!open) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const cleanPhone = recipientPhone.replace(/[^0-9]/g, '')
    if (!/^01\d{8,9}$/.test(cleanPhone)) {
      toast.error(t('gift.invalidPhone'))
      return
    }
    if (message.length > MAX_MESSAGE) {
      toast.error(t('gift.messageTooLong', { max: MAX_MESSAGE }))
      return
    }

    setSubmitting(true)
    try {
      const res = await api.post('/api/gifts', {
        recipient_phone: cleanPhone,
        recipient_name: recipientName.trim() || undefined,
        product_id: productId,
        message: message.trim() || undefined,
      })
      const giftId = res.data?.data?.id
      const claimToken = res.data?.data?.claim_token
      if (!giftId || !claimToken) {
        throw new Error('gift_id 또는 claim_token 누락')
      }
      toast.success(t('gift.movingToPayment'))
      // 결제 페이지로 이동 (Toss Payment) — gift_id 파라미터로 전달
      // PointsChargePage 가 amount + gift_id 두 파라미터 받아 토스 결제 후 gift status paid 처리
      navigate(`/checkout?gift_id=${giftId}&amount=${productPrice}&product_id=${productId}`)
      onClose()
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } }
      toast.error(e.response?.data?.error || t('gift.creationFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/50 flex items-end sm:items-center justify-center"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={dialogRef}
        className="bg-white w-full max-w-[430px] rounded-t-3xl sm:rounded-3xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={`${productName} 선물 보내기`}
      >
        {/* 헤더 */}
        <div className="sticky top-0 bg-white px-5 pt-5 pb-3 flex items-center justify-between border-b border-gray-100 z-10">
          <div className="flex items-center gap-2">
            <Gift className="w-5 h-5 text-pink-500" />
            <h2 className="font-bold text-gray-900">선물하기</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full">
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* 상품 미리보기 */}
          <div className="flex gap-3 p-3 bg-gray-50 rounded-xl">
            {productThumbnail ? (
              <img src={productThumbnail} alt="" className="w-14 h-14 rounded-lg object-cover flex-shrink-0" loading="lazy" />
            ) : (
              <div className="w-14 h-14 rounded-lg bg-white flex items-center justify-center flex-shrink-0">
                <Gift className="w-6 h-6 text-gray-300" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 text-sm truncate">{productName}</p>
              <p className="text-pink-500 font-bold text-sm mt-0.5">{formatNumber(productPrice)}원</p>
            </div>
          </div>

          {/* 수신자 정보 */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5">받는 사람 휴대폰 *</label>
            <input
              value={recipientPhone}
              onChange={e => setRecipientPhone(e.target.value)}
              placeholder="010-1234-5678"
              type="tel"
              required
              className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-200 focus:border-pink-300"
            />
            <p className="text-[10px] text-gray-400 mt-1">카카오톡 알림으로 선물 링크가 발송됩니다</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5">받는 사람 이름 (선택)</label>
            <input
              value={recipientName}
              onChange={e => setRecipientName(e.target.value)}
              placeholder={t('gift.placeholders.recipientName')}
              className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-200 focus:border-pink-300"
            />
          </div>

          {/* 메시지 */}
          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1.5 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-pink-500" /> 메시지 (선택)
            </label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder={t('gift.placeholders.message')}
              rows={3}
              maxLength={MAX_MESSAGE}
              className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-200 focus:border-pink-300 resize-none"
            />
            <div className="flex justify-end mt-1">
              <span className={`text-[10px] ${message.length > MAX_MESSAGE ? 'text-red-500' : 'text-gray-400'}`}>
                {message.length}/{MAX_MESSAGE}
              </span>
            </div>
          </div>

          {/* 안내 */}
          <div className="bg-pink-50 rounded-xl p-3 text-[11px] text-pink-700 leading-relaxed">
            • 결제 후 받는 분께 카카오톡으로 선물 링크가 발송돼요<br/>
            • 30일 내 받기 안 하면 자동 환불됩니다
          </div>

          {/* CTA */}
          <button
            type="submit"
            disabled={submitting || !recipientPhone}
            className="w-full py-4 bg-pink-500 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-pink-600 transition-colors disabled:opacity-50"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Gift className="w-4 h-4" />}
            {formatNumber(productPrice)}원 결제하고 선물하기
          </button>
        </form>
      </div>
    </div>
  )
}
