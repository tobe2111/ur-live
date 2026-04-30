import { useEffect, useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import AgencyLayout from '@/components/AgencyLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import PLSimulator from '@/components/agency/PLSimulator'
import { LayoutDashboard } from 'lucide-react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { swallow } from '@/shared/utils/swallow'
import { formatNumber } from '@/utils/format'
import {
  Users, ShoppingBag, DollarSign, Play,
  TrendingUp, ArrowUpRight, CheckCircle, XCircle, Clock, Download, Bell,
  Link2, Copy, UserPlus, Eye, AlertTriangle, ChevronRight, UserCheck, Radio
} from 'lucide-react'

interface Stats {
  sellers: number
  orders_30d: number
  revenue_30d: number
  net_revenue_30d: number
  active_streams: number
}

interface Seller {
  id: number
  name: string
  business_name: string
  email: string
  status: string
  commission_rate: number
  total_orders: number
  total_revenue: number
  active_streams: number
}

interface Order {
  id: number
  order_number: string
  total_amount: number
  payment_status: string
  status: string
  created_at: string
  shipping_name: string
  seller_business_name: string
}

function NotificationList() {
  const { t } = useTranslation()
  const [notifs, setNotifs] = useState<any[]>([])
  const headers = { Authorization: `Bearer ${localStorage.getItem('agency_token') || ''}` }
  useEffect(() => {
    api.get('/api/agency/notifications', { headers })
      .then(r => { if (r.data.success) setNotifs((r.data.data || []).slice(0, 5)) })
      .catch((_e) => { if (import.meta.env.DEV) console.warn(_e) })
  }, [])
  if (notifs.length === 0) return <p className="text-xs text-gray-400">{t('agency.noNewNotifications')}</p>
  return (
    <div className="space-y-1.5">
      {notifs.map((n, i) => (
        <div key={i} className="flex items-start gap-2 text-xs">
          <span className="w-1.5 h-1.5 bg-purple-500 rounded-full mt-1.5 shrink-0" />
          <div>
            <p className="text-gray-700 font-medium">{n.title}</p>
            <p className="text-gray-400">{new Date(n.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation()
  const map: Record<string, { label: string; cls: string }> = {
    approved: { label: t('agency.statusApproved'), cls: 'bg-green-100 text-green-700' },
    pending:  { label: t('agency.statusPending'), cls: 'bg-amber-100 text-amber-700' },
    rejected: { label: t('agency.statusRejected'), cls: 'bg-red-100 text-red-700' },
    suspended:{ label: t('agency.statusSuspended'), cls: 'bg-gray-100 text-gray-600' },
  }
  const s = map[status] || { label: status, cls: 'bg-gray-100 text-gray-600' }
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.cls}`}>{s.label}</span>
}

function PayBadge({ status }: { status: string }) {
  const { t } = useTranslation()
  if (status === 'approved') return <span className="flex items-center gap-1 text-xs text-green-600"><CheckCircle className="w-3 h-3" />{t('common.paid')}</span>
  if (status === 'failed' || status === 'cancelled') return <span className="flex items-center gap-1 text-xs text-red-500"><XCircle className="w-3 h-3" />{t('common.cancelled')}</span>
  return <span className="flex items-center gap-1 text-xs text-amber-600"><Clock className="w-3 h-3" />{t('common.pending')}</span>
}

function InviteLinkSection() {
  const { t } = useTranslation()
  const agencyId = localStorage.getItem('agency_id')
  const inviteUrl = `https://live.ur-team.com/seller/register?agency=${agencyId}`
  const [recruitedCount, setRecruitedCount] = useState(0)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('agency_token')
    if (!token) return
    api.get('/api/agency/sellers', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => {
        const sellers = r.data.data || []
        setRecruitedCount(sellers.length)
      })
      .catch((_e) => { if (import.meta.env.DEV) console.warn(_e) })
  }, [])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setCopied(true)
      toast.success(t('agency.inviteLinkCopied'))
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error(t('common.copyFailed'))
    }
  }

  return (
    <div className="bg-white rounded-xl border border-[#E8EAEE] p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
          <UserPlus className="w-4 h-4 text-purple-600" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-gray-900">{t('agency.influencerInvite')}</h3>
          <p className="text-xs text-gray-500">{t('agency.shareLink')}</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <Link2 className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-xs font-semibold text-gray-700">{t('agency.recruitedSellers', { count: recruitedCount })}</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-600 truncate font-mono">
          {inviteUrl}
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-3 py-2 bg-purple-600 text-white rounded-lg text-xs font-bold hover:bg-purple-700 transition-colors shrink-0"
        >
          <Copy className="w-3.5 h-3.5" />
          {copied ? t('common.copied') : t('common.copy')}
        </button>
      </div>
    </div>
  )
}

interface DailyStat {
  date: string
  revenue: number
  orders: number
}

function RevenueTrendChart() {
  const { t } = useTranslation()
  const [daily, setDaily] = useState<DailyStat[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('agency_token')
    if (!token) return
    api.get('/api/agency/stats/daily?days=7', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => {
        if (r.data.success) setDaily(r.data.data || [])
      })
      .catch((_e) => { if (import.meta.env.DEV) console.warn(_e) })
      .finally(() => setLoading(false))
  }, [])

  // 최근 7일 날짜 버킷 생성 (데이터 없는 날도 0으로 표시)
  const buckets = useMemo(() => {
    const dayNames = [t('common.sun'), t('common.mon'), t('common.tue'), t('common.wed'), t('common.thu'), t('common.fri'), t('common.sat')]
    const byDate: Record<string, DailyStat> = {}
    for (const d of daily) byDate[d.date] = d
    const out: { key: string; label: string; revenue: number; orders: number }[] = []
    for (let i = 6; i >= 0; i--) {
      const dt = new Date()
      dt.setDate(dt.getDate() - i)
      const key = dt.toISOString().slice(0, 10)
      const match = byDate[key]
      out.push({
        key,
        label: dayNames[dt.getDay()],
        revenue: match?.revenue || 0,
        orders: match?.orders || 0,
      })
    }
    return out
  }, [daily])

  const maxVal = Math.max(1, ...buckets.map(b => b.revenue))

  if (loading && daily.length === 0) {
    return (
      <div className="flex items-end gap-2 h-[140px] px-2 pt-4">
        {[0, 1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full animate-pulse bg-gray-200 rounded" style={{ height: '40%' }} />
            <span className="text-[10px] text-gray-300">·</span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="flex items-end gap-2 h-[140px] px-2 pt-4">
      {buckets.map((b, i) => {
        const heightPct = b.revenue > 0 ? (b.revenue / (maxVal * 1.1)) * 100 : 0
        // 라이브/공구/제휴 세분화 데이터는 아직 없으므로 단일 바 (그라디언트) 표시
        return (
          <div key={b.key} className="flex-1 flex flex-col items-center gap-1" title={`${b.key}: ${formatNumber(b.revenue)}${t('common.won')} / ${b.orders}${t('agency.unitCase')}`}>
            <div className="w-full relative" style={{ height: `${Math.max(heightPct, 2)}%` }}>
              <div
                className="absolute bottom-0 w-full rounded-t-md"
                style={{
                  height: '100%',
                  background: b.revenue > 0
                    ? 'linear-gradient(180deg, #8B5CF6 0%, #6D28D9 100%)'
                    : '#E5E7EB',
                }}
              />
            </div>
            <span className="text-[10px] text-gray-400 font-medium">{b.label}</span>
            {i === buckets.length - 1 && (
              <span className="text-[9px] text-purple-600 font-bold">{t('agency.today')}</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

// Inline skeleton placeholder
const Skel = ({ className }: { className?: string }) => (
  <div className={`animate-pulse bg-gray-200 rounded ${className || ''}`} />
)

interface Stream {
  id: number
  title: string
  seller_business_name?: string
  seller_name?: string
  status: string
}

// 🛡️ 2026-04-26 L2: TikTok 스타일 핵심 KPI 6 + 의무 작업
interface KpiData {
  diamond_total: number
  live_rate: number
  effective_live_rate: number
  active_creators: number
  effective_active_creators: number
  new_creators_today: number
  total_sellers: number
  period_days: number
}
interface MonthlyTask {
  id: number
  task_type: 'creator_growth' | 'sales_quota' | 'activation'
  target_value: number
  actual_value: number
  status: 'in_progress' | 'completed' | 'failed'
  month: string
}

export default function AgencyPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [stats, setStats] = useState<Stats | null>(null)
  const [kpiData, setKpiData] = useState<KpiData | null>(null)
  const [monthlyTasks, setMonthlyTasks] = useState<MonthlyTask[]>([])
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

    // 🛡️ 2026-04-26 L2: KPI 6 + 의무 작업 추가 fetch (실패해도 기존 화면 유지)
    api.get('/api/agency/stats/kpi', { headers })
      .then(r => { if (r.data?.success) setKpiData(r.data.data) })
      .catch(swallow('agency:fetch-kpi'))
    api.get('/api/agency/monthly-tasks', { headers })
      .then(r => { if (r.data?.success) setMonthlyTasks(r.data.data || []) })
      .catch(swallow('agency:fetch-monthly-tasks'))

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
          subtitle={t('agency.dashboardSubtitle', { defaultValue: '에이전시 종합 현황 — 소속 셀러 성과 / 매출 / 라이브' })}
          icon={<LayoutDashboard className="h-5 w-5" />}
        />
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

      {/* 1. KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: t('agency.kpiSellers'), value: String(stats?.sellers ?? 0), sub: t('common.person'), icon: Users, color: 'bg-blue-600', delta: 0, showDelta: false },
          { label: t('agency.kpiOrders'), value: String(stats?.orders_30d ?? 0), sub: t('agency.kpiOrdersSub'), icon: ShoppingBag, color: 'bg-blue-500', delta: ordersDelta, showDelta },
          { label: t('agency.kpiRevenue'), value: `${((stats?.revenue_30d ?? 0) / 10000).toFixed(0)}${t('agency.manwon')}`, sub: t('agency.kpiRevenueSub'), icon: DollarSign, color: 'bg-emerald-500', delta: revenueDelta, showDelta },
          { label: t('agency.kpiSellerRevenue'), value: `${((stats?.net_revenue_30d ?? 0) / 10000).toFixed(0)}${t('agency.manwon')}`, sub: t('agency.kpiSellerRevenueSub'), icon: TrendingUp, color: 'bg-violet-500', delta: revenueDelta, showDelta },
          { label: t('agency.kpiLive'), value: String(stats?.active_streams ?? 0), sub: t('agency.kpiLiveSub'), icon: Play, color: 'bg-rose-500', delta: 0, showDelta: false },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-2xl p-4 bg-white border border-[#E8EAEE]">
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
        ))}
      </div>

      {/* 🛡️ 2026-04-26 L2: TikTok 스타일 핵심 지표 6가지 (Q5) */}
      {kpiData && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              📊 핵심 지표 6 ({kpiData.period_days}일 기준 · 참고용)
            </span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
            {[
              { label: '총 매출(딜)', value: `${(kpiData.diamond_total / 10_000).toFixed(1)}만`, sub: '매출+후원', color: 'bg-purple-500' },
              { label: '라이브 진행률', value: `${kpiData.live_rate}%`, sub: '진행 셀러 비율', color: 'bg-blue-500' },
              { label: '유효 라이브 진행률', value: `${kpiData.effective_live_rate}%`, sub: '30분↑ 셀러', color: 'bg-indigo-500' },
              { label: '활성 셀러', value: String(kpiData.active_creators), sub: '진행 셀러 수', color: 'bg-emerald-500' },
              { label: '유효 활성 셀러', value: String(kpiData.effective_active_creators), sub: '30분↑ 진행', color: 'bg-teal-500' },
              { label: '신규 셀러', value: String(kpiData.new_creators_today), sub: '오늘 영입', color: 'bg-orange-500' },
            ].map((kpi) => (
              <div key={kpi.label} className="rounded-xl p-3 bg-white border border-gray-200">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">{kpi.label}</p>
                <p className="text-lg font-extrabold text-gray-900">{kpi.value}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{kpi.sub}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 🛡️ 2026-04-27 Phase 2-2: PL 시뮬레이터 */}
      <PLSimulator />

      {/* 🛡️ 2026-04-26 L2: 이번 달 의무 작업 진행률 (Q6) */}
      {monthlyTasks.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
              🎯 이번 달 의무 작업
            </span>
            <span className="text-[10px] text-gray-400">{monthlyTasks[0]?.month}</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {monthlyTasks.map(task => {
              const pct = Math.min(100, Math.round((task.actual_value / Math.max(1, task.target_value)) * 100))
              const isCompleted = task.status === 'completed'
              const isFailed = task.status === 'failed'
              const taskLabel: Record<MonthlyTask['task_type'], string> = {
                creator_growth: '신규 영입',
                sales_quota: '월 매출',
                activation: '활성화 (1시간↑ 라이브)',
              }
              const formatValue = (n: number) =>
                task.task_type === 'sales_quota' ? `${(n / 10_000).toFixed(0)}만원` : `${n}${task.task_type === 'creator_growth' ? '명' : '명'}`

              return (
                <div key={task.id} className={`rounded-xl p-4 border ${
                  isCompleted ? 'bg-green-50 border-green-200' :
                  isFailed ? 'bg-red-50 border-red-200' :
                  'bg-white border-gray-200'
                }`}>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-bold text-gray-700">{taskLabel[task.task_type]}</p>
                    {isCompleted && <span className="text-[10px] bg-green-500 text-white px-1.5 py-0.5 rounded font-bold">완료 ✓</span>}
                    {isFailed && <span className="text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded font-bold">미달</span>}
                  </div>
                  <p className="text-lg font-extrabold text-gray-900 mb-2">
                    {formatValue(task.actual_value)} <span className="text-xs text-gray-400 font-normal">/ {formatValue(task.target_value)}</span>
                  </p>
                  <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        isCompleted ? 'bg-green-500' : isFailed ? 'bg-red-500' : pct >= 70 ? 'bg-blue-500' : 'bg-amber-500'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-gray-500 mt-1">{pct}%</p>
                </div>
              )
            })}
          </div>
        </div>
      )}

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

      {/* 2. Commission Banner */}
      <div className="bg-gradient-to-r from-indigo-600 to-blue-600 rounded-2xl p-5 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm opacity-80">{t('agency.commissionTitle')}</p>
            <p className="text-2xl font-extrabold mt-1">
              {formatNumber(commission)}{t('common.won')}
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
                    {s.active_streams > 0 && (
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

      {/* 7. Live Schedule */}
      {liveScheduleItems.length > 0 && (
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
