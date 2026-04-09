import { useEffect, useState, useRef, useCallback, lazy, Suspense } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import {
  Package, ShoppingBag, Play, DollarSign,
  TrendingUp, Clock,
  ChevronRight, RefreshCw, ArrowUpRight,
  AlertCircle, CheckCircle2, Truck, XCircle,
  AlertTriangle, CreditCard, ArchiveRestore
} from 'lucide-react'
import { getSellerToken, getSellerId, isSellerAuthenticated, redirectToLogin } from '@/lib/seller-auth'
import SellerLayout from '@/components/SellerLayout'

// recharts lazy load (377KB → 대시보드 진입 시 차트 영역만 지연 로드)
const LazyChart = lazy(() => import('recharts').then(m => ({
  default: ({ data }: { data: any[] }) => {
    const { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } = m
    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#9ca3af" />
          <YAxis yAxisId="left" tick={{ fontSize: 11 }} stroke="#9ca3af" />
          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} stroke="#9ca3af" />
          <Tooltip />
          <Legend />
          <Line yAxisId="left" type="monotone" dataKey="revenue" name="매출" stroke="#3b82f6" strokeWidth={2} dot={false} />
          <Line yAxisId="right" type="monotone" dataKey="orders" name="주문" stroke="#f97316" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    )
  }
})))

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
  totalProducts?: number
  totalStreams?: number
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
const STATUS_CONFIG_BASE: Record<string, { labelKey: string; color: string; bg: string; icon: React.ReactNode }> = {
  PENDING:   { labelKey: 'seller.statusPending',   color: '#D97706', bg: '#FEF3C7', icon: <Clock className="w-3 h-3" /> },
  DONE:      { labelKey: 'seller.statusDone',      color: '#2563EB', bg: '#DBEAFE', icon: <CheckCircle2 className="w-3 h-3" /> },
  PAID:      { labelKey: 'seller.statusDone',      color: '#2563EB', bg: '#DBEAFE', icon: <CheckCircle2 className="w-3 h-3" /> },
  PREPARING: { labelKey: 'seller.statusPreparing', color: '#7C3AED', bg: '#EDE9FE', icon: <Package className="w-3 h-3" /> },
  SHIPPING:  { labelKey: 'seller.statusShipping',  color: '#0891B2', bg: '#CFFAFE', icon: <Truck className="w-3 h-3" /> },
  DELIVERED: { labelKey: 'seller.statusDelivered', color: '#059669', bg: '#D1FAE5', icon: <CheckCircle2 className="w-3 h-3" /> },
  CANCELLED: { labelKey: 'seller.statusCancelled', color: '#DC2626', bg: '#FEE2E2', icon: <XCircle className="w-3 h-3" /> },
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function SellerPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()

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

  // Stock alerts
  const [stockAlertCount, setStockAlertCount] = useState(0)

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

      const [dashRes, streamsRes, stockRes] = await Promise.allSettled([
        api.get(`/api/seller/dashboard/stats?period=${period}`, { headers }),
        api.get('/api/seller/streams', { headers }),
        api.get('/api/inventory/stock/alerts', { headers })
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

      if (stockRes.status === 'fulfilled' && stockRes.value.data?.success) {
        const alerts = stockRes.value.data.data || []
        setStockAlertCount(Array.isArray(alerts) ? alerts.length : 0)
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
    if (s < 60) return t('seller.secondsAgo', { count: s })
    if (s < 3600) return t('seller.minutesAgo', { count: Math.floor(s / 60) })
    return date.toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' })
  }
  // ── Loading ─────────────────────────────────────────────────────────────────
  const sellerName = localStorage.getItem('seller_name') || 'Seller'

  if (loading) {
    return (
      <SellerLayout title={t('seller.dashboard')}>
        <div className="flex items-center justify-center py-32">
          <div className="text-center">
            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-gray-500">{t('seller.loadingDashboard')}</p>
          </div>
        </div>
      </SellerLayout>
    )
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  const headerRight = (
    <div className="flex items-center gap-2">
      <div className="hidden sm:flex items-center bg-gray-100 rounded-lg p-1 gap-1">
        {(['7d', '30d', '90d'] as const).map(p => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
              period === p ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {p === '7d' ? t('seller.last7days') : p === '30d' ? t('seller.last30days') : t('seller.last90days')}
          </button>
        ))}
      </div>
      <button
        onClick={() => navigate('/seller/live-broadcast')}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors"
      >
        <Play className="w-3.5 h-3.5" />
        {t('seller.startLive')}
      </button>
    </div>
  )

  return (
    <SellerLayout title={t('seller.dashboard')} headerRight={headerRight} pendingOrders={stats.pendingOrders}>

          {/* ── 온보딩 체크리스트 (상품 0개 or YouTube 미연동 시) ── */}
          {(stats.totalProducts === 0 || !localStorage.getItem('youtube_channel_name')) && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-2xl p-5 mb-5">
              <h3 className="text-sm font-bold text-gray-900 mb-3">🚀 시작하기</h3>
              <div className="space-y-2.5">
                {[
                  { done: !!localStorage.getItem('youtube_channel_name'), label: 'YouTube 계정 연동', path: '/seller/live-broadcast' },
                  { done: (stats.totalProducts || 0) > 0, label: '첫 상품 등록', path: '/seller/products/new' },
                  { done: (stats.totalStreams || 0) > 0, label: '첫 라이브 방송', path: '/seller/live-broadcast' },
                ].map(step => (
                  <Link key={step.label} to={step.path} className="flex items-center gap-3 group">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${step.done ? 'bg-green-500' : 'bg-gray-200'}`}>
                      {step.done ? <CheckCircle2 className="w-4 h-4 text-white" /> : <span className="w-2 h-2 bg-gray-400 rounded-full" />}
                    </div>
                    <span className={`text-sm ${step.done ? 'text-gray-400 line-through' : 'text-gray-900 font-medium group-hover:text-blue-600'}`}>{step.label}</span>
                    {!step.done && <ChevronRight className="w-4 h-4 text-gray-400 ml-auto" />}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* ── Stats row ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                label: t('seller.totalRevenue'), value: fmtPrice(stats.totalRevenue),
                sub: stats.avgOrderValue > 0 ? t('seller.avgPerOrder', { amount: fmtPrice(stats.avgOrderValue) }) : undefined,
                icon: <TrendingUp className="w-5 h-5" />, color: 'text-emerald-600', bg: 'bg-emerald-50'
              },
              {
                label: t('seller.totalOrders'), value: `${(stats.totalOrders || 0).toLocaleString()}`,
                sub: stats.completedOrders > 0 ? t('seller.completedCount', { count: stats.completedOrders }) : undefined,
                icon: <ShoppingBag className="w-5 h-5" />, color: 'text-blue-600', bg: 'bg-blue-50'
              },
              {
                label: t('seller.pendingOrders'), value: `${(stats.pendingOrders || 0).toLocaleString()}`,
                sub: t('seller.needsAction'),
                icon: <AlertCircle className="w-5 h-5" />, color: 'text-amber-600', bg: 'bg-amber-50'
              },
              {
                label: t('seller.activeStreams'), value: `${stats.activeStreams || 0}`,
                sub: stats.totalViewers > 0 ? t('seller.viewerCount', { count: stats.totalViewers }) : t('seller.noStreams'),
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
                  <h2 className="text-sm font-semibold text-gray-900">{t('seller.realtimeOrders')}</h2>
                  {newOrderIds.size > 0 && (
                    <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full animate-pulse">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                      {t('seller.newOrders', { count: newOrderIds.size })}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">{t('seller.lastUpdated', { time: timeAgo(lastUpdated) })}</span>
                  <button
                    onClick={() => pollOrders(true)}
                    disabled={ordersRefreshing}
                    className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                    title={t('seller.refresh')}
                  >
                    <RefreshCw className={`w-3.5 h-3.5 text-gray-400 ${ordersRefreshing ? 'animate-spin' : ''}`} />
                  </button>
                  <Link
                    to="/seller/orders"
                    className="flex items-center gap-1 text-xs text-blue-600 font-medium hover:underline"
                  >
                    {t('seller.viewAll')} <ArrowUpRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>

              {recentOrders.length === 0 ? (
                <div className="py-16 text-center">
                  <ShoppingBag className="w-10 h-10 text-gray-200 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">{t('seller.noOrders')}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[540px]">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">{t('seller.orderNumber')}</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">{t('seller.buyer')}</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">{t('seller.amount')}</th>
                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">{t('seller.status')}</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">{t('seller.orderTime')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {recentOrders.map(order => {
                        const isNew = newOrderIds.has(order.id)
                        const scBase = STATUS_CONFIG_BASE[order.status] || { labelKey: '', color: '#6B7280', bg: '#F3F4F6', icon: null }
                        const sc = { ...scBase, label: scBase.labelKey ? t(scBase.labelKey) : order.status }
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
                              {new Date(order.created_at).toLocaleString(i18n.language, {
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

              {/* 오늘의 매출 요약 */}
              <div className="bg-white rounded-xl shadow-sm p-5">
                <h2 className="text-sm font-semibold text-gray-900 mb-4">{t('seller.todaySummary')}</h2>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">{t('seller.todayOrders')}</span>
                    <span className="text-sm font-bold text-gray-900">{(stats.totalOrders || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">{t('seller.todaySales')}</span>
                    <span className="text-sm font-bold text-gray-900">{fmtPrice(stats.totalRevenue)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">{t('seller.unprocessedOrders')}</span>
                    <span className="text-sm font-bold text-amber-600">{(stats.pendingOrders || 0).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* 알림 */}
              <div>
                <h2 className="text-sm font-semibold text-gray-900 mb-3">{t('seller.alerts')}</h2>
                <div className="grid grid-cols-3 gap-3">
                  <Link
                    to="/seller/products"
                    className="bg-amber-50 rounded-xl p-3 text-center hover:bg-amber-100 transition-colors block"
                  >
                    <AlertTriangle className="w-5 h-5 text-amber-600 mx-auto mb-1.5" />
                    <p className="text-lg font-bold text-gray-900">{stockAlertCount}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{t('seller.lowStock')}</p>
                  </Link>
                  <Link
                    to="/seller/orders"
                    className="bg-blue-50 rounded-xl p-3 text-center hover:bg-blue-100 transition-colors block"
                  >
                    <ShoppingBag className="w-5 h-5 text-blue-600 mx-auto mb-1.5" />
                    <p className="text-lg font-bold text-gray-900">{(stats.pendingOrders || 0)}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{t('seller.pendingOrdersAlert')}</p>
                  </Link>
                  <Link
                    to="/seller/settlements"
                    className="bg-green-50 rounded-xl p-3 text-center hover:bg-green-100 transition-colors block"
                  >
                    <CreditCard className="w-5 h-5 text-green-600 mx-auto mb-1.5" />
                    <p className="text-lg font-bold text-gray-900">{fmtShort(stats.totalRevenue)}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{t('seller.expectedSettlement')}</p>
                  </Link>
                </div>
              </div>

              {/* 내 공개 페이지 미리보기 */}
              {getSellerId() && (
                <div className="bg-white rounded-xl shadow-sm p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-semibold text-gray-900">{t('seller.myPublicPage')}</h2>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(`${window.location.origin}/s/${getSellerId()}`)
                          const el = document.getElementById('copy-toast')
                          if (el) { el.classList.remove('hidden'); setTimeout(() => el.classList.add('hidden'), 2000) }
                        }}
                        className="text-xs text-blue-600 font-medium hover:underline"
                      >
                        {t('seller.copyLink')}
                      </button>
                      <a
                        href={`/s/${getSellerId()}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 font-medium hover:underline flex items-center gap-0.5"
                      >
                        {t('seller.newTab')} <ArrowUpRight className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                  <p id="copy-toast" className="text-xs text-green-600 text-center mb-2 hidden">{t('seller.linkCopied')}</p>

                  {/* 공개 페이지 바로가기 (인라인 편집 가능) */}
                  <div className="flex justify-center">
                    <a
                      href={`/s/${getSellerId()}`}
                      className="block w-full max-w-[280px] p-4 bg-gradient-to-br from-pink-50 to-purple-50 rounded-2xl border border-pink-100 text-center hover:shadow-md transition-shadow"
                    >
                      <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-pink-400 to-purple-400 flex items-center justify-center">
                        <span className="text-2xl">🏪</span>
                      </div>
                      <p className="text-sm font-bold text-gray-900">{t('seller.myPublicPage')}</p>
                      <p className="text-xs text-gray-500 mt-1">탭하여 공개 페이지에서 바로 편집하세요</p>
                    </a>
                  </div>

                  <div className="flex gap-2 mt-4">
                    <a
                      href={`/s/${getSellerId()}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-gray-100 text-gray-700 text-xs font-semibold rounded-lg hover:bg-gray-200"
                    >
                      {t('seller.newTab')} <ArrowUpRight className="w-3 h-3" />
                    </a>
                    <Link
                      to="/seller/profile"
                      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700"
                    >
                      {t('seller.editProfile')}
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Chart ── */}
          {dailyStats.length > 0 && (
            <div className="grid lg:grid-cols-3 gap-5">
              {/* Sales chart */}
              <div className="lg:col-span-2 bg-white rounded-xl shadow-sm p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-semibold text-gray-900">{t('seller.dailySalesTrend')}</h2>
                  <span className="text-xs text-gray-400">
                    {period === '7d' ? t('seller.last7days') : period === '30d' ? t('seller.last30days') : t('seller.last90days')}
                  </span>
                </div>
                <div style={{ width: '100%', height: 220 }}>
                  <Suspense fallback={<div className="flex items-center justify-center h-full text-gray-400 text-sm">차트 로딩...</div>}>
                    <LazyChart data={dailyStats} />
                  </Suspense>
                </div>
              </div>

              {/* Top products */}
              {topProducts.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-sm font-semibold text-gray-900">{t('seller.topProducts')}</h2>
                    <Link to="/seller/products" className="text-xs text-blue-600 hover:underline">{t('seller.all')}</Link>
                  </div>
                  <div className="space-y-3">
                    {topProducts.slice(0, 5).map((p, i) => (
                      <div key={p.product_id} className="flex items-center gap-3">
                        <span className="w-5 text-xs font-bold text-gray-400 text-center">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-800 truncate">{p.product_name}</p>
                          <p className="text-xs text-gray-400">{p.order_count}</p>
                        </div>
                        <span className="text-xs font-semibold text-gray-700 whitespace-nowrap">
                          {fmtPrice(p.total_revenue)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

    </SellerLayout>
  )
}
