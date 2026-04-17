import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import AdminLayout from '@/components/AdminLayout'
import { TrendingUp, DollarSign, ShoppingCart, BarChart2, Loader2 } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell
} from 'recharts'

interface RevenueSummary {
  total_revenue: number
  average_daily: number
  order_count: number
  average_order_value: number
}

interface RevenueDataPoint {
  date: string
  revenue: number
  order_count: number
}

interface TopSeller {
  seller_id: number
  seller_name: string
  business_name?: string
  total_revenue: number
  order_count: number
}

interface TopProduct {
  product_id: number
  product_name: string
  image_url?: string
  total_revenue: number
  sold_count: number
}

interface CategoryData {
  category: string
  revenue: number
  order_count: number
}

type Period = '7d' | '30d' | '90d' | '1y'

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: '7d', label: '7일' },
  { value: '30d', label: '30일' },
  { value: '90d', label: '90일' },
  { value: '1y', label: '1년' },
]

const PIE_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1']

function fmt(n: number | null | undefined): string {
  return (n ?? 0).toLocaleString()
}

export default function AdminRevenueAnalyticsPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<Period>('30d')

  const [summary, setSummary] = useState<RevenueSummary | null>(null)
  const [chartData, setChartData] = useState<RevenueDataPoint[]>([])
  const [topSellers, setTopSellers] = useState<TopSeller[]>([])
  const [topProducts, setTopProducts] = useState<TopProduct[]>([])
  const [categories, setCategories] = useState<CategoryData[]>([])

  useEffect(() => {
    if (!localStorage.getItem('admin_token')) { navigate('/admin/login'); return }
  }, [navigate])

  useEffect(() => {
    loadAll()
  }, [period])

  async function loadAll() {
    setLoading(true)
    try {
      const [revenueRes, sellersRes, productsRes, categoryRes] = await Promise.all([
        api.get(`/api/admin/analytics/revenue?period=${period}`),
        api.get('/api/admin/analytics/top-sellers?limit=10'),
        api.get('/api/admin/analytics/top-products?limit=10'),
        api.get('/api/admin/analytics/category'),
      ])

      if (revenueRes.data.success) {
        setSummary(revenueRes.data.data.summary || revenueRes.data.data)
        setChartData(revenueRes.data.data.chart || revenueRes.data.data.daily || [])
      }
      if (sellersRes.data.success) {
        setTopSellers(sellersRes.data.data || [])
      }
      if (productsRes.data.success) {
        setTopProducts(productsRes.data.data || [])
      }
      if (categoryRes.data.success) {
        setCategories(categoryRes.data.data || [])
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number } }
      if (axiosErr.response?.status === 401) {
        localStorage.removeItem('admin_token')
        navigate('/admin/login')
      } else {
        toast.error('매출 데이터를 불러오지 못했습니다')
      }
    } finally {
      setLoading(false)
    }
  }

  const summaryCards = [
    { label: '총 매출', value: `${fmt(summary?.total_revenue)}원`, icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: '일 평균 매출', value: `${fmt(summary?.average_daily)}원`, icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: '주문 건수', value: `${fmt(summary?.order_count)}건`, icon: ShoppingCart, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: '평균 주문 금액', value: `${fmt(summary?.average_order_value)}원`, icon: BarChart2, color: 'text-amber-600', bg: 'bg-amber-50' },
  ]

  return (
    <AdminLayout title="매출 분석">
      {/* Period Selector */}
      <div className="flex gap-2">
        {PERIOD_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => setPeriod(opt.value)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              period === opt.value
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100 shadow-sm'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {summaryCards.map(card => (
              <div key={card.label} className="bg-white rounded-xl shadow-sm p-5">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg ${card.bg} flex items-center justify-center`}>
                    <card.icon className={`w-5 h-5 ${card.color}`} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">{card.label}</p>
                    <p className="text-lg font-bold text-gray-900">{card.value}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Revenue Chart */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">매출 추이</h3>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6B7280' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} tickFormatter={(v) => `${(v / 10000).toFixed(0)}만`} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12 }}
                    formatter={(value) => [`${fmt(Number(value ?? 0))}원`, '매출']}
                  />
                  <Bar dataKey="revenue" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-gray-400 py-10 text-sm">데이터가 없습니다</p>
            )}
          </div>

          {/* Order Count Line Chart */}
          {chartData.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">주문 건수 추이</h3>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6B7280' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12 }}
                    formatter={(value) => [`${fmt(Number(value ?? 0))}건`, '주문']}
                  />
                  <Line type="monotone" dataKey="order_count" stroke="#8B5CF6" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Two column: Top Sellers + Category Pie */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Top Sellers */}
            <div className="bg-white rounded-xl shadow-sm p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">TOP 10 셀러</h3>
              {topSellers.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left pb-2 font-medium text-gray-500">#</th>
                        <th className="text-left pb-2 font-medium text-gray-500">셀러</th>
                        <th className="text-right pb-2 font-medium text-gray-500">매출</th>
                        <th className="text-right pb-2 font-medium text-gray-500">주문</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topSellers.map((s, i) => (
                        <tr key={s.seller_id} className="border-b border-gray-50">
                          <td className="py-2 text-gray-500">{i + 1}</td>
                          <td className="py-2 text-gray-900 font-medium">{s.business_name || s.seller_name}</td>
                          <td className="py-2 text-right text-gray-700">{fmt(s.total_revenue)}원</td>
                          <td className="py-2 text-right text-gray-500">{fmt(s.order_count)}건</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-center text-gray-400 py-6 text-sm">데이터가 없습니다</p>
              )}
            </div>

            {/* Category Pie Chart */}
            <div className="bg-white rounded-xl shadow-sm p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">카테고리별 매출</h3>
              {categories.length > 0 ? (
                <div className="flex flex-col items-center">
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={categories}
                        dataKey="revenue"
                        nameKey="category"
                        cx="50%"
                        cy="50%"
                        outerRadius={90}
                        label={(props: { category?: string; percent?: number }) => `${props.category} ${((props.percent ?? 0) * 100).toFixed(0)}%`}
                        labelLine={{ stroke: '#9CA3AF' }}
                        fontSize={11}
                      >
                        {categories.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12 }}
                        formatter={(value) => [`${fmt(Number(value ?? 0))}원`]}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {categories.map((c, i) => (
                      <span key={c.category} className="flex items-center gap-1 text-xs text-gray-600">
                        <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                        {c.category}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-center text-gray-400 py-6 text-sm">데이터가 없습니다</p>
              )}
            </div>
          </div>

          {/* Top Products */}
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">TOP 10 상품</h3>
            {topProducts.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left pb-2 font-medium text-gray-500">#</th>
                      <th className="text-left pb-2 font-medium text-gray-500">상품</th>
                      <th className="text-right pb-2 font-medium text-gray-500">매출</th>
                      <th className="text-right pb-2 font-medium text-gray-500">판매수</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topProducts.map((p, i) => (
                      <tr key={p.product_id} className="border-b border-gray-50">
                        <td className="py-2.5 text-gray-500">{i + 1}</td>
                        <td className="py-2.5">
                          <div className="flex items-center gap-3">
                            {p.image_url && (
                              <img src={p.image_url} alt="" className="w-8 h-8 rounded object-cover bg-gray-100" />
                            )}
                            <span className="text-gray-900 font-medium truncate max-w-xs">{p.product_name}</span>
                          </div>
                        </td>
                        <td className="py-2.5 text-right text-gray-700">{fmt(p.total_revenue)}원</td>
                        <td className="py-2.5 text-right text-gray-500">{fmt(p.sold_count)}개</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-center text-gray-400 py-6 text-sm">데이터가 없습니다</p>
            )}
          </div>
        </>
      )}
    </AdminLayout>
  )
}
