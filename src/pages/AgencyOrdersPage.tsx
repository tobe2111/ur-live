import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AgencyLayout from '@/components/AgencyLayout'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { CheckCircle, XCircle, Clock, ChevronLeft, ChevronRight } from 'lucide-react'

interface Order {
  id: number
  order_number: string
  total_amount: number
  payment_status: string
  status: string
  created_at: string
  shipping_name: string
  seller_business_name: string
}

interface Seller { id: number; business_name: string; name: string }

function PayBadge({ status }: { status: string }) {
  if (status === 'approved') return (
    <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
      <CheckCircle className="w-3 h-3" />결제완료
    </span>
  )
  if (status === 'failed' || status === 'cancelled') return (
    <span className="flex items-center gap-1 text-xs text-red-500 bg-red-50 px-2 py-0.5 rounded-full">
      <XCircle className="w-3 h-3" />취소
    </span>
  )
  return (
    <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
      <Clock className="w-3 h-3" />대기중
    </span>
  )
}

export default function AgencyOrdersPage() {
  const navigate = useNavigate()
  const [orders, setOrders] = useState<Order[]>([])
  const [sellers, setSellers] = useState<Seller[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [filterSeller, setFilterSeller] = useState('')
  const limit = 20

  const token = localStorage.getItem('agency_token')
  const headers = { Authorization: `Bearer ${token}` }

  useEffect(() => {
    if (!token) { navigate('/agency/login', { replace: true }); return }
    api.get('/api/agency/sellers', { headers }).then(r => setSellers(r.data.data || []))
  }, [token])

  useEffect(() => {
    if (!token) return
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: String(limit) })
    if (filterSeller) params.set('seller_id', filterSeller)
    api.get(`/api/agency/orders?${params}`, { headers })
      .then(r => { setOrders(r.data.data || []); setTotal(r.data.meta?.total || 0) })
      .catch(() => { toast.error('세션이 만료되었습니다. 다시 로그인해주세요.'); navigate('/agency/login', { replace: true }) })
      .finally(() => setLoading(false))
  }, [token, page, filterSeller])

  const totalPages = Math.ceil(total / limit)

  return (
    <AgencyLayout title="주문 현황">
      <div className="bg-white rounded-xl border border-gray-200">
        {/* Filters */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100">
          <select
            value={filterSeller}
            onChange={e => { setFilterSeller(e.target.value); setPage(1) }}
            className="text-sm text-gray-900 border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">전체 셀러</option>
            {sellers.map(s => (
              <option key={s.id} value={s.id}>{s.business_name || s.name}</option>
            ))}
          </select>
          <span className="text-sm text-gray-500 ml-auto">총 {total.toLocaleString()}건</span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['주문번호', '셀러', '구매자', '금액', '결제상태', '주문일'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">불러오는 중...</td></tr>
              ) : orders.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">주문이 없습니다.</td></tr>
              ) : orders.map(o => (
                <tr key={o.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">{o.order_number}</td>
                  <td className="px-4 py-3 text-gray-700">{o.seller_business_name || '-'}</td>
                  <td className="px-4 py-3 text-gray-700">{o.shipping_name || '-'}</td>
                  <td className="px-4 py-3 font-semibold text-gray-900">{o.total_amount.toLocaleString()}원</td>
                  <td className="px-4 py-3"><PayBadge status={o.payment_status} /></td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(o.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 px-5 py-4 border-t border-gray-100">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm text-gray-600">{page} / {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </AgencyLayout>
  )
}
