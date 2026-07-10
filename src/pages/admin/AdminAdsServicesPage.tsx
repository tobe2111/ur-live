import { useState, useEffect, useCallback } from 'react'
import api from '@/lib/api'
import AdminLayout from '@/components/AdminLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import { toast } from '@/hooks/useToast'
import { formatNumber } from '@/utils/format'

/**
 * 🆕 2026-07-02 유어애즈 마케팅 서비스몰 운영 (/admin/ads-services).
 *   주문 접수함(상태·이행방식·메모) + 상품 관리(노출 토글). 무결제 — 수동 처리.
 */
interface Order {
  id: number; account_id: number; service_name: string; preset_label: string | null; quantity: number
  unit_price: number; discount_pct: number; options_total: number; total_amount: number
  contact_kakao: string | null; contact_phone: string | null; target_url: string | null; memo: string | null
  status: string; payment_status: string; fulfillment_method: string | null; admin_note: string | null; created_at: string
  supplier: string | null; supplier_order_id: string | null; supplier_cost: number; margin: number
}
const PAY_KO: Record<string, string> = { unpaid: '입금 대기', paid: '입금 확인', refunded: '환불' }
interface Service { id: number; category: string; name: string; subtitle: string | null; pricing: { unit: string; unitPrice: number }; active: number; sort_order: number }
interface Review { id: number; service_id: number; account_id: number; rating: number; title: string; body: string; author_masked: string; status: string; created_at: string }

const STATUSES = ['requested', 'confirmed', 'in_progress', 'done', 'cancelled']
const STATUS_KO: Record<string, string> = { requested: '접수됨', confirmed: '확인됨', in_progress: '진행 중', done: '완료', cancelled: '취소' }
const METHODS = ['유료광고', '콘텐츠', '인플루언서', '체험단', '운영대행', '기타']

