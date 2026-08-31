import { useEffect, useState, useRef, useCallback, Suspense } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { AlertCircle, CreditCard, Lock, ShoppingBag, TrendingUp } from 'lucide-react'
import { getSellerToken, getSellerId, isSellerAuthenticated, redirectToLogin } from '@/lib/seller-auth'
import SellerLayout from '@/components/SellerLayout'
import RoleGate from '@/components/RoleGate'
import { getRoleLabel, getRoleMeta, getCurrentSellerRole, isInfluencer as checkInfluencer } from '@/shared/seller-roles'
import { DashboardPageHeader } from '@/components/dashboard'
import SellerReferralInfoCard from '@/components/seller/SellerReferralInfoCard'
import SellerGroupBuyOverview from '@/components/seller/SellerGroupBuyOverview'
import SellerKpiDashboard from '@/components/seller/SellerKpiDashboard'
import { formatNumber } from '@/utils/format'
import { swallow } from '@/shared/utils/swallow'
import LazyChart from './seller-page/LazyChart'
import NewSellerSteps from './seller-page/NewSellerSteps'
import StoreQuickTrio from './seller-page/StoreQuickTrio'
import PrimaryActions from './seller-page/PrimaryActions'
import PublicPagePreview from './seller-page/PublicPagePreview'
import InsightsCallouts from './seller-page/InsightsCallouts'
import MyStoresPanel from './seller-page/MyStoresPanel'
import type { DashboardStats, DailyStats, TopProduct, Order } from './seller-page/types'
import SellerSupportContact from '@/components/seller/SellerSupportContact'

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
  followerCount: number
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
      followerCount: typeof c.followerCount === 'number' ? c.followerCount : 0,
      hasMealVouchers: !!c.hasMealVouchers,
      mealVoucherCount: typeof c.mealVoucherCount === 'number' ? c.mealVoucherCount : 0,
      activeGroupBuys: typeof c.activeGroupBuys === 'number' ? c.activeGroupBuys : 0,
    }
  } catch { return undefined }
}

