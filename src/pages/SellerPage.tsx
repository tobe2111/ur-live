import { useEffect, useState, useRef, useCallback } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import api from '@/lib/api'
import {
  LayoutDashboard, Package, ShoppingBag, Play, DollarSign,
  Bell, Settings, LogOut, TrendingUp, Users, Eye, Clock,
  ChevronRight, RefreshCw, ArrowUpRight, Menu, X,
  AlertCircle, CheckCircle2, Truck, XCircle, Building2
} from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer
} from 'recharts'
import { getSellerToken, isSellerAuthenticated, getSellerId, redirectToLogin, logoutSeller } from '@/lib/seller-auth'

// ─── Types ───────────────────────────────────────────────────────────────────
interface DashboardStats {
  totalRevenue: number
  totalOrders: number
  activeStreams: number
  totalViewers: number
  pendingOrders: number
  cancelledOrders: number
  completedOrders: number
  avgOrderValue: number
}

interface DailyStats {
  date: string
  orders: number
  sales: number
}

interface TopProduct {
  product_id: number
  product_name: string
  order_count: number
  total_revenue: number
}

interface Order {
  id: number
  order_number: string
  user_name: string
  user_email: string
  total_amount: number
  status: string
  shipping_name: string
  shipping_phone: string
  payment_method: string
  created_at: string
}

interface LiveStream {
  id: number
  title: string
  status: 'scheduled' | 'live' | 'ended'
  viewer_count: number
  created_at: string
  youtube_video_id: string
}

// ─── Constants ───────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  PENDING:   { label: '결제대기', color: '#D97706', bg: '#FEF3C7', icon: <Clock className="w-3 h-3" /> },
  DONE:      { label: '결제완료', color: '#2563EB', bg: '#DBEAFE', icon: <CheckCircle2 className="w-3 h-3" /> },
  PAID:      { label: '결제완료', color: '#2563EB', bg: '#DBEAFE', icon: <CheckCircle2 className="w-3 h-3" /> },
  PREPARING: { label: '준비중',   color: '#7C3AED', bg: '#EDE9FE', icon: <Package className="w-3 h-3" /> },
  SHIPPING:  { label: '배송중',   color: '#0891B2', bg: '#CFFAFE', icon: <Truck className="w-3 h-3" /> },
  DELIVERED: { label: '배송완료', color: '#059669', bg: '#D1FAE5', icon: <CheckCircle2 className="w-3 h-3" /> },
  CANCELLED: { label: '취소',     color: '#DC2626', bg: '#FEE2E2', icon: <XCircle className="w-3 h-3" /> },
}

const NAV_ITEMS = [
  { path: '/seller',              label: '대시보드',    icon: LayoutDashboard, exact: true },
  { path: '/seller/orders',       label: '주문 관리',   icon: ShoppingBag },
  { path: '/seller/products',     label: '상품 관리',   icon: Package },
  { path: '/seller/supply',       label: '공급 상품',   icon: Truck },
  { path: '/seller/live-control', label: '라이브 스트림', icon: Play },
  { path: '/seller/settlements',  label: '정산',        icon: DollarSign },
  { path: '/seller/alimtalk',     label: '알림톡',      icon: Bell },
  { path: '/seller/business-info',label: '사업자 정보',  icon: Building2 },
]