export default function AdminAdsServicesPage() {
  const [tab, setTab] = useState<'orders' | 'catalog' | 'reviews'>('orders')
  const [orders, setOrders] = useState<Order[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<number | null>(null)

  const load = useCallback(async (status = '') => {
    setLoading(true)
    try {
      const [o, s, rv] = await Promise.all([
        api.get(`/api/admin/ads/service-orders${status ? `?status=${status}` : ''}`),
        api.get('/api/admin/ads/services'),
        api.get('/api/admin/ads/service-reviews'),
      ])
      if (o.data?.success) setOrders(o.data.orders || [])
      if (s.data?.success) setServices(s.data.services || [])
      if (rv.data?.success) setReviews(rv.data.reviews || [])
    } catch { toast.error('불러오기 실패') } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  async function patchOrder(id: number, body: Record<string, unknown>, label: string) {
    setBusy(id)
    try { const r = await api.patch(`/api/admin/ads/service-orders/${id}`, body); if (r.data?.success) { toast.success(`${label} 완료`); await load(filter) } else toast.error(r.data?.error || '변경 실패') }
    catch { toast.error('변경 실패') } finally { setBusy(null) }
  }
  async function setReviewStatus(id: number, status: 'visible' | 'hidden') {
    setBusy(id)
    try { const r = await api.patch(`/api/admin/ads/service-reviews/${id}`, { status }); if (r.data?.success) { toast.success(status === 'hidden' ? '숨김' : '노출'); await load(filter) } }
    catch { toast.error('실패') } finally { setBusy(null) }
  }
  async function toggleService(s: Service) {
    setBusy(-s.id)
    try { const r = await api.post('/api/admin/ads/services', { id: s.id, category: s.category, name: s.name, subtitle: s.subtitle, pricing: s.pricing, active: !s.active, sort_order: s.sort_order }); if (r.data?.success) { toast.success('반영됨'); await load(filter) } }
    catch { toast.error('실패') } finally { setBusy(null) }
  }

  return (
    <AdminLayout title="서비스몰 주문">
      <DashboardPageHeader title="유어애즈 서비스몰" subtitle="마케팅 서비스 주문 접수함·상품 관리. 무결제 — 담당자가 확인 후 이행(광고·콘텐츠 등)하고 상태를 갱신합니다." />

      <div className="flex gap-2 mb-4">
        {(['orders', 'catalog', 'reviews'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`h-9 px-4 rounded-lg text-sm font-semibold ${tab === t ? 'bg-gray-900 text-white' : 'border border-gray-200 text-gray-600'}`}>{t === 'orders' ? '주문 접수함' : t === 'catalog' ? '상품 관리' : '리뷰 관리'}</button>
        ))}
      </div>

      {tab === 'orders' && (
        <>
          <div className="flex flex-wrap gap-1.5 mb-3">
            <button onClick={() => { setFilter(''); load('') }} className={`px-2.5 py-1 rounded-full text-[12px] font-semibold ${!filter ? 'bg-gray-900 text-white' : 'border border-gray-200 text-gray-600'}`}>전체</button>
            {STATUSES.map(s => <button key={s} onClick={() => { setFilter(s); load(s) }} className={`px-2.5 py-1 rounded-full text-[12px] font-semibold ${filter === s ? 'bg-gray-900 text-white' : 'border border-gray-200 text-gray-600'}`}>{STATUS_KO[s]}</button>)}
          </div>
          <div className="space-y-2">
            {loading ? <p className="py-10 text-center text-gray-400 text-sm">불러오는 중…</p>
              : orders.length === 0 ? <p className="py-10 text-center text-gray-400 text-sm">주문이 없습니다.</p>
              : orders.map(o => (
                <div key={o.id} className="rounded-xl border border-gray-200 bg-white p-3.5 text-[13px]">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <span className="font-bold text-gray-900">#{o.id} {o.service_name}</span>{o.preset_label && <span className="text-gray-400"> · {o.preset_label}</span>}
                      <div className="text-[12px] text-gray-500 mt-0.5">{o.quantity}개 · {formatNumber(o.total_amount)}원 (단가 {formatNumber(o.unit_price)} · 할인 {o.discount_pct}% · 옵션 {formatNumber(o.options_total)}) · 계정 #{o.account_id} · {(o.created_at || '').slice(0, 16)}</div>
                      <div className="text-[12px] text-gray-600 mt-0.5">연락처: {o.contact_kakao ? `카톡 ${o.contact_kakao}` : ''}{o.contact_phone ? ` · ${o.contact_phone}` : ''}{o.target_url ? ` · ${o.target_url}` : ''}</div>
                      {o.memo && <div className="text-[12px] text-gray-500 mt-0.5">요청: {o.memo}</div>}
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <button disabled={busy === o.id} onClick={() => patchOrder(o.id, { payment_status: o.payment_status === 'paid' ? 'unpaid' : 'paid' }, o.payment_status === 'paid' ? '입금 대기로' : '입금 확인')}
                        className={`px-2 py-0.5 rounded text-[11.5px] font-bold ${o.payment_status === 'paid' ? 'bg-emerald-50 text-emerald-600' : o.payment_status === 'refunded' ? 'bg-gray-100 text-gray-500' : 'bg-amber-50 text-amber-600'}`}>
                        {PAY_KO[o.payment_status] || o.payment_status}{o.payment_status === 'unpaid' ? ' → 확인' : ''}
                      </button>
                      <select value={o.status} disabled={busy === o.id} onChange={e => patchOrder(o.id, { status: e.target.value }, '상태 변경')} className="rounded-lg border border-gray-300 px-2 py-1 text-[12px] font-semibold text-gray-900">
                        {STATUSES.map(s => <option key={s} value={s}>{STATUS_KO[s]}</option>)}
                      </select>
                      <select value={o.fulfillment_method || ''} disabled={busy === o.id} onChange={e => patchOrder(o.id, { fulfillment_method: e.target.value }, '이행방식')} className="rounded-lg border border-gray-200 px-2 py-1 text-[11.5px] text-gray-700">
                        <option value="">이행방식…</option>
                        {METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <input defaultValue={o.admin_note || ''} placeholder="담당자 메모(고객에게 표시)" onBlur={e => { if (e.target.value !== (o.admin_note || '')) patchOrder(o.id, { admin_note: e.target.value }, '메모') }} className="flex-1 h-8 rounded-lg border border-gray-200 px-2 text-[12px] text-gray-900" />
                  </div>
                  {/* 조달(리셀러 마진) — 공급처·상위 주문번호·원가 기록 → 마진 자동 계산 */}
                  <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-gray-50 p-2">
                    <span className="text-[11px] font-bold text-gray-500">조달</span>
                    <input defaultValue={o.supplier || ''} placeholder="공급처" onBlur={e => { if (e.target.value !== (o.supplier || '')) patchOrder(o.id, { supplier: e.target.value }, '공급처') }} className="w-28 h-7 rounded border border-gray-200 px-2 text-[11.5px] text-gray-900" />
                    <input defaultValue={o.supplier_order_id || ''} placeholder="상위 주문번호" onBlur={e => { if (e.target.value !== (o.supplier_order_id || '')) patchOrder(o.id, { supplier_order_id: e.target.value }, '주문번호') }} className="w-28 h-7 rounded border border-gray-200 px-2 text-[11.5px] text-gray-900" />
                    <input type="number" defaultValue={o.supplier_cost || 0} placeholder="원가" onBlur={e => { const v = Number(e.target.value) || 0; if (v !== (o.supplier_cost || 0)) patchOrder(o.id, { supplier_cost: v }, '원가') }} className="w-24 h-7 rounded border border-gray-200 px-2 text-[11.5px] text-gray-900 text-right" />
                    <span className="text-[11.5px] text-gray-500">원가 {formatNumber(o.supplier_cost || 0)}원 → 판매 {formatNumber(o.total_amount)}원 · 마진 <b className={o.margin >= 0 ? 'text-emerald-600' : 'text-red-500'}>{formatNumber(o.margin)}원</b>{o.total_amount > 0 ? ` (${Math.round((o.margin / o.total_amount) * 100)}%)` : ''}</span>
                  </div>
                </div>
              ))}
          </div>
        </>
      )}

      {tab === 'catalog' && (
        <div className="rounded-xl border border-gray-200 bg-white overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead><tr className="text-left text-gray-500 border-b border-gray-100"><th className="py-2.5 px-3">정렬</th><th className="py-2.5 px-3">카테고리</th><th className="py-2.5 px-3">상품명</th><th className="py-2.5 px-3 text-right">단가</th><th className="py-2.5 px-3 text-center">노출</th></tr></thead>
            <tbody>
              {services.map(s => (
                <tr key={s.id} className="border-b border-gray-50 text-gray-700">
                  <td className="py-2.5 px-3 tabular-nums text-gray-400">{s.sort_order}</td>
                  <td className="py-2.5 px-3">{s.category}</td>
                  <td className="py-2.5 px-3"><span className="font-medium text-gray-900">{s.name}</span><span className="block text-[11px] text-gray-400">{s.subtitle}</span></td>
                  <td className="py-2.5 px-3 text-right tabular-nums">{formatNumber(s.pricing.unitPrice)}원/{s.pricing.unit}</td>
                  <td className="py-2.5 px-3 text-center">
                    <button disabled={busy === -s.id} onClick={() => toggleService(s)} className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${s.active ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>{s.active ? '노출' : '숨김'}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="p-3 text-[11.5px] text-gray-400">상품 신규 등록/가격 편집은 API(`POST /api/admin/ads/services`)로 지원됩니다. 시드 3종이 기본 등록되어 있습니다.</p>
        </div>
      )}

      {tab === 'reviews' && (
        <div className="space-y-2">
          <p className="text-[12px] text-gray-500">고객 리뷰는 <b>완료 주문 고객만</b> 작성합니다(구매 검증형 — 자작/가짜 불가). 부적절한 리뷰만 숨기세요.</p>
          {reviews.length === 0 ? <p className="py-8 text-center text-gray-400 text-sm">리뷰가 없습니다.</p>
            : reviews.map(r => (
              <div key={r.id} className="rounded-xl border border-gray-200 bg-white p-3 text-[13px]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="text-amber-500">{'★'.repeat(r.rating)}</span> <span className="font-bold text-gray-900">{r.title}</span>
                    <div className="text-[12px] text-gray-600 mt-0.5 whitespace-pre-wrap">{r.body}</div>
                    <div className="text-[10.5px] text-gray-400 mt-0.5">{r.author_masked} · 상품#{r.service_id} · 계정#{r.account_id} · {(r.created_at || '').slice(0, 10)}</div>
                  </div>
                  <button disabled={busy === r.id} onClick={() => setReviewStatus(r.id, r.status === 'hidden' ? 'visible' : 'hidden')} className={`shrink-0 px-2 py-1 rounded text-[11.5px] font-bold ${r.status === 'hidden' ? 'bg-gray-100 text-gray-500' : 'bg-emerald-50 text-emerald-600'}`}>{r.status === 'hidden' ? '숨김' : '노출'}</button>
                </div>
              </div>
            ))}
        </div>
      )}
    </AdminLayout>
  )
}
