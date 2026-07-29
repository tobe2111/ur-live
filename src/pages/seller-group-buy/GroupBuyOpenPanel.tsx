/**
 * 🎟️ 매장 공구 열기 패널 (2026-07-06 §2-A — 방향 A: 매장이 연다)
 *   이용권 한 건에 공구 상태를 켜고/끈다. 3분할 계산기로 소비자가·promo·매장 실수령 미리보기.
 *   ⚠️ GB_ENGINE_ENABLED(클라) + 서버 platform_settings.gb_engine_enabled 이중 게이트. OFF면 미노출.
 *   셀러 대시보드 = 라이트 테마 고정.
 */
import { useState, useEffect } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { formatNumber } from '@/utils/format'
import { Megaphone, Loader2 } from 'lucide-react'
import ThreeWaySplitCalculator from '../seller-product-new/ThreeWaySplitCalculator'
import { promoGuideFor } from '../seller-product-new/PromoMarginCalculator'
import type { GbMode } from '@/shared/gb-session'

interface Props {
  productId: number
  listPrice: number
  category: string
  headers: Record<string, string>
}

const MODE_LABEL: Record<GbMode, string> = { off: '상시 판매', scheduled: '공구 예약됨', live: '공구 진행 중', ended: '공구 종료' }

export default function GroupBuyOpenPanel({ productId, listPrice, category, headers }: Props) {
  const [mode, setMode] = useState<GbMode>('off')
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  // 폼: 할인율(→공구 특가) · promo% · 마감일 · 링크전용
  const [discountPct, setDiscountPct] = useState(20)
  const [promoPct, setPromoPct] = useState(promoGuideFor(category).min)
  const [deadline, setDeadline] = useState('')
  const [linkOnly, setLinkOnly] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await api.get(`/api/seller/products/${productId}/group-buy`, { headers })
        if (!cancelled && res.data?.success) setMode(res.data.data?.session?.mode ?? 'off')
      } catch { /* 게이트 OFF(403) 등 — off 로 표시 */ }
      finally { if (!cancelled) setLoading(false) }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId])

  const gbPrice = Math.round(listPrice * (1 - discountPct / 100))

  async function openGb() {
    if (!deadline) { toast.error('공구 마감 일시를 선택해주세요'); return }
    setSaving(true)
    try {
      const res = await api.post(`/api/seller/products/${productId}/group-buy`, {
        action: 'open', deadline: new Date(deadline).toISOString(), price: gbPrice, promoPct, linkOnly,
      }, { headers })
      if (res.data?.success) { setMode(res.data.data?.session?.mode ?? 'live'); setOpen(false); toast.success('공구가 시작됐어요') }
      else toast.error(res.data?.error || '공구 설정 실패')
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || '공구 설정 실패')
    } finally { setSaving(false) }
  }

  async function closeGb() {
    setSaving(true)
    try {
      const res = await api.post(`/api/seller/products/${productId}/group-buy`, { action: 'close' }, { headers })
      if (res.data?.success) { setMode('off'); toast.success('공구를 닫았어요 (상시가로 복귀)') }
    } catch { toast.error('공구 닫기 실패') } finally { setSaving(false) }
  }

  if (loading) return null

  const isActive = mode === 'live' || mode === 'scheduled'

  return (
    <div className="mt-3 rounded-xl border border-gray-200 bg-white p-3">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[12px] font-bold text-gray-800">
          <Megaphone className="w-3.5 h-3.5 text-emerald-600" /> 공구 · <span className={isActive ? 'text-emerald-700' : 'text-gray-500'}>{MODE_LABEL[mode]}</span>
        </span>
        {isActive ? (
          <button onClick={closeGb} disabled={saving} className="text-[12px] font-semibold text-red-600 disabled:opacity-50">공구 닫기</button>
        ) : (
          <button onClick={() => setOpen(o => !o)} className="text-[12px] font-semibold text-emerald-700">{open ? '취소' : '공구 열기'}</button>
        )}
      </div>

      {open && !isActive && (
        <div className="mt-3 space-y-3">
          <div>
            <label className="block text-[12px] font-semibold text-gray-700 mb-1">공구 마감</label>
            <input type="datetime-local" value={deadline} onChange={e => setDeadline(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900" />
          </div>
          <ThreeWaySplitCalculator
            originalPrice={listPrice}
            discountPct={discountPct}
            onDiscountChange={setDiscountPct}
            promoPct={promoPct}
            onPromoChange={setPromoPct}
            category={category}
          />
          <label className="flex items-center gap-2 text-[12px] text-gray-700">
            <input type="checkbox" checked={linkOnly} onChange={e => setLinkOnly(e.target.checked)} className="accent-gray-900" />
            링크 전용 (상시 노출 숨김 · 추천 링크로만 공구가) — 미체크 시 공구가로 통일
          </label>
          <button onClick={openGb} disabled={saving}
            className="w-full py-2.5 bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white text-[13px] font-bold rounded-xl flex items-center justify-center gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            공구 시작 · 소비자 {formatNumber(gbPrice)}원
          </button>
        </div>
      )}
    </div>
  )
}
