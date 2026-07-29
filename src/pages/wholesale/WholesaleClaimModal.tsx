import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { X, Loader2, AlertTriangle } from 'lucide-react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { WT } from './wholesale-theme'

// 🏭 BIZ-1 (2026-06-08) 판매사 발의 도매 클레임(RMA) 제기 모달.
//   하자/오배송/파손/수량부족/기타 사유 + 설명 + 증빙 URL → POST /api/wholesale/claims.
//   라이트 고정 B2B 서피스(WT 토큰). i18n defaultValue.

interface Props {
  orderId: number
  orderItemId?: number | null
  onClose: () => void
  onSubmitted?: () => void
}

const REASONS: { code: string; ko: string }[] = [
  { code: 'defective', ko: '불량/하자' },
  { code: 'wrong_item', ko: '오배송(다른 상품)' },
  { code: 'damaged', ko: '배송 중 파손' },
  { code: 'shortage', ko: '수량 부족' },
  { code: 'other', ko: '기타' },
]

export default function WholesaleClaimModal({ orderId, orderItemId, onClose, onSubmitted }: Props) {
  const { t } = useTranslation()
  const [reasonCode, setReasonCode] = useState('')
  const [reasonText, setReasonText] = useState('')
  const [evidenceUrl, setEvidenceUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function sellerAuth() {
    const token = typeof window !== 'undefined' ? localStorage.getItem('seller_token') : null
    return { headers: token ? { Authorization: `Bearer ${token}` } : {} }
  }

  async function submit() {
    if (!reasonCode) { toast.error(t('wholesale.claim.pickReason', { defaultValue: '클레임 사유를 선택해주세요' })); return }
    if (evidenceUrl && !/^https?:\/\//i.test(evidenceUrl)) {
      toast.error(t('wholesale.claim.badUrl', { defaultValue: '증빙 URL은 http(s):// 로 시작해야 합니다' })); return
    }
    setSubmitting(true)
    try {
      const r = await api.post('/api/wholesale/claims', {
        wholesale_order_id: orderId,
        wholesale_order_item_id: orderItemId ?? null,
        reason_code: reasonCode,
        reason_text: reasonText.trim(),
        evidence_url: evidenceUrl.trim(),
      }, sellerAuth())
      if (r.data?.success) {
        toast.success(t('wholesale.claim.done', { defaultValue: '클레임이 접수되었습니다. 검토 후 안내드립니다.' }))
        onSubmitted?.()
        onClose()
      } else {
        toast.error(r.data?.error || t('wholesale.claim.fail', { defaultValue: '클레임 접수에 실패했습니다' }))
      }
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || t('wholesale.claim.fail', { defaultValue: '클레임 접수에 실패했습니다' }))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" style={{ background: 'rgba(20,22,28,0.4)' }} onClick={onClose}>
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 max-h-[90dvh] overflow-y-auto" onClick={e => e.stopPropagation()} style={{ boxShadow: WT.shCard }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="inline-flex items-center gap-2 text-[16px] font-bold" style={{ color: WT.ink }}>
            <AlertTriangle className="w-5 h-5" style={{ color: WT.brand }} />
            {t('wholesale.claim.title', { defaultValue: '클레임 제기' })}
          </h3>
          <button onClick={onClose} aria-label={t('common.close', { defaultValue: '닫기' })}><X className="w-5 h-5" style={{ color: WT.ink4 }} /></button>
        </div>

        <p className="text-[12px] mb-3" style={{ color: WT.ink3 }}>
          {t('wholesale.claim.orderLabel', { defaultValue: '주문' })} #{orderId}
        </p>

        {/* 사유 선택 */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          {REASONS.map(r => {
            const active = reasonCode === r.code
            return (
              <button key={r.code} onClick={() => setReasonCode(r.code)}
                className="h-11 rounded-xl text-[13px] font-medium transition"
                style={{
                  background: active ? WT.ink : WT.fill,
                  color: active ? '#fff' : WT.ink2,
                  border: `1px solid ${active ? WT.ink : WT.line}`,
                }}>
                {t(`wholesale.claim.reason.${r.code}`, { defaultValue: r.ko })}
              </button>
            )
          })}
        </div>

        {/* 설명 */}
        <label className="block text-[12px] font-medium mb-1.5" style={{ color: WT.ink2 }}>
          {t('wholesale.claim.detail', { defaultValue: '상세 설명 (선택)' })}
        </label>
        <textarea value={reasonText} onChange={e => setReasonText(e.target.value)} maxLength={1000} rows={3}
          placeholder={t('wholesale.claim.detailPlaceholder', { defaultValue: '어떤 문제가 있었는지 알려주세요' })}
          className="w-full rounded-xl px-3.5 py-2.5 text-[13px] mb-4 resize-none outline-none"
          style={{ background: WT.fill2, color: WT.ink, border: `1px solid ${WT.line}` }} />

        {/* 증빙 URL */}
        <label className="block text-[12px] font-medium mb-1.5" style={{ color: WT.ink2 }}>
          {t('wholesale.claim.evidence', { defaultValue: '증빙 사진 URL (선택)' })}
        </label>
        <input value={evidenceUrl} onChange={e => setEvidenceUrl(e.target.value)} maxLength={500}
          placeholder="https://..."
          className="w-full rounded-xl px-3.5 h-11 text-[13px] mb-5 outline-none"
          style={{ background: WT.fill2, color: WT.ink, border: `1px solid ${WT.line}` }} />

        <button onClick={submit} disabled={submitting || !reasonCode}
          className="w-full h-12 rounded-xl font-bold text-white inline-flex items-center justify-center gap-2 disabled:opacity-50"
          style={{ background: WT.brand }}>
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {t('wholesale.claim.submit', { defaultValue: '클레임 접수' })}
        </button>
      </div>
    </div>
  )
}
