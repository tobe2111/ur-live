import { useEffect, useState, useRef, useCallback, useMemo, Suspense } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import {
  Package, ShoppingBag, Play, DollarSign,
  TrendingUp,
  ChevronRight, ArrowUpRight,
  AlertCircle,
  AlertTriangle, CreditCard, Users,
  Utensils, Gift, Radio, LayoutDashboard
} from 'lucide-react'
import { getSellerToken, getSellerId, isSellerAuthenticated, redirectToLogin } from '@/lib/seller-auth'
import SellerLayout from '@/components/SellerLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import SellerOnboardingWidget from '@/components/seller/SellerOnboardingWidget'
import { formatNumber } from '@/utils/format'
import LazyChart from './seller-page/LazyChart'
import OnboardingChecklist from './seller-page/OnboardingChecklist'
import RealtimeOrdersPanel from './seller-page/RealtimeOrdersPanel'
import type { DashboardStats, DailyStats, TopProduct, Order, LiveStream } from './seller-page/types'

// 🛡️ 2026-05-02: TD-018 분할 — types / LazyChart / OnboardingChecklist / RealtimeOrdersPanel
//   를 ./seller-page/ 디렉토리로 추출. STATUS_CONFIG_BASE 는 RealtimeOrdersPanel 내부로 이동.
//   미사용 DeferUntilVisible 컴포넌트 (dead code) 제거.

// Inline skeleton placeholder
const Skel = ({ className }: { className?: string }) => (
  <div className={`animate-pulse bg-gray-200 rounded ${className || ''}`} />
)

