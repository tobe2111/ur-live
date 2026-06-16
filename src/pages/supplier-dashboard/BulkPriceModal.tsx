import { useState } from 'react'
import { X } from 'lucide-react'
import { toast } from '@/hooks/useToast'
import { supplierApi } from '@/lib/supplier-api'
import type { CatalogItem } from './types'

// 🏭 BIZ-6 (2026-06-08): 가격 일괄변경 — 승인(판매중) 상품을 선택해 새 공급가/권장가를 일괄 제출.
//   라이브 가격은 직접 안 바뀜 — 어드민 승인 큐(pending_*)에 적재. 승인 전까지 기존 가격 유지.
export default function BulkPriceModal({ t, items, onClose, onDone }: {
  t: (k: string, o?: Record<string, unknown>) => string
  items: CatalogItem[]
  onClose: () => void
  onDone: () => void
}) {
  // 선택된 상품의 새 가격 입력값. 기본값은 기존 가격으로 프리필.
  const [edits, setEdits] = useState<Record<number, { selected: boolean; supply: string; retail: string }>>(() => {
    const init: Record<number, { selected: boolean; supply: string; retail: string }> = {}
    for (const it of items) init[it.id] = { selected: false, supply: String(it.supply_price || ''), retail: String(it.retail_price || '') }
    return init
  })
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const toggle = (id: number) => setEdits(e => ({ ...e, [id]: { ...e[id], selected: !e[id].selected } }))
  const setSupply = (id: number, v: string) => setEdits(e => ({ ...e, [id]: { ...e[id], supply: v } }))
  const setRetail = (id: number, v: string) => setEdits(e => ({ ...e, [id]: { ...e[id], retail: v } }))
  const selectedCount = Object.values(edits).filter(e => e.selected).length

  const submit = async () => {
    setError('')
    const payload: { product_id: number; supply_price: number; retail_price?: number; reason?: string }[] = []
    for (const it of items) {
      const e = edits[it.id]
      if (!e?.selected) continue
      const supply = Number(e.supply)
      if (!Number.isFinite(supply) || supply <= 0) { setError(t('supplier.bulkErrSupply', { defaultValue: '선택한 상품의 공급가를 올바르게 입력해주세요' })); return }
      const retailNum = Number(e.retail)
      const item: { product_id: number; supply_price: number; retail_price?: number; reason?: string } = { product_id: it.id, supply_price: supply }
      if (e.retail !== '' && Number.isFinite(retailNum)) {
        if (retailNum < supply) { setError(t('supplier.bulkErrRetail', { defaultValue: '권장 소비자가는 공급가 이상이어야 합니다' })); return }
        item.retail_price = retailNum
      }
      if (reason.trim()) item.reason = reason.trim()
      payload.push(item)
    }
    if (payload.length === 0) { setError(t('supplier.bulkErrNone', { defaultValue: '변경할 상품을 선택해주세요' })); return }
    setSaving(true)
    try {
      const res = await supplierApi.post<{ summary?: { queued: number; skipped: number } }>('/api/supplier/products/bulk-price-change', { items: payload })
      const sm = res.summary
      toast.success(t('supplier.bulkPriceDone', { defaultValue: '{{q}}건 접수, {{s}}건 제외', q: sm?.queued ?? 0, s: sm?.skipped ?? 0 })
        .replace('{{q}}', String(sm?.queued ?? 0)).replace('{{s}}', String(sm?.skipped ?? 0)))
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally { setSaving(false) }
  }

  const cellCls = "w-24 px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-[#FC5424]/30 focus:border-[#FC5424] outline-none"
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-0 sm:px-4" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-2xl rounded-t-2xl sm:rounded-2xl p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-lg font-bold text-gray-900">{t('supplier.bulkPriceChange', { defaultValue: '가격 일괄변경' })}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-xs text-gray-500 mb-4">{t('supplier.bulkPriceHint', { defaultValue: '판매 중(승인) 상품만 변경할 수 있습니다. 운영진 승인 후 반영되며, 승인 전까지 기존 가격이 유지됩니다.' })}</p>
        {error && <div className="mb-4 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
        {items.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-10">{t('supplier.bulkNoApproved', { defaultValue: '가격 변경 가능한 승인 상품이 없습니다.' })}</p>
        ) : (
          <>
            <div className="border border-gray-200 rounded-xl overflow-hidden mb-4">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs">
                  <tr>
                    <th className="px-2 py-2 w-8"></th>
                    <th className="text-left font-medium px-2 py-2">{t('supplier.colProduct', { defaultValue: '상품' })}</th>
                    <th className="text-right font-medium px-2 py-2">{t('supplier.fieldSupplyPrice', { defaultValue: '공급가(원)' })}</th>
                    <th className="text-right font-medium px-2 py-2">{t('supplier.fieldRetail', { defaultValue: '권장가(원)' })}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map(it => {
                    const e = edits[it.id]
                    return (
                      <tr key={it.id} className={e?.selected ? 'bg-[#FC5424]/5' : ''}>
                        <td className="px-2 py-2 text-center">
                          <input type="checkbox" checked={!!e?.selected} onChange={() => toggle(it.id)} disabled={saving} className="w-4 h-4" />
                        </td>
                        <td className="px-2 py-2 text-gray-900 truncate max-w-[180px]">{it.name}</td>
                        <td className="px-2 py-2 text-right">
                          <input type="number" min={1} value={e?.supply ?? ''} disabled={saving || !e?.selected}
                            onChange={ev => setSupply(it.id, ev.target.value)} className={`${cellCls} text-right disabled:bg-gray-50 disabled:text-gray-400`} />
                        </td>
                        <td className="px-2 py-2 text-right">
                          <input type="number" min={0} value={e?.retail ?? ''} disabled={saving || !e?.selected}
                            onChange={ev => setRetail(it.id, ev.target.value)} className={`${cellCls} text-right disabled:bg-gray-50 disabled:text-gray-400`} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-600 mb-1">{t('supplier.fieldReason', { defaultValue: '변경 사유 (선택)' })}</label>
              <input value={reason} onChange={e => setReason(e.target.value)} disabled={saving}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-[#FC5424]/30 focus:border-[#FC5424] outline-none"
                placeholder={t('supplier.reasonPh', { defaultValue: '예: 원자재 가격 인상 반영' })} />
            </div>
            <button onClick={submit} disabled={saving || selectedCount === 0}
              className="w-full py-3 rounded-xl bg-[#FC5424] text-white font-semibold text-sm disabled:opacity-60">
              {saving
                ? t('common.loading', { defaultValue: '처리 중...' })
                : t('supplier.submitBulkPrice', { defaultValue: '{{n}}개 가격 변경 요청', n: selectedCount }).replace('{{n}}', String(selectedCount))}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
