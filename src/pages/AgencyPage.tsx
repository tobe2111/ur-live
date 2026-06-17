import { useEffect, useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import AgencyLayout from '@/components/AgencyLayout'
import AgencyGroupBuyAlert from '@/components/agency/AgencyGroupBuyAlert'
import { DashboardPageHeader } from '@/components/dashboard'
import PLSimulator from '@/components/agency/PLSimulator'
import { LayoutDashboard } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { swallow } from '@/shared/utils/swallow'
import { formatNumber } from '@/utils/format'
import { LIVE_COMMERCE_SUSPENDED } from '@/shared/feature-flags'
import {
  Users, Store, DollarSign, Play,
  TrendingUp, ArrowUpRight, Download, Bell,
  Eye, AlertTriangle, ChevronRight, UserCheck, Radio, Ticket
} from 'lucide-react'
import NotificationList from './agency-page/NotificationList'
import { StatusBadge, PayBadge } from './agency-page/badges'
import { KpiMetricsGrid, MonthlyTasksGrid } from './agency-page/KpiMetricsGrid'
import InviteLinkSection from './agency-page/InviteLinkSection'
import RevenueTrendChart from './agency-page/RevenueTrendChart'
import type { Stats, Seller, Order, DailyStat, Stream, KpiData, MonthlyTask } from './agency-page/types'

// 🛡️ 2026-05-02: TD-018 분할 — types / NotificationList / StatusBadge / PayBadge /
//   InviteLinkSection / RevenueTrendChart 를 ./agency-page/ 디렉토리로 추출.
//   미사용 lucide-react 아이콘 (CheckCircle, XCircle, Clock, Link2, Copy, UserPlus) 정리.

// Inline skeleton placeholder (테이블 로딩 자리에서만 사용)
const Skel = ({ className }: { className?: string }) => (
  <div className={`animate-pulse bg-gray-200 rounded ${className || ''}`} />
)

type IntroducedSummary = {
  total_stores: number; active_stores: number
  total_commission: number; month_commission: number
  pending_commission: number; available_commission: number; paid_commission: number
}

type AgencyBundle = {
  stats: Stats | null; kpiData: KpiData | null; monthlyTasks: MonthlyTask[]
  sellers: Seller[]; orders: Order[]; daily: DailyStat[]; streams: Stream[]
  agencyProfile: { commission_rate?: number } | null
  introducedSummary: IntroducedSummary | null
}

// sessionStorage 즉시렌더 캐시 (5분 TTL) → useQuery initialData seed (이미 shaped — select 미사용).
function readAgencyCache(): AgencyBundle | undefined {
  try {
    const cached = sessionStorage.getItem('agency_dashboard_cache')
    if (!cached) return undefined
    const c = JSON.parse(cached)
    if (Date.now() - (c.ts || 0) >= 5 * 60 * 1000) return undefined
    return {
      stats: c.stats ?? null, kpiData: null, monthlyTasks: [],
      sellers: Array.isArray(c.sellers) ? c.sellers : [], orders: Array.isArray(c.orders) ? c.orders : [],
      daily: Array.isArray(c.daily) ? c.daily : [], streams: [], agencyProfile: null,
      introducedSummary: c.introducedSummary ?? null,
    }
  } catch { return undefined }
}

// 🛡️ 2026-06-03: bundle fetch + shaping. select 대신 fetcher 에서 shape → initialData(이미 shaped)와 형태 일치.
//   세션만료(success=false) → null 반환(상위 effect 가 로그인 redirect). 성공 시 sessionStorage 캐시 갱신.
async function fetchAgencyBundle(): Promise<AgencyBundle | null> {
  const res = await api.get('/api/agency/dashboard/bundle')
  const raw: any = res.data
  if (!raw?.success) return null
  const b = raw.data || {}
  const bundle: AgencyBundle = {
    stats: b.stats?.data ?? null,
    kpiData: b.kpi?.data ?? null,
    monthlyTasks: b.monthlyTasks?.data ?? [],
    sellers: b.sellers?.data ?? [],
    orders: b.orders?.data ?? [],
    daily: b.daily?.data ?? [],
    streams: b.streams?.data ?? [],
    agencyProfile: b.profile?.success ? b.profile.data : null,
    introducedSummary: b.introducedSummary?.success ? b.introducedSummary.data : null,
  }
  try {
    sessionStorage.setItem('agency_dashboard_cache', JSON.stringify({
      ts: Date.now(), stats: bundle.stats, sellers: bundle.sellers, orders: bundle.orders, daily: bundle.daily,
      introducedSummary: bundle.introducedSummary,
    }))
  } catch { /* quota 무시 */ }
  return bundle
}

export default function AgencyPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  // 월간 매출 목표 (localStorage 저장)
  const [monthlyGoal, setMonthlyGoal] = useState<number>(() => {
    const stored = Number(localStorage.getItem('agency_monthly_goal') || '0')
    return stored > 0 ? stored : 50_000_000
  })
  const [editingGoal, setEditingGoal] = useState(false)

  const token = localStorage.getItem('agency_token')

  useEffect(() => {
    if (!token) navigate('/agency/login', { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  // 🛡️ 2026-06-03 Tier2(대시보드): 8→1 bundle fetch 를 useQuery 로 이전.
  //   sessionStorage 5분 캐시는 initialData 로 보존(즉시렌더, 함수형 — mount 1회만 parse) + refetchOnMount:'always' 백그라운드 fresh.
  //   select 미사용 — fetcher 가 shape → initialData 와 형태 일치(select 가 initialData 까지 적용되어 null 되던 버그 회피).
  const bundleQ = useQuery<AgencyBundle | null>({
    queryKey: ['agency', 'dashboard-bundle'],
    queryFn: fetchAgencyBundle,
    enabled: !!token,
    initialData: () => readAgencyCache() ?? undefined,
    staleTime: 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnMount: 'always',
  })
  const stats = bundleQ.data?.stats ?? null
  const kpiData = bundleQ.data?.kpiData ?? null
  const monthlyTasks = bundleQ.data?.monthlyTasks ?? []
  const sellers = bundleQ.data?.sellers ?? []
  const orders = bundleQ.data?.orders ?? []
  const daily = bundleQ.data?.daily ?? []
  const streams = bundleQ.data?.streams ?? []
  const agencyProfile = bundleQ.data?.agencyProfile ?? null
  // 🏪 매장 영입 요약 (대시보드 1순위 지표)
  const introduced = bundleQ.data?.introducedSummary ?? null
  const loading = bundleQ.isLoading && !bundleQ.data

  // 세션 만료(success=false → fetcher 가 null 반환) → 로그인. (캐시 갱신은 fetcher 내부에서 성공 시 수행.)
  useEffect(() => {
    if (bundleQ.isFetched && bundleQ.data === null && !bundleQ.isFetching) {
      toast.error(t('agency.sessionExpired'))
      navigate('/agency/login', { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bundleQ.isFetched, bundleQ.data, bundleQ.isFetching])

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
  const { revenueDelta } = useMemo(() => {
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
  type AgencyInsightSeverity = 'high' | 'medium' | 'info'
  type AgencyInsightIcon = typeof AlertTriangle | typeof TrendingUp | typeof UserCheck | typeof Radio
  interface AgencyInsight {
    severity: AgencyInsightSeverity
    icon: AgencyInsightIcon
    title: string
    description?: string
    action?: { label: string; path: string }
  }
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

    // 4) 진행중 라이브 0 && 승인 셀러 > 0 — 🏁 라이브 중단 시 숨김(공구 집중).
    if (!LIVE_COMMERCE_SUSPENDED) {
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
    }

    return list
  }, [sellers, stats, daily])

  const showStatsSkeleton = loading && !stats

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

  return (
    <AgencyLayout title={t('seller.dashboard')}>
      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
        {/* 🛡️ 2026-04-22 배치 130: 디자인 시스템 적용 */}
        <DashboardPageHeader
          title={t('seller.dashboard')}
          subtitle={LIVE_COMMERCE_SUSPENDED
            ? t('agency.dashboardSubtitleStore', { defaultValue: '에이전시 종합 현황 — 소속 셀러 성과 / 매출 / 공구' })
            : t('agency.dashboardSubtitle', { defaultValue: '에이전시 종합 현황 — 소속 셀러 성과 / 매출 / 라이브' })}
          icon={<LayoutDashboard className="h-5 w-5" />}
        />

        {/* 🛡️ 2026-05-15: 본인 셀러망 즉시 액션 alert (churn / 미달성 / 분쟁) */}
        <AgencyGroupBuyAlert />

      {/* 0. 월간 매출 목표 진행률 */}
      <div className="bg-white rounded-2xl p-4 border border-[#E8EAEE]">
        <div className="flex items-center justify-between mb-2 gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-[12px] font-bold text-gray-700">{t('seller.monthlyGoalTitle')}</p>
              <button
                onClick={() => setEditingGoal(!editingGoal)}
                className="text-[10px] text-purple-600 hover:underline"
              >
                {editingGoal ? t('common.close') : t('seller.changeGoal')}
              </button>
            </div>
            {editingGoal ? (
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="number"
                  min={0}
                  step={1000000}
                  defaultValue={monthlyGoal}
                  onBlur={(e) => {
                    const v = Math.max(0, Number(e.target.value) || 0)
                    setMonthlyGoal(v)
                    localStorage.setItem('agency_monthly_goal', String(v))
                    setEditingGoal(false)
                  }}
                  className="text-[14px] font-bold text-gray-900 px-2 py-1 border border-gray-300 rounded w-44"
                />
                <span className="text-[12px] text-gray-500">{t('common.won')}</span>
              </div>
            ) : (
              <p className="text-[16px] sm:text-[20px] font-extrabold text-gray-900 truncate">
                {formatNumber(currentRev)}{t('common.won')} / {formatNumber(monthlyGoal)}{t('common.won')}
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
          {t('seller.daysLeft', { days: daysLeft })} · {t('seller.goalRemaining', { amount: Math.max(0, monthlyGoal - currentRev) })}
        </p>
      </div>

      {/* 1. KPI Row — 🏪 2026-06-17 매장 영입 중심 재편(소속 셀러 지표는 보존하되 후순위로). */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          // ① 영입 가게 — 에이전시 핵심 지표
          { label: t('agency.kpiStores', { defaultValue: '영입 가게' }), value: String(introduced?.total_stores ?? 0), sub: t('agency.kpiStoresSub', { defaultValue: '입점 매장' }), icon: Store, color: 'bg-indigo-600', delta: 0, showDelta: false, path: '/agency/introduced-stores' },
          // ② 이번달 영입 수익 (실 적립 commission)
          { label: t('agency.kpiStoreCommission', { defaultValue: '이번달 영입 수익' }), value: `${formatNumber(introduced?.month_commission ?? 0)}${t('common.won')}`, sub: t('agency.kpiStoreCommissionSub', { defaultValue: '매장 commission' }), icon: DollarSign, color: 'bg-emerald-500', delta: 0, showDelta: false, path: '/agency/settlements' },
          // ③ 진행중 공구 (라이브 중단 시) / 라이브 (복원 시)
          LIVE_COMMERCE_SUSPENDED
            ? { label: t('agency.kpiGroupBuys', { defaultValue: '진행중 공구' }), value: String(stats?.active_group_buys ?? 0), sub: t('agency.kpiGroupBuysSub', { defaultValue: '소속 셀러' }), icon: Ticket, color: 'bg-amber-500', delta: 0, showDelta: false, path: '/agency/group-buy' }
            : { label: t('agency.kpiLive'), value: String(stats?.active_streams ?? 0), sub: t('agency.kpiLiveSub'), icon: Play, color: 'bg-rose-500', delta: 0, showDelta: false },
          // ④ 30일 총매출 (영입 매장 + 소속 셀러 합산)
          { label: t('agency.kpiRevenue'), value: `${((stats?.revenue_30d ?? 0) / 10000).toFixed(0)}${t('agency.manwon')}`, sub: t('agency.kpiRevenueSub'), icon: TrendingUp, color: 'bg-blue-500', delta: revenueDelta, showDelta },
          // ⑤ 담당 셀러 (보존 — 후순위)
          { label: t('agency.kpiSellers'), value: String(stats?.sellers ?? 0), sub: t('common.person'), icon: Users, color: 'bg-violet-500', delta: 0, showDelta: false, path: '/agency/sellers' },
        ].map((kpi) => {
          const kpiPath = (kpi as { path?: string }).path
          return (
          <div
            key={kpi.label}
            onClick={kpiPath ? () => navigate(kpiPath) : undefined}
            className={`rounded-2xl p-4 bg-white border border-[#E8EAEE] ${kpiPath ? 'cursor-pointer hover:border-amber-300 transition-colors' : ''}`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#6B7280] mb-1">{kpi.label}</p>
                {showStatsSkeleton ? (
                  <>
                    <Skel className="h-6 w-2/3 mb-1" />
                    <Skel className="h-3 w-1/2" />
                  </>
                ) : (
                  <>
                    <p className="text-[22px] font-extrabold text-[#111]">{kpi.value}</p>
                    {kpi.showDelta && (
                      <span className={`text-[10px] font-bold block ${kpi.delta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {kpi.delta >= 0 ? '↑' : '↓'} {Math.abs(kpi.delta)}% {t('seller.vsPreviousPeriod')}
                      </span>
                    )}
                    {kpi.sub && <p className="text-[10px] text-gray-400 mt-0.5">{kpi.sub}</p>}
                  </>
                )}
              </div>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${kpi.color} shrink-0`}>
                <kpi.icon className="w-4 h-4 text-white" />
              </div>
            </div>
          </div>
          )
        })}
      </div>

      {/* 🛡️ 2026-04-26 L2: TikTok 스타일 핵심 지표 6가지 (Q5) */}
      {!LIVE_COMMERCE_SUSPENDED && kpiData && <KpiMetricsGrid kpiData={kpiData} />}

      {/* 🛡️ 2026-04-27 Phase 2-2: PL 시뮬레이터 */}
      <PLSimulator />

      {/* 🛡️ 2026-04-26 L2: 이번 달 의무 작업 진행률 (Q6) */}
      <MonthlyTasksGrid tasks={monthlyTasks} />

      {/* 1.5 Actionable insights callouts */}
      {insights.length > 0 && (
        <div className="space-y-2">
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

      {/* 2. Commission Banner — 🏪 매장 영입 누적 수익(실 적립) 우선 + 소속 셀러 추정 수수료는 보조 */}
      <div className="bg-gradient-to-r from-indigo-600 to-blue-600 rounded-2xl p-5 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm opacity-80">{t('agency.storeCommissionTitle', { defaultValue: '매장 영입 누적 수익' })}</p>
            <p className="text-2xl font-extrabold mt-1">
              {formatNumber(introduced?.total_commission ?? 0)}{t('common.won')}
            </p>
            <p className="text-xs opacity-70 mt-1">
              {t('agency.storeCommissionBreakdown', {
                defaultValue: '이번달 {{month}}원 · 정산 가능 {{avail}}원',
                month: formatNumber(introduced?.month_commission ?? 0),
                avail: formatNumber(introduced?.available_commission ?? 0),
              })}
            </p>
            <p className="text-[11px] opacity-50 mt-0.5">
              {t('agency.sellerCommissionAside', {
                defaultValue: '소속 셀러 매출 추정 수수료 {{c}}원 ({{rate}}%)',
                c: formatNumber(commission), rate: commissionRate,
              })}
            </p>
          </div>
          <button
            onClick={() => navigate('/agency/settlements')}
            className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-sm font-bold transition-colors shrink-0"
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
                  {formatNumber(totalOrdersAgg)}{t('agency.unitCase')}
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-gray-100">
                <div className="h-full rounded-full" style={{ width: '100%', background: '#10B981' }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. Quick Actions — 🏪 매장 영입 우선 */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => navigate('/agency/introduced-stores')} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700">+ {t('agency.inviteStore', { defaultValue: '가게 영입' })}</button>
        <button onClick={() => navigate('/agency/group-buy')} className="px-4 py-2 bg-amber-500 text-white rounded-lg text-xs font-bold hover:bg-amber-600">{t('agency.manageGroupBuyAction', { defaultValue: '공구 관리' })}</button>
        <button onClick={() => navigate('/agency/notices')} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-200">{t('agency.sendNotice')}</button>
        <button onClick={() => navigate('/agency/sellers')} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-200">{t('agency.inviteSeller')}</button>
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
        {/* Seller Ranking */}
        <div className="rounded-2xl bg-white border border-[#E8EAEE] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-bold text-gray-900">{t('agency.affiliatedSellers')}</h2>
            <button
              onClick={() => navigate('/agency/sellers')}
              className="text-xs text-purple-600 hover:underline flex items-center gap-1 font-semibold"
            >
              {t('seller.viewAll')} <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
          {loading && sortedSellers.length === 0 ? (
            <div className="divide-y divide-gray-50">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <Skel className="w-5 h-4" />
                    <div className="flex-1 min-w-0 space-y-1">
                      <Skel className="h-4 w-1/2" />
                      <Skel className="h-3 w-1/3" />
                    </div>
                  </div>
                  <Skel className="h-5 w-12" />
                </div>
              ))}
            </div>
          ) : sortedSellers.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400">
              {t('agency.noSellers')}<br />
              <span className="text-xs">{t('agency.requestAssignment')}</span>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {sortedSellers.slice(0, 8).map((s, idx) => (
                <div key={s.id} className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-[12px] font-bold text-gray-400 w-5 text-center">
                      {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{s.business_name || s.name}</p>
                      <p className="text-xs text-gray-400">{s.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 ml-3 flex-shrink-0">
                    <div className="text-right hidden sm:block">
                      <p className="text-xs font-semibold text-gray-900">{(s.total_revenue / 10000).toFixed(0)}{t('agency.manwon')}</p>
                      <p className="text-xs text-gray-400">{s.total_orders}{t('agency.unitCase')}</p>
                    </div>
                    {!LIVE_COMMERCE_SUSPENDED && s.active_streams > 0 && (
                      <span className="flex items-center gap-1 text-xs bg-rose-100 text-rose-600 px-2 py-0.5 rounded-full">
                        <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse" />
                        LIVE
                      </span>
                    )}
                    <StatusBadge status={s.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Orders */}
        <div className="rounded-2xl bg-white border border-[#E8EAEE] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-bold text-gray-900">{t('agency.recentOrders')}</h2>
            <button
              onClick={() => navigate('/agency/orders')}
              className="text-xs text-purple-600 hover:underline flex items-center gap-1 font-semibold"
            >
              {t('seller.viewAll')} <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
          {loading && orders.length === 0 ? (
            <div className="divide-y divide-gray-50">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between px-5 py-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <Skel className="h-3 w-1/3" />
                    <Skel className="h-4 w-1/4" />
                    <Skel className="h-3 w-1/2" />
                  </div>
                  <Skel className="h-4 w-16 ml-3" />
                </div>
              ))}
            </div>
          ) : orders.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400">{t('agency.noOrders')}</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {orders.map(o => (
                <div key={o.id} className="flex items-center justify-between px-5 py-3">
                  <div className="min-w-0">
                    <p className="text-xs font-mono text-gray-500">{o.order_number}</p>
                    <p className="text-sm font-medium text-gray-900">{formatNumber(o.total_amount)}{t('common.won')}</p>
                    <p className="text-xs text-gray-400">{o.seller_business_name}</p>
                  </div>
                  <div className="ml-3 flex-shrink-0">
                    <PayBadge status={o.payment_status} />
                    <p className="text-xs text-gray-400 mt-1 text-right">
                      {new Date(o.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 7. Live Schedule — 🏁 라이브 중단 시 숨김(공구 집중) */}
      {!LIVE_COMMERCE_SUSPENDED && liveScheduleItems.length > 0 && (
        <div className="rounded-2xl bg-white border border-[#E8EAEE] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-bold text-gray-900">{t('agency.liveInProgress')}</h2>
            <button
              onClick={() => navigate('/agency/streams')}
              className="text-xs text-purple-600 hover:underline flex items-center gap-1 font-semibold"
            >
              {t('agency.liveStatus')} <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
          <div className="divide-y divide-gray-50">
            {liveScheduleItems.map((item, i) => (
              <div key={i} className="flex items-center justify-between px-5 py-3.5 bg-pink-50/60">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-rose-600 bg-rose-100 px-2 py-0.5 rounded-full flex-shrink-0">
                    <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse" />
                    LIVE
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold text-gray-900 truncate">{item.sellerName}</p>
                    <p className="text-[11px] text-gray-500 truncate">{item.title}</p>
                  </div>
                </div>
                <button
                  onClick={() => navigate('/agency/streams')}
                  className="text-[11px] font-bold text-purple-600 hover:text-purple-700 flex items-center gap-0.5 ml-3 flex-shrink-0"
                >
                  {t('common.preview')} <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      </div>
    </AgencyLayout>
  )
}