// ─── Component ───────────────────────────────────────────────────────────────
export default function SellerPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()

  const sellerType = localStorage.getItem('seller_type') || 'influencer'
  const isInfluencer = sellerType === 'influencer' || sellerType === 'both'

  // Stats
  const [hasBank, setHasBank] = useState(false)
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

  // 팔로워/구독자 수
  const [followerCount, setFollowerCount] = useState(0)

  // 활동 데이터 기반 대시보드 커스터마이징
  const [hasLiveHistory, setHasLiveHistory] = useState(false)
  const [hasMealVouchers, setHasMealVouchers] = useState(false)
  const [mealVoucherCount, setMealVoucherCount] = useState(0)
  const [activeGroupBuys, setActiveGroupBuys] = useState(0)

  // 월간 매출 목표 (localStorage 저장)
  const [monthlyGoal, setMonthlyGoal] = useState<number>(() => {
    const stored = Number(localStorage.getItem('seller_monthly_goal') || '0')
    return stored > 0 ? stored : 10_000_000
  })
  const [editingGoal, setEditingGoal] = useState(false)

  // ── Auth ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isSellerAuthenticated()) {
      redirectToLogin(navigate)
      return
    }
    // sessionStorage 캐시로 즉시 렌더 (5분 TTL)
    try {
      const cached = sessionStorage.getItem(`seller_dashboard_cache_${period}`)
      if (cached) {
        const c = JSON.parse(cached)
        if (Date.now() - (c.ts || 0) < 5 * 60 * 1000) {
          if (c.stats) setStats(c.stats)
          if (c.dailyStats) setDailyStats(c.dailyStats)
          if (c.topProducts) setTopProducts(c.topProducts)
          if (c.streams) setStreams(c.streams)
          if (typeof c.stockAlertCount === 'number') setStockAlertCount(c.stockAlertCount)
          if (typeof c.followerCount === 'number') setFollowerCount(c.followerCount)
          if (typeof c.hasLiveHistory === 'boolean') setHasLiveHistory(c.hasLiveHistory)
          if (typeof c.hasMealVouchers === 'boolean') setHasMealVouchers(c.hasMealVouchers)
          if (typeof c.mealVoucherCount === 'number') setMealVoucherCount(c.mealVoucherCount)
          if (typeof c.activeGroupBuys === 'number') setActiveGroupBuys(c.activeGroupBuys)
          setLoading(false)
        }
      }
    } catch { /* 파싱 실패 무시 */ }
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

            // 🛡️ 2026-04-23 배치 170: 신규 주문 알림 (브라우저 Notification + 사운드)
            try {
              if (Notification.permission === 'granted') {
                new Notification('🛒 새 주문이 들어왔어요!', {
                  body: `${newIds.size}건의 새 주문을 확인하세요`,
                  icon: '/favicon.ico',
                })
              } else if (Notification.permission === 'default') {
                Notification.requestPermission()
              }
              const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2JkZeWj4J1aGBneIONkpGLgXRtZ2l4hI+UkYyBdWxnbHqFkJSTjoF1bGdteYWQlJOOgXVsZ2x5hpGVk46BdWxnbHmFkJSTjoF1')
              audio.volume = 0.3
              audio.play().catch(() => {})
            } catch { /* non-critical */ }
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
    // 10s polling interval for near real-time order updates
    // (SSE upgrade deferred due to Cloudflare Workers CPU/duration limits)
    const interval = setInterval(() => pollOrders(), 10000)
    return () => {
      clearInterval(interval)
      if (newOrderTimerRef.current) clearTimeout(newOrderTimerRef.current)
    }
  }, [pollOrders])

  // ── Dashboard data ─────────────────────────────────────────────────────────
  async function loadDashboardData() {
    try {
      const token = getSellerToken()
      const headers = token ? { Authorization: `Bearer ${token}` } : {}

      const [dashRes, streamsRes, stockRes, followerRes, productsRes, profileRes] = await Promise.allSettled([
        api.get(`/api/seller/dashboard/stats?period=${period}`, { headers }),
        api.get('/api/seller/streams', { headers }),
        api.get('/api/inventory/stock/alerts', { headers }),
        api.get(`/api/social/followers/${getSellerId()}`),
        api.get('/api/seller/products', { headers }),
        api.get('/api/seller/profile', { headers }),
      ])
      // 온보딩 체크: 정산 계좌 등록 여부
      if (profileRes.status === 'fulfilled' && profileRes.value.data?.success) {
        const p = profileRes.value.data.data
        setHasBank(!!(p?.bank_name && p?.bank_account))
      }

      // 캐시 저장용 스냅샷
      const snapshot: Record<string, unknown> = { ts: Date.now() }

      let nextStats: DashboardStats | null = null
      if (dashRes.status === 'fulfilled' && dashRes.value.data.success) {
        const d = dashRes.value.data.data
        nextStats = {
          totalRevenue:    d.summary?.total_sales      || 0,
          totalOrders:     d.summary?.total_orders     || 0,
          activeStreams:    0,
          totalViewers:    0,
          pendingOrders:   d.summary?.pending_orders   || 0,
          cancelledOrders: d.summary?.cancelled_orders || 0,
          completedOrders: d.summary?.completed_orders || 0,
          avgOrderValue:   d.summary?.avg_order_value  || 0,
          lowStockCount:   d.summary?.low_stock_count  || 0,
          pendingSettlement: d.summary?.pending_settlement || 0,
        }
        setDailyStats(d.daily || [])
        setTopProducts(d.topProducts || [])
        snapshot.dailyStats = d.daily || []
        snapshot.topProducts = d.topProducts || []
      }

      if (streamsRes.status === 'fulfilled' && streamsRes.value.data.success) {
        const s: LiveStream[] = streamsRes.value.data.data || []
        setStreams(s)
        if (nextStats) {
          nextStats.activeStreams = s.filter(x => x.status === 'live').length
          nextStats.totalViewers = s.reduce((sum, x) => sum + (x.viewer_count || 0), 0)
        }
        snapshot.streams = s
      }
      if (nextStats) {
        setStats(nextStats)
        snapshot.stats = nextStats
      }

      if (stockRes.status === 'fulfilled' && stockRes.value.data?.success) {
        const alerts = stockRes.value.data.data || []
        const count = Array.isArray(alerts) ? alerts.length : 0
        setStockAlertCount(count)
        snapshot.stockAlertCount = count
      }
      if (followerRes.status === 'fulfilled' && followerRes.value.data?.success) {
        const count = followerRes.value.data.data?.count || 0
        setFollowerCount(count)
        snapshot.followerCount = count
      }

      // 활동 데이터 분석: 라이브 이력 + 식사권 상품
      if (streamsRes.status === 'fulfilled' && streamsRes.value.data.success) {
        const allStreams: LiveStream[] = streamsRes.value.data.data || []
        const hasHistory = allStreams.length > 0
        setHasLiveHistory(hasHistory)
        snapshot.hasLiveHistory = hasHistory
      }
      if (productsRes.status === 'fulfilled' && productsRes.value.data?.success) {
        const prods = productsRes.value.data.data || []
        type ProdEntry = { category?: string; group_buy_status?: string }
        const vouchers = (prods as ProdEntry[]).filter(p => p.category === 'meal_voucher' || p.category === 'group_buy')
        const hasVouchers = vouchers.length > 0
        const activeBuys = vouchers.filter(p => p.group_buy_status === 'active' || p.group_buy_status === 'achieved').length
        setHasMealVouchers(hasVouchers)
        setMealVoucherCount(vouchers.length)
        setActiveGroupBuys(activeBuys)
        snapshot.hasMealVouchers = hasVouchers
        snapshot.mealVoucherCount = vouchers.length
        snapshot.activeGroupBuys = activeBuys
      }

      // sessionStorage 캐시 (5분 TTL)
      try { sessionStorage.setItem(`seller_dashboard_cache_${period}`, JSON.stringify(snapshot)) } catch { /* quota 무시 */ }
    } catch {
      // silent fail
    } finally {
      setLoading(false)
    }
  }

  // ── Period-over-period 델타 계산 ──────────────────────────────────────────
  // dailyStats: 최근 N일 데이터. 전반기(prev) vs 후반기(curr) 비교.
  function pctDelta(curr: number, prev: number): number {
    if (prev > 0) return Math.round(((curr - prev) / prev) * 100)
    if (curr > 0) return 100
    return 0
  }
  const halfLen = Math.max(1, Math.floor(dailyStats.length / 2))
  const prevSlice = dailyStats.slice(0, halfLen)
  const currSlice = dailyStats.slice(-halfLen)
  const prevRevenue = prevSlice.reduce((s, d) => s + (d.sales || 0), 0)
  const currRevenue = currSlice.reduce((s, d) => s + (d.sales || 0), 0)
  const prevOrders = prevSlice.reduce((s, d) => s + (d.orders || 0), 0)
  const currOrders = currSlice.reduce((s, d) => s + (d.orders || 0), 0)
  const revenueDelta = pctDelta(currRevenue, prevRevenue)
  const ordersDelta = pctDelta(currOrders, prevOrders)
  // pending/viewers: sessionStorage에 이전 스냅샷이 있으면 비교
  const snapshotKey = `seller_stats_prev_snapshot`
  let pendingDelta = 0
  let viewersDelta = 0
  try {
    const raw = sessionStorage.getItem(snapshotKey)
    if (raw) {
      const prevSnap = JSON.parse(raw) as { pendingOrders?: number; totalViewers?: number; activeStreams?: number; ts?: number }
      // 24시간 이상 된 스냅샷만 비교용으로 사용
      if (prevSnap.ts && Date.now() - prevSnap.ts > 24 * 60 * 60 * 1000) {
        pendingDelta = pctDelta(stats.pendingOrders || 0, prevSnap.pendingOrders || 0)
        viewersDelta = pctDelta(stats.totalViewers || 0, prevSnap.totalViewers || 0)
      }
    }
  } catch { /* ignore */ }

  // 월간 매출 목표 진행률 (이번 달 기준)
  const now = new Date()
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const daysLeft = Math.max(0, daysInMonth - now.getDate())
  const goalProgress = monthlyGoal > 0 ? (stats.totalRevenue / monthlyGoal) * 100 : 0

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

  // ── Actionable insights ────────────────────────────────────────────────────
  // 대시보드 데이터로 자동 파생되는 배너. 우선순위/심각도 기준 최대 몇 건 노출.
  type InsightSeverity = 'high' | 'medium' | 'info'
  type InsightIcon = typeof Package | typeof AlertTriangle | typeof TrendingUp | typeof DollarSign
  interface Insight {
    severity: InsightSeverity
    icon: InsightIcon
    title: string
    description?: string
    action?: { label: string; path: string }
  }
  const insights: Insight[] = useMemo(() => {
    const list: Insight[] = []

    // 1) 미처리 주문 ≥ 5
    if ((stats.pendingOrders || 0) >= 5) {
      list.push({
        severity: 'high',
        icon: Package,
        title: t('seller.insightPendingOrdersTitle', { count: stats.pendingOrders }),
        description: t('seller.insightPendingOrdersDesc'),
        action: { label: t('seller.insightManageOrders'), path: '/seller/orders' },
      })
    }

    // 2) 재고 부족 상품 ≥ 3
    const lowStock = stats.lowStockCount ?? 0
    if (lowStock >= 3) {
      list.push({
        severity: 'medium',
        icon: AlertTriangle,
        title: t('seller.insightLowStockTitle', { count: lowStock }),
        description: t('seller.insightLowStockDesc'),
        action: { label: t('seller.insightManageInventory'), path: '/seller/inventory' },
      })
    }

    // 3) 오늘 매출 > 어제 매출 * 1.2  (dailyStats 마지막 2개 비교)
    if (dailyStats.length >= 2) {
      const todayRevenue = dailyStats[dailyStats.length - 1]?.sales || 0
      const yesterdayRevenue = dailyStats[dailyStats.length - 2]?.sales || 0
      if (yesterdayRevenue > 0 && todayRevenue > yesterdayRevenue * 1.2) {
        const pct = Math.round(((todayRevenue - yesterdayRevenue) / yesterdayRevenue) * 100)
        list.push({
          severity: 'info',
          icon: TrendingUp,
          title: t('seller.insightRevenueUpTitle'),
          description: t('seller.insightRevenueUpDesc', { pct }),
        })
      }
    }

    // 4) 등록된 상품이 없음 (totalProducts === 0)
    if ((stats.totalProducts ?? -1) === 0) {
      list.push({
        severity: 'high',
        icon: Package,
        title: t('seller.insightNoProductsTitle'),
        description: t('seller.insightNoProductsDesc'),
        action: { label: t('seller.insightRegisterProduct'), path: '/seller/products/new' },
      })
    }

    // 5) 정산 신청 가능 > 0
    const settlementAvailable = stats.pendingSettlement ?? 0
    if (settlementAvailable > 0) {
      list.push({
        severity: 'info',
        icon: DollarSign,
        title: t('seller.insightSettlementTitle', { amount: fmtPrice(settlementAvailable) }),
        description: t('seller.insightSettlementDesc'),
        action: { label: t('seller.insightSettlement'), path: '/seller/settlements' },
      })
    }

    return list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stats, dailyStats, t, i18n.language])

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
      {isInfluencer && (
        <button
          onClick={() => navigate('/seller/live-broadcast')}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Play className="w-3.5 h-3.5" />
          {t('seller.startLive')}
        </button>
      )}
    </div>
  )

  return (
    <SellerLayout title={t('seller.dashboard')} headerRight={headerRight} pendingOrders={stats.pendingOrders}>
      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
        {/* 🛡️ 2026-04-22 배치 131: 디자인 시스템 적용 */}
        <DashboardPageHeader
          title={t('seller.dashboard')}
          subtitle={t('seller.dashboardSubtitle', { defaultValue: '셀러 대시보드 — 매출 / 주문 / 라이브 현황' })}
          icon={<LayoutDashboard className="h-5 w-5" />}
        />

        {/* 🛡️ 2026-04-23 배치 170: 셀러 온보딩 가이드 (신규 셀러만 표시) */}
        <OnboardingChecklist stats={stats} hasBank={hasBank} />

        {/* 🛡️ 2026-04-27 Phase 1-5: 7일 부트캠프 위젯 */}
        <SellerOnboardingWidget />

          {/* ── 월간 매출 목표 진행률 ── */}
          <div className="bg-white rounded-2xl p-4 border border-[#E8EAEE]">
            <div className="flex items-center justify-between mb-2 gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-[12px] font-bold text-gray-700">{t('seller.monthlyGoalTitle')}</p>
                  <button
                    onClick={() => setEditingGoal(!editingGoal)}
                    className="text-[10px] text-blue-600 hover:underline"
                  >
                    {editingGoal ? t('common.close') : t('seller.changeGoal')}
                  </button>
                </div>
                {editingGoal ? (
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="number"
                      min={0}
                      step={100000}
                      defaultValue={monthlyGoal}
                      onBlur={(e) => {
                        const v = Math.max(0, Number(e.target.value) || 0)
                        setMonthlyGoal(v)
                        localStorage.setItem('seller_monthly_goal', String(v))
                        setEditingGoal(false)
                      }}
                      className="text-[14px] font-bold text-gray-900 px-2 py-1 border border-gray-300 rounded w-40"
                    />
                    <span className="text-[12px] text-gray-500">{t('common.won')}</span>
                  </div>
                ) : (
                  <p className="text-[16px] sm:text-[20px] font-extrabold text-gray-900 truncate">
                    {formatNumber(stats.totalRevenue || 0)}{t('common.won')} / {formatNumber(monthlyGoal)}{t('common.won')}
                  </p>
                )}
              </div>
              <p className="text-[13px] font-extrabold shrink-0" style={{ color: '#FF0033' }}>
                {Math.round(goalProgress)}%
              </p>
            </div>
            <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${Math.min(goalProgress, 100)}%`,
                  background: 'linear-gradient(90deg, #FF0033, #EC4899)'
                }}
              />
            </div>
            <p className="text-[10px] text-gray-500 mt-1.5">
              {t('seller.daysLeft', { days: daysLeft })} · {t('seller.goalRemaining', { amount: Math.max(0, monthlyGoal - (stats.totalRevenue || 0)) })}
            </p>
          </div>

          {/* ── Stats row ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
            {[
              {
                label: t('seller.totalRevenue'), value: fmtPrice(stats.totalRevenue),
                sub: stats.avgOrderValue > 0 ? t('seller.avgPerOrder', { amount: fmtPrice(stats.avgOrderValue) }) : undefined,
                icon: <TrendingUp className="w-5 h-5" />, color: 'text-emerald-600', bg: 'bg-emerald-50',
                influencerOnly: false, delta: revenueDelta, showDelta: dailyStats.length >= 2,
              },
              {
                label: t('seller.totalOrders'), value: `${formatNumber(stats.totalOrders || 0)}`,
                sub: stats.completedOrders > 0 ? t('seller.completedCount', { count: stats.completedOrders }) : undefined,
                icon: <ShoppingBag className="w-5 h-5" />, color: 'text-blue-600', bg: 'bg-blue-50',
                influencerOnly: false, delta: ordersDelta, showDelta: dailyStats.length >= 2,
              },
              {
                label: t('seller.pendingOrders'), value: `${formatNumber(stats.pendingOrders || 0)}`,
                sub: t('seller.needsAction'),
                icon: <AlertCircle className="w-5 h-5" />, color: 'text-amber-600', bg: 'bg-amber-50',
                influencerOnly: false, delta: pendingDelta, showDelta: pendingDelta !== 0,
              },
              {
                label: t('seller.activeStreams'), value: `${stats.activeStreams || 0}`,
                sub: stats.totalViewers > 0 ? t('seller.viewerCount', { count: stats.totalViewers }) : t('seller.noStreams'),
                icon: <Play className="w-5 h-5" />, color: 'text-red-500', bg: 'bg-red-50',
                influencerOnly: true, delta: viewersDelta, showDelta: viewersDelta !== 0,
              },
            ].filter(card => !card.influencerOnly || isInfluencer).map(card => (
              <div key={card.label} className="bg-white rounded-xl p-3 sm:p-4 shadow-sm">
                <div className="flex items-center justify-between mb-2 sm:mb-3">
                  <span className="text-[10px] sm:text-xs font-medium text-gray-500">{card.label}</span>
                  <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg ${card.bg} ${card.color} flex items-center justify-center`}>
                    {card.icon}
                  </div>
                </div>
                {loading ? (
                  <>
                    <Skel className="h-6 w-2/3 mb-1" />
                    <Skel className="h-3 w-1/2" />
                  </>
                ) : (
                  <>
                    <p className="text-lg sm:text-xl font-bold text-gray-900 mb-0.5">{card.value}</p>
                    {card.showDelta && (
                      <span className={`text-[10px] font-bold ${card.delta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {card.delta >= 0 ? '↑' : '↓'} {Math.abs(card.delta)}% {t('seller.vsPreviousPeriod')}
                      </span>
                    )}
                    {card.sub && <p className="text-[10px] sm:text-xs text-gray-400">{card.sub}</p>}
                  </>
                )}
              </div>
            ))}
          </div>

          {/* ── Actionable insights callouts ── */}
          {insights.length > 0 && (
            <div className="space-y-2 mb-4">
              {insights.map((insight, i) => (
                <div key={i} className={`rounded-xl p-3 flex items-start gap-3 ${insight.severity === 'high' ? 'bg-red-50 border border-red-200' : insight.severity === 'medium' ? 'bg-amber-50 border border-amber-200' : 'bg-blue-50 border border-blue-200'}`}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${insight.severity === 'high' ? 'bg-red-100' : insight.severity === 'medium' ? 'bg-amber-100' : 'bg-blue-100'}`}>
                    <insight.icon className={`w-4 h-4 ${insight.severity === 'high' ? 'text-red-600' : insight.severity === 'medium' ? 'text-amber-600' : 'text-blue-600'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-extrabold text-gray-900">{insight.title}</p>
                    {insight.description && <p className="text-[11px] text-gray-600 mt-0.5">{insight.description}</p>}
                  </div>
                  {insight.action && (
                    <button onClick={() => navigate(insight.action!.path)} className="text-[11px] font-bold px-3 py-1.5 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 shrink-0">
                      {insight.action.label}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── 할 일 목록 ── */}
          {(stats.pendingOrders > 0 || (stats.lowStockCount ?? 0) > 0 || (stats.pendingSettlement ?? 0) > 0) && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <h3 className="text-sm font-bold text-amber-800 mb-2">📋 {t('seller.actionItems')}</h3>
              <div className="flex flex-wrap gap-2">
                {stats.pendingOrders > 0 && (
                  <Link to="/seller/orders" className="flex items-center gap-1.5 px-3 py-2 bg-white rounded-lg text-xs font-medium text-amber-700 border border-amber-200 hover:bg-amber-100">
                    <ShoppingBag className="w-3.5 h-3.5" /> {t('seller.unprocessedOrderCount', { count: stats.pendingOrders })}
                  </Link>
                )}
                {(stats.lowStockCount ?? 0) > 0 && (
                  <Link to="/seller/inventory" className="flex items-center gap-1.5 px-3 py-2 bg-white rounded-lg text-xs font-medium text-orange-700 border border-orange-200 hover:bg-orange-100">
                    <AlertTriangle className="w-3.5 h-3.5" /> {t('seller.lowStockCount', { count: stats.lowStockCount })}
                  </Link>
                )}
                {(stats.pendingSettlement ?? 0) > 0 && (
                  <Link to="/seller/settlements" className="flex items-center gap-1.5 px-3 py-2 bg-white rounded-lg text-xs font-medium text-green-700 border border-green-200 hover:bg-green-100">
                    <CreditCard className="w-3.5 h-3.5" /> {t('seller.settlementAvailableCount', { count: stats.pendingSettlement })}
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* ── Main grid ── */}
          <div className="grid lg:grid-cols-3 gap-3 sm:gap-5">

            {/* ── Real-time orders (col-span-2) ── */}
            <RealtimeOrdersPanel
              recentOrders={recentOrders}
              newOrderIds={newOrderIds}
              ordersRefreshing={ordersRefreshing}
              lastUpdated={lastUpdated}
              onRefresh={() => pollOrders(true)}
              fmtPrice={fmtPrice}
              timeAgo={timeAgo}
            />

            {/* ── Right panel (col-span-1) ── */}
            <div className="space-y-4">

              {/* 전환 퍼널 — 실제 데이터만 표시 (추정값 사용 금지) */}
              {(() => {
                const hasViewerData = stats.totalViewers > 0
                const orderCount = stats.totalOrders || 0
                const viewerCount = stats.totalViewers || 0
                // 시청자 기준 전환율 (실제 데이터 있을 때만)
                const orderPct = hasViewerData && viewerCount > 0
                  ? Math.max(0, Math.round((orderCount / viewerCount) * 100))
                  : 0
                return (
                  <div className="bg-white rounded-2xl p-5 border border-[#E8EAEE]">
                    <h3 className="text-[14px] font-extrabold text-gray-900 mb-3">{t('seller.conversionFunnel')}</h3>
                    {!hasViewerData && orderCount === 0 ? (
                      <p className="text-[12px] text-gray-500 py-4 text-center">
                        {t('seller.noViewerData')}
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {hasViewerData && (
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[12px] font-semibold text-gray-700">{t('seller.broadcastViewers')}</span>
                              <span className="text-[12px] font-extrabold text-gray-900">
                                {formatNumber(viewerCount)}<span className="text-[10px] text-gray-500 ml-1">(100%)</span>
                              </span>
                            </div>
                            <div className="w-full h-1.5 rounded-full bg-gray-100">
                              <div className="h-full rounded-full" style={{ width: '100%', background: '#FF0033' }} />
                            </div>
                          </div>
                        )}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[12px] font-semibold text-gray-700">{t('seller.ordersCompleted')}</span>
                            <span className="text-[12px] font-extrabold text-gray-900">
                              {formatNumber(orderCount)}
                              {hasViewerData && (
                                <span className="text-[10px] text-gray-500 ml-1">({orderPct}%)</span>
                              )}
                            </span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-gray-100">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${hasViewerData ? Math.min(orderPct, 100) : 100}%`,
                                background: '#10B981'
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })()}

              {/* 빠른 액션 — 활동 데이터 기반 동적 배치 */}
              <div>
                <h2 className="text-sm font-semibold text-gray-900 mb-3">{t('seller.quickActions')}</h2>
                <div className="space-y-2">
                  {/* 식사권/공구 관련 (식사권 이력 있거나 가게사장님이면 상단) */}
                  {(hasMealVouchers || sellerType === 'store_owner') && (
                    <>
                      <Link to="/seller/meal-voucher/new"
                        className="flex items-center justify-between p-3.5 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors">
                        <div className="flex items-center gap-3">
                          <Utensils className="w-4 h-4" />
                          <div>
                            <p className="text-[13px] font-bold">{t('seller.registerVoucher')}</p>
                            <p className="text-[11px] text-gray-400">{t('seller.selectOnKakaoMap')}</p>
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-gray-400" />
                      </Link>
                      {activeGroupBuys > 0 && (
                        <Link to="/seller/group-buy"
                          className="flex items-center justify-between p-3.5 bg-pink-50 border border-pink-200 rounded-xl hover:bg-pink-100 transition-colors">
                          <div className="flex items-center gap-3">
                            <Gift className="w-4 h-4 text-pink-600" />
                            <div>
                              <p className="text-[13px] font-bold text-gray-900">{t('seller.groupBuyManage')}</p>
                              <p className="text-[11px] text-pink-600">{t('seller.activeGroupBuyCount', { count: activeGroupBuys })}</p>
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-gray-400" />
                        </Link>
                      )}
                    </>
                  )}

                  {/* 공동구매 만들기 (항상 표시) */}
                  <Link to="/seller/meal-voucher/new"
                    className={`flex items-center justify-between p-3.5 rounded-xl transition-colors ${
                      hasMealVouchers || sellerType === 'store_owner'
                        ? 'bg-white border border-gray-200 hover:bg-gray-50'
                        : 'bg-gray-900 text-white hover:bg-gray-800'
                    }`}>
                    <div className="flex items-center gap-3">
                      <Users className={`w-4 h-4 ${hasMealVouchers || sellerType === 'store_owner' ? 'text-gray-600' : ''}`} />
                      <div>
                        <p className={`text-[13px] font-bold ${hasMealVouchers || sellerType === 'store_owner' ? 'text-gray-900' : ''}`}>{t('seller.createGroupBuy')}</p>
                        <p className={`text-[11px] ${hasMealVouchers || sellerType === 'store_owner' ? 'text-gray-500' : 'text-gray-400'}`}>{t('seller.tierBasedDiscount')}</p>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </Link>

                  {/* 라이브 관련 (라이브 이력 있거나 인플루언서면 표시) */}
                  {isInfluencer && (
                    <Link to="/seller/live-broadcast"
                      className={`flex items-center justify-between p-3.5 rounded-xl transition-colors ${
                        hasLiveHistory
                          ? 'bg-red-50 border border-red-200 hover:bg-red-100'
                          : 'bg-white border border-gray-200 hover:bg-gray-50'
                      }`}>
                      <div className="flex items-center gap-3">
                        <Radio className={`w-4 h-4 ${hasLiveHistory ? 'text-red-500' : 'text-gray-600'}`} />
                        <div>
                          <p className="text-[13px] font-bold text-gray-900">{t('seller.live')}</p>
                          <p className="text-[11px] text-gray-500">{hasLiveHistory ? t('seller.continuePrevious') : t('seller.startFirstLive')}</p>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </Link>
                  )}
                </div>
              </div>

              {/* 알림 */}
              <div>
                <h2 className="text-sm font-semibold text-gray-900 mb-3">{t('seller.alerts')}</h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                  <Link
                    to={`/profile/${localStorage.getItem('seller_username') || getSellerId()}`}
                    className="bg-pink-50 rounded-xl p-3 text-center hover:bg-pink-100 transition-colors block"
                  >
                    <Users className="w-5 h-5 text-pink-600 mx-auto mb-1.5" />
                    <p className="text-lg font-bold text-gray-900">{followerCount}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{t('seller.followers')}</p>
                  </Link>
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
                    <p className="text-lg font-bold text-gray-900">{fmtShort(stats.pendingSettlement ?? Math.round(stats.totalRevenue * 0.85))}</p>
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
                        href={`/profile/${localStorage.getItem('seller_username') || getSellerId()}`}
                        target="_blank" rel="noopener noreferrer"
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
                      href={`/profile/${localStorage.getItem('seller_username') || getSellerId()}`}
                      className="block w-full max-w-[280px] p-4 bg-gradient-to-br from-pink-50 to-purple-50 rounded-2xl border border-pink-100 text-center hover:shadow-md transition-shadow"
                    >
                      <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-pink-400 to-purple-400 flex items-center justify-center">
                        <span className="text-2xl">🏪</span>
                      </div>
                      <p className="text-sm font-bold text-gray-900">{t('seller.myPublicPage')}</p>
                      <p className="text-xs text-gray-500 mt-1">{t('seller.tapToEditPublicPage')}</p>
                    </a>
                  </div>

                  <div className="flex gap-2 mt-4">
                    <a
                      href={`/profile/${localStorage.getItem('seller_username') || getSellerId()}`}
                      target="_blank" rel="noopener noreferrer"
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
            <div className="grid lg:grid-cols-3 gap-3 sm:gap-5">
              {/* Sales chart — 스크롤 진입 시 recharts 번들 로드 */}
              <div className="lg:col-span-2 bg-white rounded-xl shadow-sm p-5">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-semibold text-gray-900">{t('seller.dailySalesTrend')}</h2>
                  <span className="text-xs text-gray-400">
                    {period === '7d' ? t('seller.last7days') : period === '30d' ? t('seller.last30days') : t('seller.last90days')}
                  </span>
                </div>
                <div style={{ width: '100%', height: 220 }}>
                  <Suspense fallback={<div className="flex items-center justify-center h-full text-gray-400 text-sm">{t('seller.chartLoading')}</div>}>
                    <LazyChart data={dailyStats} salesLabel={t('seller.sales')} ordersLabel={t('seller.order')} />
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

      </div>
    </SellerLayout>
  )
}
