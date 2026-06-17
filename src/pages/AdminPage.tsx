import { lazy, Suspense, useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { LIVE_COMMERCE_SUSPENDED } from '@/shared/feature-flags'
import { toast } from '@/hooks/useToast'
import {
  Users, Play, Package, TrendingUp, CheckCircle,
  DollarSign, Eye, X, Ticket, Truck, RotateCcw, Banknote, Boxes, AlertTriangle
} from 'lucide-react'
import AdminLayout from '@/components/AdminLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import { LayoutDashboard } from 'lucide-react'
import { formatNumber } from '@/utils/format'
import { confirmDialog } from '@/components/ui/confirm-dialog'
import DeferUntilVisible from './admin-page/DeferUntilVisible'
import ChartSkeleton from './admin-page/ChartSkeleton'
import AdminRevenueChart from './admin-page/AdminRevenueChart'
import AdminActivityFeed from './admin-page/AdminActivityFeed'
// 🛡️ 2026-05-27 (loading P1): 모달 lazy — 사용자가 액션 클릭 시만 fetch.
const RejectionModal = lazy(() => import('./admin-page/RejectionModal'))
const BizInfoModal = lazy(() => import('./admin-page/BizInfoModal'))
import SellersTable from './admin-page/SellersTable'
import StreamsTable from './admin-page/StreamsTable'
import PendingSellersTable from './admin-page/PendingSellersTable'
import type { ApiError, Seller, Stream, Stats, DashboardStats, Alert } from './admin-page/types'

// 🛡️ 2026-05-02: TD-018 분할 — types / DeferUntilVisible / ChartSkeleton /
//   AdminRevenueChart / AdminActivityFeed / RejectionModal / BizInfoModal
//   를 ./admin-page/ 디렉토리로 추출. 미사용 imports (clearAuthData, formatKST,
//   AlertTriangle, Zap, ChevronRight, Search, MoreVertical, Bell, Send, Shield,
//   Radio, Activity, FileText) 제거.

// 🛡️ 2026-06-03 Tier2(대시보드): 4-endpoint 번들 타입 + fetcher + sessionStorage seed.
type AdminBundle = { sellers: Seller[]; pending: Seller[]; streams: Stream[]; liveStreams: Stream[] }

function readAdminDashCache(): AdminBundle | undefined {
  try {
    const cached = sessionStorage.getItem('admin_dashboard_cache')
    if (!cached) return undefined
    const c = JSON.parse(cached)
    if (Date.now() - (c.ts || 0) >= 5 * 60 * 1000) return undefined
    return { sellers: c.sellers || [], pending: c.pending || [], streams: c.streams || [], liveStreams: c.liveStreams || [] }
  } catch { return undefined }
}

async function fetchAdminDashboard(): Promise<AdminBundle> {
  const [sellersRes, pendingRes, streamsRes, liveStreamsRes] = await Promise.allSettled([
    api.get('/api/admin/sellers?limit=200'),
    api.get('/api/admin/sellers/pending?limit=100'),
    // 🛡️ 2026-06-17: 관리 테이블은 admin 엔드포인트 사용 — 소프트 삭제(deleted_at) 스트림 제외
    //   → 단건/일괄 삭제 후 행이 실제로 사라짐. (public /api/streams 는 deleted_at 미필터)
    api.get('/api/admin/streams?limit=100'),
    api.get('/api/streams?status=live&limit=50'),
  ])
  const sellers = sellersRes.status === 'fulfilled' ? (sellersRes.value.data.data || []) : []
  const pending = pendingRes.status === 'fulfilled' ? (pendingRes.value.data.data || []) : []
  const streams = streamsRes.status === 'fulfilled' ? (streamsRes.value.data.data || []) : []
  const liveStreams = liveStreamsRes.status === 'fulfilled' ? (liveStreamsRes.value.data.data || []) : []
  const bundle = { sellers, pending, streams, liveStreams }
  try { sessionStorage.setItem('admin_dashboard_cache', JSON.stringify({ ts: Date.now(), ...bundle })) } catch { /* quota 무시 */ }
  return bundle
}

export default function AdminPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  // 🛡️ 2026-06-03 Tier2(대시보드): 4-endpoint 번들 → useQuery (initialData=sessionStorage 즉시렌더 + refetchOnMount:'always').
  const dashQ = useQuery<AdminBundle>({
    queryKey: ['admin', 'dashboard'],
    queryFn: fetchAdminDashboard,
    enabled: !!localStorage.getItem('admin_token'),
    initialData: () => readAdminDashCache(),
    staleTime: 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnMount: 'always',
  })
  const sellers = dashQ.data?.sellers ?? []
  const pendingSellers = dashQ.data?.pending ?? []
  const streams = dashQ.data?.streams ?? []
  const stats: Stats = {
    totalSellers: sellers.length,
    activeSellers: sellers.filter((s: Seller) => s.status === 'approved').length,
    totalStreams: streams.length,
    activeStreams: streams.filter((s: Stream) => s.status === 'live').length,
  }
  const loading = dashQ.isLoading && !dashQ.data
  const loadData = () => dashQ.refetch()
  const [dashboardStats, setDashboardStats] = useState<DashboardStats>({ todaySales: 0, todayOrders: 0, currentVisitors: 0, liveStreams: 0 })
  const [rejectModalOpen, setRejectModalOpen] = useState(false)
  const [selectedSeller, setSelectedSeller] = useState<Seller | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [bizInfoSeller, setBizInfoSeller] = useState<Seller | null>(null)
  const [commissionSettings, setCommissionSettings] = useState<{ key: string; value: string; description: string }[]>([])

  // ── 실시간 알림 ──
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [salesTarget, setSalesTarget] = useState(1000000)
  const salesAlertShown = useRef(false)
  const recentOrdersRef = useRef<{ userId: string; time: number }[]>([])

  const dismissAlert = useCallback((index: number) => {
    setAlerts(prev => prev.filter((_, i) => i !== index))
  }, [])

  // 매출 목표 설정 로드
  useEffect(() => {
    api.get('/api/admin/settings/commission', { headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` } })
      .then(r => {
        if (r.data.success) {
          setCommissionSettings(r.data.data)
          const target = r.data.data?.find((s: { key: string }) => s.key === 'daily_sales_target')
          if (target) setSalesTarget(Number(target.value) || 1000000)
        }
      })
      .catch(() => { toast.error(t('admin.settings.fetchFailed', { defaultValue: '설정 데이터를 불러오지 못했습니다' })) })
  }, [])

  // 매출 목표 달성 알림
  useEffect(() => {
    if (dashboardStats.todaySales >= salesTarget && !salesAlertShown.current) {
      setAlerts(prev => [...prev, {
        type: 'success',
        emoji: '\uD83C\uDF89',
        title: t('admin.dashboard.k001', { defaultValue: '일일 매출 목표 달성!' }),
        message: t('admin.dashboard.todaySalesMsg', { sales: fmtPrice(dashboardStats.todaySales), target: fmtPrice(salesTarget), defaultValue: `오늘 매출 ${fmtPrice(dashboardStats.todaySales)} 달성 (목표: ${fmtPrice(salesTarget)})` })
      }])
      salesAlertShown.current = true
    }
  }, [dashboardStats.todaySales, salesTarget])

  async function updateCommission(key: string, newValue: string) {
    try {
      const res = await api.put('/api/admin/settings/commission', { key, value: newValue }, { headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` } })
      if (res.data.success) {
        toast.success(res.data.message)
        setCommissionSettings(prev => prev.map(s => s.key === key ? { ...s, value: newValue } : s))
      }
    } catch { toast.error(t('admin.commission.updateFailed', { defaultValue: '수수료 변경 실패' })) }
  }
  const liveStreams = dashQ.data?.liveStreams ?? []

  useEffect(() => {
    if (!localStorage.getItem('admin_token')) { navigate('/admin/login', { replace: true }); return }
    loadDashboardStats()
    const interval = setInterval(() => { if (!document.hidden) loadDashboardStats() }, 30000)
    const onVisible = () => { if (!document.hidden) loadDashboardStats() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', onVisible) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate])

  async function loadDashboardStats() {
    try {
      const response = await api.get('/api/admin/dashboard/stats')
      if (response.data?.success && response.data?.data) {
        setDashboardStats(response.data.data)
      }
    } catch (e) { if (import.meta.env.DEV) console.warn('[AdminPage] stats load failed:', e) }

    // 이상 거래 감지: 유저별 그룹핑 (도배 방지)
    try {
      const h = { headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` } }
      const ordersRes = await api.get('/api/admin/orders?page=1&limit=10', h)
      const orders = ordersRes.data?.data?.orders || ordersRes.data?.data || []
      const now = Date.now()

      // 고액 주문을 유저별 그룹핑 (개별 알림 도배 방지)
      const highValueByUser: Record<string, { count: number; total: number }> = {}
      for (const order of orders) {
        if (Number(order.total_amount) > 500000) {
          const uid = String(order.user_email || order.user_id || 'unknown')
          if (!highValueByUser[uid]) highValueByUser[uid] = { count: 0, total: 0 }
          highValueByUser[uid].count++
          highValueByUser[uid].total += Number(order.total_amount)
        }
      }
      const userEntries = Object.entries(highValueByUser)
      if (userEntries.length > 0) {
        setAlerts(prev => {
          if (prev.some(a => a.title.includes(t('admin.dashboard.k002', { defaultValue: '고액 주문' })))) return prev
          const summary = userEntries.slice(0, 3).map(([uid, d]) =>
            `${uid}: ${d.count}건 ${formatNumber(d.total)}원`
          ).join(' | ')
          return [...prev, {
            type: 'warning' as const,
            emoji: '⚠️',
            title: t('admin.dashboard.highOrderAlert', { count: userEntries.length, defaultValue: `고액 주문 감지 (${userEntries.length}명)` }),
            message: summary + (userEntries.length > 3 ? t('admin.dashboard.andMore', { n: userEntries.length - 3, defaultValue: ` 외 ${userEntries.length - 3}명` }) : '')
          }]
        })
      }

      // 연속 주문 감지 (유저별 1건만)
      const continuousDetected = new Set<string>()
      for (const order of orders) {
        if (order.user_id && order.created_at) {
          const uid = String(order.user_id)
          const orderTime = new Date(order.created_at).getTime()
          if (!continuousDetected.has(uid)) {
            const recent = recentOrdersRef.current.filter(
              r => r.userId === uid && Math.abs(now - r.time) < 60000
            )
            if (recent.length >= 2) {
              continuousDetected.add(uid)
              setAlerts(prev => {
                if (prev.some(a => a.title.includes(t('admin.dashboard.k003', { defaultValue: '연속 주문' })))) return prev
                return [...prev, {
                  type: 'error' as const,
                  emoji: '🚨',
                  title: t('admin.dashboard.k004', { defaultValue: '연속 주문 감지' }),
                  message: `유저 ${order.user_email || uid}: 1분 내 ${recent.length + 1}건`
                }]
              })
            }
          }
          if (!recentOrdersRef.current.some(r => r.userId === uid && r.time === orderTime)) {
            recentOrdersRef.current.push({ userId: uid, time: orderTime })
          }
        }
      }
      recentOrdersRef.current = recentOrdersRef.current.filter(r => now - r.time < 300000)
    } catch (e) { if (import.meta.env.DEV) console.warn('[AdminPage] orders load failed:', e) }
  }

  async function approveSeller(sellerId: number) {
    if (!(await confirmDialog(t('admin.dashboard.k005', { defaultValue: '이 판매자를 승인하시겠습니까?' })))) return
    try {
      const response = await api.patch(`/api/admin/sellers/${sellerId}/approve`, {})
      toast.success(response.data.message || t('admin.dashboard.k006', { defaultValue: '판매자 승인 완료!' }))
      loadData()
    } catch (err: unknown) {
      const apiErr = err as ApiError
      toast.error(t('admin.dashboard.approveFailed', { msg: apiErr.response?.data?.error || apiErr.message, defaultValue: `승인 실패: ${apiErr.response?.data?.error || apiErr.message}` }))
    }
  }

  async function rejectSeller() {
    if (!selectedSeller || !rejectionReason.trim()) {
      toast.error(t('admin.dashboard.k007', { defaultValue: '거부 사유를 입력해주세요' }))
      return
    }
    try {
      const response = await api.patch(`/api/admin/sellers/${selectedSeller.id}/reject`, { reason: rejectionReason })
      toast.info(response.data.message || t('admin.dashboard.k008', { defaultValue: '판매자 승인이 거부되었습니다' }))
      setRejectModalOpen(false)
      setSelectedSeller(null)
      setRejectionReason('')
      loadData()
    } catch (err: unknown) {
      const apiErr = err as ApiError
      toast.error(t('admin.dashboard.rejectFailed', { msg: apiErr.response?.data?.error || apiErr.message, defaultValue: `거부 실패: ${apiErr.response?.data?.error || apiErr.message}` }))
    }
  }

  function openRejectModal(seller: Seller) {
    setSelectedSeller(seller)
    setRejectionReason('')
    setRejectModalOpen(true)
  }

  async function openBizInfo(seller: Seller) {
    try {
      const token = localStorage.getItem('admin_token')
      const res = await api.get(`/api/admin/sellers/${seller.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      setBizInfoSeller(res.data.data)
    } catch {
      setBizInfoSeller(seller)
    }
  }

  async function approveBizInfo(sellerId: number) {
    try {
      await api.patch(`/api/admin/sellers/${sellerId}/business-info/approve`)
      toast.success(t('admin.dashboard.k009', { defaultValue: '사업자 정보를 승인했습니다' }))
      setBizInfoSeller(prev => prev ? { ...prev, biz_is_verified: 1, biz_verified_at: new Date().toISOString() } : null)
    } catch (err: unknown) {
      const apiErr = err as ApiError
      toast.error(apiErr.response?.data?.error || t('admin.dashboard.k010', { defaultValue: '승인 실패' }))
    }
  }

  async function rejectBizInfo(sellerId: number) {
    try {
      await api.patch(`/api/admin/sellers/${sellerId}/business-info/reject`)
      toast.success(t('admin.dashboard.k011', { defaultValue: '사업자 정보를 반려했습니다' }))
      setBizInfoSeller(prev => prev ? { ...prev, biz_is_verified: 0, biz_verified_at: null } : null)
    } catch (err: unknown) {
      const apiErr = err as ApiError
      toast.error(apiErr.response?.data?.error || t('admin.dashboard.k012', { defaultValue: '반려 실패' }))
    }
  }

  async function deleteStream(streamId: number) {
    if (!(await confirmDialog({ message: t('admin.dashboard.k013', { defaultValue: '정말 이 라이브를 삭제하시겠습니까?' }), danger: true }))) return
    try {
      await api.delete(`/api/admin/streams/${streamId}`)
      toast.success(t('admin.dashboard.k014', { defaultValue: '라이브 삭제 완료!' }))
      loadData()
    } catch (err: unknown) {
      const apiErr = err as ApiError
      toast.error(`삭제 실패: ${apiErr.response?.data?.error || apiErr.message}`)
    }
  }

  // 🛡️ 2026-06-17: 체크박스 일괄 삭제 — 선택한 라이브를 한번에 소프트 삭제.
  //   confirm → 삭제됨이면 true 반환(StreamsTable 이 선택 초기화) + refetch 로 행 제거.
  async function bulkDeleteStreams(ids: number[]): Promise<boolean> {
    if (ids.length === 0) return false
    if (!(await confirmDialog({ message: t('admin.dashboard.k072', { defaultValue: `선택한 ${ids.length}개 라이브를 삭제하시겠습니까?\n\n· 소프트 삭제 (이력/매출은 보존)\n· 메인/홈/다시보기 피드에서 즉시 제거됩니다` }), danger: true }))) return false
    try {
      const res = await api.delete('/api/admin/streams/bulk', { data: { ids } })
      toast.success(res.data?.message || t('admin.dashboard.k073', { defaultValue: `${res.data?.deleted ?? ids.length}건 삭제 완료!` }))
      loadData()
      return true
    } catch (err: unknown) {
      const apiErr = err as ApiError
      toast.error(`${t('admin.dashboard.k074', { defaultValue: '일괄 삭제 실패' })}: ${apiErr.response?.data?.error || apiErr.message}`)
      return false
    }
  }

  async function updateCommissionRate(sellerId: number, currentRate: number) {
    const newRate = prompt(t('admin.dashboard.commissionPrompt', { currentRate, defaultValue: `새 수수료율 (0-100%, 현재: ${currentRate}%)` }), currentRate.toString())
    if (!newRate) return
    const rate = parseFloat(newRate)
    if (isNaN(rate) || rate < 0 || rate > 100) {
      toast.error(t('admin.dashboard.k015', { defaultValue: '수수료율은 0~100 사이여야 합니다' }))
      return
    }
    try {
      await api.patch(`/api/admin/sellers/${sellerId}/commission`, { commission_rate: rate })
      toast.success(`수수료율 ${currentRate}% → ${rate}%로 변경`)
      loadData()
    } catch (err: unknown) {
      const apiErr = err as ApiError
      toast.error(`변경 실패: ${apiErr.response?.data?.error || apiErr.message}`)
    }
  }

  async function toggleManipulateStatsPermission(sellerId: number, currentValue: number) {
    const newValue = currentValue ? 0 : 1
    const action = newValue ? t('admin.dashboard.k016', { defaultValue: '승인' }) : t('admin.dashboard.k017', { defaultValue: '해제' })
    if (!(await confirmDialog(`시청자 수 조작 권한을 ${action}하시겠습니까?`))) return
    try {
      await api.patch(`/api/admin/sellers/${sellerId}/permissions`, { can_manipulate_stats: newValue })
      toast.success(`권한이 ${action}되었습니다!`)
      loadData()
    } catch (err: unknown) {
      const apiErr = err as ApiError
      toast.error(`권한 변경 실패: ${apiErr.response?.data?.error || apiErr.message}`)
    }
  }

  async function suspendSeller(sellerId: number) {
    if (!(await confirmDialog(t('admin.dashboard.k018', { defaultValue: '이 판매자를 정지(비활성화)하시겠습니까?' })))) return
    try {
      const response = await api.delete(`/api/admin/sellers/${sellerId}`)
      toast.success(response.data.message || t('admin.dashboard.k019', { defaultValue: '판매자가 정지되었습니다' }))
      loadData()
    } catch (err: unknown) {
      const apiErr = err as ApiError
      toast.error(`정지 실패: ${apiErr.response?.data?.error || apiErr.message}`)
    }
  }

  function fmtPrice(n: number) {
    return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(n || 0)
  }

  return (
    <AdminLayout title={t('admin.pages.dashboard')} pendingCount={pendingSellers.length}>
      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
        <div className="flex items-start justify-between gap-4">
          <DashboardPageHeader
            title={t('admin.pages.dashboard')}
            subtitle={t('admin.dashboard.k020', { defaultValue: "유어딜 전체 운영 현황 — 셀러 승인·매출·주문·정산" })}
            icon={<LayoutDashboard className="h-5 w-5" />}
          />
          <button
            onClick={() => { loadData(); loadDashboardStats() }}
            className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-[12px] font-semibold transition-colors"
            title={t('admin.dashboard.k021', { defaultValue: "수동 새로고침 (자동: 30초)" })}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            새로고침
          </button>
        </div>
      {/* Rejection Modal */}
      {rejectModalOpen && selectedSeller && (
        <Suspense fallback={null}>
          <RejectionModal
            seller={selectedSeller}
            reason={rejectionReason}
            onReasonChange={setRejectionReason}
            onCancel={() => { setRejectModalOpen(false); setSelectedSeller(null); setRejectionReason('') }}
            onConfirm={rejectSeller}
          />
        </Suspense>
      )}

      {/* ── 실시간 알림 ── */}
      {alerts.length > 0 && (
        <div className="space-y-2 mb-4">
          {alerts.map((alert, i) => (
            <div key={i} className={`flex items-center gap-3 px-4 py-3 rounded-xl ${
              alert.type === 'success' ? 'bg-green-50 border border-green-200' :
              alert.type === 'warning' ? 'bg-amber-50 border border-amber-200' :
              'bg-red-50 border border-red-200'
            }`}>
              <span className="text-lg">{alert.emoji}</span>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">{alert.title}</p>
                <p className="text-xs text-gray-500">{alert.message}</p>
              </div>
              <button onClick={() => dismissAlert(i)} aria-label={t('admin.dashboard.k022', { defaultValue: "알림 닫기" })} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      )}

      {/* ── 실시간 통계 카드 ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
        {[
          { label: t('admin.dashboard.k023', { defaultValue: '오늘 매출' }), value: fmtPrice(dashboardStats.todaySales), sub: t('admin.dashboard.k024', { defaultValue: '실시간' }), icon: <DollarSign className="w-5 h-5" />, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: '오늘 주문', value: `${formatNumber(dashboardStats.todayOrders || 0)}건`, sub: '실시간', icon: <Package className="w-5 h-5" />, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: '현재 방문자', value: `${formatNumber(dashboardStats.currentVisitors || 0)}명`, sub: '최근 5분', icon: <Eye className="w-5 h-5" />, color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: '라이브 방송', value: `${formatNumber(dashboardStats.liveStreams || 0)}개`, sub: '진행 중', icon: <Play className="w-5 h-5" />, color: 'text-red-500', bg: 'bg-red-50' },
        ].filter(card => !(LIVE_COMMERCE_SUSPENDED && card.label === '라이브 방송')).map(card => (
          <div key={card.label} className="bg-white rounded-xl p-3 sm:p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <span className="text-[10px] sm:text-xs font-medium text-gray-500">{card.label}</span>
              <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg ${card.bg} ${card.color} flex items-center justify-center`}>
                {card.icon}
              </div>
            </div>
            <p className="text-lg sm:text-xl font-bold text-gray-900 mb-0.5">{card.value}</p>
            <p className="text-[10px] sm:text-xs text-gray-400">{card.sub}</p>
          </div>
        ))}
      </div>

      {/* 🛡️ 2026-05-24 Q1: 교환권 거래 분리 표시 카드 (클릭 → /admin/voucher-transactions) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
        <button
          onClick={() => navigate('/admin/voucher-transactions')}
          className="bg-white rounded-xl p-3 sm:p-4 shadow-sm text-left active:opacity-80 transition-opacity hover:shadow-md col-span-2"
        >
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <span className="text-[10px] sm:text-xs font-medium text-gray-500">오늘 교환권 거래</span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-pink-50 text-pink-600 flex items-center justify-center">
              <Ticket className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-lg sm:text-xl font-bold text-gray-900">{formatNumber(dashboardStats.todayVouchers || 0)}건</p>
            <p className="text-sm text-gray-600">· {fmtPrice(dashboardStats.todayVouchersAmount || 0)}</p>
          </div>
          <p className="text-[10px] sm:text-xs text-pink-600 mt-0.5">→ 자세히 보기 (사용자/시각/상품)</p>
        </button>
        <button
          onClick={() => navigate('/admin/voucher-orders')}
          className="bg-white rounded-xl p-3 sm:p-4 shadow-sm text-left active:opacity-80 transition-opacity hover:shadow-md col-span-2"
        >
          <div className="flex items-center justify-between mb-2 sm:mb-3">
            <span className="text-[10px] sm:text-xs font-medium text-gray-500">KT Alpha 자동발송 상태</span>
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Package className="w-5 h-5" />
            </div>
          </div>
          <p className="text-sm text-gray-700">processing / sent / failed 추적</p>
          <p className="text-[10px] sm:text-xs text-amber-600 mt-0.5">→ 발송 추적 + 재발송</p>
        </button>
      </div>

      {/* 🛡️ 2026-06-14: 처리 대기 작업 — 운영자가 지금 처리해야 할 일 한눈에 (사용자 요구).
          각 카드 클릭 → 해당 처리 페이지. count 0 이어도 표시(안심용), >0 이면 강조. */}
      <div className="bg-white rounded-xl shadow-sm p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          <h2 className="text-sm font-semibold text-gray-900">처리 대기 작업</h2>
          <span className="text-xs text-gray-400">지금 확인이 필요한 운영 업무</span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-2 sm:gap-3">
          {[
            { label: '승인 대기 셀러', value: dashboardStats.pendingSellers ?? pendingSellers.length, icon: <Users className="w-4 h-4" />, link: '/admin/seller-approval', color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: '미발송 주문', value: dashboardStats.unshippedOrders ?? 0, icon: <Truck className="w-4 h-4" />, link: '/admin/orders?status=PAID', color: 'text-indigo-600', bg: 'bg-indigo-50' },
            { label: '반품 신청', value: dashboardStats.pendingReturns ?? 0, icon: <RotateCcw className="w-4 h-4" />, link: '/admin/returns', color: 'text-rose-600', bg: 'bg-rose-50' },
            { label: '정산 대기', value: dashboardStats.pendingPayouts ?? 0, icon: <Banknote className="w-4 h-4" />, link: '/admin/payout-center', color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: '공급사 승인', value: dashboardStats.pendingSuppliers ?? 0, icon: <Boxes className="w-4 h-4" />, link: '/admin/suppliers', color: 'text-purple-600', bg: 'bg-purple-50' },
            { label: '교환권 발송실패', value: dashboardStats.failedVouchers ?? 0, icon: <Ticket className="w-4 h-4" />, link: '/admin/voucher-orders', color: 'text-amber-600', bg: 'bg-amber-50' },
          ].map(task => (
            <button
              key={task.label}
              onClick={() => navigate(task.link)}
              className={`text-left rounded-lg p-3 border transition-all hover:shadow-sm ${
                task.value > 0 ? 'border-amber-200 bg-amber-50/40' : 'border-gray-100 bg-white hover:bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className={`w-7 h-7 rounded-lg ${task.bg} ${task.color} flex items-center justify-center`}>{task.icon}</span>
                {task.value > 0 && <span className="text-[10px] font-bold text-amber-600">처리 필요</span>}
              </div>
              <p className="text-lg font-bold text-gray-900">{formatNumber(task.value)}<span className="text-xs font-normal text-gray-400 ml-0.5">건</span></p>
              <p className="text-[11px] text-gray-500 truncate">{task.label}</p>
            </button>
          ))}
        </div>
      </div>

      {/* 🛡️ 2026-05-24: 별점 "신규" 즉시 백필 — cron 기다리지 않고 바로 시드 트리거. */}
      <div className="bg-white rounded-xl p-3 sm:p-4 shadow-sm flex items-center gap-3">
        <span className="text-2xl">⭐</span>
        <div className="flex-1">
          <p className="text-sm font-bold text-gray-900">신규 상품 별점 자동 시드</p>
          <p className="text-[11px] text-gray-500">review_count=0 + is_active=1 인 상품에 ★4.3~4.8 즉시 시드 (cron 기다리지 않음, 매시간 자동도 동작)</p>
        </div>
        <button
          onClick={async () => {
            if (!(await confirmDialog('신규 상품 (별점 없음) 전체에 허위리뷰 즉시 시드할까요? max 500개.'))) return
            try {
              const res = await api.post('/api/admin/reviews/auto-seed-missing', { max_batch: 500 })
              if (res.data?.success) {
                const r = res.data.data
                const msg = res.data.message || `✅ ${r.seeded_products}개 상품에 ${r.seeded_reviews}개 리뷰 시드 완료`
                if (r.seeded_products === 0) toast.info(msg)
                else toast.success(msg)
              } else {
                const debug = res.data?._debug?.message ? ` (${res.data._debug.message})` : ''
                toast.error((res.data?.error || '시드 실패') + debug)
              }
            } catch (e) {
              const ax = e as { response?: { data?: { error?: string; _debug?: { message?: string } } } }
              const debug = ax.response?.data?._debug?.message ? ` (${ax.response.data._debug.message})` : ''
              toast.error((ax.response?.data?.error || '시드 실패') + debug)
            }
          }}
          className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold rounded-lg"
        >
          즉시 시드
        </button>
      </div>

      {/* ── 매출 차트 + 활동 피드 (스크롤 진입 시 로드) ── */}
      <div className="grid lg:grid-cols-2 gap-3 sm:gap-4">
        <DeferUntilVisible fallback={<ChartSkeleton title={t('admin.dashboard.k025', { defaultValue: "매출 추이" })} />}>
          <AdminRevenueChart />
        </DeferUntilVisible>
        <DeferUntilVisible fallback={<ChartSkeleton title={t('admin.dashboard.k026', { defaultValue: "최근 활동" })} />}>
          <AdminActivityFeed />
        </DeferUntilVisible>
      </div>

      {/* ── 판매자 통계 카드 — 🛡️ 2026-04-28: 클릭 가능 (해당 페이지 이동) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
        {[
          { label: t('admin.dashboard.k027', { defaultValue: '총 판매자' }), value: stats.totalSellers, icon: <Users className="w-5 h-5" />, color: 'text-blue-600', bg: 'bg-blue-50', link: '/admin/seller-approval' },
          { label: t('admin.dashboard.k028', { defaultValue: '승인된 판매자' }), value: stats.activeSellers, icon: <CheckCircle className="w-5 h-5" />, color: 'text-emerald-600', bg: 'bg-emerald-50', link: '/admin/seller-approval?status=active' },
          { label: t('admin.dashboard.k029', { defaultValue: '총 라이브' }), value: stats.totalStreams, icon: <Play className="w-5 h-5" />, color: 'text-red-500', bg: 'bg-red-50', link: '/admin/live-monitor' },
          { label: t('admin.dashboard.k030', { defaultValue: '진행 중 라이브' }), value: stats.activeStreams, icon: <TrendingUp className="w-5 h-5" />, color: 'text-amber-600', bg: 'bg-amber-50', link: '/admin/live-monitor?status=live' },
        ].filter(card => !(LIVE_COMMERCE_SUSPENDED && card.link.startsWith('/admin/live-monitor'))).map(card => (
          <button
            key={card.label}
            onClick={() => navigate(card.link)}
            className="bg-white rounded-xl p-4 shadow-sm text-left hover:shadow-md hover:bg-gray-50 transition-all group cursor-pointer"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-gray-500 group-hover:text-gray-700">{card.label}</span>
              <div className={`w-8 h-8 rounded-lg ${card.bg} ${card.color} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                {card.icon}
              </div>
            </div>
            <p className="text-xl font-bold text-gray-900">{card.value}</p>
          </button>
        ))}
      </div>

      {/* ── 진행 중인 라이브 ── 🏭 2026-06-04 라이브 잠정 중단 시 숨김 (복원 가능) */}
      {!LIVE_COMMERCE_SUSPENDED && (
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-red-100 bg-red-50 flex items-center gap-2">
          <Play className="w-4 h-4 text-red-500" />
          <h2 className="text-sm font-semibold text-gray-900">{t('admin.dashboard.k031', { defaultValue: '진행 중인 라이브' })}</h2>
          <span className="ml-auto text-xs font-semibold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
            {liveStreams.length}개
          </span>
        </div>
        {liveStreams.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-gray-400">{t('admin.dashboard.k032', { defaultValue: '현재 진행 중인 라이브가 없습니다' })}</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {liveStreams.map(stream => (
              <div key={stream.id} className="px-5 py-3 flex items-center justify-between hover:bg-gray-50">
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-red-50 text-red-600">
                    🔴 라이브
                  </span>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{stream.title}</p>
                    <p className="text-xs text-gray-500">{stream.seller_name || `판매자 #${stream.seller_id}`}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <Eye className="w-3.5 h-3.5" />
                    <span>{formatNumber(stream.viewer_count || 0)}명</span>
                  </div>
                  <a
                    href={`/live/${stream.id}`}
                    target="_blank" rel="noopener noreferrer"
                    className="px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100"
                  >
                    보기
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      )}

      {/* ── 수수료 설정 ── */}
      {commissionSettings.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm p-5 mb-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">{t('admin.dashboard.k033', { defaultValue: '💰 플랫폼 수수료 설정' })}</h2>
          <div className="space-y-3">
            {commissionSettings.map(setting => (
              <div key={setting.key} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-900">{setting.description}</p>
                  <p className="text-xs text-gray-500">{setting.key}</p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={setting.value}
                    onChange={e => setCommissionSettings(prev => prev.map(s => s.key === setting.key ? { ...s, value: e.target.value } : s))}
                    className="w-20 px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900 text-right font-bold"
                    min="0" max="100" step="0.5"
                  />
                  <span className="text-sm text-gray-500">%</span>
                  <button
                    onClick={() => updateCommission(setting.key, setting.value)}
                    className="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700"
                  >
                    적용
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 승인 대기 판매자 ── */}
      <PendingSellersTable
        pendingSellers={pendingSellers}
        onApprove={approveSeller}
        onReject={openRejectModal}
      />

      {/* ── 판매자 관리 ── */}
      <SellersTable
        sellers={sellers}
        loading={loading}
        onRefresh={loadData}
        onUpdateCommission={updateCommissionRate}
        onTogglePermission={toggleManipulateStatsPermission}
        onOpenBizInfo={openBizInfo}
        onApprove={approveSeller}
        onSuspend={suspendSeller}
      />

      {/* ── 라이브 스트림 관리 ── */}
      <StreamsTable
        streams={streams}
        loading={loading}
        onDelete={deleteStream}
        onBulkDelete={bulkDeleteStreams}
      />
      {/* ── 사업자 정보 상세 모달 ── */}
      {bizInfoSeller && (
        <Suspense fallback={null}>
          <BizInfoModal
            seller={bizInfoSeller}
            onClose={() => setBizInfoSeller(null)}
            onApprove={approveBizInfo}
            onReject={rejectBizInfo}
          />
        </Suspense>
      )}
      </div>
    </AdminLayout>
  )
}

