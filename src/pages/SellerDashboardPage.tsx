/**
 * 판매자 통계 대시보드 페이지 (Recharts 통합)
 * 
 * 기능:
 * - 일별 매출 차트 (Line Chart)
 * - 상품별 매출 순위 (Bar Chart)
 * - 주요 통계 카드
 * - 기간 선택 (7일, 30일, 90일)
 */

import { useState, useEffect, lazy, Suspense } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { 
  TrendingUp, 
  Package, 
  ShoppingCart, 
  DollarSign,
  ArrowLeft,
  Calendar,
  Loader2,
  CheckCircle,
  Clock,
  XCircle
} from 'lucide-react'

// Lazy load DashboardCharts component
const DashboardCharts = lazy(() => import('@/components/charts/DashboardCharts'))

interface DailyStats {
  date: string
  orders: number
  sales: number
  completed_orders: number
}

interface Summary {
  total_orders: number
  total_sales: number
  avg_order_value: number
  completed_orders: number
  pending_orders: number
  cancelled_orders: number
}

interface TopProduct {
  product_id: number
  product_name: string
  order_count: number
  total_quantity: number
  total_revenue: number
}

interface DashboardData {
  period: string
  daily: DailyStats[]
  summary: Summary
  topProducts: TopProduct[]
}

