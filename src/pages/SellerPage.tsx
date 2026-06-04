import { useEffect, useState, useRef, useCallback, useMemo, Suspense } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import {
  Package, ShoppingBag, Play, DollarSign,
  TrendingUp,
  AlertCircle,
  AlertTriangle, CreditCard,
  LayoutDashboard
} from 'lucide-react'
import { getSellerToken, getSellerId, isSellerAuthenticated, redirectToLogin } from '@/lib/seller-auth'
import { useSellerMode } from '@/hooks/useSellerMode'
import SellerLayout from '@/components/SellerLayout'
import RoleGate from '@/components/RoleGate'
import SellerTrackingLinkCopy from '@/components/seller/SellerTrackingLinkCopy'
import { getRoleLabel, getRoleMeta, getCurrentSellerRole, isInfluencer as checkInfluencer } from '@/shared/seller-roles'
import { DashboardPageHeader } from '@/components/dashboard'
import SellerReferralInfoCard from '@/components/seller/SellerReferralInfoCard'
import SellerGroupBuyOverview from '@/components/seller/SellerGroupBuyOverview'
import SellerKpiDashboard from '@/components/seller/SellerKpiDashboard'
import { formatNumber } from '@/utils/format'
import { swallow } from '@/shared/utils/swallow'
import LazyChart from './seller-page/LazyChart'
import MonthlyGoalCard from './seller-page/MonthlyGoalCard'
import ConversionFunnel from './seller-page/ConversionFunnel'
import QuickActions from './seller-page/QuickActions'
import AlertsGrid from './seller-page/AlertsGrid'
import PrimaryActions from './seller-page/PrimaryActions'
import PublicPagePreview from './seller-page/PublicPagePreview'
import type { DashboardStats, DailyStats, TopProduct, Order, LiveStream } from './seller-page/types'

// 🛡️ 2026-05-02: TD-018 분할 — types / LazyChart / OnboardingChecklist / RealtimeOrdersPanel
//   를 ./seller-page/ 디렉토리로 추출. STATUS_CONFIG_BASE 는 RealtimeOrdersPanel 내부로 이동.
//   미사용 DeferUntilVisible 컴포넌트 (dead code) 제거.

// Inline skeleton placeholder
const Skel = ({ className }: { className?: string }) => (
  <div className={`animate-pulse bg-gray-200 rounded ${className || ''}`} />
)

// 🛡️ 2026-05-27 (memory): 새 주문 알림 사운드 — module-scope 1회 생성 → GC 압력 ↓.
//   이전: 매 폴링마다 new Audio(data:...) → 인스턴스 누적.
// 🛡️ 2026-06-04 (CSP): data:audio URI 는 CSP media-src('self' https: blob:) 에 차단됨 →
//   콘솔 violation. base64 → Blob → object URL(blob:) 로 변환해 정책 위반 없이 재생.
const NEW_ORDER_WAV_B64 = 'UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2JkZeWj4J1aGBneIONkpGLgXRtZ2l4hI+UkYyBdWxnbHqFkJSTjoF1bGdteYWQlJOOgXVsZ2x5hpGVk46BdWxnbHmFkJSTjoF1bGdteYWQlJOOgXVsZ2x5hpGVk46BdWxnbHmFkJSTjoF1'
const newOrderAudio: HTMLAudioElement = (() => {
  if (typeof Audio === 'undefined') return { play: () => Promise.resolve(), currentTime: 0 } as unknown as HTMLAudioElement
  try {
    const bytes = Uint8Array.from(atob(NEW_ORDER_WAV_B64), (ch) => ch.charCodeAt(0))
    const url = URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' }))
    return Object.assign(new Audio(url), { volume: 0.3 })
  } catch {
    return { play: () => Promise.resolve(), currentTime: 0 } as unknown as HTMLAudioElement
  }
})()

// 🛡️ 2026-06-03 Tier2(대시보드): 6-endpoint 대시보드 번들 타입 + fetcher + sessionStorage seed.
type SellerDashBundle = {
  hasBank: boolean
  stats: DashboardStats
  dailyStats: DailyStats[]
  topProducts: TopProduct[]
  streams: LiveStream[]
  stockAlertCount: number
  followerCount: number
  hasLiveHistory: boolean
  hasMealVouchers: boolean
  mealVoucherCount: number
  activeGroupBuys: number
}

