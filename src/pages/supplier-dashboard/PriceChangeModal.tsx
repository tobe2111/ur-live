import { useState } from 'react'
import { X } from 'lucide-react'
import { toast } from '@/hooks/useToast'
import { formatWon } from '@/utils/format'
import { supplierApi } from '@/lib/supplier-api'
import type { CatalogItem } from './types'
import SupplyChannelGuide from './SupplyChannelGuide'
import NaverPriceCheck from './NaverPriceCheck'

// 🏭 2026-06-07 (사용자 요청): 판매중(승인) 상품 가격 수정 요청 — 운영진 승인 후 반영.
//   승인 전까지 기존 노출 가격 유지. 온라인 최저가 참고 링크 함께 제출.
export default function PriceChangeModal({ t, item, onClose, onDone }: {
  t: (k: string, o?: Record<string, unknown>) => string
  item: CatalogItem
  onClose: () => void
  onDone: () => void
}) {
  const [supply, setSupply] = useState(String(item.supply_price || ''))
  const [retail, setRetail] = useState(String(item.retail_price || ''))
  const [lpUrl, setLpUrl] = useState('')
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const newSupply = Number(supply)
    const newRetail = Number(retail || supply)
    if (!Number.isFinite(newSupply) || newSupply <= 0) { setError(t('supplier.errSupply', { defaultValue: '공급가를 올바르게 입력해주세요' })); return }
    if (newRetail < newSupply) { setError(t('supplier.errRetail', { defaultValue: '권장 소비자가는 공급가 이상이어야 합니다' })); return }
    setSaving(true)
    try {
      await supplierApi.post(`/api/supplier/products/${item.id}/price-change-request`, {
        new_supply_price: newSupply,
        new_retail_price: newRetail,
        lowest_price_url: lpUrl.trim() || undefined,
        reason: reason.trim() || undefined,
      })
      toast.success(t('supplier.priceReqOk', { defaultValue: '가격 수정 요청이 접수되었습니다. 운영진 승인 후 반영됩니다.' }))
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally { setSaving(false) }
  }

  const inputCls = "w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-[#FF0033]/30 focus:border-[#FF0033] outline-none"
  const labelCls = "block text-xs font-medium text-gray-600 mb-1"
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-0 sm:px-4" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-lg font-bold text-gray-900">{t('supplier.priceChangeTitle', { defaultValue: '가격 수정 요청' })}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-xs text-gray-500 mb-4">{item.name} · {t('supplier.priceChangeHint', { defaultValue: '판매 중인 상품의 가격은 운영진 승인 후 반영됩니다. 승인 전까지 기존 가격이 유지됩니다.' })}</p>
        {item.pending_supply_price != null && (
          <div className="mb-4 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
            {t('supplier.priceChangePending', { defaultValue: '이미 승인 대기 중인 변경 요청이 있습니다. 새로 제출하면 덮어씁니다.' })}
            （{formatWon(item.pending_supply_price)}）
          </div>
        )}
        {error && <div className="mb-4 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>{t('supplier.fieldSupplyPrice', { defaultValue: '공급가(원)' })} <span className="text-red-500">*</span></label>
              <input required type="number" min={1} disabled={saving} value={supply} onChange={e => setSupply(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>{t('supplier.fieldRetail', { defaultValue: '권장 소비자가(원)' })}</label>
              <input type="number" min={0} disabled={saving} value={retail} onChange={e => setRetail(e.target.value)} className={inputCls} />
            </div>
          </div>
          {/* 🏭 2026-06-12 (영업단 제안): 새 가격 기준 공급률·제안 가능 채널 실시간 안내. */}
          <SupplyChannelGuide t={t} supplyPrice={supply} retailPrice={retail} />
          {/* 🛒 2026-06-12 (사용자 요청): 시중 최저가 대조 — 가격 인하 요청의 근거를 폼 안에서 바로 확인. */}
          <NaverPriceCheck t={t} name={item.name} supplyPrice={supply} retailPrice={retail} />
          <div>
            <label className={labelCls}>{t('supplier.fieldLowestUrl', { defaultValue: '온라인 최저가 참고 링크' })}</label>
            <input disabled={saving} value={lpUrl} onChange={e => setLpUrl(e.target.value)} className={inputCls} placeholder="https://search.shopping.naver.com/..." />
            <p className="text-[11px] text-gray-400 mt-1">{t('supplier.lowestUrlHint', { defaultValue: '네이버쇼핑 등 온라인 최저가를 확인할 수 있는 링크 (검수용).' })}</p>
          </div>
          <div>
            <label className={labelCls}>{t('supplier.fieldReason', { defaultValue: '변경 사유 (선택)' })}</label>
            <textarea disabled={saving} value={reason} onChange={e => setReason(e.target.value)} rows={2} className={inputCls} placeholder={t('supplier.reasonPh', { defaultValue: '예: 원자재 가격 인상 반영' })} />
          </div>
          <button type="submit" disabled={saving} className="w-full py-3 rounded-xl bg-[#FF0033] text-white font-semibold text-sm disabled:opacity-60 mt-2">
            {saving ? t('common.loading', { defaultValue: '처리 중...' }) : t('supplier.submitPriceChange', { defaultValue: '가격 수정 요청' })}
          </button>
        </form>
      </div>
    </div>
  )
}
