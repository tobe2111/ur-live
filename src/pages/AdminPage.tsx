import { CustomModal, useModal } from '@/components/CustomModal'
import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { clearAuthData } from '@/utils/auth'
import {
  Users, Play, Package, TrendingUp, CheckCircle, XCircle,
  DollarSign, Eye, RefreshCw, X
} from 'lucide-react'
import AdminLayout from '@/components/AdminLayout'
import { formatKST, formatKSTDate } from '@/utils/date'

interface ApiError {
  response?: { status?: number; data?: { error?: string } }
  message?: string
}

interface Seller {
  id: number
  email: string
  username?: string
  name?: string
  phone?: string
  business_name?: string
  business_number?: string
  company_name?: string
  status: string
  commission_rate?: number
  can_manipulate_stats?: number
  created_at: string
  // seller_business_info joined fields
  biz_number?: string
  biz_name?: string
  ceo_name?: string
  business_type?: string
  business_category?: string
  postal_code?: string
  address?: string
  address_detail?: string
  biz_phone?: string
  biz_email?: string
  biz_is_verified?: number
  biz_verified_at?: string | null
}

interface Stream {
  id: number
  title: string
  seller_id: number
  status: string
  youtube_video_id: string
  created_at: string
  seller_name?: string
  viewer_count?: number
}

interface Stats {
  totalSellers: number
  activeSellers: number
  totalStreams: number
  activeStreams: number
}

interface DashboardStats {
  todaySales: number
  todayOrders: number
  currentVisitors: number
  liveStreams: number
}

interface Alert {
  type: 'success' | 'warning' | 'error'
  emoji: string
  title: string
  message: string
}

