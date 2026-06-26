import { useState } from 'react'
import { X } from 'lucide-react'
import { toast } from '@/hooks/useToast'
import { supplierApi } from '@/lib/supplier-api'
import type { OrderItem } from './types'

export default function ShipModal({ t, order, onClose, onShipped }: {
  t: (k: string, o?: Record<string, unknown>) => string
  order: OrderItem
  onClose: () => void
  onShipped: () => void
}) {
  const [courier, setCourier] = useState(order.courier || '')
  const [tracking, setTracking] = useState(order.tracking_number || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!tracking.trim()) { setError(t('supplier.errTracking', { defaultValue: '운송장 번호를 입력해주세요' })); return }
    setSaving(true)
    try {
      await supplierApi.put(`/api/supplier/orders/${order.order_id}/shipping`, { courier: courier.trim() || undefined, tracking_number: tracking.trim() })
      toast.success(t('supplier.shippedOk', { defaultValue: '운송장이 등록되었습니다.' }))
      onShipped()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally { setSaving(false) }
  }

  const inputCls = "w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-[#FC5424]/30 focus:border-[#FC5424] outline-none"
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-0 sm:px-4" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl p-6 max-h-[90dvh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">{t('supplier.enterTracking', { defaultValue: '운송장 입력' })}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-xs text-gray-500 mb-4">#{order.order_number || order.order_id} · {order.item_names}</p>
        {error && <div className="mb-4 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">{t('supplier.courier', { defaultValue: '택배사' })}</label>
            <input value={courier} onChange={e => setCourier(e.target.value)} className={inputCls} placeholder={t('supplier.courierPh', { defaultValue: '예: CJ대한통운' })} disabled={saving} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">{t('supplier.trackingNo', { defaultValue: '운송장 번호' })} <span className="text-red-500">*</span></label>
            <input value={tracking} onChange={e => setTracking(e.target.value)} className={inputCls} disabled={saving} />
          </div>
          <button type="submit" disabled={saving} className="w-full py-3 rounded-xl bg-[#FC5424] text-white font-semibold text-sm disabled:opacity-60 mt-2">
            {saving ? t('common.loading', { defaultValue: '처리 중...' }) : t('supplier.registerTracking', { defaultValue: '발송 등록' })}
          </button>
        </form>
      </div>
    </div>
  )
}