async function fetchSellerDashboard(period: string): Promise<SellerDashBundle> {
  const token = getSellerToken()
  const headers = token ? { Authorization: `Bearer ${token}` } : {}
  // 🗑️ 2026-08-20 라이브 잔재 제거: /api/seller/streams 는 서버에서 사라진 라우트(영구 중단).
  // 🗑️ 2026-08-23 (대표 AB테스트 — "재고부족 같은 라이브커머스 잔재 다 지워"): 재고 경보
  //    (/api/inventory/stock/alerts — 쇼핑 재고 레일) 호출·타일 제거. 이용권 콘솔에 무의미.
  const [dashRes, followerRes, productsRes, profileRes] = await Promise.allSettled([
    api.get(`/api/seller/dashboard/stats?period=${period}`, { headers }),
    api.get(`/api/social/followers/${getSellerId()}`),
    api.get('/api/seller/products', { headers }),
    api.get('/api/seller/profile', { headers }),
  ])

  const bundle: SellerDashBundle = {
    hasBank: false, stats: { ...DEFAULT_DASH_STATS }, dailyStats: [], topProducts: [],
    followerCount: 0, hasMealVouchers: false, mealVoucherCount: 0, activeGroupBuys: 0,
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
      followerCount: bundle.followerCount, hasMealVouchers: bundle.hasMealVouchers,
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
  // 🗑️ 2026-08-23 (대표 AB테스트): live/store 모드 분기 제거 — 라이브 영구 중단으로 모드는 늘
  //   'store' 하나였다(modesForSellerType 이 LIVE_COMMERCE_SUSPENDED 에서 ['store'] 고정).

  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('7d')

  // 🚪 2026-08-24 (대표): "첫 단계는 매장 등록 — 무조건 선행. 없으면 다음 단계 이용 불가."
  //   MyStoresPanel 이 서버 판정(store_ready + 매장 목록)으로 게이트 여부를 알려준다.
  //   null(판정 중)엔 잠그지 않는다 — 오탐으로 정상 셀러를 막으면 안 된다(fail-open).
  const [storeGated, setStoreGated] = useState<boolean | null>(null)
  const onGateChange = useCallback((g: boolean | null) => setStoreGated(g), [])

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
  const loading = dashQ.isLoading && !dashQ.data

  // Real-time orders
  const [recentOrders, setRecentOrders] = useState<Order[]>([])
  const [newOrderIds, setNewOrderIds] = useState<Set<number>>(new Set())
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  const [ordersRefreshing, setOrdersRefreshing] = useState(false)
  const lastMaxIdRef = useRef<number>(0)
  const newOrderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 대시보드 번들에서 파생 (follower/활동 데이터)
  const followerCount = dashQ.data?.followerCount ?? 0
  const activeGroupBuys = dashQ.data?.activeGroupBuys ?? 0

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
                  icon: '/icon-biz-192.png',
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
  try {
    const raw = sessionStorage.getItem(snapshotKey)
    if (raw) {
      const prevSnap = JSON.parse(raw) as { pendingOrders?: number; ts?: number }
      // 24시간 이상 된 스냅샷만 비교용으로 사용
      if (prevSnap.ts && Date.now() - prevSnap.ts > 24 * 60 * 60 * 1000) {
        pendingDelta = pctDelta(stats.pendingOrders || 0, prevSnap.pendingOrders || 0)
      }
    }
  } catch { /* ignore */ }

  // ── Helpers ────────────────────────────────────────────────────────────────
  function fmtPrice(n: number) {
    return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(n || 0)
  }
  function timeAgo(date: Date) {
    const s = Math.floor((Date.now() - date.getTime()) / 1000)
    if (s < 60) return t('seller.secondsAgo', { count: s })
    if (s < 3600) return t('seller.minutesAgo', { count: Math.floor(s / 60) })
    return date.toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' })
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
      {/* 🗑️ 2026-07-07 라이브커머스 제거: 송출 버튼 삭제. */}
    </div>
  )

  return (
    <SellerLayout title={t('seller.dashboard')} headerRight={headerRight} pendingOrders={stats.pendingOrders}>
      {/* 🧱 2026-08-20 (대표): "너무 공백이 많아 — 컴팩트하게" → 세로 간격·패딩 축소. */}
      <div className="mx-auto max-w-7xl space-y-3 p-3 sm:p-4">
        {/* 🛡️ 2026-04-22 배치 131: 디자인 시스템 적용 */}
        {/* 🧹 2026-08-31: 상단바가 이미 "대시보드"를 말하는데 페이지 제목이 또 "대시보드"였다.
            같은 화면에서 같은 단어가 두 번 나오면 둘 중 하나는 자리만 차지한다.
            ⇒ 부제에 묻혀 있던 **역할**을 제목으로 올린다 — 이 화면이 실제로 알려 줄 것은
               "여기가 어디냐"(상단바가 답함)가 아니라 "당신이 무엇으로 로그인해 있느냐"다.
            아이콘도 뗐다. 홈 카테고리 '전체' 와 같은 그림이라 뜻을 더하지 않았다. */}
        <DashboardPageHeader
          title={getRoleLabel(getCurrentSellerRole())}
          subtitle={getRoleMeta(getCurrentSellerRole()).description}
        />

        {/* 🗑️ 2026-06-26 (대표 — '의미 없음'): 셀러 트래킹 링크(/browse?seller=) 제거.
            대상 /browse(쇼핑)는 SHOPPING_TAB_HIDDEN 으로 숨김 + 정식 공유 경로는 유어샵(/u/{handle}) 이라 obsolete. */}

        {/* 🏪 2026-08-24 (대표): 1번 섹션 = 내 매장 — 등록 매장 카드(여러 개면 여러 개, 카드마다
            이용권 등록). 등록 매장이 없으면 이 자리가 STEP 1 게이트가 되고 아래 전부가 잠긴다. */}
        <MyStoresPanel onGateChange={onGateChange} />

        {storeGated === true ? (
          <p className="text-center text-[12px] text-gray-400 py-8">
            <Lock className="w-3.5 h-3.5 inline-block align-[-2px] mr-1 text-gray-400" aria-hidden="true" />{t('seller.stores.lockedNote', { defaultValue: '매장 등록을 마치면 이용권 등록 · 주문 · 정산 · 소개 협업이 열려요' })}
          </p>
        ) : (
        <>
        {/* 🧱 2026-08-23 (대표 AB테스트 — "중요한 작업들이 모여있어야"): 핵심 작업 5버튼을
            헤더 바로 아래로 — 이용권 등록(주역)·주문·이용권 관리·정산·소개 파트너 찾기. */}
        <PrimaryActions
          pendingOrders={stats.pendingOrders || 0}
          activeGroupBuys={activeGroupBuys}
          settlementAvailable={stats.pendingSettlement ?? 0}
        />

        {/* 🧭 2026-07-19 (대표 UI v2 P2 — 심플 모드): 🏪 스캔 안내 카드 → 3액션 트리오(QR스캔·정산·내 딜)로 대체 */}
        <RoleGate showFor="store-or-both">
          <StoreQuickTrio />
        </RoleGate>

        {/* 🏭 2026-06-04 (사용자 요청): 시작 가이드(온보딩 체크리스트) 제거 — 대시보드 간소화. */}
        {/* 🛡️ 2026-05-27: 영입자 + commission 분배 가시화 (영입자 있을 때만 표시) */}
        <SellerReferralInfoCard />

        {/* 🗑️ 2026-08-23 (대표): 라이브/공구 모드 배지·이중 렌더 제거 — 라이브 영구 중단으로 모드는 하나다. */}
        <SellerGroupBuyOverview />

        {/* 🛡️ 2026-05-15: KPI 통합 대시보드 (단골 / 공구 / 매출 / 분쟁) */}
        <SellerKpiDashboard />

        {/* 🏭 2026-06-04 (사용자 요청): 현재 등급(TierBadge) · 광고 슬롯 입찰 배너 · 시작 가이드(온보딩) ·
            7일 부트캠프 위젯 제거 — 셀러 대시보드 간소화. */}

          {/* 🗑️ 2026-08-20 (대표): 월간 매출 목표 카드 제거 — "매출 목표 필요없고, 컴팩트하게". */}
          {/* ── Stats row ── */}
          {/* 🛡️ 2026-05-14: 태블릿 (md+) 4 cols → 풀 너비 활용 (iPad sidebar 있어도 588px+ 콘텐츠 영역).
              2026-05-18: Mode-specific 4번째 카드 — live 모드는 '진행 라이브', store 모드는 '진행 공구'. */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
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
              // 💰 2026-08-23 (대표 AB테스트): 4번째 카드 = 정산 예정 — 종전 '진행 현황 👇' 필러 CTA
              //   (라이브/모드 잔재)를 실데이터 카드로 대체.
              {
                label: t('seller.expectedSettlement', { defaultValue: '정산 예정' }),
                value: fmtPrice(stats.pendingSettlement ?? 0),
                sub: t('seller.primary.settlementsDesc', { defaultValue: '딜/현금 출금' }),
                icon: <CreditCard className="w-5 h-5" />, color: 'text-green-600', bg: 'bg-green-50',
                visible: true, delta: 0, showDelta: false,
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

          {/* 🧭 2026-06-09: 신규 셀러(상품 0·주문 0) 3단계 시작 안내 — 데이터 생기면 자동 소멸 */}
          {(stats.totalProducts ?? -1) === 0 && (stats.totalOrders || 0) === 0 && (
            <NewSellerSteps isStoreOwner={!isInfluencer} />
          )}

          {/* ── Actionable insights callouts ── (2026-08-26 컴포넌트 추출 — 로직 불변) */}
          <InsightsCallouts stats={stats} dailyStats={dailyStats} fmtPrice={fmtPrice} />

          {/* ── 할 일 목록 ── */}
          {/* 🗑️ 2026-08-23 (대표): 재고 부족 칩 제거 — 쇼핑 재고 레일 잔재. */}
          {(stats.pendingOrders > 0 || (stats.pendingSettlement ?? 0) > 0) && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <h3 className="text-sm font-bold text-amber-800 mb-2">📋 {t('seller.actionItems')}</h3>
              <div className="flex flex-wrap gap-2">
                {stats.pendingOrders > 0 && (
                  <Link to="/seller/orders" className="flex items-center gap-1.5 px-3 py-2 bg-white rounded-lg text-xs font-medium text-amber-700 border border-amber-200 hover:bg-amber-100">
                    <ShoppingBag className="w-3.5 h-3.5" /> {t('seller.unprocessedOrderCount', { count: stats.pendingOrders })}
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

          {/* 🗑️ 2026-08-23 (대표 AB테스트): 빠른 액션(→상단 핵심 작업으로 통합)·알림 그리드(재고 부족
              등 잔재, 나머지는 stat 카드와 중복)·전환 퍼널(시청자 지표 = 라이브 잔재) 제거.
              내 공개 페이지는 컴팩트 한 줄로. */}
          <PublicPagePreview followerCount={followerCount} />

          {/* ── Chart ── */}
          {dailyStats.length > 0 && (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
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

        </>
        )}

        {/* ☎️ 2026-08-01 O9 — 운영자 문의 경로(X8 확정 ⓒ). 미설정이면 자기가 안 그린다.
            게이트 밖 — 문의 경로는 매장 등록 전에도 열려 있어야 한다. */}
        <SellerSupportContact />

      </div>
    </SellerLayout>
  )
}