export default function AdminPage() {
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
      .catch(() => {})
  }, [])

  // 매출 목표 달성 알림
  useEffect(() => {
    if (dashboardStats.todaySales >= salesTarget && !salesAlertShown.current) {
      setAlerts(prev => [...prev, {
        type: 'success',
        emoji: '\uD83C\uDF89',
        title: '일일 매출 목표 달성!',
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
    } catch { toast.error('수수료 변경 실패') }
  }
  const [liveStreams, setLiveStreams] = useState<Stream[]>([])

  useEffect(() => {
    const token = localStorage.getItem('admin_token')
    if (!token) {
      navigate('/admin/login', { replace: true })
      return
    }
    loadData()
    loadDashboardStats()
    const interval = setInterval(loadDashboardStats, 5000)
    return () => clearInterval(interval)
  }, [navigate])

  async function loadData() {
    try {
      const [sellersRes, pendingRes, streamsRes, liveStreamsRes] = await Promise.all([
        api.get('/api/admin/sellers'),
        api.get('/api/admin/sellers/pending'),
        api.get('/api/streams'),
        api.get('/api/streams?status=live'),
      ])
      const sellersData = sellersRes.data.data || []
      const pendingData = pendingRes.data.data || []
      const streamsData = streamsRes.data.data || []
      const liveStreamsData = liveStreamsRes.data.data || []
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
      setLoading(false)
    } catch (err: unknown) {
      const apiErr = err as ApiError
      if (apiErr.response?.status === 401) {
        localStorage.removeItem('admin_token')
        localStorage.removeItem('user_type')
        navigate('/admin/login')
      }
      setLoading(false)
    }
  }

  async function loadDashboardStats() {
    try {
      const response = await api.get('/api/admin/dashboard/stats')
      if (response.data?.success && response.data?.data) {
        setDashboardStats(response.data.data)
      }
    } catch { /* silent */ }

    // 이상 거래 감지: 최근 주문 확인
    try {
      const h = { headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` } }
      const ordersRes = await api.get('/api/admin/orders?page=1&limit=5', h)
      const orders = ordersRes.data?.data?.orders || ordersRes.data?.data || []
      const now = Date.now()

      for (const order of orders) {
        // 고액 주문 감지 (50만원 초과)
        if (Number(order.total_amount) > 500000) {
          setAlerts(prev => {
            if (prev.some(a => a.message.includes(order.order_number))) return prev
            return [...prev, {
              type: 'warning' as const,
              emoji: '\u26A0\uFE0F',
              title: '이상 거래 감지 - 고액 주문',
              message: `주문 ${order.order_number}: ${Number(order.total_amount).toLocaleString()}원 (유저: ${order.user_email || order.user_id})`
            }]
          })
        }

        // 동일 유저 1분 내 다중 주문 감지
        if (order.user_id && order.created_at) {
          const orderTime = new Date(order.created_at).getTime()
          const recent = recentOrdersRef.current.filter(
            r => r.userId === order.user_id && Math.abs(now - r.time) < 60000
          )
          if (recent.length >= 2) {
            setAlerts(prev => {
              if (prev.some(a => a.title === '이상 거래 감지 - 연속 주문' && a.message.includes(order.user_id))) return prev
              return [...prev, {
                type: 'error' as const,
                emoji: '\uD83D\uDEA8',
                title: '이상 거래 감지 - 연속 주문',
                message: `유저 ${order.user_email || order.user_id}이(가) 1분 내 ${recent.length + 1}건 주문`
              }]
            })
          }
          // 기존 기록에 없으면 추가
          if (!recentOrdersRef.current.some(r => r.userId === order.user_id && r.time === orderTime)) {
            recentOrdersRef.current.push({ userId: order.user_id, time: orderTime })
          }
        }
      }

      // 오래된 기록 정리 (5분 이상)
      recentOrdersRef.current = recentOrdersRef.current.filter(r => now - r.time < 300000)
    } catch { /* silent */ }
  }

  async function approveSeller(sellerId: number) {
    if (!confirm('이 판매자를 승인하시겠습니까?')) return
    try {
      const response = await api.patch(`/api/admin/sellers/${sellerId}/approve`, {})
      toast.success(response.data.message || '판매자 승인 완료!')
      loadData()
    } catch (err: unknown) {
      const apiErr = err as ApiError
      toast.error(`승인 실패: ${apiErr.response?.data?.error || apiErr.message}`)
    }
  }

  async function rejectSeller() {
    if (!selectedSeller || !rejectionReason.trim()) {
      toast.error('거부 사유를 입력해주세요')
      return
    }
    try {
      const response = await api.patch(`/api/admin/sellers/${selectedSeller.id}/reject`, { reason: rejectionReason })
      toast.info(response.data.message || '판매자 승인이 거부되었습니다')
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
      toast.success('사업자 정보를 승인했습니다')
      setBizInfoSeller(prev => prev ? { ...prev, biz_is_verified: 1, biz_verified_at: new Date().toISOString() } : null)
    } catch (err: unknown) {
      const apiErr = err as ApiError
      toast.error(apiErr.response?.data?.error || '승인 실패')
    }
  }

  async function rejectBizInfo(sellerId: number) {
    try {
      await api.patch(`/api/admin/sellers/${sellerId}/business-info/reject`)
      toast.success('사업자 정보를 반려했습니다')
      setBizInfoSeller(prev => prev ? { ...prev, biz_is_verified: 0, biz_verified_at: null } : null)
    } catch (err: unknown) {
      const apiErr = err as ApiError
      toast.error(apiErr.response?.data?.error || '반려 실패')
    }
  }

  async function deleteStream(streamId: number) {
    if (!confirm('정말 이 라이브를 삭제하시겠습니까?')) return
    try {
      await api.delete(`/api/admin/streams/${streamId}`)
      toast.success('라이브 삭제 완료!')
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
      toast.error('수수료율은 0~100 사이여야 합니다')
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
    const action = newValue ? '승인' : '해제'
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
    if (!confirm('이 판매자를 정지(비활성화)하시겠습니까?')) return
    try {
      const response = await api.delete(`/api/admin/sellers/${sellerId}`)
      toast.success(response.data.message || '판매자가 정지되었습니다')
      loadData()
    } catch (err: unknown) {
      const apiErr = err as ApiError
      toast.error(`정지 실패: ${apiErr.response?.data?.error || apiErr.message}`)
    }
  }

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

  function fmtPrice(n: number) {
    return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(n || 0)
  }

  return (
    <AdminLayout title="관리자 대시보드" pendingCount={pendingSellers.length}>
      {/* Rejection Modal */}
      {rejectModalOpen && selectedSeller && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-base font-semibold text-gray-900 mb-4">판매자 승인 거부</h3>
            <p className="text-sm text-gray-600 mb-1">
              <strong>{selectedSeller.name || selectedSeller.username}</strong>님의 승인을 거부합니다.
            </p>
            <p className="text-xs text-gray-500 mb-3">거부 사유를 입력해주세요:</p>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="예: 사업자등록증 확인 불가"
              rows={3}
              className="w-full border border-gray-200 rounded-lg p-3 text-sm text-gray-900 focus:ring-2 focus:ring-red-500 focus:outline-none"
            />
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => { setRejectModalOpen(false); setSelectedSeller(null); setRejectionReason('') }}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200"
              >취소</button>
              <button
                onClick={rejectSeller}
                disabled={!rejectionReason.trim()}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
              >거부 확정</button>
            </div>
          </div>
        </div>
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
              <button onClick={() => dismissAlert(i)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      )}

      {/* ── 실시간 통계 카드 ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
        {[
          { label: '오늘 매출', value: fmtPrice(dashboardStats.todaySales), sub: '실시간', icon: <DollarSign className="w-5 h-5" />, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: '오늘 주문', value: `${(dashboardStats.todayOrders || 0).toLocaleString()}건`, sub: '실시간', icon: <Package className="w-5 h-5" />, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: '현재 방문자', value: `${(dashboardStats.currentVisitors || 0).toLocaleString()}명`, sub: '최근 5분', icon: <Eye className="w-5 h-5" />, color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: '라이브 방송', value: `${(dashboardStats.liveStreams || 0).toLocaleString()}개`, sub: '진행 중', icon: <Play className="w-5 h-5" />, color: 'text-red-500', bg: 'bg-red-50' },
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

      {/* ── 매출 차트 + 활동 피드 ── */}
      <div className="grid lg:grid-cols-2 gap-3 sm:gap-4">
        <AdminRevenueChart />
        <AdminActivityFeed />
      </div>

      {/* ── 판매자 통계 카드 ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
        {[
          { label: '총 판매자', value: stats.totalSellers, icon: <Users className="w-5 h-5" />, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: '승인된 판매자', value: stats.activeSellers, icon: <CheckCircle className="w-5 h-5" />, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: '총 라이브', value: stats.totalStreams, icon: <Play className="w-5 h-5" />, color: 'text-red-500', bg: 'bg-red-50' },
          { label: '진행 중 라이브', value: stats.activeStreams, icon: <TrendingUp className="w-5 h-5" />, color: 'text-amber-600', bg: 'bg-amber-50' },
        ].map(card => (
          <div key={card.label} className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-gray-500">{card.label}</span>
              <div className={`w-8 h-8 rounded-lg ${card.bg} ${card.color} flex items-center justify-center`}>
                {card.icon}
              </div>
            </div>
            <p className="text-xl font-bold text-gray-900">{card.value}</p>
          </div>
        ))}
      </div>

      {/* ── 진행 중인 라이브 ── */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-red-100 bg-red-50 flex items-center gap-2">
          <Play className="w-4 h-4 text-red-500" />
          <h2 className="text-sm font-semibold text-gray-900">진행 중인 라이브</h2>
          <span className="ml-auto text-xs font-semibold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
            {liveStreams.length}개
          </span>
        </div>
        {liveStreams.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-gray-400">현재 진행 중인 라이브가 없습니다</div>
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
                    <span>{(stream.viewer_count || 0).toLocaleString()}명</span>
                  </div>
                  <a
                    href={`/live/${stream.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
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
          <h2 className="text-sm font-semibold text-gray-900 mb-3">💰 플랫폼 수수료 설정</h2>
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
      {pendingSellers.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-amber-100 bg-amber-50 flex items-center gap-2">
            <Users className="w-4 h-4 text-amber-600" />
            <h2 className="text-sm font-semibold text-gray-900">승인 대기 판매자</h2>
            <span className="ml-auto text-xs font-semibold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
              {pendingSellers.length}명
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50">
                  {['신청일시', '이름', '이메일', '연락처', '상호명', '사업자번호', '승인 관리'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {pendingSellers.map(seller => (
                  <tr key={seller.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-xs text-gray-500">{formatKST(seller.created_at)}</td>
                    <td className="px-4 py-3">
                      <p className="text-xs font-medium text-gray-900">{seller.name || '-'}</p>
                      <p className="text-xs text-gray-400">{seller.username}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-600">{seller.email}</td>
                    <td className="px-4 py-3 text-xs text-gray-600">{seller.phone || '-'}</td>
                    <td className="px-4 py-3 text-xs text-gray-900">{seller.business_name || seller.company_name || '-'}</td>
                    <td className="px-4 py-3 text-xs text-gray-600">{seller.business_number || '-'}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button onClick={() => approveSeller(seller.id)} className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700">
                          <CheckCircle className="w-3 h-3" /> 승인
                        </button>
                        <button onClick={() => openRejectModal(seller)} className="flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700">
                          <XCircle className="w-3 h-3" /> 거부
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── 판매자 관리 ── */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">판매자 관리</h2>
          <button onClick={loadData} className="p-1.5 rounded-lg hover:bg-gray-100">
            <RefreshCw className="w-3.5 h-3.5 text-gray-400" />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50">
                {['ID', '이메일', '회사명', '수수료율', '특수권한', '상태', '가입일', '액션'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sellers.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-400">등록된 판매자가 없습니다</td></tr>
              ) : sellers.map(seller => (
                <tr key={seller.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-xs text-gray-500">{seller.id}</td>
                  <td className="px-4 py-3 text-xs text-gray-900">{seller.email}</td>
                  <td className="px-4 py-3 text-xs text-gray-900">{seller.business_name || seller.company_name || '-'}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => updateCommissionRate(seller.id, seller.commission_rate || 10)} className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                      {(seller.commission_rate || 10).toFixed(2)}%
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleManipulateStatsPermission(seller.id, seller.can_manipulate_stats || 0)}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
                        seller.can_manipulate_stats ? 'bg-purple-100 text-purple-700 hover:bg-purple-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      {seller.can_manipulate_stats ? <><CheckCircle className="w-3 h-3" />승인됨</> : <><XCircle className="w-3 h-3" />미승인</>}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                      seller.status === 'approved' ? 'bg-emerald-50 text-emerald-700' :
                      seller.status === 'suspended' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
                    }`}>
                      {seller.status === 'approved' ? '승인됨' : seller.status === 'suspended' ? '정지됨' : '대기중'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">{formatKSTDate(seller.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => openBizInfo(seller)} className="text-xs text-purple-600 hover:text-purple-800 font-medium">사업자정보</button>
                      {seller.status !== 'approved' && (
                        <button onClick={() => approveSeller(seller.id)} className="text-xs text-blue-600 hover:text-blue-800 font-medium">승인</button>
                      )}
                      {seller.status !== 'suspended' && (
                        <button onClick={() => suspendSeller(seller.id)} className="text-xs text-red-500 hover:text-red-700 font-medium">정지</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 라이브 스트림 관리 ── */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">라이브 스트림 관리</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50">
                {['ID', '제목', 'YouTube ID', '상태', '생성일', '액션'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {streams.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">등록된 라이브가 없습니다</td></tr>
              ) : streams.map(stream => (
                <tr key={stream.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-xs text-gray-500">{stream.id}</td>
                  <td className="px-4 py-3 text-xs text-gray-900">{stream.title}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 font-mono">{stream.youtube_video_id}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                      stream.status === 'live' ? 'bg-red-50 text-red-600' :
                      stream.status === 'scheduled' ? 'bg-amber-50 text-amber-600' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {stream.status === 'live' ? '🔴 라이브' : stream.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">{formatKSTDate(stream.created_at)}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => deleteStream(stream.id)} className="text-xs text-red-500 hover:text-red-700 font-medium">삭제</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {/* ── 사업자 정보 상세 모달 ── */}
      {bizInfoSeller && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="fixed inset-0 bg-black/50" onClick={() => setBizInfoSeller(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900">
                사업자 정보 — {bizInfoSeller.business_name || bizInfoSeller.name}
              </h3>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                bizInfoSeller.biz_is_verified
                  ? 'bg-emerald-50 text-emerald-700'
                  : bizInfoSeller.biz_number
                    ? 'bg-yellow-50 text-yellow-700'
                    : 'bg-gray-100 text-gray-400'
              }`}>
                {bizInfoSeller.biz_is_verified ? '승인됨' : bizInfoSeller.biz_number ? '승인 대기' : '미제출'}
              </span>
            </div>
            {!bizInfoSeller.biz_number ? (
              <p className="text-sm text-gray-400 text-center py-6">사업자 정보가 아직 제출되지 않았습니다.</p>
            ) : (
              <dl className="space-y-3">
                {[
                  { label: '사업자번호', value: bizInfoSeller.biz_number },
                  { label: '상호명', value: bizInfoSeller.biz_name },
                  { label: '대표자명', value: bizInfoSeller.ceo_name },
                  { label: '업태', value: bizInfoSeller.business_type },
                  { label: '업종', value: bizInfoSeller.business_category },
                  { label: '우편번호', value: bizInfoSeller.postal_code },
                  { label: '사업장 주소', value: bizInfoSeller.address },
                  { label: '상세 주소', value: bizInfoSeller.address_detail },
                  { label: '전화번호', value: bizInfoSeller.biz_phone },
                  { label: '이메일', value: bizInfoSeller.biz_email },
                  { label: '승인일시', value: bizInfoSeller.biz_verified_at ? formatKST(bizInfoSeller.biz_verified_at) : null },
                ].map(({ label, value }) => (
                  <div key={label} className="flex gap-3">
                    <dt className="text-xs text-gray-400 w-28 shrink-0">{label}</dt>
                    <dd className="text-xs text-gray-900 break-all">{value || <span className="text-gray-300">미입력</span>}</dd>
                  </div>
                ))}
              </dl>
            )}
            <div className="mt-5 flex gap-2">
              {bizInfoSeller.biz_number && !bizInfoSeller.biz_is_verified && (
                <button
                  onClick={() => approveBizInfo(bizInfoSeller.id)}
                  className="flex-1 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-xl hover:bg-emerald-700"
                >
                  승인
                </button>
              )}
              {bizInfoSeller.biz_number && !!bizInfoSeller.biz_is_verified && (
                <button
                  onClick={() => rejectBizInfo(bizInfoSeller.id)}
                  className="flex-1 py-2.5 bg-red-100 text-red-600 text-sm font-medium rounded-xl hover:bg-red-200"
                >
                  승인 취소
                </button>
              )}
              <button
                onClick={() => setBizInfoSeller(null)}
                className="flex-1 py-2.5 bg-gray-100 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-200"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}

function AdminRevenueChart() {
  const [data, setData] = useState<any[]>([])
  const [days, setDays] = useState(14)
  const h = { headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` } }
  useEffect(() => {
    api.get(`/api/admin/tools/chart/revenue?days=${days}`, h)
      .then(r => { if (r.data.success) setData(r.data.data || []) }).catch(() => {})
  }, [days])
  const max = Math.max(...data.map(d => d.revenue), 1)
  return (
    <div className="bg-white rounded-xl shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-gray-900">매출 추이</h3>
        <div className="flex gap-1">
          {[7, 14, 30].map(d => (
            <button key={d} onClick={() => setDays(d)}
              className={`px-2 py-1 rounded text-xs font-medium ${days === d ? 'bg-blue-100 text-blue-700' : 'text-gray-500'}`}>{d}일</button>
          ))}
        </div>
      </div>
      <div className="flex items-end gap-1 overflow-x-auto scrollbar-hide" style={{ minHeight: 160 }}>
        {data.slice(-14).map(d => (
          <div key={d.date} className="flex flex-col items-center flex-1 min-w-[28px]">
            <span className="text-[9px] text-gray-500 mb-1">{(d.revenue / 10000).toFixed(0)}만</span>
            <div className="w-full bg-gray-100 rounded-t" style={{ height: `${Math.max(4, (d.revenue / max) * 120)}px` }}>
              <div className="w-full h-full bg-emerald-500 rounded-t" />
            </div>
            <span className="text-[9px] text-gray-400 mt-1">{d.date.slice(5)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function AdminActivityFeed() {
  const [orders, setOrders] = useState<any[]>([])
  const lastCountRef = useRef(0)
  const h = { headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` } }
  const fetchOrders = () => {
    api.get('/api/admin/orders?page=1&limit=8', h)
      .then(r => {
        const list = r.data.data?.orders || r.data.data || []
        if (list.length > lastCountRef.current && lastCountRef.current > 0) {
          // 새 주문 알림
          try { new Audio('/static/notification.mp3').play().catch(() => {}) } catch {}
        }
        lastCountRef.current = list.length
        if (r.data.success) setOrders(list)
      }).catch(() => {})
  }
  useEffect(() => {
    fetchOrders()
    const interval = setInterval(fetchOrders, 30000) // 30초 자동 갱신
    return () => clearInterval(interval)
  }, [])
  return (
    <div className="bg-white rounded-xl shadow-sm p-4">
      <h3 className="text-sm font-bold text-gray-900 mb-3">최근 활동</h3>
      {orders.length === 0 ? <p className="text-xs text-gray-400">활동이 없습니다</p> : (
        <div className="space-y-2">
          {orders.slice(0, 8).map((o: { status: string; order_number: string; total_amount: number; created_at?: string }, i: number) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
              <span className="text-gray-700 flex-1 truncate">
                {o.status === 'PAID' || o.status === 'DONE' ? '💰 주문' : o.status === 'SHIPPING' ? '📦 배송' : o.status === 'CANCELLED' ? '❌ 취소' : '📝 ' + o.status}
                {' '}{o.order_number} · {Number(o.total_amount || 0).toLocaleString()}원
              </span>
              <span className="text-gray-400 shrink-0">{o.created_at ? new Date(o.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