// ─── Component ───────────────────────────────────────────────────────────────
export default function SellerPage() {
  const navigate = useNavigate()
  const location = useLocation()

  // Stats
  const [stats, setStats] = useState<DashboardStats>({
    totalRevenue: 0, totalOrders: 0, activeStreams: 0, totalViewers: 0,
    pendingOrders: 0, cancelledOrders: 0, completedOrders: 0, avgOrderValue: 0
  })
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([])
  const [topProducts, setTopProducts] = useState<TopProduct[]>([])
  const [streams, setStreams] = useState<LiveStream[]>([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('7d')

  // Real-time orders
  const [recentOrders, setRecentOrders] = useState<Order[]>([])
  const [newOrderIds, setNewOrderIds] = useState<Set<number>>(new Set())
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  const [ordersRefreshing, setOrdersRefreshing] = useState(false)
  const lastMaxIdRef = useRef<number>(0)
  const newOrderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // UI state
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const sellerName = localStorage.getItem('seller_name') || '셀러'

  // ── Auth ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isSellerAuthenticated()) {
      redirectToLogin(navigate)
      return
    }
    loadDashboardData()
  }, [navigate, period])

  // ── Real-time orders polling ───────────────────────────────────────────────
  const pollOrders = useCallback(async (isManual = false) => {
    if (isManual) setOrdersRefreshing(true)
    try {
      const resp = await api.get('/api/seller/orders?limit=10&sort=desc', {
        headers: { Authorization: `Bearer ${getSellerToken()}` }
      })
      if (resp.data.success) {
        const orders: Order[] = resp.data.data || []
        setRecentOrders(orders)
        setLastUpdated(new Date())

        if (orders.length > 0) {
          const maxId = Math.max(...orders.map(o => o.id))
          if (lastMaxIdRef.current > 0 && maxId > lastMaxIdRef.current) {
            const newIds = new Set(orders.filter(o => o.id > lastMaxIdRef.current).map(o => o.id))
            setNewOrderIds(newIds)
            if (newOrderTimerRef.current) clearTimeout(newOrderTimerRef.current)
            newOrderTimerRef.current = setTimeout(() => setNewOrderIds(new Set()), 12000)
          }
          lastMaxIdRef.current = maxId
        }
      }
    } catch {
      // silent fail
    } finally {
      if (isManual) setOrdersRefreshing(false)
    }
  }, [])

  useEffect(() => {
    pollOrders()
    const interval = setInterval(() => pollOrders(), 30000)
    return () => {
      clearInterval(interval)
      if (newOrderTimerRef.current) clearTimeout(newOrderTimerRef.current)
    }
  }, [pollOrders])

  // ── Dashboard data ─────────────────────────────────────────────────────────
  async function loadDashboardData() {
    try {
      setLoading(true)
      const token = getSellerToken()
      const headers = token ? { Authorization: `Bearer ${token}` } : {}

      const [dashRes, streamsRes] = await Promise.allSettled([
        api.get(`/api/seller/dashboard/stats?period=${period}`, { headers }),
        api.get('/api/seller/streams', { headers })
      ])

      if (dashRes.status === 'fulfilled' && dashRes.value.data.success) {
        const d = dashRes.value.data.data
        setStats({
          totalRevenue:    d.summary?.total_sales      || 0,
          totalOrders:     d.summary?.total_orders     || 0,
          activeStreams:    0,
          totalViewers:    0,
          pendingOrders:   d.summary?.pending_orders   || 0,
          cancelledOrders: d.summary?.cancelled_orders || 0,
          completedOrders: d.summary?.completed_orders || 0,
          avgOrderValue:   d.summary?.avg_order_value  || 0,
        })
        setDailyStats(d.daily || [])
        setTopProducts(d.topProducts || [])
      }

      if (streamsRes.status === 'fulfilled' && streamsRes.value.data.success) {
        const s: LiveStream[] = streamsRes.value.data.data || []
        setStreams(s)
        setStats(prev => ({
          ...prev,
          activeStreams: s.filter(x => x.status === 'live').length,
          totalViewers:  s.reduce((sum, x) => sum + (x.viewer_count || 0), 0),
        }))
      }
    } catch {
      // silent fail
    } finally {
      setLoading(false)
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  function fmtPrice(n: number) {
    return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(n || 0)
  }
  function fmtShort(n: number) {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
    return String(n)
  }
  function timeAgo(date: Date) {
    const s = Math.floor((Date.now() - date.getTime()) / 1000)
    if (s < 60) return `${s}초 전`
    if (s < 3600) return `${Math.floor(s / 60)}분 전`
    return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
  }
  function isActive(path: string, exact?: boolean) {
    return exact ? location.pathname === path : location.pathname.startsWith(path)
  }

  // ── Sidebar ────────────────────────────────────────────────────────────────
  const Sidebar = () => (
    <aside className="w-52 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col h-full">
      {/* Workspace */}
      <div className="px-4 pt-5 pb-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white text-sm font-bold">
            {sellerName.charAt(0)}
          </div>
          <div className="min-w-0">
            <p className="text-xs text-gray-400">워크스페이스</p>
            <p className="text-sm font-semibold text-gray-800 truncate">{sellerName}</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ path, label, icon: Icon, exact }) => {
          const active = isActive(path, exact)
          return (
            <Link
              key={path}
              to={path}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
              {label === '주문 관리' && (stats.pendingOrders || 0) > 0 && (
                <span className={`ml-auto text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                  active ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-700'
                }`}>
                  {stats.pendingOrders}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Bottom */}
      <div className="px-3 py-4 border-t border-gray-100 space-y-0.5">
        <Link
          to="/seller/profile"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
        >
          <Settings className="w-4 h-4" />
          설정
        </Link>
        <button
          onClick={() => logoutSeller(navigate)}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-500 hover:bg-red-50 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          로그아웃
        </button>
      </div>
    </aside>
  )

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F4F5F7]">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">대시보드 불러오는 중...</p>
        </div>
      </div>
    )
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen overflow-hidden bg-[#F4F5F7]">

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Desktop sidebar */}
      <div className="hidden lg:flex">
        <Sidebar />
      </div>

      {/* Mobile sidebar drawer */}
      <div className={`fixed inset-y-0 left-0 z-50 lg:hidden transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <Sidebar />
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Top bar */}
        <header className="bg-white border-b border-gray-200 px-6 h-14 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden p-1.5 rounded-lg hover:bg-gray-100"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <div>
              <h1 className="text-base font-semibold text-gray-900">대시보드</h1>
              <p className="text-xs text-gray-400 hidden sm:block">안녕하세요, {sellerName}님</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Period selector */}
            <div className="hidden sm:flex items-center bg-gray-100 rounded-lg p-1 gap-1">
              {(['7d', '30d', '90d'] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                    period === p ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {p === '7d' ? '7일' : p === '30d' ? '30일' : '90일'}
                </button>
              ))}
            </div>
            <button
              onClick={() => navigate('/seller/live-broadcast')}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Play className="w-3.5 h-3.5" />
              라이브 시작
            </button>
          </div>
        </header>

        {/* Scrollable content */}
        <main className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* ── Stats row ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                label: '총 매출', value: fmtPrice(stats.totalRevenue),
                sub: stats.avgOrderValue > 0 ? `평균 ${fmtPrice(stats.avgOrderValue)}/건` : undefined,
                icon: <TrendingUp className="w-5 h-5" />, color: 'text-emerald-600', bg: 'bg-emerald-50'
              },
              {
                label: '총 주문', value: `${(stats.totalOrders || 0).toLocaleString()}건`,
                sub: stats.completedOrders > 0 ? `완료 ${stats.completedOrders.toLocaleString()}건` : undefined,
                icon: <ShoppingBag className="w-5 h-5" />, color: 'text-blue-600', bg: 'bg-blue-50'
              },
              {
                label: '대기 주문', value: `${(stats.pendingOrders || 0).toLocaleString()}건`,
                sub: '처리 필요',
                icon: <AlertCircle className="w-5 h-5" />, color: 'text-amber-600', bg: 'bg-amber-50'
              },
              {
                label: '활성 라이브', value: `${stats.activeStreams || 0}개`,
                sub: stats.totalViewers > 0 ? `시청자 ${stats.totalViewers.toLocaleString()}명` : '방송 없음',
                icon: <Play className="w-5 h-5" />, color: 'text-red-500', bg: 'bg-red-50'
              },
            ].map(card => (
              <div key={card.label} className="bg-white rounded-xl p-4 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-gray-500">{card.label}</span>
                  <div className={`w-8 h-8 rounded-lg ${card.bg} ${card.color} flex items-center justify-center`}>
                    {card.icon}
                  </div>
                </div>
                <p className="text-xl font-bold text-gray-900 mb-0.5">{card.value}</p>
                {card.sub && <p className="text-xs text-gray-400">{card.sub}</p>}
              </div>
            ))}
          </div>

          {/* ── Main grid ── */}
          <div className="grid lg:grid-cols-3 gap-5">

            {/* ── Real-time orders (col-span-2) ── */}
            <div className="lg:col-span-2 bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-semibold text-gray-900">실시간 주문</h2>
                  {newOrderIds.size > 0 && (
                    <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full animate-pulse">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                      새 주문 {newOrderIds.size}건
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">{timeAgo(lastUpdated)} 업데이트</span>
                  <button
                    onClick={() => pollOrders(true)}
                    disabled={ordersRefreshing}
                    className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                    title="새로고침"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 text-gray-400 ${ordersRefreshing ? 'animate-spin' : ''}`} />
                  </button>
                  <Link
                    to="/seller/orders"
                    className="flex items-center gap-1 text-xs text-blue-600 font-medium hover:underline"
                  >
                    전체보기 <ArrowUpRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>

              {recentOrders.length === 0 ? (
                <div className="py-16 text-center">
                  <ShoppingBag className="w-10 h-10 text-gray-200 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">아직 주문이 없어요</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[540px]">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">주문번호</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">구매자</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">금액</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">상태</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">주문시각</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {recentOrders.map(order => {
                        const isNew = newOrderIds.has(order.id)
                        const sc = STATUS_CONFIG[order.status] || { label: order.status, color: '#6B7280', bg: '#F3F4F6', icon: null }
                        return (
                          <tr
                            key={order.id}
                            className={`transition-colors ${isNew ? 'bg-emerald-50/60' : 'hover:bg-gray-50'}`}
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-1.5">
                                {isNew && (
                                  <span className="text-[10px] font-bold text-white bg-emerald-500 px-1.5 py-0.5 rounded-full leading-none">
                                    NEW
                                  </span>
                                )}
                                <span className="text-xs font-mono text-gray-700">
                                  #{order.order_number?.slice(-8) || order.id}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <p className="text-xs font-medium text-gray-800">{order.shipping_name || order.user_name || '-'}</p>
                              <p className="text-xs text-gray-400 truncate max-w-[120px]">{order.user_email || ''}</p>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span className="text-sm font-semibold text-gray-900">
                                {fmtPrice(order.total_amount)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span
                                className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full"
                                style={{ color: sc.color, backgroundColor: sc.bg }}
                              >
                                {sc.icon}
                                {sc.label}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right text-xs text-gray-400">
                              {new Date(order.created_at).toLocaleString('ko-KR', {
                                month: 'numeric', day: 'numeric',
                                hour: '2-digit', minute: '2-digit'
                              })}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* ── Right panel (col-span-1) ── */}
            <div className="space-y-4">

              {/* Active streams */}
              <div className="bg-white rounded-xl shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-gray-900">라이브 스트림</h2>
                  <Link
                    to="/seller/streams/new"
                    className="text-xs text-blue-600 font-medium hover:underline"
                  >
                    + 새 라이브
                  </Link>
                </div>
                {streams.length === 0 ? (
                  <div className="py-10 text-center">
                    <Play className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                    <p className="text-xs text-gray-400">라이브가 없어요</p>
                    <button
                      onClick={() => navigate('/seller/streams/new')}
                      className="mt-3 text-xs text-blue-600 font-medium hover:underline"
                    >
                      첫 라이브 만들기
                    </button>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-50">
                    {streams.slice(0, 4).map(s => (
                      <div key={s.id} className="px-5 py-3 flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                          s.status === 'live' ? 'bg-red-500 animate-pulse' :
                          s.status === 'scheduled' ? 'bg-amber-400' : 'bg-gray-300'
                        }`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-800 truncate">{s.title}</p>
                          <p className="text-xs text-gray-400">
                            {s.status === 'live' ? `시청자 ${(s.viewer_count || 0).toLocaleString()}명` :
                             s.status === 'scheduled' ? '예정' : '종료'}
                          </p>
                        </div>
                        <Link
                          to={`/seller/streams/${s.id}`}
                          className="text-xs text-gray-400 hover:text-blue-600 transition-colors"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Quick actions */}
              <div className="bg-white rounded-xl shadow-sm p-5">
                <h2 className="text-sm font-semibold text-gray-900 mb-3">퀵액션</h2>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: '라이브 방송', icon: Play, path: '/seller/live-broadcast', color: 'text-red-500 bg-red-50' },
                    { label: '상품 추가',   icon: Package, path: '/seller/products/new', color: 'text-blue-600 bg-blue-50' },
                    { label: '주문 처리',   icon: ShoppingBag, path: '/seller/orders', color: 'text-amber-600 bg-amber-50' },
                    { label: '정산 확인',   icon: TrendingUp, path: '/seller/settlements', color: 'text-emerald-600 bg-emerald-50' },
                  ].map(({ label, icon: Icon, path, color }) => (
                    <button
                      key={path}
                      onClick={() => navigate(path)}
                      className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors"
                    >
                      <div className={`w-8 h-8 rounded-lg ${color} flex items-center justify-center`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className="text-xs font-medium text-gray-700">{label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── Chart ── */}
          {dailyStats.length > 0 && (
            <div className="grid lg:grid-cols-3 gap-5">
              {/* Sales chart */}
              <div className="lg:col-span-2 bg-white rounded-xl shadow-sm p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-semibold text-gray-900">일별 매출 추이</h2>
                  <span className="text-xs text-gray-400">
                    {period === '7d' ? '최근 7일' : period === '30d' ? '최근 30일' : '최근 90일'}
                  </span>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={dailyStats} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: '#9CA3AF' }}
                      tickFormatter={v => {
                        const d = new Date(v)
                        return `${d.getMonth() + 1}/${d.getDate()}`
                      }}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: '#9CA3AF' }}
                      tickFormatter={v => fmtShort(v)}
                      width={45}
                    />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E5E7EB' }}
                      // @ts-ignore
                    formatter={(v: number, name: string) =>
                        name === '매출' ? [fmtPrice(v), name] : [`${v}건`, name]
                      }
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="sales" stroke="#2563EB" strokeWidth={2} name="매출" dot={false} activeDot={{ r: 4 }} />
                    <Line type="monotone" dataKey="orders" stroke="#10B981" strokeWidth={2} name="주문" dot={false} activeDot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Top products */}
              {topProducts.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-semibold text-gray-900">인기 상품 Top 5</h2>
                    <Link to="/seller/products" className="text-xs text-blue-600 hover:underline">전체</Link>
                  </div>
                  <div className="space-y-3">
                    {topProducts.slice(0, 5).map((p, i) => (
                      <div key={p.product_id} className="flex items-center gap-3">
                        <span className="w-5 text-xs font-bold text-gray-400 text-center">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-800 truncate">{p.product_name}</p>
                          <p className="text-xs text-gray-400">{p.order_count}건</p>
                        </div>
                        <span className="text-xs font-semibold text-gray-700 whitespace-nowrap">
                          {fmtShort(p.total_revenue)}원
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

        </main>
      </div>
    </div>
  )
}
