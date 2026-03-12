import { useEffect, useState, lazy, Suspense } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import NotificationBell from '@/components/NotificationBell'
import { getSellerToken, isSellerAuthenticated, getSellerId, redirectToLogin, logoutSeller } from '@/lib/seller-auth'
import { 
  ArrowLeft, 
  TrendingUp,
  Package,
  DollarSign,
  Users,
  Play,
  Settings,
  ShoppingBag,
  Clock,
  Eye,
  Calendar,
  ChevronRight,
  Building2,
  LogOut,
  XCircle,
  Loader2
} from 'lucide-react'
import { 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts'

// 통합된 통계 인터페이스
interface DashboardStats {
  totalRevenue: number
  totalOrders: number
  activeStreams: number
  totalViewers: number
  pendingOrders?: number
  cancelledOrders?: number
  completedOrders?: number
  avgOrderValue?: number
}

interface DailyStats {
  date: string
  orders: number
  sales: number
  completed_orders: number
}

interface TopProduct {
  product_id: number
  product_name: string
  order_count: number
  total_quantity: number
  total_revenue: number
}

interface LiveStream {
  id: number
  title: string
  description: string
  youtube_video_id: string
  platform?: string
  thumbnail_url?: string
  status: 'scheduled' | 'live' | 'ended'
  viewer_count: number
  created_at: string
}

interface Product {
  id: number
  name: string
  price: number
  stock: number
  image_url: string
  is_active: boolean
}

export default function SellerPage() {
  const navigate = useNavigate()
  const [stats, setStats] = useState<DashboardStats>({
    totalRevenue: 0,
    totalOrders: 0,
    activeStreams: 0,
    totalViewers: 0,
    pendingOrders: 0,
    cancelledOrders: 0,
    completedOrders: 0,
    avgOrderValue: 0
  })
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([])
  const [topProducts, setTopProducts] = useState<TopProduct[]>([])
  const [streams, setStreams] = useState<LiveStream[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [sellerId, setSellerId] = useState<number | null>(null)
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('7d')

  // Mock seller info (in production, get from session)
  const sellerName = '리스터코퍼레이션 셀러'

  useEffect(() => {
    // ✅ JWT 기반 인증 확인
    if (!isSellerAuthenticated()) {
      console.log('[SellerPage] ❌ Not authenticated')
      redirectToLogin(navigate)
      return
    }
    
    console.log('[SellerPage] ✅ Authenticated as seller')
    
    const token = getSellerToken()
    const sellerIdStr = getSellerId()
    
    console.log('[SellerPage] ✅ JWT Auth success:', {
      hasToken: !!token,
      sellerId: sellerIdStr,
      userType: localStorage.getItem('user_type')
    })
    
    loadDashboardData()
  }, [navigate, period])

  async function loadDashboardData() {
    try {
      setLoading(true)
      const token = getSellerToken()
      const userId = getSellerId()
      
      if (userId) {
        setSellerId(parseInt(userId))
      }

      // ⚡ 병렬 API 호출로 속도 향상
      const [dashboardResponse, streamsResponse] = await Promise.allSettled([
        token ? api.get(`/api/seller/dashboard/stats?period=${period}`).catch(err => {
          console.error('Failed to load dashboard stats:', err)
          return { data: { success: false } }
        }) : Promise.resolve({ data: { success: false } }),
        api.get('/api/seller/streams')
      ])

      // Dashboard stats 처리 (통합 API)
      if (dashboardResponse.status === 'fulfilled' && dashboardResponse.value.data.success) {
        const data = dashboardResponse.value.data.data
        
        // 기존 stats + 추가 stats 통합
        setStats({
          totalRevenue: data.summary?.total_sales || 0,
          totalOrders: data.summary?.total_orders || 0,
          activeStreams: 0, // 스트림에서 계산
          totalViewers: 0, // 스트림에서 계산
          pendingOrders: data.summary?.pending_orders || 0,
          cancelledOrders: data.summary?.cancelled_orders || 0,
          completedOrders: data.summary?.completed_orders || 0,
          avgOrderValue: data.summary?.avg_order_value || 0
        })
        
        setDailyStats(data.daily || [])
        setTopProducts(data.topProducts || [])
      } else {
        // Fallback to old API
        const oldStatsResponse = await api.get('/api/seller/stats').catch(() => ({ data: { success: false } }))
        if (oldStatsResponse.data.success) {
          setStats({
            ...oldStatsResponse.data.data,
            pendingOrders: 0,
            cancelledOrders: 0,
            completedOrders: 0,
            avgOrderValue: 0
          })
        }
      }

      // Streams 처리
      let loadedStreams: LiveStream[] = []
      if (streamsResponse.status === 'fulfilled' && streamsResponse.value.data.success) {
        loadedStreams = streamsResponse.value.data.data || []
        setStreams(loadedStreams)
        
        // 활성 라이브 및 시청자 수 계산
        const activeCount = loadedStreams.filter(s => s.status === 'live').length
        const totalViewers = loadedStreams.reduce((sum, s) => sum + (s.viewer_count || 0), 0)
        
        setStats(prev => ({
          ...prev,
          activeStreams: activeCount,
          totalViewers: totalViewers
        }))
      }

      // Products 처리 (첫 스트림에서만 로드)
      if (loadedStreams.length > 0) {
        const firstStream = loadedStreams[0]
        try {
          const productsResponse = await api.get(`/api/streams/${firstStream.id}/products`)
          if (productsResponse.data.success) {
            setProducts(productsResponse.data.data || [])
          }
        } catch (error) {
          console.error('Failed to load products:', error)
          setProducts([])
        }
      } else {
        setProducts([])
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  function logout() {
    logoutSeller(navigate)
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
      <div className="min-h-screen bg-[#fbfbfd] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#007aff] mx-auto mb-4"></div>
          <p className="text-[17px] text-[#6e6e73]">대시보드 로딩 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#fbfbfd]">
      {/* Header */}
      <header className="apple-glass sticky top-0 z-50 border-b border-[#e5e5ea]">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6">
          <div className="flex h-[52px] items-center justify-between">
            <Link 
              to="/"
              className="flex items-center space-x-2 text-[#1d1d1f] hover:opacity-60 transition-opacity"
            >
              <ArrowLeft className="h-5 w-5" />
              <span className="text-[14px] font-normal hidden sm:inline">홈으로</span>
            </Link>
            <h1 className="text-[17px] font-semibold text-[#1d1d1f]">
              셀러 대시보드
            </h1>
            <div className="flex items-center gap-3">
              <NotificationBell userType="seller" />
              <button 
                onClick={() => navigate('/seller/live-control')}
                className="flex items-center gap-1.5 text-[#007aff] hover:opacity-60 transition-opacity"
                title="라이브 컨트롤"
              >
                <Play className="h-5 w-5" />
                <span className="text-[14px] font-medium hidden sm:inline">라이브 컨트롤</span>
              </button>
              <button 
                onClick={() => navigate('/seller/profile')}
                className="text-[#1d1d1f] hover:opacity-60 transition-opacity"
                title="프로필 편집"
              >
                <Settings className="h-5 w-5" />
              </button>
              <button 
                onClick={logout}
                className="flex items-center gap-1.5 text-[#ff3b30] hover:opacity-60 transition-opacity"
                title="로그아웃"
              >
                <LogOut className="h-4 w-4" />
                <span className="text-[14px] font-medium hidden sm:inline">로그아웃</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1280px] mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Welcome Section + Period Selector */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h2 className="text-[28px] sm:text-[32px] font-bold text-[#1d1d1f] mb-2">
                안녕하세요, {sellerName}님! 👋
              </h2>
              <p className="text-[15px] sm:text-[17px] text-[#6e6e73]">
                오늘도 성공적인 라이브 쇼핑을 시작해보세요
              </p>
            </div>
            
            {/* Period Selector */}
            <div className="flex gap-2">
              <button
                onClick={() => setPeriod('7d')}
                className={`px-4 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                  period === '7d'
                    ? 'bg-[#007aff] text-white'
                    : 'apple-card text-[#1d1d1f] hover:shadow-md'
                }`}
              >
                최근 7일
              </button>
              <button
                onClick={() => setPeriod('30d')}
                className={`px-4 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                  period === '30d'
                    ? 'bg-[#007aff] text-white'
                    : 'apple-card text-[#1d1d1f] hover:shadow-md'
                }`}
              >
                최근 30일
              </button>
              <button
                onClick={() => setPeriod('90d')}
                className={`px-4 py-2 rounded-lg text-[13px] font-medium transition-colors ${
                  period === '90d'
                    ? 'bg-[#007aff] text-white'
                    : 'apple-card text-[#1d1d1f] hover:shadow-md'
                }`}
              >
                최근 90일
              </button>
            </div>
          </div>
        </div>

        {/* Stats Grid - 확장 (6개) */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-8">
          <div className="apple-card p-4 sm:p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-[#34c759]/10 rounded-full flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-[#34c759]" />
              </div>
              <TrendingUp className="h-4 w-4 text-[#34c759]" />
            </div>
            <p className="text-[13px] text-[#6e6e73] mb-1">총 매출</p>
            <p className="text-[21px] sm:text-[24px] font-bold text-[#1d1d1f]">
              {formatPrice(stats.totalRevenue)}
            </p>
            {(stats.avgOrderValue ?? 0) > 0 && (
              <p className="text-[11px] text-[#6e6e73] mt-1">
                평균 {formatPrice(stats.avgOrderValue ?? 0)}/건
              </p>
            )}
          </div>

          <div className="apple-card p-4 sm:p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-[#007aff]/10 rounded-full flex items-center justify-center">
                <ShoppingBag className="h-5 w-5 text-[#007aff]" />
              </div>
              <TrendingUp className="h-4 w-4 text-[#007aff]" />
            </div>
            <p className="text-[13px] text-[#6e6e73] mb-1">총 주문</p>
            <p className="text-[21px] sm:text-[24px] font-bold text-[#1d1d1f]">
              {formatNumber(stats.totalOrders)}건
            </p>
            {(stats.completedOrders ?? 0) > 0 && (
              <p className="text-[11px] text-[#34c759] mt-1">
                완료 {formatNumber(stats.completedOrders ?? 0)}건
              </p>
            )}
          </div>

          <div className="apple-card p-4 sm:p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-[#ff3b30]/10 rounded-full flex items-center justify-center">
                <Play className="h-5 w-5 text-[#ff3b30]" />
              </div>
              <Badge className="bg-[#ff3b30] text-white border-0 px-2 py-0.5">
                <span className="text-[11px] font-semibold">LIVE</span>
              </Badge>
            </div>
            <p className="text-[13px] text-[#6e6e73] mb-1">활성 라이브</p>
            <p className="text-[21px] sm:text-[24px] font-bold text-[#1d1d1f]">
              {stats.activeStreams || 0}개
            </p>
          </div>

          <div className="apple-card p-4 sm:p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-[#ff9500]/10 rounded-full flex items-center justify-center">
                <Users className="h-5 w-5 text-[#ff9500]" />
              </div>
              <Eye className="h-4 w-4 text-[#ff9500]" />
            </div>
            <p className="text-[13px] text-[#6e6e73] mb-1">총 시청자</p>
            <p className="text-[21px] sm:text-[24px] font-bold text-[#1d1d1f]">
              {formatNumber(stats.totalViewers)}명
            </p>
          </div>

          <div className="apple-card p-4 sm:p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-[#ffcc00]/10 rounded-full flex items-center justify-center">
                <Clock className="h-5 w-5 text-[#ffcc00]" />
              </div>
            </div>
            <p className="text-[13px] text-[#6e6e73] mb-1">대기 중</p>
            <p className="text-[21px] sm:text-[24px] font-bold text-[#1d1d1f]">
              {formatNumber(stats.pendingOrders || 0)}건
            </p>
            <p className="text-[11px] text-[#6e6e73] mt-1">
              처리 필요
            </p>
          </div>

          <div className="apple-card p-4 sm:p-6">
            <div className="flex items-center justify-between mb-3">
              <div className="w-10 h-10 bg-[#ff3b30]/10 rounded-full flex items-center justify-center">
                <XCircle className="h-5 w-5 text-[#ff3b30]" />
              </div>
            </div>
            <p className="text-[13px] text-[#6e6e73] mb-1">취소</p>
            <p className="text-[21px] sm:text-[24px] font-bold text-[#1d1d1f]">
              {formatNumber(stats.cancelledOrders || 0)}건
            </p>
            {stats.totalOrders > 0 && (
              <p className="text-[11px] text-[#6e6e73] mt-1">
                취소율 {((stats.cancelledOrders || 0) / stats.totalOrders * 100).toFixed(1)}%
              </p>
            )}
          </div>
        </div>

        {/* Charts Section */}
        {dailyStats.length > 0 && (
          <div className="mb-8">
            {/* Sales Trend Chart */}
            <div className="apple-card p-4 sm:p-6 mb-6">
              <h2 className="text-[17px] sm:text-[19px] font-semibold text-[#1d1d1f] mb-4 flex items-center gap-2">
                <Calendar className="h-5 w-5 text-[#007aff]" />
                일별 매출 추이
              </h2>
              
              <div className="w-full overflow-x-auto -mx-4 sm:-mx-6 px-4 sm:px-6">
                <div className="min-w-[300px]">
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={dailyStats} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="date" 
                        tick={{ fontSize: 10 }}
                        tickFormatter={(value) => {
                          const date = new Date(value)
                          return `${date.getMonth() + 1}/${date.getDate()}`
                        }}
                      />
                      <YAxis 
                        yAxisId="left"
                        tick={{ fontSize: 10 }}
                        tickFormatter={(value) => formatShortPrice(value)}
                      />
                      <YAxis 
                        yAxisId="right" 
                        orientation="right"
                        tick={{ fontSize: 10 }}
                      />
                      <Tooltip 
                        // @ts-ignore - recharts formatter type
                        formatter={(value: any, name: string) => {
                          if (name === '매출액') return formatPrice(value)
                          return formatNumber(value)
                        }}
                        labelFormatter={(label) => {
                          const date = new Date(label)
                          return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: '12px' }} />
                      <Line 
                        yAxisId="left"
                        type="monotone" 
                        dataKey="sales" 
                        stroke="#3B82F6" 
                        strokeWidth={2}
                        name="매출액"
                        dot={{ r: 2 }}
                        activeDot={{ r: 4 }}
                      />
                      <Line 
                        yAxisId="right"
                        type="monotone" 
                        dataKey="orders" 
                        stroke="#10B981" 
                        strokeWidth={2}
                        name="주문 수"
                        dot={{ r: 2 }}
                        activeDot={{ r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Top Products Chart */}
            {topProducts.length > 0 && (
              <div className="apple-card p-4 sm:p-6">
                <h2 className="text-[17px] sm:text-[19px] font-semibold text-[#1d1d1f] mb-4 flex items-center gap-2">
                  <Package className="h-5 w-5 text-[#5856d6]" />
                  상품별 매출 Top 5
                </h2>
                
                <div className="w-full overflow-x-auto -mx-4 sm:-mx-6 px-4 sm:px-6 mb-6">
                  <div className="min-w-[300px]">
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={topProducts.slice(0, 5)} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis 
                          dataKey="product_name" 
                          tick={{ fontSize: 10 }}
                          angle={-15}
                          textAnchor="end"
                          height={70}
                        />
                        <YAxis 
                          tick={{ fontSize: 10 }}
                          tickFormatter={(value) => formatShortPrice(value)}
                        />
                        <Tooltip 
                          formatter={(value: any) => formatPrice(value)}
                        />
                        <Legend wrapperStyle={{ fontSize: '12px' }} />
                        <Bar dataKey="total_revenue" fill="#8B5CF6" name="매출액" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Product Table */}
                <div className="overflow-x-auto -mx-4 sm:-mx-6">
                  <table className="w-full min-w-[500px]">
                    <thead className="bg-[#f5f5f7]">
                      <tr>
                        <th className="px-3 py-2 text-left text-[11px] font-medium text-[#6e6e73] uppercase">순위</th>
                        <th className="px-3 py-2 text-left text-[11px] font-medium text-[#6e6e73] uppercase">상품명</th>
                        <th className="px-3 py-2 text-right text-[11px] font-medium text-[#6e6e73] uppercase">주문</th>
                        <th className="px-3 py-2 text-right text-[11px] font-medium text-[#6e6e73] uppercase">판매량</th>
                        <th className="px-3 py-2 text-right text-[11px] font-medium text-[#6e6e73] uppercase">매출액</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#e5e5ea]">
                      {topProducts.map((product, index) => (
                        <tr key={product.product_id} className="hover:bg-[#f5f5f7]/50">
                          <td className="px-3 py-3 text-[13px] font-medium text-[#1d1d1f]">
                            {index + 1}
                          </td>
                          <td className="px-3 py-3 text-[13px] text-[#1d1d1f] max-w-[150px] truncate">
                            {product.product_name}
                          </td>
                          <td className="px-3 py-3 text-[13px] text-[#1d1d1f] text-right whitespace-nowrap">
                            {formatNumber(product.order_count)}건
                          </td>
                          <td className="px-3 py-3 text-[13px] text-[#1d1d1f] text-right whitespace-nowrap">
                            {formatNumber(product.total_quantity)}개
                          </td>
                          <td className="px-3 py-3 text-[13px] font-medium text-[#1d1d1f] text-right whitespace-nowrap">
                            {formatPrice(product.total_revenue)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Quick Access Section */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <button
            onClick={() => navigate('/seller/live-broadcast')}
            className="apple-card p-4 hover:shadow-lg transition-all text-left bg-gradient-to-br from-red-50 to-orange-50"
          >
            <div className="w-10 h-10 bg-red-600/10 rounded-full flex items-center justify-center mb-3">
              <Play className="h-5 w-5 text-red-600" />
            </div>
            <p className="text-[15px] font-semibold text-[#1d1d1f] mb-1">🔴 YouTube 라이브</p>
            <p className="text-[13px] text-[#6e6e73]">원클릭 방송 시작</p>
          </button>

          <button
            onClick={() => navigate('/seller/live-control')}
            className="apple-card p-4 hover:shadow-lg transition-all text-left"
          >
            <div className="w-10 h-10 bg-[#ff3b30]/10 rounded-full flex items-center justify-center mb-3">
              <Play className="h-5 w-5 text-[#ff3b30]" />
            </div>
            <p className="text-[15px] font-semibold text-[#1d1d1f] mb-1">라이브 컨트롤</p>
            <p className="text-[13px] text-[#6e6e73]">상품 실시간 전환</p>
          </button>

          <button
            onClick={() => navigate('/seller/business-info')}
            className="apple-card p-4 hover:shadow-lg transition-all text-left"
          >
            <div className="w-10 h-10 bg-[#5856d6]/10 rounded-full flex items-center justify-center mb-3">
              <Building2 className="h-5 w-5 text-[#5856d6]" />
            </div>
            <p className="text-[15px] font-semibold text-[#1d1d1f] mb-1">사업자 정보</p>
            <p className="text-[13px] text-[#6e6e73]">정보 등록 및 관리</p>
          </button>

          <button
            onClick={() => navigate('/seller/orders')}
            className="apple-card p-4 hover:shadow-lg transition-all text-left"
          >
            <div className="w-10 h-10 bg-[#ff9500]/10 rounded-full flex items-center justify-center mb-3">
              <Package className="h-5 w-5 text-[#ff9500]" />
            </div>
            <p className="text-[15px] font-semibold text-[#1d1d1f] mb-1">주문 관리</p>
            <p className="text-[13px] text-[#6e6e73]">주문 확인 및 배송</p>
          </button>

          <button
            onClick={() => navigate('/seller/products')}
            className="apple-card p-4 hover:shadow-lg transition-all text-left"
          >
            <div className="w-10 h-10 bg-[#34c759]/10 rounded-full flex items-center justify-center mb-3">
              <ShoppingBag className="h-5 w-5 text-[#34c759]" />
            </div>
            <p className="text-[15px] font-semibold text-[#1d1d1f] mb-1">상품 관리</p>
            <p className="text-[13px] text-[#6e6e73]">상품 등록 및 수정</p>
          </button>

          <button
            onClick={() => navigate('/seller/settlements')}
            className="apple-card p-4 hover:shadow-lg transition-all text-left bg-gradient-to-br from-emerald-50 to-green-50"
          >
            <div className="w-10 h-10 bg-emerald-600/10 rounded-full flex items-center justify-center mb-3">
              <DollarSign className="h-5 w-5 text-emerald-600" />
            </div>
            <p className="text-[15px] font-semibold text-[#1d1d1f] mb-1">💰 정산 관리</p>
            <p className="text-[13px] text-[#6e6e73]">수익 정산 조회</p>
          </button>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Live Streams Section */}
          <section>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-[21px] font-semibold text-[#1d1d1f]">
                내 라이브 스트림
              </h3>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => navigate('/seller/streams/new')}
                  className="text-[15px] text-[#007aff] font-medium hover:opacity-60 transition-opacity"
                >
                  + 새 라이브
                </button>
                {streams.length > 3 && (
                  <button 
                    onClick={() => navigate('/seller/streams')}
                    className="text-[15px] text-[#007aff] font-medium hover:opacity-60 transition-opacity flex items-center"
                  >
                    더보기
                    <ChevronRight className="h-4 w-4 ml-0.5" />
                  </button>
                )}
              </div>
            </div>

            {streams.length === 0 ? (
              <div className="apple-card p-12 text-center">
                <div className="w-16 h-16 bg-[#f5f5f7] rounded-full flex items-center justify-center mx-auto mb-4">
                  <Play className="h-10 w-10 text-[#6e6e73]" />
                </div>
                <p className="text-[15px] text-[#6e6e73] mb-4">
                  라이브가 없습니다
                </p>
                <button 
                  onClick={() => navigate('/seller/streams/new')}
                  className="apple-button px-6 py-2.5"
                >
                  라이브 시작하기
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {streams.slice(0, 3).map(stream => (
                  <div key={stream.id} className="apple-card p-4 hover:shadow-lg transition-shadow">
                    <div className="flex gap-4">
                      {stream.thumbnail_url ? (
                        <img
                          src={stream.thumbnail_url}
                          alt={stream.title}
                          className="w-24 h-24 rounded-xl object-cover flex-shrink-0"
                          loading="lazy"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                          }}
                        />
                      ) : (
                        <img
                          src={`https://img.youtube.com/vi/${stream.youtube_video_id}/mqdefault.jpg`}
                          alt={stream.title}
                          className="w-24 h-24 rounded-xl object-cover flex-shrink-0"
                          loading="lazy"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.style.display = 'none';
                          }}
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="text-[15px] font-semibold text-[#1d1d1f] line-clamp-1">
                            {stream.title}
                          </h4>
                          <Badge 
                            className={`
                              border-0 px-2 py-0.5 ml-2 flex-shrink-0
                              ${stream.status === 'live' 
                                ? 'bg-[#ff3b30] text-white' 
                                : stream.status === 'scheduled'
                                ? 'bg-[#ff9500] text-white'
                                : 'bg-[#8e8e93] text-white'
                              }
                            `}
                          >
                            <span className="text-[11px] font-semibold">
                              {stream.status === 'live' 
                                ? 'LIVE' 
                                : stream.status === 'scheduled'
                                ? '예정'
                                : '종료'
                              }
                            </span>
                          </Badge>
                        </div>
                        <p className="text-[13px] text-[#6e6e73] mb-2 line-clamp-1">
                          {stream.description || '설명 없음'}
                        </p>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4 text-[13px] text-[#6e6e73]">
                            <div className="flex items-center gap-1">
                              <Eye className="h-3.5 w-3.5" />
                              {(stream.viewer_count || 0).toLocaleString()}
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5" />
                              {new Date(stream.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                            </div>
                          </div>
                          <button 
                            onClick={() => navigate(`/seller/streams/${stream.id}`)}
                            className="text-[13px] text-[#007aff] font-medium hover:opacity-60 transition-opacity flex items-center"
                          >
                            관리
                            <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Products Section */}
          <section>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-[21px] font-semibold text-[#1d1d1f]">
                상품 관리
              </h3>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => navigate('/seller/products/new')}
                  className="text-[15px] text-[#007aff] font-medium hover:opacity-60 transition-opacity"
                >
                  + 상품 추가
                </button>
                {products.length > 3 && (
                  <button 
                    onClick={() => navigate('/seller/products')}
                    className="text-[15px] text-[#007aff] font-medium hover:opacity-60 transition-opacity flex items-center"
                  >
                    더보기
                    <ChevronRight className="h-4 w-4 ml-0.5" />
                  </button>
                )}
              </div>
            </div>

            {products.length === 0 ? (
              <div className="apple-card p-12 text-center">
                <div className="w-16 h-16 bg-[#f5f5f7] rounded-full flex items-center justify-center mx-auto mb-4">
                  <Package className="h-10 w-10 text-[#6e6e73]" />
                </div>
                <p className="text-[15px] text-[#6e6e73] mb-4">
                  등록된 상품이 없습니다
                </p>
                <button 
                  onClick={() => navigate('/seller/products/new')}
                  className="apple-button px-6 py-2.5"
                >
                  상품 추가하기
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {products.slice(0, 3).map(product => (
                  <div key={product.id} className="apple-card p-4 hover:shadow-lg transition-shadow">
                    <div className="flex gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="text-[15px] font-semibold text-[#1d1d1f] line-clamp-1">
                            {product.name}
                          </h4>
                          {product.is_active ? (
                            <Badge className="bg-[#34c759] text-white border-0 px-2 py-0.5 ml-2 flex-shrink-0">
                              <span className="text-[11px] font-semibold">판매중</span>
                            </Badge>
                          ) : (
                            <Badge className="bg-[#8e8e93] text-white border-0 px-2 py-0.5 ml-2 flex-shrink-0">
                              <span className="text-[11px] font-semibold">품절</span>
                            </Badge>
                          )}
                        </div>
                        <p className="text-[17px] font-bold text-[#1d1d1f] mb-2">
                          {(product.price || 0).toLocaleString()}원
                        </p>
                        <div className="flex items-center justify-between">
                          <div className={`
                            text-[13px] font-medium
                            ${product.stock > 10 
                              ? 'text-[#34c759]' 
                              : product.stock > 0 
                              ? 'text-[#ff9500]' 
                              : 'text-[#ff3b30]'
                            }
                          `}>
                            {product.stock > 0 
                              ? `재고 ${product.stock}개` 
                              : '품절'
                            }
                          </div>
                          <button 
                            onClick={() => navigate(`/seller/products/${product.id}/edit`)}
                            className="text-[13px] text-[#007aff] font-medium hover:opacity-60 transition-opacity flex items-center"
                          >
                            수정
                            <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  )
}
