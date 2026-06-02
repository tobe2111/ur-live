import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Truck, Loader2, RotateCcw, Package } from 'lucide-react'
import SEO from '@/components/SEO'
import { toast } from '@/hooks/useToast'
import { formatWon } from '@/utils/format'
import { supplierApi, isSupplierLoggedIn } from '@/lib/supplier-api'

// 🏭 2026-06-01 유통스타트 — 제조사(공급자) 도매 주문 처리 (Phase 3). 송장 입력 + 반품 승인.
// 라이트 테마 (대시보드 계열).

interface Line {
  item_id: number
  wholesale_order_id: number
  name: string
  qty: number
  base_supply_price: number
  settle_amount: number
  courier: string | null
  tracking_number: string | null
  shipped_at: string | null
  line_status: string
  order_status: string
  created_at: string
  ship_to_name: string | null
  ship_to_phone: string | null
  ship_to_address: string | null
  ship_to_postal: string | null
}

export default function SupplierWholesaleOrdersPage() {
  const navigate = useNavigate()
  const [lines, setLines] = useState<Line[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<number | null>(null)
  const [draft, setDraft] = useState<Record<number, { courier: string; tracking: string }>>({})

  const load = useCallback(() => {
    setLoading(true)
    supplierApi.get<{ items: Line[] }>('/api/supplier/wholesale/orders')
      .then(r => setLines(r.items || []))
      .catch(e => { if (import.meta.env.DEV) console.warn(e) })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!isSupplierLoggedIn()) { navigate('/supplier/login'); return }
    load()
  }, [load, navigate])

  async function ship(item: Line) {
    const d = draft[item.item_id]
    if (!d?.courier?.trim() || !d?.tracking?.trim()) { toast.error('택배사와 운송장 번호를 입력해주세요'); return }
    setBusy(item.item_id)
    try {
      await supplierApi.post(`/api/supplier/wholesale/items/${item.item_id}/ship`, { courier: d.courier.trim(), tracking_number: d.tracking.trim() })
      toast.success('송장이 등록되었습니다')
      load()
    } catch (e) { toast.error(e instanceof Error ? e.message : '송장 등록 실패') } finally { setBusy(null) }
  }

  async function refund(item: Line) {
    if (!window.confirm(`주문 #${item.wholesale_order_id} 을(를) 전액 환불 처리할까요? 되돌릴 수 없습니다.`)) return
    setBusy(item.item_id)
    try {
      await supplierApi.post(`/api/supplier/wholesale/orders/${item.wholesale_order_id}/refund`, { reason: '판매자 반품 승인' })
      toast.success('환불 처리되었습니다')
      load()
    } catch (e) { toast.error(e instanceof Error ? e.message : '환불 처리 실패') } finally { setBusy(null) }
  }

  return (
    <div className="min-h-screen bg-[#F4F5F7]">
      <SEO title="도매 주문 처리 - 공급자" description="공급자 도매 주문 송장/반품" url="/supplier/wholesale-orders" noindex />
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto flex items-center gap-3 px-4 h-[52px]">
          <button onClick={() => navigate('/supplier')} aria-label="뒤로"><ArrowLeft className="w-5 h-5 text-gray-900" /></button>
          <h1 className="text-[15px] font-bold text-gray-900">도매 주문 처리</h1>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-7 h-7 animate-spin text-gray-400" /></div>
        ) : lines.length === 0 ? (
          <div className="flex flex-col items-center py-20 text-gray-400"><Package className="w-10 h-10 mb-3" /><p>처리할 도매 주문이 없습니다.</p></div>
        ) : (
          <div className="space-y-3">
            {lines.map(l => {
              const shipped = l.line_status === 'SHIPPED'
              const refunded = l.line_status === 'REFUNDED'
              const d = draft[l.item_id] || { courier: l.courier || '', tracking: l.tracking_number || '' }
              return (
                <div key={l.item_id} className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-400">주문 #{l.wholesale_order_id} · {new Date(l.created_at).toLocaleString('ko-KR')}</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${refunded ? 'bg-gray-100 text-gray-500' : shipped ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>
                      {refunded ? '환불됨' : shipped ? '발송완료' : '발송대기'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="font-medium text-gray-900">{l.name}</div>
                      <div className="text-sm text-gray-500">수량 {l.qty}개 · 정산 {formatWon(l.settle_amount)}</div>
                    </div>
                  </div>
                  {/* 배송지 */}
                  <div className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3 mb-3">
                    <div className="font-medium text-gray-800">{l.ship_to_name || '—'} {l.ship_to_phone || ''}</div>
                    <div>{l.ship_to_postal ? `(${l.ship_to_postal}) ` : ''}{l.ship_to_address || '배송지 정보 없음'}</div>
                  </div>

                  {!refunded && !shipped && (
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text" placeholder="택배사" value={d.courier}
                        onChange={e => setDraft(p => ({ ...p, [l.item_id]: { ...d, courier: e.target.value } }))}
                        className="px-3 py-2 border border-gray-200 rounded-lg text-gray-900 sm:w-32"
                      />
                      <input
                        type="text" placeholder="운송장 번호" value={d.tracking}
                        onChange={e => setDraft(p => ({ ...p, [l.item_id]: { ...d, tracking: e.target.value } }))}
                        className="px-3 py-2 border border-gray-200 rounded-lg text-gray-900 flex-1"
                      />
                      <button onClick={() => ship(l)} disabled={busy === l.item_id} className="inline-flex items-center justify-center gap-1 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                        {busy === l.item_id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Truck className="w-4 h-4" />} 송장등록
                      </button>
                    </div>
                  )}
                  {shipped && !refunded && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600"><Truck className="w-4 h-4 inline mr-1" />{l.courier} {l.tracking_number}</span>
                      <button onClick={() => refund(l)} disabled={busy === l.item_id} className="inline-flex items-center gap-1 px-3 py-1.5 border border-rose-200 text-rose-600 rounded-lg text-xs font-medium disabled:opacity-50">
                        <RotateCcw className="w-3.5 h-3.5" /> 반품/환불
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
