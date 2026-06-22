import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { useApiQuery } from '@/hooks/queries/useApiQuery'
import AdminLayout from '@/components/AdminLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import { Package, Loader2, Search, RotateCcw, X } from 'lucide-react'
import { toast } from '@/hooks/useToast'
import { formatWon } from '@/utils/format'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import AdminDataTable, { type AdminDataTableColumn } from '@/components/admin/AdminDataTable'

// 🏭 2026-06-01 유통스타트 — 어드민 도매주문 모니터 (오버사이트 + 강제환불). 라이트 테마.

interface OrderRow {
  id: number
  distributor_seller_id: number
  status: string
  grade: string | null
  subtotal: number
  margin_total: number
  refunded_amount: number
  created_at: string
  business_name: string | null
  seller_name: string | null
  username: string | null
  item_count: number
}
interface DetailItem {
  product_id: number; name: string; qty: number; base_supply_price: number
  distributor_unit_price: number; line_total: number; line_status: string
  courier: string | null; tracking_number: string | null; supplier_id: number | null; supplier_name: string | null
}

const STATUS: Record<string, { t: string; c: string }> = {
  PENDING: { t: '결제대기', c: 'bg-amber-50 text-amber-700' },
  PAID: { t: '결제완료', c: 'bg-emerald-50 text-emerald-700' },
  SHIPPED: { t: '발송완료', c: 'bg-blue-50 text-blue-700' },
  PARTIAL_REFUNDED: { t: '부분환불', c: 'bg-orange-50 text-orange-700' },
  REFUNDED: { t: '환불완료', c: 'bg-rose-50 text-rose-700' },
  FAILED: { t: '실패', c: 'bg-gray-100 text-gray-500' },
}
const FILTERS = ['', 'PAID', 'SHIPPED', 'PARTIAL_REFUNDED', 'REFUNDED']

