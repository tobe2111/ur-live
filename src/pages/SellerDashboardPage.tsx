/**
 * 판매자 통계 대시보드 페이지
 * 
 * 기능:
 * - 일/주/월별 매출 차트
 * - 상품별 매출 순위
 * - 주요 통계 카드
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { 
  TrendingUp, 
  Package, 
  ShoppingCart, 
  DollarSign,
  ArrowLeft,
  Calendar,
  Loader2
} from 'lucide-react'

interface Stats {
  totalProducts: number
  activeProducts: number
  totalStock: number
  totalOrders: number
  totalRevenue: number
  activeStreams: number
  totalViewers: number
}

interface SalesData {
  period: string
  order_count: number
  total_sales: number
  total_quantity: number
}

interface ProductSales {
  id: number
  name: string
  price: number
  image_url: string
  order_count: number
  total_sold: number
  total_revenue: number
  current_stock: number
}

export default function SellerDashboardPage() {
  const navigate = useNavigate()
  const [stats, setStats] = useState<Stats | null>(null)
  const [salesData, setSalesData] = useState<SalesData[]>([])
  const [topProducts, setTopProducts] = useState<ProductSales[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('daily')

  useEffect(() => {
    const sessionToken = localStorage.getItem('seller_session_token')
    const userType = localStorage.getItem('user_type')
    
    if (!sessionToken || userType !== 'seller') {
      navigate('/seller/login')
      return
    }
    
    loadAllData()
  }, [period])

  async function loadAllData() {
    try {
      setLoading(true)
      const sessionToken = localStorage.getItem('seller_session_token')

      // Load basic stats
      const statsRes = await api.get('/api/seller/stats', {
        headers: { 'Authorization': `Bearer ${sessionToken}` }
      })

      // Load sales data
      const salesRes = await api.get(`/api/seller/stats/sales?period=${period}`, {
        headers: { 'Authorization': `Bearer ${sessionToken}` }
      })

      // Load top products
      const productsRes = await api.get('/api/seller/stats/products?limit=10&days=30', {
        headers: { 'Authorization': `Bearer ${sessionToken}` }
      })

      setStats(statsRes.data.data)
      setSalesData(salesRes.data.data.sales)
      setTopProducts(productsRes.data.data.products)
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
      currency: 'KRW'
    }).format(price)
  }

  function formatNumber(num: number) {
    return new Intl.NumberFormat('ko-KR').format(num)
  }

  function getPeriodLabel(period: string) {
    switch (period) {
      case 'daily':
        return '일별'
      case 'weekly':
        return '주별'
      case 'monthly':
        return '월별'
      default:
        return period
    }
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/seller')}
                className="text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">📊 통계 대시보드</h1>
                <p className="text-sm text-gray-600">매출 및 상품 분석</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-2">
                <Package className="w-8 h-8 text-blue-600" />
                <TrendingUp className="w-4 h-4 text-green-600" />
              </div>
              <p className="text-sm text-gray-600">총 상품</p>
              <p className="text-3xl font-bold text-gray-900">{stats.totalProducts}</p>
              <p className="text-xs text-gray-500 mt-1">
                활성: {stats.activeProducts}개
              </p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-2">
                <ShoppingCart className="w-8 h-8 text-green-600" />
                <TrendingUp className="w-4 h-4 text-green-600" />
              </div>
              <p className="text-sm text-gray-600">총 주문</p>
              <p className="text-3xl font-bold text-gray-900">{formatNumber(stats.totalOrders)}</p>
              <p className="text-xs text-gray-500 mt-1">
                누적 주문 수
              </p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-2">
                <DollarSign className="w-8 h-8 text-yellow-600" />
                <TrendingUp className="w-4 h-4 text-green-600" />
              </div>
              <p className="text-sm text-gray-600">총 매출</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatPrice(stats.totalRevenue)}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                누적 매출액
              </p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-2">
                <Package className="w-8 h-8 text-purple-600" />
              </div>
              <p className="text-sm text-gray-600">재고</p>
              <p className="text-3xl font-bold text-gray-900">{formatNumber(stats.totalStock)}</p>
              <p className="text-xs text-gray-500 mt-1">
                전체 재고 수량
              </p>
            </div>
          </div>
        )}

        {/* Sales Chart */}
        <div className="bg-white rounded-lg shadow mb-8">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Calendar className="w-6 h-6 text-blue-600" />
                <div>
                  <h2 className="text-xl font-bold text-gray-900">매출 추이</h2>
                  <p className="text-sm text-gray-600">기간별 매출 분석</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setPeriod('daily')}
                  className={`px-4 py-2 rounded-lg font-medium ${
                    period === 'daily'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  일별
                </button>
                <button
                  onClick={() => setPeriod('weekly')}
                  className={`px-4 py-2 rounded-lg font-medium ${
                    period === 'weekly'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  주별
                </button>
                <button
                  onClick={() => setPeriod('monthly')}
                  className={`px-4 py-2 rounded-lg font-medium ${
                    period === 'monthly'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  월별
                </button>
              </div>
            </div>
          </div>

          {/* Simple Bar Chart (CSS-based) */}
          <div className="p-6">
            {salesData.length > 0 ? (
              <div className="space-y-4">
                {salesData.map((data, idx) => {
                  const maxSales = Math.max(...salesData.map(d => d.total_sales))
                  const percentage = (data.total_sales / maxSales) * 100

                  return (
                    <div key={idx} className="flex items-center gap-4">
                      <div className="w-24 text-sm font-medium text-gray-700 flex-shrink-0">
                        {data.period}
                      </div>
                      <div className="flex-1">
                        <div className="relative h-8 bg-gray-100 rounded-lg overflow-hidden">
                          <div
                            className="absolute inset-y-0 left-0 bg-blue-600 rounded-lg transition-all duration-500"
                            style={{ width: `${percentage}%` }}
                          />
                          <div className="absolute inset-0 flex items-center px-3">
                            <span className="text-sm font-medium text-gray-900">
                              {formatPrice(data.total_sales)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="w-20 text-sm text-gray-600 text-right flex-shrink-0">
                        {data.order_count}건
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                매출 데이터가 없습니다
              </div>
            )}
          </div>
        </div>

        {/* Top Products */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-6 h-6 text-green-600" />
              <div>
                <h2 className="text-xl font-bold text-gray-900">인기 상품 TOP 10</h2>
                <p className="text-sm text-gray-600">최근 30일 기준</p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            {topProducts.length > 0 ? (
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">순위</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">상품</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase">판매량</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase">주문수</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase">매출액</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-700 uppercase">재고</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {topProducts.map((product, idx) => (
                    <tr key={product.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold">
                          {idx + 1}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={product.image_url || 'https://via.placeholder.com/64'}
                            alt={product.name}
                            className="w-12 h-12 object-cover rounded-lg"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'https://via.placeholder.com/64'
                            }}
                          />
                          <div>
                            <p className="font-medium text-gray-900">{product.name}</p>
                            <p className="text-sm text-gray-500">{formatPrice(product.price)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <span className="text-sm font-medium text-gray-900">
                          {formatNumber(product.total_sold)}개
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <span className="text-sm text-gray-600">
                          {formatNumber(product.order_count)}건
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <span className="text-sm font-bold text-green-600">
                          {formatPrice(product.total_revenue)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <span className={`text-sm font-medium ${
                          product.current_stock < 10 ? 'text-red-600' : 'text-gray-900'
                        }`}>
                          {formatNumber(product.current_stock)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="text-center py-12 text-gray-500">
                판매 데이터가 없습니다
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