export default function SellerDashboardPage() {
  const navigate = useNavigate()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('7d')

  useEffect(() => {
    const sessionToken = localStorage.getItem('seller_session_token')
    const userType = localStorage.getItem('user_type')
    
    if (!sessionToken || userType !== 'seller') {
      navigate('/seller/login')
      return
    }
    
    loadDashboardData()
  }, [period])

  async function loadDashboardData() {
    try {
      setLoading(true)
      const sessionToken = localStorage.getItem('seller_session_token')

      const response = await api.get(`/api/seller/dashboard/stats?period=${period}`, {
        headers: { 'Authorization': `Bearer ${sessionToken}` }
      })

      setData(response.data.data)
      setLoading(false)
    } catch (err: any) {
      console.error('Failed to load dashboard data:', err)
      if (err.response?.status === 401) {
        navigate('/seller/login')
      }
      setLoading(false)
    }
  }

  function formatPrice(price: number) {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
      maximumFractionDigits: 0
    }).format(price || 0)
  }

  function formatNumber(num: number) {
    return new Intl.NumberFormat('ko-KR').format(num || 0)
  }

  function formatShortPrice(price: number) {
    if (price >= 1000000) {
      return `${(price / 1000000).toFixed(1)}M`
    } else if (price >= 1000) {
      return `${(price / 1000).toFixed(1)}K`
    }
    return price.toString()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">통계를 불러오는 중...</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">데이터를 불러올 수 없습니다.</p>
          <button
            onClick={loadDashboardData}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg"
          >
            다시 시도
          </button>
        </div>
      </div>
    )
  }

  const { daily, summary, topProducts } = data

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={() => navigate('/seller')}
                className="text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
              <div>
                <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">📊 통계 대시보드</h1>
                <p className="text-xs sm:text-sm text-gray-600">매출 및 상품 분석</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 sm:py-6 lg:py-8">
        {/* Period Selector */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setPeriod('7d')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              period === '7d'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50 border'
            }`}
          >
            최근 7일
          </button>
          <button
            onClick={() => setPeriod('30d')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              period === '30d'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50 border'
            }`}
          >
            최근 30일
          </button>
          <button
            onClick={() => setPeriod('90d')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              period === '90d'
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50 border'
            }`}
          >
            최근 90일
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6 mb-6">
          <div className="bg-white rounded-lg shadow p-4 lg:p-6">
            <div className="flex items-center justify-between mb-2">
              <ShoppingCart className="w-8 h-8 text-blue-600" />
            </div>
            <p className="text-sm text-gray-600">총 주문</p>
            <p className="text-2xl lg:text-3xl font-bold text-gray-900">{formatNumber(summary.total_orders)}</p>
            <p className="text-xs text-green-600 mt-1">
              완료: {formatNumber(summary.completed_orders)}건
            </p>
          </div>

          <div className="bg-white rounded-lg shadow p-4 lg:p-6">
            <div className="flex items-center justify-between mb-2">
              <DollarSign className="w-8 h-8 text-green-600" />
            </div>
            <p className="text-sm text-gray-600">총 매출</p>
            <p className="text-xl lg:text-2xl font-bold text-gray-900">
              {formatPrice(summary.total_sales)}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              평균: {formatPrice(summary.avg_order_value)}/건
            </p>
          </div>

          <div className="bg-white rounded-lg shadow p-4 lg:p-6">
            <div className="flex items-center justify-between mb-2">
              <Clock className="w-8 h-8 text-yellow-600" />
            </div>
            <p className="text-sm text-gray-600">대기 중</p>
            <p className="text-2xl lg:text-3xl font-bold text-gray-900">{formatNumber(summary.pending_orders)}</p>
            <p className="text-xs text-gray-500 mt-1">
              처리 필요
            </p>
          </div>

          <div className="bg-white rounded-lg shadow p-4 lg:p-6">
            <div className="flex items-center justify-between mb-2">
              <XCircle className="w-8 h-8 text-red-600" />
            </div>
            <p className="text-sm text-gray-600">취소</p>
            <p className="text-2xl lg:text-3xl font-bold text-gray-900">{formatNumber(summary.cancelled_orders)}</p>
            <p className="text-xs text-gray-500 mt-1">
              취소율: {summary.total_orders > 0 ? ((summary.cancelled_orders / summary.total_orders) * 100).toFixed(1) : 0}%
            </p>
          </div>
        </div>

        {/* Sales Trend Chart */}
        <div className="bg-white rounded-lg shadow mb-6 p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            일별 매출 추이
          </h2>
          
          {daily && daily.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={daily} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => {
                    const date = new Date(value)
                    return `${date.getMonth() + 1}/${date.getDate()}`
                  }}
                />
                <YAxis 
                  yAxisId="left"
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => formatShortPrice(value)}
                />
                <YAxis 
                  yAxisId="right" 
                  orientation="right"
                  tick={{ fontSize: 12 }}
                />
                <Tooltip 
                  formatter={(value: any, name: string) => {
                    if (name === '매출액') return formatPrice(value)
                    return formatNumber(value)
                  }}
                  labelFormatter={(label) => {
                    const date = new Date(label)
                    return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`
                  }}
                />
                <Legend />
                <Line 
                  yAxisId="left"
                  type="monotone" 
                  dataKey="sales" 
                  stroke="#3B82F6" 
                  strokeWidth={2}
                  name="매출액"
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
                <Line 
                  yAxisId="right"
                  type="monotone" 
                  dataKey="orders" 
                  stroke="#10B981" 
                  strokeWidth={2}
                  name="주문 수"
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-500">
              데이터가 없습니다
            </div>
          )}
        </div>

        {/* Top Products Bar Chart */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Package className="w-5 h-5 text-purple-600" />
            상품별 매출 Top 5
          </h2>
          
          {topProducts && topProducts.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={topProducts.slice(0, 5)} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="product_name" 
                    tick={{ fontSize: 12 }}
                    angle={-15}
                    textAnchor="end"
                    height={80}
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => formatShortPrice(value)}
                  />
                  <Tooltip 
                    formatter={(value: any, name: string) => {
                      if (name === '매출액') return formatPrice(value)
                      return formatNumber(value)
                    }}
                  />
                  <Legend />
                  <Bar dataKey="total_revenue" fill="#8B5CF6" name="매출액" />
                </BarChart>
              </ResponsiveContainer>

              {/* Product Table */}
              <div className="mt-6 overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">순위</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">상품명</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">주문 수</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">판매량</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">매출액</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {topProducts.map((product, index) => (
                      <tr key={product.product_id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {index + 1}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {product.product_name}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-right">
                          {formatNumber(product.order_count)}건
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 text-right">
                          {formatNumber(product.total_quantity)}개
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">
                          {formatPrice(product.total_revenue)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-500">
              판매 데이터가 없습니다
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