const DEFAULT_DASH_STATS: DashboardStats = {
  totalRevenue: 0, totalOrders: 0, activeStreams: 0, totalViewers: 0,
  pendingOrders: 0, cancelledOrders: 0, completedOrders: 0, avgOrderValue: 0,
}

// sessionStorage 5분 TTL 캐시 → useQuery initialData (즉시렌더 보존).
function readSellerDashCache(period: string): SellerDashBundle | undefined {
  try {
    const cached = sessionStorage.getItem(`seller_dashboard_cache_${period}`)
    if (!cached) return undefined
    const c = JSON.parse(cached)
    if (Date.now() - (c.ts || 0) >= 5 * 60 * 1000) return undefined
    return {
      hasBank: false,
      stats: c.stats ?? DEFAULT_DASH_STATS,
      dailyStats: c.dailyStats ?? [],
      topProducts: c.topProducts ?? [],
      streams: c.streams ?? [],
      stockAlertCount: typeof c.stockAlertCount === 'number' ? c.stockAlertCount : 0,
      followerCount: typeof c.followerCount === 'number' ? c.followerCount : 0,
      hasLiveHistory: !!c.hasLiveHistory,
      hasMealVouchers: !!c.hasMealVouchers,
      mealVoucherCount: typeof c.mealVoucherCount === 'number' ? c.mealVoucherCount : 0,
      activeGroupBuys: typeof c.activeGroupBuys === 'number' ? c.activeGroupBuys : 0,
    }
  } catch { return undefined }
}