// 🧱 2026-06-10: 공통 AdminDataTable 레퍼런스 적용 — 기존 셀 마크업/클래스 그대로 컬럼 정의로 이동.
const ORDER_COLUMNS: Array<AdminDataTableColumn<OrderRow>> = [
  { key: 'order', label: '주문', render: o => <>#{o.id} <span className="text-gray-400">({o.item_count})</span></> },
  { key: 'distributor', label: '판매사', render: o => <span className="text-gray-900">{o.business_name || o.seller_name || o.username || `#${o.distributor_seller_id}`}</span> },
  { key: 'grade', label: '등급', render: o => <span className="text-gray-600">{o.grade || '-'}</span> },
  { key: 'status', label: '상태', render: o => <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS[o.status]?.c || 'bg-gray-100 text-gray-600'}`}>{STATUS[o.status]?.t || o.status}</span> },
  { key: 'subtotal', label: '결제액', className: 'text-right', render: o => <span className="font-medium text-gray-900">{formatWon(o.subtotal)}</span> },
  { key: 'margin_total', label: '마진', className: 'text-right', render: o => <span className="text-gray-600">{formatWon(o.margin_total)}</span> },
  { key: 'created_at', label: '일자', render: o => <span className="text-gray-500">{new Date(o.created_at).toLocaleDateString('ko-KR')}</span> },
]

export default function AdminWholesaleOrdersPage() {
  const navigate = useNavigate()
  const h = { headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` } }

  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [detail, setDetail] = useState<{ order: OrderRow & Record<string, unknown>; items: DetailItem[] } | null>(null)
  const [refunding, setRefunding] = useState(false)
  // 🛡️ 2026-06-03 Tier2(대시보드): 수동 페칭 → useApiQuery (status별 캐시, search 는 refetch 로 commit).
  const { data: orders = [], isLoading: loading, refetch } = useApiQuery<OrderRow[]>(
    ['admin', 'distributor-orders', status], '/api/admin/distributor/orders',
    { params: { ...(status ? { status } : {}), ...(search ? { search } : {}) }, select: (r: any) => (r?.success ? r.orders || [] : []) },
  )
  const load = (_st?: string, _q?: string) => refetch()

  useEffect(() => { if (!localStorage.getItem('admin_token')) navigate('/admin/login', { replace: true }) }, [navigate])

  function openDetail(id: number) {
    api.get(`/api/admin/distributor/orders/${id}`, h)
      .then(r => { if (r.data.success) setDetail({ order: r.data.order, items: r.data.items || [] }) })
      .catch(() => toast.error('상세 조회 실패'))
  }

  async function forceRefund(id: number) {
    if (!(await confirmDialog({ message: `주문 #${id} 을(를) 관리자 강제 전액환불 할까요? 되돌릴 수 없습니다.`, danger: true }))) return
    setRefunding(true)
    try {
      const r = await api.post(`/api/admin/distributor/orders/${id}/refund`, { reason: '관리자 환불' }, h)
      if (r.data.success) { toast.success('환불 처리됨'); setDetail(null); load(status, search) }
      else toast.error(r.data.error || '환불 실패')
    } catch (e: unknown) { toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || '오류') }
    finally { setRefunding(false) }
  }

  return (
    <AdminLayout title="도매 주문">
      <div className="ur-content-full px-4 lg:px-8 py-6">
        <DashboardPageHeader icon={<Package className="w-5 h-5" />} title="도매 주문 모니터" subtitle="유통스타트 B2B 주문 현황 + 분쟁/멈춘 주문 강제환불" />

        <div className="flex flex-wrap items-center gap-2 my-4">
          {FILTERS.map(f => (
            <button key={f || 'all'} onClick={() => setStatus(f)} className={`px-3 py-1.5 rounded-lg text-sm font-medium ${status === f ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-700'}`}>
              {f ? (STATUS[f]?.t || f) : '전체'}
            </button>
          ))}
          <form onSubmit={e => { e.preventDefault(); load(status, search) }} className="relative ml-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="판매사 검색" className="pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-gray-900 text-sm" />
          </form>
        </div>

        <AdminDataTable<OrderRow>
          columns={ORDER_COLUMNS}
          rows={orders}
          loading={loading}
          empty="주문이 없습니다."
          rowKey={o => o.id}
          onRowClick={o => openDetail(o.id)}
        />
      </div>

      {/* 상세 모달 */}
      {detail && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setDetail(null)}>
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">주문 #{detail.order.id} 상세</h3>
              <button onClick={() => setDetail(null)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="text-sm text-gray-600 mb-3">
              상태 <b>{STATUS[detail.order.status as string]?.t || String(detail.order.status)}</b> ·
              결제 <b>{formatWon(Number(detail.order.subtotal))}</b> ·
              환불 {formatWon(Number(detail.order.refunded_amount) || 0)}
            </div>
            <div className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3 mb-4">
              배송지: {String(detail.order.ship_to_name || '-')} {String(detail.order.ship_to_phone || '')}<br />
              {String(detail.order.ship_to_address || '-')}
            </div>
            <table className="w-full text-sm mb-4">
              <thead><tr className="text-left text-gray-500 border-b border-gray-100">
                <th className="py-2 font-medium">상품</th><th className="py-2 font-medium">제조사</th>
                <th className="py-2 font-medium text-right">수량</th><th className="py-2 font-medium text-right">금액</th><th className="py-2 font-medium">상태</th>
              </tr></thead>
              <tbody>
                {detail.items.map((it, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="py-2 text-gray-900">{it.name}</td>
                    <td className="py-2 text-gray-600">{it.supplier_name || `#${it.supplier_id}`}</td>
                    <td className="py-2 text-right text-gray-600">{it.qty}</td>
                    <td className="py-2 text-right text-gray-900">{formatWon(it.line_total)}</td>
                    <td className="py-2 text-gray-500">{it.line_status === 'REFUNDED' ? '환불' : it.line_status === 'SHIPPED' ? `발송(${it.courier || ''})` : '대기'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {['PAID', 'SHIPPED', 'PARTIAL_REFUNDED'].includes(detail.order.status as string) && (
              <button onClick={() => forceRefund(detail.order.id)} disabled={refunding} className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                {refunding ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />} 관리자 강제 전액환불
              </button>
            )}
          </div>
        </div>
      )}
    </AdminLayout>
  )
}
