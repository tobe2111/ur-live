import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import {
  Users, Play, Package, TrendingUp, CheckCircle,
  DollarSign, Eye, X
} from 'lucide-react'
import AdminLayout from '@/components/AdminLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import { LayoutDashboard } from 'lucide-react'
import { formatNumber } from '@/utils/format'
import DeferUntilVisible from './admin-page/DeferUntilVisible'
import ChartSkeleton from './admin-page/ChartSkeleton'
import AdminRevenueChart from './admin-page/AdminRevenueChart'
import AdminActivityFeed from './admin-page/AdminActivityFeed'
import RejectionModal from './admin-page/RejectionModal'
import BizInfoModal from './admin-page/BizInfoModal'
import SellersTable from './admin-page/SellersTable'
import StreamsTable from './admin-page/StreamsTable'
import PendingSellersTable from './admin-page/PendingSellersTable'
import type { ApiError, Seller, Stream, Stats, DashboardStats, Alert } from './admin-page/types'

// 🛡️ 2026-05-02: TD-018 분할 — types / DeferUntilVisible / ChartSkeleton /
//   AdminRevenueChart / AdminActivityFeed / RejectionModal / BizInfoModal
//   를 ./admin-page/ 디렉토리로 추출. 미사용 imports (clearAuthData, formatKST,
//   AlertTriangle, Zap, ChevronRight, Search, MoreVertical, Bell, Send, Shield,
//   Radio, Activity, FileText) 제거.

