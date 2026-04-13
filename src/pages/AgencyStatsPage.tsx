import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AgencyLayout from '@/components/AgencyLayout'
import api from '@/lib/api'
import { TrendingUp, ShoppingBag, Play, Users } from 'lucide-react'

interface Seller {
  id: number
  name: string
  business_name: string
  email: string
  status: string
  total_orders: number
  total_revenue: number
  active_streams: number
}

interface SellerStat {
  seller: Seller
  orders: { order_count: number; revenue: number; net_revenue: number } | null
  streams: { stream_count: number; total_viewers: number } | null
}

type Period = '7d' | '30d' | '90d'

export default function AgencyStatsPage() {
  const navigate = useNavigate()
  const [sellers, setSellers] = useState<Seller[]>([])
  const [stats, setStats] = useState<SellerStat[]>([])
  const [period, setPeriod] = useState<Period>('30d')
  const [loading, setLoading] = useState(true)
  const [sort, setSort] = useState<'revenue' | 'orders' | 'streams'>('revenue')

  const token = localStorage.getItem('agency_token')
  const headers = { Authorization: `Bearer ${token}` }

  useEffect(() => {
    if (!token) { navigate('/agency/login', { replace: true }); return }
    api.get('/api/agency/sellers', { headers })
      .then(r => setSellers(r.data.data || []))
      .catch(() => navigate('/agency/login', { replace: true }))
  }, [token])

  useEffect(() => {
    if (!sellers.length) { setLoading(false); return }
    setLoading(true)
    Promise.all(
      sellers.map(s =>
        api.get(`/api/agency/sellers/${s.id}/stats?period=${period}`, { headers })
          .then(r => ({ seller: s, ...r.data.data }))
          .catch(() => ({ seller: s, orders: null, streams: null, period }))
      )
    ).then(results => {
      setStats(results as SellerStat[])
    }).finally(() => setLoading(false))
  }, [sellers, period])

  const sorted = [...stats].sort((a, b) => {
    if (sort === 'revenue') return (b.orders?.revenue ?? 0) - (a.orders?.revenue ?? 0)
    if (sort === 'orders') return (b.orders?.order_count ?? 0) - (a.orders?.order_count ?? 0)
    return (b.streams?.stream_count ?? 0) - (a.streams?.stream_count ?? 0)
  })

  const totals = stats.reduce((acc, s) => ({
    revenue: acc.revenue + (s.orders?.revenue ?? 0),
    orders: acc.orders + (s.orders?.order_count ?? 0),
    net_revenue: acc.net_revenue + (s.orders?.net_revenue ?? 0),
    streams: acc.streams + (s.streams?.stream_count ?? 0),
    viewers: acc.viewers + (s.streams?.total_viewers ?? 0),
  }), { revenue: 0, orders: 0, net_revenue: 0, streams: 0, viewers: 0 })

  return (
    <AgencyLayout title="통계 분석">
      {/* Period selector */}
      <div className="flex items-center gap-2">
        {(['7d', '30d', '90d'] as Period[]).map(p => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              period === p ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {p === '7d' ? '최근 7일' : p === '30d' ? '최근 30일' : '최근 90일'}
          </button>
        ))}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: '총 매출', value: `${(totals.revenue / 10000).toFixed(0)}만원`, icon: TrendingUp, color: 'bg-blue-600' },
          { label: '총 주문', value: `${totals.orders}건`, icon: ShoppingBag, color: 'bg-emerald-500' },
          { label: '총 라이브', value: `${totals.streams}회`, icon: Play, color: 'bg-rose-500' },
          { label: '총 시청자', value: `${totals.viewers.toLocaleString()}명`, icon: Users, color: 'bg-violet-500' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
                <p className="text-2xl font-bold text-gray-900">{value}</p>
              </div>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
                <Icon className="w-5 h-5 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Seller ranking table */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">셀러별 성과</h2>
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-400 mr-2">정렬:</span>
            {(['revenue', 'orders', 'streams'] as const).map(s => (
              <button
                key={s}
                onClick={() => setSort(s)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  sort === s ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {s === 'revenue' ? '매출' : s === 'orders' ? '주문' : '라이브'}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-gray-400">불러오는 중...</div>
        ) : sorted.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">소속 셀러가 없습니다.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['순위', '셀러', '매출', '주문', '셀러수익', '라이브', '시청자'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sorted.map((s, i) => (
                  <tr key={s.seller.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                        i === 0 ? 'bg-yellow-100 text-yellow-700' :
                        i === 1 ? 'bg-gray-100 text-gray-600' :
                        i === 2 ? 'bg-orange-100 text-orange-600' :
                        'text-gray-400'
                      }`}>
                        {i + 1}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{s.seller.business_name || s.seller.name}</p>
                      <p className="text-xs text-gray-400">{s.seller.email}</p>
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-900">
                      {((s.orders?.revenue ?? 0) / 10000).toFixed(1)}만원
                    </td>
                    <td className="px-4 py-3 text-gray-700">{s.orders?.order_count ?? 0}건</td>
                    <td className="px-4 py-3 text-gray-700">
                      {((s.orders?.net_revenue ?? 0) / 10000).toFixed(1)}만원
                    </td>
                    <td className="px-4 py-3 text-gray-700">{s.streams?.stream_count ?? 0}회</td>
                    <td className="px-4 py-3 text-gray-700">
                      {(s.streams?.total_viewers ?? 0).toLocaleString()}명
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AgencyLayout>
  )
}
