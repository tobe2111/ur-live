import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import AgencyLayout from '@/components/AgencyLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import { BarChart2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { TrendingUp, ShoppingBag, Play, Users, ArrowUpDown, Trophy } from 'lucide-react'

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

interface ComparisonRow {
  id: number
  name: string
  business_name: string
  order_count: number
  revenue: number
  live_count: number
  ended_streams: number
  total_vouchers: number
  used_vouchers: number
  voucher_usage_rate: number
  total_group_buys: number
  achieved_group_buys: number
  group_buy_success_rate: number
}

type ComparisonSortKey = 'revenue' | 'order_count' | 'voucher_usage_rate' | 'group_buy_success_rate'

type Period = '7d' | '30d' | '90d'

export default function AgencyStatsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [sellers, setSellers] = useState<Seller[]>([])
  const [stats, setStats] = useState<SellerStat[]>([])
  const [period, setPeriod] = useState<Period>('30d')
  const [loading, setLoading] = useState(true)
  const [sort, setSort] = useState<'revenue' | 'orders' | 'streams'>('revenue')

  // Restaurant comparison state
  const [comparison, setComparison] = useState<ComparisonRow[]>([])
  const [comparisonLoading, setComparisonLoading] = useState(false)
  const [comparisonSort, setComparisonSort] = useState<ComparisonSortKey>('revenue')
  const [comparisonSortAsc, setComparisonSortAsc] = useState(false)

  const token = localStorage.getItem('agency_token')
  const headers = { Authorization: `Bearer ${token}` }

  useEffect(() => {
    if (!token) { navigate('/agency/login', { replace: true }); return }
    api.get('/api/agency/sellers', { headers })
      .then(r => setSellers(r.data.data || []))
      .catch(() => { toast.error('세션이 만료되었습니다. 다시 로그인해주세요.'); navigate('/agency/login', { replace: true }) })
  }, [token])

  useEffect(() => {
    if (!sellers.length) { setLoading(false); return }
    setLoading(true)
    api.get(`/api/agency/stats/batch?period=${period}`, { headers })
      .then(r => {
        const { orders: orderMap, streams: streamMap } = r.data.data as {
          orders: Record<number, { order_count: number; revenue: number; net_revenue: number }>
          streams: Record<number, { stream_count: number; total_viewers: number }>
        }
        setStats(sellers.map(s => ({
          seller: s,
          orders: orderMap[s.id] ?? null,
          streams: streamMap[s.id] ?? null,
        })))
      })
      .catch(() => setStats(sellers.map(s => ({ seller: s, orders: null, streams: null }))))
      .finally(() => setLoading(false))
  }, [sellers, period])

  // Fetch restaurant comparison data
  useEffect(() => {
    if (!token || !sellers.length) return
    setComparisonLoading(true)
    const days = period === '7d' ? 7 : period === '90d' ? 90 : 30
    api.get(`/api/agency/sellers/compare?period=${days}`, { headers })
      .then(r => setComparison(r.data.data || []))
      .catch(() => setComparison([]))
      .finally(() => setComparisonLoading(false))
  }, [sellers, period, token])

  const sorted = [...stats].sort((a, b) => {
    if (sort === 'revenue') return (b.orders?.revenue ?? 0) - (a.orders?.revenue ?? 0)
    if (sort === 'orders') return (b.orders?.order_count ?? 0) - (a.orders?.order_count ?? 0)
    return (b.streams?.stream_count ?? 0) - (a.streams?.stream_count ?? 0)
  })

  const sortedComparison = useMemo(() => {
    const list = [...comparison]
    list.sort((a, b) => {
      const aVal = a[comparisonSort] ?? 0
      const bVal = b[comparisonSort] ?? 0
      return comparisonSortAsc ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number)
    })
    return list
  }, [comparison, comparisonSort, comparisonSortAsc])

  const topPerformerId = sortedComparison.length > 0 ? sortedComparison[0].id : null

  function handleComparisonSort(key: ComparisonSortKey) {
    if (comparisonSort === key) {
      setComparisonSortAsc(!comparisonSortAsc)
    } else {
      setComparisonSort(key)
      setComparisonSortAsc(false)
    }
  }

  const totals = stats.reduce((acc, s) => ({
    revenue: acc.revenue + (s.orders?.revenue ?? 0),
    orders: acc.orders + (s.orders?.order_count ?? 0),
    net_revenue: acc.net_revenue + (s.orders?.net_revenue ?? 0),
    streams: acc.streams + (s.streams?.stream_count ?? 0),
    viewers: acc.viewers + (s.streams?.total_viewers ?? 0),
  }), { revenue: 0, orders: 0, net_revenue: 0, streams: 0, viewers: 0 })

  return (
    <AgencyLayout title={t('agency.stats')}>
      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
        {/* 🛡️ 2026-04-22 배치 130: 디자인 시스템 적용 */}
        <DashboardPageHeader
          title={t('agency.stats')}
          subtitle={t('agency.statsSubtitle')}
          icon={<BarChart2 className="h-5 w-5" />}
        />
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
      {/* Restaurant Comparison Table */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">식당별 성과 비교</h2>
          <p className="text-xs text-gray-400">열 클릭으로 정렬</p>
        </div>

        {comparisonLoading ? (
          <div className="p-8 text-center text-sm text-gray-400">불러오는 중...</div>
        ) : sortedComparison.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">비교할 식당이 없습니다.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">식당명</th>
                  {([
                    { key: 'revenue' as ComparisonSortKey, label: '매출' },
                    { key: 'order_count' as ComparisonSortKey, label: '주문수' },
                    { key: 'voucher_usage_rate' as ComparisonSortKey, label: '바우처 사용률' },
                    { key: 'group_buy_success_rate' as ComparisonSortKey, label: '공구 참여율' },
                  ]).map(col => (
                    <th
                      key={col.key}
                      onClick={() => handleComparisonSort(col.key)}
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 cursor-pointer hover:text-gray-700 select-none"
                    >
                      <span className="inline-flex items-center gap-1">
                        {col.label}
                        <ArrowUpDown className={`w-3 h-3 ${comparisonSort === col.key ? 'text-blue-600' : 'text-gray-300'}`} />
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {sortedComparison.map(row => (
                  <tr
                    key={row.id}
                    className={`hover:bg-gray-50 ${row.id === topPerformerId ? 'bg-yellow-50' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {row.id === topPerformerId && (
                          <Trophy className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                        )}
                        <div>
                          <p className="font-medium text-gray-900">{row.business_name || row.name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-900">
                      {((row.revenue ?? 0) / 10000).toFixed(1)}만원
                    </td>
                    <td className="px-4 py-3 text-gray-700">{row.order_count ?? 0}건</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden max-w-[80px]">
                          <div
                            className="h-full bg-emerald-500 rounded-full"
                            style={{ width: `${Math.min(row.voucher_usage_rate ?? 0, 100)}%` }}
                          />
                        </div>
                        <span className="text-gray-700 text-xs font-medium">{row.voucher_usage_rate ?? 0}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden max-w-[80px]">
                          <div
                            className="h-full bg-violet-500 rounded-full"
                            style={{ width: `${Math.min(row.group_buy_success_rate ?? 0, 100)}%` }}
                          />
                        </div>
                        <span className="text-gray-700 text-xs font-medium">{row.group_buy_success_rate ?? 0}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </div>
    </AgencyLayout>
  )
}
