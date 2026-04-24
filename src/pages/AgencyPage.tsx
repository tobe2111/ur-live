import { useEffect, useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import AgencyLayout from '@/components/AgencyLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import { LayoutDashboard, Download, Bell, AlertTriangle, TrendingUp, UserCheck, Radio } from 'lucide-react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import type { Stats, Seller, Order, DailyStat, Stream, AgencyInsight } from '@/components/agency/dashboard/agency-dashboard-types'
import { NotificationList } from '@/components/agency/dashboard/NotificationList'
import { InviteLinkSection } from '@/components/agency/dashboard/InviteLinkSection'
import { RevenueTrendChart } from '@/components/agency/dashboard/RevenueTrendChart'
import { AgencyKpiRow } from '@/components/agency/dashboard/AgencyKpiRow'
import { AgencyInsightsCallouts } from '@/components/agency/dashboard/AgencyInsightsCallouts'
import { AgencySellerRanking } from '@/components/agency/dashboard/AgencySellerRanking'
import { AgencyRecentOrders } from '@/components/agency/dashboard/AgencyRecentOrders'
import { AgencyLiveSchedule } from '@/components/agency/dashboard/AgencyLiveSchedule'
import { AgencyMonthlyGoal } from '@/components/agency/dashboard/AgencyMonthlyGoal'

export default function AgencyPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [stats, setStats] = useState<Stats | null>(null)
  const [sellers, setSellers] = useState<Seller[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [daily, setDaily] = useState<DailyStat[]>([])
  const [streams, setStreams] = useState<Stream[]>([])
  const [agencyProfile, setAgencyProfile] = useState<{ commission_rate?: number } | null>(null)
  const [loading, setLoading] = useState(true)

  // 월간 매출 목표 (localStorage 저장)
  const [monthlyGoal, setMonthlyGoal] = useState<number>(() => {
    const stored = Number(localStorage.getItem('agency_monthly_goal') || '0')
    return stored > 0 ? stored : 50_000_000
  })
  const [editingGoal, setEditingGoal] = useState(false)

  const token = localStorage.getItem('agency_token')

  useEffect(() => {
    if (!token) { navigate('/agency/login', { replace: true }); return }
    const headers = { Authorization: `Bearer ${token}` }

    // sessionStorage 캐시로 즉시 렌더 (5분 TTL)
    try {
      const cached = sessionStorage.getItem('agency_dashboard_cache')
      if (cached) {
        const c = JSON.parse(cached)
        if (Date.now() - (c.ts || 0) < 5 * 60 * 1000) {
          if (c.stats) setStats(c.stats)
          if (Array.isArray(c.sellers)) setSellers(c.sellers)
          if (Array.isArray(c.orders)) setOrders(c.orders)
          if (Array.isArray(c.daily)) setDaily(c.daily)
          setLoading(false)
        }
      }
    } catch { /* 파싱 실패 무시 */ }

    // Promise.allSettled: 하나 실패해도 나머지 데이터 표시
    Promise.allSettled([
      api.get('/api/agency/stats', { headers }),
      api.get('/api/agency/sellers', { headers }),
      api.get('/api/agency/orders?limit=8', { headers }),
      api.get('/api/agency/stats/daily?days=14', { headers }),
      api.get('/api/agency/streams?status=live', { headers }),
      api.get('/api/agency/profile', { headers }),
    ])
      .then(([statsRes, sellersRes, ordersRes, dailyRes, streamsRes, profileRes]) => {
        // 통계 호출이 401로 실패하면 세션 만료 처리
        const authFailed = [statsRes, sellersRes].some(r =>
          r.status === 'rejected' && (r.reason as { response?: { status?: number } })?.response?.status === 401
        )
        if (authFailed) {
          toast.error(t('agency.sessionExpired'))
          navigate('/agency/login', { replace: true })
          return
        }

        const nextStats = statsRes.status === 'fulfilled' ? (statsRes.value.data.data as Stats | null) : null
        const nextSellers = sellersRes.status === 'fulfilled' ? (sellersRes.value.data.data || []) : []
        const nextOrders = ordersRes.status === 'fulfilled' ? (ordersRes.value.data.data || []) : []
        const nextDaily = dailyRes.status === 'fulfilled' ? (dailyRes.value.data.data || []) : []
        const nextStreams = streamsRes.status === 'fulfilled' ? (streamsRes.value.data.data || []) : []
        const nextProfile = profileRes.status === 'fulfilled' && profileRes.value.data.success ? profileRes.value.data.data : null

        if (nextStats) setStats(nextStats)
        setSellers(nextSellers)
        setOrders(nextOrders)
        setDaily(nextDaily)
        setStreams(nextStreams)
        if (nextProfile) setAgencyProfile(nextProfile)

        // sessionStorage 캐시 (5분 TTL)
        try {
          sessionStorage.setItem('agency_dashboard_cache', JSON.stringify({
            ts: Date.now(), stats: nextStats, sellers: nextSellers, orders: nextOrders, daily: nextDaily,
          }))
        } catch { /* quota 무시 */ }
      })
      .finally(() => setLoading(false))
  }, [token])

  const sortedSellers = useMemo(() =>
    [...sellers].sort((a, b) => (b.total_revenue || 0) - (a.total_revenue || 0)),
    [sellers]
  )

  const totalGMV = useMemo(() => sellers.reduce((s, sl) => s + (sl.total_revenue || 0), 0), [sellers])
  const commissionRate = agencyProfile?.commission_rate ?? 2.0
  const commission = useMemo(
    () => Math.round(((stats?.revenue_30d ?? 0) * commissionRate) / 100),
    [stats, commissionRate]
  )

  // ── Period-over-period 델타 (최근 7일 vs 이전 7일) ─────────────────────────
  const pctDelta = (curr: number, prev: number) => {
    if (prev > 0) return Math.round(((curr - prev) / prev) * 100)
    if (curr > 0) return 100
    return 0
  }
  const { revenueDelta, ordersDelta } = useMemo(() => {
    if (!daily || daily.length === 0) return { revenueDelta: 0, ordersDelta: 0 }
    const half = Math.max(1, Math.floor(daily.length / 2))
    const prev = daily.slice(0, half)
    const curr = daily.slice(-half)
    const prevRev = prev.reduce((s, d) => s + (d.revenue || 0), 0)
    const currRev = curr.reduce((s, d) => s + (d.revenue || 0), 0)
    const prevOrd = prev.reduce((s, d) => s + (d.orders || 0), 0)
    const currOrd = curr.reduce((s, d) => s + (d.orders || 0), 0)
    return {
      revenueDelta: pctDelta(currRev, prevRev),
      ordersDelta: pctDelta(currOrd, prevOrd),
    }
  }, [daily])
  const showDelta = daily.length >= 2

  // 월간 목표 진행률
  const now = new Date()
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
  const daysLeft = Math.max(0, daysInMonth - now.getDate())
  const currentRev = stats?.revenue_30d ?? 0
  const goalProgress = monthlyGoal > 0 ? (currentRev / monthlyGoal) * 100 : 0

  // 전환 퍼널 (에이전시: 소속 셀러 집계) — 실제 데이터만 표시 (추정값 사용 금지)
  const totalOrdersAgg = stats?.orders_30d ?? 0

  const liveScheduleItems = useMemo(() => {
    // 라이브 상태의 실제 스트림에서 제목 사용
    return streams
      .filter(st => st.status === 'live')
      .map(st => ({
        sellerName: st.seller_business_name || st.seller_name || '',
        title: st.title,
        isLive: true,
      }))
  }, [streams])

  // ── Actionable insights ────────────────────────────────────────────────────
  // 에이전시 대시보드 데이터로 자동 파생되는 배너
  const insights: AgencyInsight[] = useMemo(() => {
    const list: AgencyInsight[] = []

    // 1) 비활성 셀러 ≥ 1
    // proxy: 승인 상태이면서 총 주문 0건이고 현재 라이브 없음
    const inactiveSellers = sellers.filter(s =>
      s.status === 'approved' && (s.total_orders || 0) === 0 && (s.active_streams || 0) === 0
    ).length
    if (inactiveSellers >= 1) {
      list.push({
        severity: 'medium',
        icon: AlertTriangle,
        title: t('agency.inactiveSellersTitle', { count: inactiveSellers }),
        description: t('agency.inactiveSellersDesc'),
        action: { label: t('agency.manageSellers'), path: '/agency/sellers' },
      })
    }

    // 2) 이번 주 매출 < 지난 주 * 0.8 (일일 데이터 기반: 최근 7일 vs 이전 7일)
    if (daily && daily.length >= 4) {
      const half = Math.max(1, Math.floor(daily.length / 2))
      const prev = daily.slice(0, half)
      const curr = daily.slice(-half)
      const prevRev = prev.reduce((s, d) => s + (d.revenue || 0), 0)
      const currRev = curr.reduce((s, d) => s + (d.revenue || 0), 0)
      if (prevRev > 0 && currRev < prevRev * 0.8) {
        const dropPct = Math.round(((prevRev - currRev) / prevRev) * 100)
        list.push({
          severity: 'high',
          icon: TrendingUp,
          title: t('agency.weeklyDropTitle', { pct: dropPct }),
          description: t('agency.weeklyDropDesc'),
        })
      }
    }

    // 3) 승인 대기 셀러 ≥ 1
    const pendingSellers = sellers.filter(s => s.status === 'pending').length
    if (pendingSellers >= 1) {
      list.push({
        severity: 'info',
        icon: UserCheck,
        title: t('agency.pendingSellersTitle', { count: pendingSellers }),
        description: t('agency.pendingSellersDesc'),
        action: { label: t('common.manage'), path: '/agency/sellers' },
      })
    }

    // 4) 진행중 라이브 0 && 승인 셀러 > 0
    const liveStreams = stats?.active_streams ?? 0
    const activeSellers = sellers.filter(s => s.status === 'approved').length
    if (liveStreams === 0 && activeSellers > 0) {
      list.push({
        severity: 'info',
        icon: Radio,
        title: t('agency.noLiveTodayTitle'),
        description: t('agency.noLiveTodayDesc', { count: activeSellers }),
        action: { label: t('agency.viewSchedule'), path: '/agency/schedule' },
      })
    }

    return list
  }, [sellers, stats, daily])

  async function downloadCSV(days: number) {
    try {
      const res = await api.get(`/api/agency/report/csv?period=${days}`, {
        responseType: 'blob',
        headers: { Authorization: `Bearer ${token}` },
      })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url; a.download = `agency-report-${days}d.csv`; a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error(t('agency.reportDownloadFailed'))
    }
  }

  // suppress unused variable warning — totalGMV used for future display
  void totalGMV

  return (
    <AgencyLayout title={t('seller.dashboard')}>
      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
        {/* 🛡️ 2026-04-22 배치 130: 디자인 시스템 적용 */}
        <DashboardPageHeader
          title={t('seller.dashboard')}
          subtitle={t('agency.dashboardSubtitle') || '에이전시 종합 현황 — 소속 셀러 성과 / 매출 / 라이브'}
          icon={<LayoutDashboard className="h-5 w-5" />}
        />

      {/* 0. 월간 매출 목표 진행률 */}
      <AgencyMonthlyGoal
        currentRev={currentRev}
        monthlyGoal={monthlyGoal}
        goalProgress={goalProgress}
        daysLeft={daysLeft}
        editingGoal={editingGoal}
        onToggleEdit={() => setEditingGoal(!editingGoal)}
        onGoalChange={(v) => {
          setMonthlyGoal(v)
          localStorage.setItem('agency_monthly_goal', String(v))
          setEditingGoal(false)
        }}
      />

      {/* 1. KPI Row */}
      <AgencyKpiRow
        stats={stats}
        loading={loading}
        ordersDelta={ordersDelta}
        revenueDelta={revenueDelta}
        showDelta={showDelta}
      />

      {/* 1.5 Actionable insights callouts */}
      <AgencyInsightsCallouts insights={insights} />

      {/* 2. Commission Banner */}
      <div className="bg-gradient-to-r from-indigo-600 to-blue-600 rounded-2xl p-5 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm opacity-80">{t('agency.commissionTitle')}</p>
            <p className="text-2xl font-extrabold mt-1">
              {commission.toLocaleString()}{t('common.won')}
            </p>
            <p className="text-xs opacity-60 mt-1">{t('agency.commissionDesc', { rate: commissionRate })}</p>
          </div>
          <button
            onClick={() => navigate('/agency/settlements')}
            className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-sm font-bold transition-colors"
          >
            {t('agency.settlementManage')} →
          </button>
        </div>
      </div>

      {/* 2.5 전환 퍼널 — 실제 데이터만 표시 (추정값 사용 금지) */}
      <div className="bg-white rounded-2xl p-5 border border-[#E8EAEE]">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[14px] font-extrabold text-gray-900">{t('agency.orderStatusTitle')}</h3>
          <span className="text-[10px] text-gray-400">{t('agency.sellerAggregate')}</span>
        </div>
        {totalOrdersAgg === 0 ? (
          <p className="text-[12px] text-gray-500 py-4 text-center">
            {t('agency.noOrderData')}
          </p>
        ) : (
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[12px] font-semibold text-gray-700">{t('agency.orderComplete')}</span>
                <span className="text-[12px] font-extrabold text-gray-900">
                  {totalOrdersAgg.toLocaleString()}{t('agency.unitCase')}
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-gray-100">
                <div className="h-full rounded-full" style={{ width: '100%', background: '#10B981' }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. Quick Actions */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => navigate('/agency/sellers')} className="px-4 py-2 bg-purple-600 text-white rounded-lg text-xs font-bold hover:bg-purple-700">+ {t('agency.inviteSeller')}</button>
        <button onClick={() => navigate('/agency/notices')} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-200">{t('agency.sendNotice')}</button>
        <button onClick={() => navigate('/agency/compare')} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-200">{t('agency.compareSellers')}</button>
        <button onClick={() => navigate('/agency/targets')} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-200">{t('agency.revenueGoal')}</button>
      </div>

      {/* 4. Invite Link */}
      <InviteLinkSection />

      {/* 5. Revenue Trend + CSV Download + Notifications */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-4">
        {/* Revenue Trend */}
        <div className="rounded-2xl bg-white border border-[#E8EAEE] p-5">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold text-gray-900">{t('agency.revenueTrend7days')}</h2>
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ background: '#8B5CF6' }} />
              <span className="text-[10px] text-gray-500">{t('agency.dailyRevenue')}</span>
            </div>
          </div>
          <RevenueTrendChart />
        </div>

        {/* CSV Download + Notifications */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-[#E8EAEE] p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-bold text-gray-900">{t('agency.revenueReportDownload')}</p>
            </div>
            <p className="text-xs text-gray-500 mb-3">{t('agency.revenueReportDesc')}</p>
            <div className="flex gap-2">
              {[7, 30, 90].map(d => (
                <button key={d}
                  onClick={() => downloadCSV(d)}
                  className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-200">
                  <Download className="w-3 h-3 inline mr-1" />{t('agency.daysShort', { days: d })}
                </button>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-[#E8EAEE] p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-bold text-gray-900">{t('agency.recentNotifications')}</p>
              <Bell className="w-4 h-4 text-gray-400" />
            </div>
            <NotificationList />
          </div>
        </div>
      </div>

      {/* 6. Seller Ranking + Recent Orders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AgencySellerRanking sortedSellers={sortedSellers} loading={loading} />
        <AgencyRecentOrders orders={orders} loading={loading} />
      </div>

      {/* 7. Live Schedule */}
      <AgencyLiveSchedule items={liveScheduleItems} />

      </div>
    </AgencyLayout>
  )
}
