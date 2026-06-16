import { useState, useEffect, useCallback } from 'react'
import { X } from 'lucide-react'
import { toast } from '@/hooks/useToast'
import { supplierApi } from '@/lib/supplier-api'
import type { CatalogItem } from './types'

// 제조사 자가관리 — '승인한 유통채널' 상품의 허용 유통사 추가/해제.
export default function ChannelModal({ t, item, onClose }: { t: (k: string, o?: Record<string, unknown>) => string; item: CatalogItem; onClose: () => void }) {
  const [list, setList] = useState<Array<{ id: number; distributor_seller_id: number; business_name: string | null; seller_name: string | null; username: string | null; distributor_grade: string | null }>>([])
  const [sellerId, setSellerId] = useState('')
  const [busy, setBusy] = useState(false)
  const load = useCallback(() => {
    supplierApi.get<{ distributors: typeof list }>(`/api/supplier/products/${item.id}/channel-access`)
      .then(r => setList(r.distributors || [])).catch(() => { /* ignore */ })
  }, [item.id])
  useEffect(() => { load() }, [load])
  const add = async () => {
    const dsid = Number(sellerId)
    if (!Number.isFinite(dsid) || dsid <= 0) { toast.error('유통사 ID를 입력하세요'); return }
    setBusy(true)
    try { await supplierApi.post(`/api/supplier/products/${item.id}/channel-access`, { distributor_seller_id: dsid }); setSellerId(''); load() }
    catch (e) { toast.error(e instanceof Error ? e.message : '승인 실패') } finally { setBusy(false) }
  }
  const remove = async (accessId: number) => {
    try { await supplierApi.delete(`/api/supplier/products/${item.id}/channel-access/${accessId}`); load() } catch { toast.error('해제 실패') }
  }
  const inputCls = 'flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900'
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-0 sm:px-4" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-6 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-lg font-bold text-gray-900">{t('supplier.manageChannel', { defaultValue: '승인 유통사 관리' })}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-xs text-gray-500 mb-4">{item.name} · {t('supplier.channelHint', { defaultValue: '승인한 유통사에게만 이 상품이 노출·주문됩니다.' })}</p>
        <div className="flex gap-2 mb-4">
          <input value={sellerId} onChange={e => setSellerId(e.target.value)} type="number" placeholder={t('supplier.distributorId', { defaultValue: '유통사 ID' })} className={inputCls} />
          <button onClick={add} disabled={busy} className="px-4 py-2 bg-[#FC5424] text-white rounded-lg text-sm font-semibold disabled:opacity-60">{t('common.add', { defaultValue: '추가' })}</button>
        </div>
        {list.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">{t('supplier.noChannel', { defaultValue: '승인된 유통사가 없습니다.' })}</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {list.map(d => (
              <li key={d.id} className="flex items-center justify-between py-2.5 text-sm">
                <span className="text-gray-700">{d.business_name || d.seller_name || `#${d.distributor_seller_id}`} <span className="text-gray-400 text-xs">{d.distributor_grade || 'C'}</span></span>
                <button onClick={() => remove(d.id)} className="text-gray-400 hover:text-rose-500"><X className="w-4 h-4" /></button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
