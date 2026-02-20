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
        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6 mb-4 sm:mb-6 lg:mb-8">
            <div className="bg-white rounded-lg shadow p-3 sm:p-4 lg:p-6">
              <div className="flex items-center justify-between mb-1 sm:mb-2">
                <Package className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 text-blue-600" />
                <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4 text-green-600" />
              </div>
              <p className="text-xs sm:text-sm text-gray-600">총 상품</p>
              <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">{stats.totalProducts}</p>
              <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1">
                활성: {stats.activeProducts}개
              </p>
            </div>

            <div className="bg-white rounded-lg shadow p-3 sm:p-4 lg:p-6">
              <div className="flex items-center justify-between mb-1 sm:mb-2">
                <ShoppingCart className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 text-green-600" />
                <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4 text-green-600" />
              </div>
              <p className="text-xs sm:text-sm text-gray-600">총 주문</p>
              <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">{formatNumber(stats.totalOrders)}</p>
              <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1">
                누적 주문 수
              </p>
            </div>

            <div className="bg-white rounded-lg shadow p-3 sm:p-4 lg:p-6">
              <div className="flex items-center justify-between mb-1 sm:mb-2">
                <DollarSign className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 text-yellow-600" />
                <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4 text-green-600" />
              </div>
              <p className="text-xs sm:text-sm text-gray-600">총 매출</p>
              <p className="text-base sm:text-xl lg:text-2xl font-bold text-gray-900">
                {formatPrice(stats.totalRevenue)}
              </p>
              <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1">
                누적 매출액
              </p>
            </div>

            <div className="bg-white rounded-lg shadow p-3 sm:p-4 lg:p-6">
              <div className="flex items-center justify-between mb-1 sm:mb-2">
                <Package className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 text-purple-600" />
              </div>
              <p className="text-xs sm:text-sm text-gray-600">재고</p>
              <p className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">{formatNumber(stats.totalStock)}</p>
              <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1">
                전체 재고 수량
              </p>
            </div>
          </div>
        )}

        {/* Sales Chart */}
        <div className="bg-white rounded-lg shadow mb-4 sm:mb-6 lg:mb-8">
          <div className="p-3 sm:p-4 lg:p-6 border-b border-gray-200">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
              <div className="flex items-center gap-2 sm:gap-3">
                <Calendar className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                <div>
                  <h2 className="text-base sm:text-lg lg:text-xl font-bold text-gray-900">매출 추이</h2>
                  <p className="text-xs sm:text-sm text-gray-600">기간별 매출 분석</p>
                </div>
              </div>
              <div className="flex gap-1 sm:gap-2">
                <button
                  onClick={() => setPeriod('daily')}
                  className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-sm sm:text-base font-medium ${
                    period === 'daily'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  일별
                </button>
                <button
                  onClick={() => setPeriod('weekly')}
                  className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-sm sm:text-base font-medium ${
                    period === 'weekly'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  주별
                </button>
                <button
                  onClick={() => setPeriod('monthly')}
                  className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-sm sm:text-base font-medium ${
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
          <div className="p-3 sm:p-4 lg:p-6">
            {salesData.length > 0 ? (
              <div className="space-y-2 sm:space-y-3 lg:space-y-4">
                {salesData.map((data, idx) => {
                  const maxSales = Math.max(...salesData.map(d => d.total_sales))
                  const percentage = (data.total_sales / maxSales) * 100

                  return (
                    <div key={idx} className="flex items-center gap-2 sm:gap-3 lg:gap-4">
                      <div className="w-16 sm:w-20 lg:w-24 text-xs sm:text-sm font-medium text-gray-700 flex-shrink-0">
                        {data.period}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="relative h-6 sm:h-7 lg:h-8 bg-gray-100 rounded-lg overflow-hidden">
                          <div
                            className="absolute inset-y-0 left-0 bg-blue-600 rounded-lg transition-all duration-500"
                            style={{ width: `${percentage}%` }}
                          />
                          <div className="absolute inset-0 flex items-center px-2 sm:px-3">
                            <span className="text-xs sm:text-sm font-medium text-gray-900 truncate">
                              {formatPrice(data.total_sales)}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="w-12 sm:w-16 lg:w-20 text-xs sm:text-sm text-gray-600 text-right flex-shrink-0">
                        {data.order_count}건
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-center py-8 sm:py-10 lg:py-12 text-sm sm:text-base text-gray-500">
                매출 데이터가 없습니다
              </div>
            )}
          </div>
        </div>

        {/* Top Products */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-3 sm:p-4 lg:p-6 border-b border-gray-200">
            <div className="flex items-center gap-2 sm:gap-3">
              <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
              <div>
                <h2 className="text-base sm:text-lg lg:text-xl font-bold text-gray-900">인기 상품 TOP 10</h2>
                <p className="text-xs sm:text-sm text-gray-600">최근 30일 기준</p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            {topProducts.length > 0 ? (
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-700 uppercase">순위</th>
                    <th className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-700 uppercase">상품</th>
                    <th className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 text-right text-[10px] sm:text-xs font-medium text-gray-700 uppercase hidden sm:table-cell">판매량</th>
                    <th className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 text-right text-[10px] sm:text-xs font-medium text-gray-700 uppercase hidden md:table-cell">주문수</th>
                    <th className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 text-right text-[10px] sm:text-xs font-medium text-gray-700 uppercase">매출액</th>
                    <th className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 text-right text-[10px] sm:text-xs font-medium text-gray-700 uppercase hidden lg:table-cell">재고</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {topProducts.map((product, idx) => (
                    <tr key={product.id} className="hover:bg-gray-50">
                      <td className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 whitespace-nowrap">
                        <div className="flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 rounded-full bg-blue-100 text-blue-700 text-xs sm:text-sm font-bold">
                          {idx + 1}
                        </div>
                      </td>
                      <td className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4">
                        <div className="flex items-center gap-2 sm:gap-3">
                          <img
                            src={product.image_url || 'https://via.placeholder.com/64'}
                            alt={product.name}
                            className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 object-cover rounded-lg flex-shrink-0"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'https://via.placeholder.com/64'
                            }}
                          />
                          <div className="min-w-0">
                            <p className="text-xs sm:text-sm font-medium text-gray-900 truncate">{product.name}</p>
                            <p className="text-[10px] sm:text-xs text-gray-500">{formatPrice(product.price)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 whitespace-nowrap text-right hidden sm:table-cell">
                        <span className="text-xs sm:text-sm font-medium text-gray-900">
                          {formatNumber(product.total_sold)}개
                        </span>
                      </td>
                      <td className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 whitespace-nowrap text-right hidden md:table-cell">
                        <span className="text-xs sm:text-sm text-gray-600">
                          {formatNumber(product.order_count)}건
                        </span>
                      </td>
                      <td className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 whitespace-nowrap text-right">
                        <span className="text-xs sm:text-sm font-bold text-green-600">
                          {formatPrice(product.total_revenue)}
                        </span>
                      </td>
                      <td className="px-2 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 whitespace-nowrap text-right hidden lg:table-cell">
                        <span className={`text-xs sm:text-sm font-medium ${
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
              <div className="text-center py-8 sm:py-10 lg:py-12 text-sm sm:text-base text-gray-500">
                판매 데이터가 없습니다
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