async function fetchSellerDashboard(period: string): Promise<SellerDashBundle> {
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

  const bundle: SellerDashBundle = {
    hasBank: false, stats: { ...DEFAULT_DASH_STATS }, dailyStats: [], topProducts: [], streams: [],
    stockAlertCount: 0, followerCount: 0, hasLiveHistory: false, hasMealVouchers: false, mealVoucherCount: 0, activeGroupBuys: 0,
  }

  if (profileRes.status === 'fulfilled' && profileRes.value.data?.success) {
    const p = profileRes.value.data.data
    bundle.hasBank = !!(p?.bank_name && p?.bank_account)
  }
  if (dashRes.status === 'fulfilled' && dashRes.value.data.success) {
    const d = dashRes.value.data.data
    bundle.stats = {
      totalRevenue: d.summary?.total_sales || 0, totalOrders: d.summary?.total_orders || 0,
      activeStreams: 0, totalViewers: 0,
      pendingOrders: d.summary?.pending_orders || 0, cancelledOrders: d.summary?.cancelled_orders || 0,
      completedOrders: d.summary?.completed_orders || 0, avgOrderValue: d.summary?.avg_order_value || 0,
      lowStockCount: d.summary?.low_stock_count || 0, pendingSettlement: d.summary?.pending_settlement || 0,
    }
    bundle.dailyStats = d.daily || []
    bundle.topProducts = d.topProducts || []
  }
  if (streamsRes.status === 'fulfilled' && streamsRes.value.data.success) {
    const s: LiveStream[] = streamsRes.value.data.data || []
    bundle.streams = s
    bundle.stats.activeStreams = s.filter(x => x.status === 'live').length
    bundle.stats.totalViewers = s.reduce((sum, x) => sum + (x.viewer_count || 0), 0)
    bundle.hasLiveHistory = s.length > 0
  }
  if (stockRes.status === 'fulfilled' && stockRes.value.data?.success) {
    const alerts = stockRes.value.data.data || []
    bundle.stockAlertCount = Array.isArray(alerts) ? alerts.length : 0
  }
  if (followerRes.status === 'fulfilled' && followerRes.value.data?.success) {
    bundle.followerCount = followerRes.value.data.data?.count || 0
  }
  if (productsRes.status === 'fulfilled' && productsRes.value.data?.success) {
    const prods = productsRes.value.data.data || []
    type ProdEntry = { category?: string; group_buy_status?: string }
    const vouchers = (prods as ProdEntry[]).filter(p => p.category === 'meal_voucher' || p.category === 'group_buy')
    bundle.hasMealVouchers = vouchers.length > 0
    bundle.mealVoucherCount = vouchers.length
    bundle.activeGroupBuys = vouchers.filter(p => p.group_buy_status === 'active' || p.group_buy_status === 'achieved').length
  }

  // sessionStorage 캐시 (5분 TTL) — 다음 진입 즉시렌더.
  try {
    sessionStorage.setItem(`seller_dashboard_cache_${period}`, JSON.stringify({
      ts: Date.now(), stats: bundle.stats, dailyStats: bundle.dailyStats, topProducts: bundle.topProducts,
      streams: bundle.streams, stockAlertCount: bundle.stockAlertCount, followerCount: bundle.followerCount,
      hasLiveHistory: bundle.hasLiveHistory, hasMealVouchers: bundle.hasMealVouchers,
      mealVoucherCount: bundle.mealVoucherCount, activeGroupBuys: bundle.activeGroupBuys,
    }))
  } catch { /* quota 무시 */ }

  return bundle
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function SellerPage() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()

  const sellerType = localStorage.getItem('seller_type') || 'influencer'
  // 🛡️ 2026-05-21 Phase D-5: helper 사용 (직접 비교 금지).
  const isInfluencer = checkInfluencer(sellerType)
  // 🛡️ 2026-05-18: Mode-specific 대시보드 — SellerLayout 의 mode 토글과 동기화.
  //   'live' 모드 = 라이브 셀러용 (시청자/방송 KPI 강조)
  //   'store' 모드 = 공구 셀러용 (공구 진행률/매장 voucher 매출 강조)
  // 'both' 사용자는 토글로 전환, 단일 타입은 자동 고정.
  const activeMode = useSellerMode()
  const isLiveMode = activeMode === 'live'
  const isStoreMode = activeMode === 'store'

  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('7d')

  // 🛡️ 2026-06-03 Tier2(대시보드): 6-endpoint Promise.allSettled 대시보드 → useQuery.
  //   sessionStorage 5분 캐시 = initialData (즉시렌더) + refetchOnMount:'always' 백그라운드 fresh.
  //   실시간 주문 폴링(pollOrders)은 snapshot-diff/알림 사이드이펙트라 명령형 유지.
  const dashQ = useQuery<SellerDashBundle>({
    queryKey: ['seller', 'dashboard', period],
    queryFn: () => fetchSellerDashboard(period),
    enabled: isSellerAuthenticated(),
    initialData: () => readSellerDashCache(period),
    staleTime: 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnMount: 'always',
  })
  const hasBank = dashQ.data?.hasBank ?? false
  const stats = dashQ.data?.stats ?? DEFAULT_DASH_STATS
  const dailyStats = dashQ.data?.dailyStats ?? []
  const topProducts = dashQ.data?.topProducts ?? []
  const streams = dashQ.data?.streams ?? []
  const loading = dashQ.isLoading && !dashQ.data

  // Real-time orders
  const [recentOrders, setRecentOrders] = useState<Order[]>([])
  const [newOrderIds, setNewOrderIds] = useState<Set<number>>(new Set())
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  const [ordersRefreshing, setOrdersRefreshing] = useState(false)
  const lastMaxIdRef = useRef<number>(0)
  const newOrderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 대시보드 번들에서 파생 (stock/follower/활동 데이터)
  const stockAlertCount = dashQ.data?.stockAlertCount ?? 0
  const followerCount = dashQ.data?.followerCount ?? 0
  const hasLiveHistory = dashQ.data?.hasLiveHistory ?? false
  const hasMealVouchers = dashQ.data?.hasMealVouchers ?? false
  const mealVoucherCount = dashQ.data?.mealVoucherCount ?? 0
  const activeGroupBuys = dashQ.data?.activeGroupBuys ?? 0

  // 월간 매출 목표 (localStorage 저장)
  const [monthlyGoal, setMonthlyGoal] = useState<number>(() => {
    const stored = Number(localStorage.getItem('seller_monthly_goal') || '0')
    return stored > 0 ? stored : 10_000_000
  })
  const [editingGoal, setEditingGoal] = useState(false)

  // ── Auth ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isSellerAuthenticated()) redirectToLogin(navigate)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate])

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
                new Notification(t('seller.newOrderNotifTitle', { defaultValue: '🛒 새 주문이 들어왔어요!' }), {
                  body: t('seller.newOrderNotifBody', { defaultValue: '{{count}}건의 새 주문을 확인하세요', count: newIds.size }),
                  icon: '/favicon.ico',
                })
              } else if (Notification.permission === 'default') {
                Notification.requestPermission()
              }
              // 🛡️ 2026-05-27 (memory): module-scope 1회 생성 — 매 알림마다 새 Audio 인스턴스 회피.
              newOrderAudio.currentTime = 0
              newOrderAudio.play().catch(swallow('seller:new-order-audio'))
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
    const interval = setInterval(() => { if (!document.hidden) pollOrders() }, 10000)
    const onVisible = () => { if (!document.hidden) pollOrders() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
      if (newOrderTimerRef.current) clearTimeout(newOrderTimerRef.current)
    }
  }, [pollOrders])

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
          subtitle={`${getRoleLabel(getCurrentSellerRole())} — ${getRoleMeta(getCurrentSellerRole()).description}`}
          icon={<LayoutDashboard className="h-5 w-5" />}
        />

        {/* 🛡️ 2026-05-21 Phase D-5: role 기반 자동 분기 — 인플루언서/사장님별 전용 위젯. */}
        <RoleGate showFor="influencer-or-both">
          {getSellerId() && (
            <div className="max-w-md">
              <SellerTrackingLinkCopy sellerId={getSellerId() || ''} />
            </div>
          )}
        </RoleGate>

        <RoleGate showFor="store-or-both">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl">🏪</span>
              <div className="flex-1">
                <p className="text-sm font-bold text-emerald-900">매장 사장님 — QR 스캔 빠른 안내</p>
                <p className="text-xs text-emerald-700 mt-1 leading-relaxed">
                  • 손님이 매장 방문 시 QR / PIN 보여주면 카메라로 스캔하세요<br />
                  • 매직링크는 카톡으로 받은 링크 클릭 (로그인 불요)<br />
                  • 매출 정산: <a href="/seller/ledger" className="underline">/seller/ledger</a>
                </p>
              </div>
            </div>
          </div>
        </RoleGate>

        {/* 🏭 2026-06-04 (사용자 요청): 시작 가이드(온보딩 체크리스트) 제거 — 대시보드 간소화. */}
        {/* 🛡️ 2026-05-27: 영입자 + commission 분배 가시화 (영입자 있을 때만 표시) */}
        <SellerReferralInfoCard />

        {/* 🛡️ 2026-05-18: Mode-specific 헤더 배지 — 어느 모드인지 시각적으로 즉시 인지. */}
        {sellerType.toLowerCase() === 'both' && (
          <div className={`rounded-xl px-4 py-2.5 flex items-center gap-2 text-sm font-bold ${
            isLiveMode
              ? 'bg-red-50 text-red-700 border border-red-200'
              : 'bg-amber-50 text-amber-800 border border-amber-200'
          }`}>
            {isLiveMode ? '📺 라이브 셀러 모드' : '🏪 공구 셀러 모드'}
            <span className="text-xs font-normal text-gray-500">
              · {isLiveMode ? '라이브 송출 + 시청자 + 일반 상품 KPI 강조' : '공구 진행률 + 매장 voucher 매출 강조'}
            </span>
          </div>
        )}

        {/* 🛡️ 2026-05-18: Mode-specific 섹션 순서.
              store 모드: 공구 진행 현황을 KPI 위에 (공구 셀러의 1순위 관심사).
              live 모드: 기존 순서 유지 (KPI → 공구) — 라이브 셀러는 공구가 부수 활동. */}
        {isStoreMode && <SellerGroupBuyOverview />}

        {/* 🛡️ 2026-05-15: KPI 통합 대시보드 (단골 / 공구 / 매출 / 분쟁) */}
        <SellerKpiDashboard />

        {isLiveMode && <SellerGroupBuyOverview />}

        {/* 🏭 2026-06-04 (사용자 요청): 현재 등급(TierBadge) · 광고 슬롯 입찰 배너 · 시작 가이드(온보딩) ·
            7일 부트캠프 위젯 제거 — 셀러 대시보드 간소화. */}

          {/* ── 월간 매출 목표 진행률 ── */}
          <MonthlyGoalCard
            totalRevenue={stats.totalRevenue}
            monthlyGoal={monthlyGoal}
            setMonthlyGoal={setMonthlyGoal}
            editingGoal={editingGoal}
            setEditingGoal={setEditingGoal}
            goalProgress={goalProgress}
            daysLeft={daysLeft}
          />

          {/* ── Stats row ── */}
          {/* 🛡️ 2026-05-14: 태블릿 (md+) 4 cols → 풀 너비 활용 (iPad sidebar 있어도 588px+ 콘텐츠 영역).
              2026-05-18: Mode-specific 4번째 카드 — live 모드는 '진행 라이브', store 모드는 '진행 공구'. */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
            {[
              {
                label: t('seller.totalRevenue'), value: fmtPrice(stats.totalRevenue),
                sub: stats.avgOrderValue > 0 ? t('seller.avgPerOrder', { amount: fmtPrice(stats.avgOrderValue) }) : undefined,
                icon: <TrendingUp className="w-5 h-5" />, color: 'text-emerald-600', bg: 'bg-emerald-50',
                visible: true, delta: revenueDelta, showDelta: dailyStats.length >= 2,
              },
              {
                label: t('seller.totalOrders'), value: `${formatNumber(stats.totalOrders || 0)}`,
                sub: stats.completedOrders > 0 ? t('seller.completedCount', { count: stats.completedOrders }) : undefined,
                icon: <ShoppingBag className="w-5 h-5" />, color: 'text-blue-600', bg: 'bg-blue-50',
                visible: true, delta: ordersDelta, showDelta: dailyStats.length >= 2,
              },
              {
                label: t('seller.pendingOrders'), value: `${formatNumber(stats.pendingOrders || 0)}`,
                sub: t('seller.needsAction'),
                icon: <AlertCircle className="w-5 h-5" />, color: 'text-amber-600', bg: 'bg-amber-50',
                visible: true, delta: pendingDelta, showDelta: pendingDelta !== 0,
              },
              // 🛡️ 2026-05-18: live 모드 — 진행 중 라이브 + 누적 시청자
              {
                label: t('seller.activeStreams'), value: `${stats.activeStreams || 0}`,
                sub: stats.totalViewers > 0 ? t('seller.viewerCount', { count: stats.totalViewers }) : t('seller.noStreams'),
                icon: <Play className="w-5 h-5" />, color: 'text-red-500', bg: 'bg-red-50',
                visible: isLiveMode && isInfluencer, delta: viewersDelta, showDelta: viewersDelta !== 0,
              },
              // 🛡️ 2026-05-18: store 모드 — '진행 공구 보기' CTA 카드 (데이터는 SellerGroupBuyOverview 가 표시).
              //   KPI 카드 4칸 채우면서 SellerGroupBuyOverview 섹션으로 자연스럽게 유도.
              {
                label: t('seller.groupBuysCta', { defaultValue: '공구 운영' }),
                value: t('seller.viewGroupBuys', { defaultValue: '진행 현황' }),
                sub: t('seller.groupBuysCtaSub', { defaultValue: '👇 아래 섹션 확인' }),
                icon: <Package className="w-5 h-5" />, color: 'text-amber-700', bg: 'bg-amber-50',
                visible: isStoreMode, delta: 0, showDelta: false,
              },
            ].filter(card => card.visible).map(card => (
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

          {/* 🛡️ 2026-05-20: 큰 CTA 카드 그리드 (사용자 요청 — 작은 link 보다 명확) */}
          <PrimaryActions
            pendingOrders={stats.pendingOrders || 0}
            isInfluencer={isInfluencer}
          />

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
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5">

            {/* 🏭 2026-06-04 (사용자 요청): 실시간 주문 패널 제거 — 셀러 대시보드 간소화. */}

            {/* ── Right panel (col-span-1) ── */}
            <div className="space-y-4">

              {/* 전환 퍼널 — 실제 데이터만 표시 (추정값 사용 금지) */}
              <ConversionFunnel
                totalViewers={stats.totalViewers}
                totalOrders={stats.totalOrders}
              />

              {/* 빠른 액션 — 활동 데이터 기반 동적 배치 */}
              <QuickActions
                hasMealVouchers={hasMealVouchers}
                sellerType={sellerType}
                activeGroupBuys={activeGroupBuys}
                isInfluencer={isInfluencer}
                hasLiveHistory={hasLiveHistory}
              />

              {/* 알림 */}
              <AlertsGrid
                followerCount={followerCount}
                stockAlertCount={stockAlertCount}
                pendingOrders={stats.pendingOrders || 0}
                pendingSettlement={stats.pendingSettlement ?? Math.round(stats.totalRevenue * 0.85)}
                fmtShort={fmtShort}
              />

              {/* 내 공개 페이지 미리보기 */}
              <PublicPagePreview />
            </div>
          </div>

          {/* ── Chart ── */}
          {dailyStats.length > 0 && (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5">
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