export default function AdminPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [sellers, setSellers] = useState<Seller[]>([])
  const [pendingSellers, setPendingSellers] = useState<Seller[]>([])
  const [streams, setStreams] = useState<Stream[]>([])
  const [stats, setStats] = useState<Stats>({ totalSellers: 0, activeSellers: 0, totalStreams: 0, activeStreams: 0 })
  const [dashboardStats, setDashboardStats] = useState<DashboardStats>({ todaySales: 0, todayOrders: 0, currentVisitors: 0, liveStreams: 0 })
  const [loading, setLoading] = useState(true)
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
        message: `오늘 매출 ${fmtPrice(dashboardStats.todaySales)} 달성 (목표: ${fmtPrice(salesTarget)})`
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
  const [liveStreams, setLiveStreams] = useState<Stream[]>([])

  useEffect(() => {
    const token = localStorage.getItem('admin_token')
    if (!token) {
      navigate('/admin/login', { replace: true })
      return
    }
    // sessionStorage 캐시로 즉시 렌더 (5분 TTL)
    try {
      const cached = sessionStorage.getItem('admin_dashboard_cache')
      if (cached) {
        const c = JSON.parse(cached)
        if (Date.now() - (c.ts || 0) < 5 * 60 * 1000) {
          const sellersData = c.sellers || []
          const streamsData = c.streams || []
          setSellers(sellersData)
          setPendingSellers(c.pending || [])
          setStreams(streamsData)
          setLiveStreams(c.liveStreams || [])
          setStats({
            totalSellers: sellersData.length,
            activeSellers: sellersData.filter((s: Seller) => s.status === 'approved').length,
            totalStreams: streamsData.length,
            activeStreams: streamsData.filter((s: Stream) => s.status === 'live').length,
          })
          setLoading(false)
        }
      }
    } catch { /* 파싱 실패 무시 */ }
    loadData()
    loadDashboardStats()
    const interval = setInterval(() => { if (!document.hidden) loadDashboardStats() }, 30000)
    const onVisible = () => { if (!document.hidden) loadDashboardStats() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', onVisible) }
  }, [navigate])

  async function loadData() {
    // Promise.allSettled: 하나 실패해도 나머지 데이터 표시
    const [sellersRes, pendingRes, streamsRes, liveStreamsRes] = await Promise.allSettled([
      api.get('/api/admin/sellers'),
      api.get('/api/admin/sellers/pending'),
      api.get('/api/streams'),
      api.get('/api/streams?status=live'),
    ])

    // 401 체크: 첫 번째 auth 호출 실패 시 로그인으로
    const firstAuthErr = [sellersRes, pendingRes].find(r => r.status === 'rejected')
    if (firstAuthErr && firstAuthErr.status === 'rejected') {
      const apiErr = firstAuthErr.reason as ApiError
      if (apiErr?.response?.status === 401) {
        localStorage.removeItem('admin_token')
        localStorage.removeItem('user_type')
        navigate('/admin/login')
        setLoading(false)
        return
      }
    }

    const sellersData = sellersRes.status === 'fulfilled' ? (sellersRes.value.data.data || []) : []
    const pendingData = pendingRes.status === 'fulfilled' ? (pendingRes.value.data.data || []) : []
    const streamsData = streamsRes.status === 'fulfilled' ? (streamsRes.value.data.data || []) : []
    const liveStreamsData = liveStreamsRes.status === 'fulfilled' ? (liveStreamsRes.value.data.data || []) : []

    setLiveStreams(liveStreamsData)
    setSellers(sellersData)
    setPendingSellers(pendingData)
    setStreams(streamsData)
    setStats({
      totalSellers: sellersData.length,
      activeSellers: sellersData.filter((s: Seller) => s.status === 'approved').length,
      totalStreams: streamsData.length,
      activeStreams: streamsData.filter((s: Stream) => s.status === 'live').length,
    })

    // sessionStorage 캐시 저장 (5분 TTL)
    try {
      sessionStorage.setItem('admin_dashboard_cache', JSON.stringify({
        ts: Date.now(),
        sellers: sellersData, pending: pendingData, streams: streamsData, liveStreams: liveStreamsData,
      }))
    } catch { /* quota 초과 무시 */ }

    setLoading(false)
  }

  async function loadDashboardStats() {
    try {
      const response = await api.get('/api/admin/dashboard/stats')
      if (response.data?.success && response.data?.data) {
        setDashboardStats(response.data.data)
      }
    } catch { /* silent */ }

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
            title: `고액 주문 감지 (${userEntries.length}명)`,
            message: summary + (userEntries.length > 3 ? ` 외 ${userEntries.length - 3}명` : '')
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
    } catch { /* silent */ }
  }

  async function approveSeller(sellerId: number) {
    if (!confirm(t('admin.dashboard.k005', { defaultValue: '이 판매자를 승인하시겠습니까?' }))) return
    try {
      const response = await api.patch(`/api/admin/sellers/${sellerId}/approve`, {})
      toast.success(response.data.message || t('admin.dashboard.k006', { defaultValue: '판매자 승인 완료!' }))
      loadData()
    } catch (err: unknown) {
      const apiErr = err as ApiError
      toast.error(`승인 실패: ${apiErr.response?.data?.error || apiErr.message}`)
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
      toast.error(`거부 실패: ${apiErr.response?.data?.error || apiErr.message}`)
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
    if (!confirm(t('admin.dashboard.k013', { defaultValue: '정말 이 라이브를 삭제하시겠습니까?' }))) return
    try {
      await api.delete(`/api/admin/streams/${streamId}`)
      toast.success(t('admin.dashboard.k014', { defaultValue: '라이브 삭제 완료!' }))
      loadData()
    } catch (err: unknown) {
      const apiErr = err as ApiError
      toast.error(`삭제 실패: ${apiErr.response?.data?.error || apiErr.message}`)
    }
  }

  async function updateCommissionRate(sellerId: number, currentRate: number) {
    const newRate = prompt(`새 수수료율 (0-100%, 현재: ${currentRate}%)`, currentRate.toString())
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
    if (!confirm(`시청자 수 조작 권한을 ${action}하시겠습니까?`)) return
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
    if (!confirm(t('admin.dashboard.k018', { defaultValue: '이 판매자를 정지(비활성화)하시겠습니까?' }))) return
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
        <RejectionModal
          seller={selectedSeller}
          reason={rejectionReason}
          onReasonChange={setRejectionReason}
          onCancel={() => { setRejectModalOpen(false); setSelectedSeller(null); setRejectionReason('') }}
          onConfirm={rejectSeller}
        />
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
        ].map(card => (
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
        ].map(card => (
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

      {/* ── 진행 중인 라이브 ── */}
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
      />
      {/* ── 사업자 정보 상세 모달 ── */}
      {bizInfoSeller && (
        <BizInfoModal
          seller={bizInfoSeller}
          onClose={() => setBizInfoSeller(null)}
          onApprove={approveBizInfo}
          onReject={rejectBizInfo}
        />
      )}
      </div>
    </AdminLayout>
  )
}

