import { Truck } from 'lucide-react'
import type { OrderItem } from './types'

export default function OrdersTab({ items, t, status, setStatus, onShip }: {
  items: OrderItem[]
  t: (k: string, o?: Record<string, unknown>) => string
  status: 'to_ship' | 'shipped'
  setStatus: (s: 'to_ship' | 'shipped') => void
  onShip: (o: OrderItem) => void
}) {
  const fmtAddr = (o: OrderItem) => {
    const name = o.recipient_name || o.shipping_name || '-'
    const phone = o.recipient_phone || o.shipping_phone || ''
    let addr = o.shipping_address || ''
    try { const p = JSON.parse(addr); addr = [p.address, p.address_detail].filter(Boolean).join(' ') } catch { /* plain text */ }
    return { name, phone, addr }
  }
  return (
    <div>
      <div className="flex gap-1 mb-4 bg-white rounded-xl p-1 border border-gray-200 w-fit">
        {([['to_ship', t('supplier.toShip', { defaultValue: '발송 대기' })], ['shipped', t('supplier.shipped', { defaultValue: '발송 완료' })]] as const).map(([k, label]) => (
          <button key={k} onClick={() => setStatus(k)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${status === k ? 'bg-[#FF0033] text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
            {label}
          </button>
        ))}
      </div>
      {items.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 py-16 text-center text-gray-400 text-sm">
          {status === 'to_ship' ? t('supplier.noToShip', { defaultValue: '발송할 주문이 없습니다.' }) : t('supplier.noShipped', { defaultValue: '발송 완료된 주문이 없습니다.' })}
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(o => {
            const a = fmtAddr(o)
            return (
              <div key={o.order_id} className="bg-white rounded-2xl border border-gray-200 p-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-gray-900 text-sm">#{o.order_number || o.order_id}</p>
                      <span className="text-xs text-gray-400">{(o.created_at || '').slice(0, 10)}</span>
                      <span className="text-xs text-gray-500">{t('supplier.qtyN', { defaultValue: '수량' })} {o.total_qty}</span>
                    </div>
                    <p className="text-sm text-gray-700 truncate">{o.item_names}</p>
                    <p className="text-xs text-gray-500 mt-1">📦 {a.name} {a.phone} · {a.addr || t('supplier.noAddr', { defaultValue: '주소 정보 없음' })}</p>
                    {o.tracking_number && (
                      <p className="text-xs text-green-600 mt-1">🚚 {o.courier || ''} {o.tracking_number}</p>
                    )}
                  </div>
                  {status === 'to_ship' && (
                    <button onClick={() => onShip(o)} className="shrink-0 flex items-center gap-1 px-3 py-1.5 text-xs font-semibold bg-[#FF0033] text-white rounded-lg">
                      <Truck className="w-3.5 h-3.5" /> {t('supplier.enterTracking', { defaultValue: '운송장 입력' })}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
