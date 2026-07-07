/**
 * 🎟️ 인플루언서 공구 제안 모달 (2026-07-06 §2-B B1 — 인플루언서 → 매장)
 *   인플루언서가 이 이용권에 희망 조건(기간·공구 특가·소개비)으로 공구를 제안 → 매장이 승인하면 공구 시작.
 *   소비자/인플루언서 대면 — 다크 지원. 모달 z-index 표준(10500).
 */
import { useState } from 'react'
import { createPortal } from 'react-dom'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { formatNumber } from '@/utils/format'
import { X, Loader2 } from 'lucide-react'

export default function GbProposeModal({ productId, listPrice, productName, onClose }: {
  productId: number; listPrice: number; productName: string; onClose: () => void
}) {
  const [deadline, setDeadline] = useState('')
  const [price, setPrice] = useState(Math.round(listPrice * 0.8))
  const [promo, setPromo] = useState(20)
  const [saving, setSaving] = useState(false)

  async function submit() {
    if (!deadline || !price) { toast.error('마감과 공구 특가를 입력해주세요'); return }
    if (price >= listPrice) { toast.error('공구 특가는 상시가보다 낮아야 해요'); return }
    setSaving(true)
    try {
      const res = await api.post('/api/gb-proposals', {
        product_id: productId, deadline: new Date(deadline).toISOString(), price, promo_pct: promo,
      })
      if (res.data?.success) { toast.success('매장에 공구를 제안했어요. 승인되면 알림을 드려요.'); onClose() }
      else toast.error(res.data?.error || '제안 실패')
    } catch (e: unknown) {
      const err = e as { response?: { status?: number; data?: { error?: string } } }
      if (err.response?.status === 401) { toast.error('로그인이 필요해요'); return }
      toast.error(err.response?.data?.error || '제안 실패')
    } finally { setSaving(false) }
  }

  return createPortal(
    <div className="fixed inset-0 z-[10500] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" onClick={onClose}>
      <div className="w-full sm:max-w-sm bg-white dark:bg-[#121212] rounded-t-2xl sm:rounded-2xl p-5 space-y-3" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-[15px] font-bold text-gray-900 dark:text-white">공구 제안하기</h3>
          <button onClick={onClose} aria-label="닫기" className="text-gray-400"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-[12px] text-gray-500 dark:text-gray-400 truncate">{productName} · 상시가 {formatNumber(listPrice)}원</p>

        <div>
          <label className="block text-[12px] font-semibold text-gray-700 dark:text-gray-300 mb-1">공구 마감</label>
          <input type="datetime-local" value={deadline} onChange={e => setDeadline(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-[#2A2A2A] dark:bg-[#1A1A1A] rounded-lg text-sm text-gray-900 dark:text-white" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[12px] font-semibold text-gray-700 dark:text-gray-300 mb-1">공구 특가</label>
            <input type="number" value={price || ''} onChange={e => setPrice(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-[#2A2A2A] dark:bg-[#1A1A1A] rounded-lg text-sm text-gray-900 dark:text-white" />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-gray-700 dark:text-gray-300 mb-1">내 소개비 %</label>
            <input type="number" min={0} max={50} value={promo} onChange={e => setPromo(Math.max(0, Math.min(50, Number(e.target.value))))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-[#2A2A2A] dark:bg-[#1A1A1A] rounded-lg text-sm text-gray-900 dark:text-white" />
          </div>
        </div>

        <button onClick={submit} disabled={saving}
          className="w-full py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl text-[14px] font-bold flex items-center justify-center gap-2 disabled:opacity-50">
          {saving && <Loader2 className="w-4 h-4 animate-spin" />} 매장에 제안 보내기
        </button>
      </div>
    </div>,
    document.body,
  )
}
