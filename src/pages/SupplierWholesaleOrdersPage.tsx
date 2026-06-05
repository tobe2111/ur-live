import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Truck, Loader2, RotateCcw, Package, Download, Upload, Boxes } from 'lucide-react'
import SEO from '@/components/SEO'
import { toast } from '@/hooks/useToast'
import { formatWon } from '@/utils/format'
import { supplierApi, isSupplierLoggedIn, getSupplierToken } from '@/lib/supplier-api'
import { confirmDialog } from '@/components/ui/confirm-dialog'

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
  // 🏭 2026-06-04 합배송: 주문 단위 일괄발송 입력/진행상태.
  const [orderDraft, setOrderDraft] = useState<Record<number, { courier: string; tracking: string }>>({})
  const [busyOrder, setBusyOrder] = useState<number | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // 라인을 주문 단위로 묶음 (합배송 — 같은 제조사가 한 주문에 여러 상품).
  const groups = useMemo(() => {
    const m = new Map<number, Line[]>()
    for (const l of lines) {
      const arr = m.get(l.wholesale_order_id)
      if (arr) arr.push(l); else m.set(l.wholesale_order_id, [l])
    }
    return [...m.entries()].map(([orderId, items]) => ({
      orderId, items,
      pendingCount: items.filter(it => it.line_status !== 'SHIPPED' && it.line_status !== 'REFUNDED').length,
    }))
  }, [lines])

  // 주문 .xlsx 내보내기 (인증 헤더 fetch → blob).
  async function exportOrders() {
    const token = getSupplierToken()
    const res = await fetch('/api/supplier/wholesale/orders/export', { headers: token ? { Authorization: `Bearer ${token}` } : {} })
    if (!res.ok) { toast.error('내보내기 실패'); return }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `wholesale-orders-${new Date().toISOString().slice(0, 10)}.xlsx`; a.click()
    URL.revokeObjectURL(url)
  }

  // 송장 일괄 업로드 (CSV: item_id, courier, tracking_number).
  async function bulkTracking(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; e.target.value = ''
    if (!file) return
    setUploading(true)
    try {
      const csv = await file.text()
      const r = await supplierApi.post<{ summary?: { ok: number; failed: number; skipped: number } }>('/api/supplier/wholesale/tracking/bulk', { csv })
      const s = r.summary
      toast.success(`송장 ${s?.ok ?? 0}건 등록 (실패 ${s?.failed ?? 0}, 건너뜀 ${s?.skipped ?? 0})`)
      load()
    } catch (err) { toast.error(err instanceof Error ? err.message : '일괄 업로드 실패') } finally { setUploading(false) }
  }

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

  // 합배송: 주문 내 내 미발송 라인 전체를 송장 1개로 일괄 발송.
  async function shipAll(orderId: number) {
    const d = orderDraft[orderId]
    if (!d?.courier?.trim() || !d?.tracking?.trim()) { toast.error('택배사와 운송장 번호를 입력해주세요'); return }
    setBusyOrder(orderId)
    try {
      const r = await supplierApi.post<{ shipped?: number; already?: boolean }>(
        `/api/supplier/wholesale/orders/${orderId}/ship-all`,
        { courier: d.courier.trim(), tracking_number: d.tracking.trim() },
      )
      toast.success(r.already ? '이미 모두 발송된 주문입니다' : `${r.shipped ?? 0}개 상품 한 송장으로 발송 완료`)
      load()
    } catch (e) { toast.error(e instanceof Error ? e.message : '일괄 발송 실패') } finally { setBusyOrder(null) }
  }

  async function refund(item: Line) {
    if (!(await confirmDialog({ message: `주문 #${item.wholesale_order_id} 을(를) 전액 환불 처리할까요? 되돌릴 수 없습니다.`, danger: true }))) return
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
          <div className="ml-auto flex items-center gap-2">
            <button onClick={exportOrders} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">
              <Download className="w-3.5 h-3.5" /> 주문 엑셀
            </button>
            <button onClick={() => fileRef.current?.click()} disabled={uploading} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-60">
              {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />} 송장 일괄(CSV)
            </button>
            <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={bulkTracking} />
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-7 h-7 animate-spin text-gray-400" /></div>
        ) : lines.length === 0 ? (
          <div className="flex flex-col items-center py-20 text-gray-400"><Package className="w-10 h-10 mb-3" /><p>처리할 도매 주문이 없습니다.</p></div>
        ) : (
          <div className="space-y-4">
            {groups.map(g => {
              const first = g.items[0]
              const od = orderDraft[g.orderId] || { courier: '', tracking: '' }
              const canBundle = g.pendingCount >= 2 // 합배송: 미발송 라인 2개 이상일 때만 일괄발송 노출
              return (
                <div key={g.orderId} className="bg-white rounded-xl border border-gray-200 p-4">
                  {/* 주문 헤더 + 배송지 (주문당 1회) */}
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-400">주문 #{g.orderId} · {new Date(first.created_at).toLocaleString('ko-KR')}</span>
                    {g.pendingCount > 0
                      ? <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">발송대기 {g.pendingCount}건</span>
                      : <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">발송완료</span>}
                  </div>
                  <div className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3 mb-3">
                    <div className="font-medium text-gray-800">{first.ship_to_name || '—'} {first.ship_to_phone || ''}</div>
                    <div>{first.ship_to_postal ? `(${first.ship_to_postal}) ` : ''}{first.ship_to_address || '배송지 정보 없음'}</div>
                  </div>

                  {/* 합배송 일괄발송 (미발송 2건 이상) */}
                  {canBundle && (
                    <div className="border border-blue-100 bg-blue-50/40 rounded-lg p-3 mb-3">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-700 mb-2">
                        <Boxes className="w-4 h-4" /> 합배송 — {g.pendingCount}개 상품을 한 박스(송장 1개)로 발송
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="text" placeholder="택배사" value={od.courier}
                          onChange={e => setOrderDraft(p => ({ ...p, [g.orderId]: { ...od, courier: e.target.value } }))}
                          className="px-3 py-2 border border-gray-200 rounded-lg text-gray-900 sm:w-32"
                        />
                        <input
                          type="text" placeholder="운송장 번호" value={od.tracking}
                          onChange={e => setOrderDraft(p => ({ ...p, [g.orderId]: { ...od, tracking: e.target.value } }))}
                          className="px-3 py-2 border border-gray-200 rounded-lg text-gray-900 flex-1"
                        />
                        <button onClick={() => shipAll(g.orderId)} disabled={busyOrder === g.orderId} className="inline-flex items-center justify-center gap-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                          {busyOrder === g.orderId ? <Loader2 className="w-4 h-4 animate-spin" /> : <Boxes className="w-4 h-4" />} 전체 일괄발송
                        </button>
                      </div>
                      <p className="text-[11px] text-gray-500 mt-1.5">상품별로 따로 보내려면 아래에서 개별 송장을 입력하세요.</p>
                    </div>
                  )}

                  {/* 라인별 카드 */}
                  <div className="space-y-2">
                    {g.items.map(l => {
                      const shipped = l.line_status === 'SHIPPED'
                      const refunded = l.line_status === 'REFUNDED'
                      const d = draft[l.item_id] || { courier: l.courier || '', tracking: l.tracking_number || '' }
                      return (
                        <div key={l.item_id} className="border border-gray-100 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2 gap-2">
                            <div>
                              <div className="font-medium text-gray-900">{l.name}</div>
                              <div className="text-sm text-gray-500">수량 {l.qty}개 · 정산 {formatWon(l.settle_amount)}</div>
                            </div>
                            <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${refunded ? 'bg-gray-100 text-gray-500' : shipped ? 'bg-blue-50 text-blue-700' : 'bg-amber-50 text-amber-700'}`}>
                              {refunded ? '환불됨' : shipped ? '발송완료' : '발송대기'}
                            </span>
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
                                {busy === l.item_id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Truck className="w-4 h-4" />} 개별송장
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
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
