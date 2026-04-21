import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import AgencyLayout from '@/components/AgencyLayout'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import {
  Users, ShoppingBag, DollarSign, Play,
  TrendingUp, ArrowUpRight, CheckCircle, XCircle, Clock, Download, Bell,
  Link2, Copy, UserPlus, Eye, AlertTriangle, ChevronRight
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
  const [notifs, setNotifs] = useState<any[]>([])
  const headers = { Authorization: `Bearer ${localStorage.getItem('agency_token') || ''}` }
  useEffect(() => {
    api.get('/api/agency/notifications', { headers })
      .then(r => { if (r.data.success) setNotifs((r.data.data || []).slice(0, 5)) })
      .catch(() => {})
  }, [])
  if (notifs.length === 0) return <p className="text-xs text-gray-400">새로운 알림이 없습니다</p>
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

function statusBadge(status: string) {
  const map: Record<string, { label: string; cls: string }> = {
    approved: { label: '승인', cls: 'bg-green-100 text-green-700' },
    pending:  { label: '대기', cls: 'bg-amber-100 text-amber-700' },
    rejected: { label: '거부', cls: 'bg-red-100 text-red-700' },
    suspended:{ label: '정지', cls: 'bg-gray-100 text-gray-600' },
  }
  const s = map[status] || { label: status, cls: 'bg-gray-100 text-gray-600' }
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.cls}`}>{s.label}</span>
}

function payBadge(status: string) {
  if (status === 'approved') return <span className="flex items-center gap-1 text-xs text-green-600"><CheckCircle className="w-3 h-3" />결제완료</span>
  if (status === 'failed' || status === 'cancelled') return <span className="flex items-center gap-1 text-xs text-red-500"><XCircle className="w-3 h-3" />취소</span>
  return <span className="flex items-center gap-1 text-xs text-amber-600"><Clock className="w-3 h-3" />대기중</span>
}

function InviteLinkSection() {
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
      .catch(() => {})
  }, [])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setCopied(true)
      toast.success('초대 링크가 복사되었습니다.')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('복사에 실패했습니다.')
    }
  }

  return (
    <div className="bg-white rounded-xl border border-[#E8EAEE] p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
          <UserPlus className="w-4 h-4 text-purple-600" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-gray-900">인플루언서 초대</h3>
          <p className="text-xs text-gray-500">링크를 공유하여 셀러를 모집하세요</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <Link2 className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-xs font-semibold text-gray-700">모집된 셀러: {recruitedCount}명</span>
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
          {copied ? '복사됨!' : '복사'}
        </button>
      </div>
    </div>
  )
}

function RevenueTrendChart({ sellers }: { sellers: Seller[] }) {
  const totalRev = sellers.reduce((s, sl) => s + (sl.total_revenue || 0), 0)
  const days = ['월', '화', '수', '목', '금', '토', '일']
  const dayWeights = [0.12, 0.14, 0.13, 0.16, 0.18, 0.15, 0.12]
  const maxVal = Math.max(...dayWeights) * totalRev || 1

  return (
    <div className="flex items-end gap-2 h-[140px] px-2 pt-4">
      {days.map((d, i) => {
        const live = dayWeights[i] * totalRev * 0.6
        const groupBuy = dayWeights[i] * totalRev * 0.25
        const affiliate = dayWeights[i] * totalRev * 0.15
        const total = live + groupBuy + affiliate
        const heightPct = (total / (maxVal * 1.1)) * 100
        return (
          <div key={d} className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full relative" style={{ height: `${Math.max(heightPct, 5)}%` }}>
              <div className="absolute bottom-0 w-full rounded-t-md overflow-hidden flex flex-col-reverse" style={{ height: '100%' }}>
                <div style={{ height: '60%', background: '#8B5CF6' }} />
                <div style={{ height: '25%', background: '#FF0033' }} />
                <div style={{ height: '15%', background: '#10B981' }} />
              </div>
            </div>
            <span className="text-[10px] text-gray-400 font-medium">{d}</span>
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

export default function AgencyPage() {
  const navigate = useNavigate()
  const [stats, setStats] = useState<Stats | null>(null)
  const [sellers, setSellers] = useState<Seller[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

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
          setLoading(false)
        }
      }
    } catch { /* 파싱 실패 무시 */ }

    // Promise.allSettled: 하나 실패해도 나머지 데이터 표시
    Promise.allSettled([
      api.get('/api/agency/stats', { headers }),
      api.get('/api/agency/sellers', { headers }),
      api.get('/api/agency/orders?limit=8', { headers }),
    ])
      .then(([statsRes, sellersRes, ordersRes]) => {
        // 통계 호출이 401로 실패하면 세션 만료 처리
        const authFailed = [statsRes, sellersRes].some(r =>
          r.status === 'rejected' && (r.reason as { response?: { status?: number } })?.response?.status === 401
        )
        if (authFailed) {
          toast.error('세션이 만료되었습니다. 다시 로그인해주세요.')
          navigate('/agency/login', { replace: true })
          return
        }

        const nextStats = statsRes.status === 'fulfilled' ? (statsRes.value.data.data as Stats | null) : null
        const nextSellers = sellersRes.status === 'fulfilled' ? (sellersRes.value.data.data || []) : []
        const nextOrders = ordersRes.status === 'fulfilled' ? (ordersRes.value.data.data || []) : []

        if (nextStats) setStats(nextStats)
        setSellers(nextSellers)
        setOrders(nextOrders)

        // sessionStorage 캐시 (5분 TTL)
        try {
          sessionStorage.setItem('agency_dashboard_cache', JSON.stringify({
            ts: Date.now(), stats: nextStats, sellers: nextSellers, orders: nextOrders,
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
  const commission = useMemo(() => Math.round((stats?.revenue_30d ?? 0) * 0.02), [stats])

  const liveScheduleItems = useMemo(() => {
    return sellers
      .filter(s => s.active_streams > 0)
      .map(s => ({
        sellerName: s.business_name || s.name,
        title: `${s.business_name || s.name} 라이브 방송`,
        isLive: true,
      }))
  }, [sellers])

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
      toast.error('리포트 다운로드에 실패했습니다.')
    }
  }

  return (
    <AgencyLayout title="대시보드">
      {/* 1. KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: '소속 셀러', value: String(stats?.sellers ?? 0), sub: '명', icon: Users, color: 'bg-blue-600' },
          { label: '이번달 주문', value: String(stats?.orders_30d ?? 0), sub: '30일 기준', icon: ShoppingBag, color: 'bg-blue-500' },
          { label: '이번달 매출', value: `${((stats?.revenue_30d ?? 0) / 10000).toFixed(0)}만원`, sub: '결제 완료 기준', icon: DollarSign, color: 'bg-emerald-500' },
          { label: '셀러 수익', value: `${((stats?.net_revenue_30d ?? 0) / 10000).toFixed(0)}만원`, sub: '수수료 제외', icon: TrendingUp, color: 'bg-violet-500' },
          { label: '진행중 라이브', value: String(stats?.active_streams ?? 0), sub: '현재 방송', icon: Play, color: 'bg-rose-500' },
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

      {/* 2. Commission Banner */}
      <div className="bg-gradient-to-r from-indigo-600 to-blue-600 rounded-2xl p-5 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm opacity-80">이번달 에이전시 수수료</p>
            <p className="text-2xl font-extrabold mt-1">
              {commission.toLocaleString()}원
            </p>
            <p className="text-xs opacity-60 mt-1">매출 대비 2% · 확정 후 정산 신청 가능</p>
          </div>
          <button
            onClick={() => navigate('/agency/settlements')}
            className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-xl text-sm font-bold transition-colors"
          >
            정산 관리 →
          </button>
        </div>
      </div>

      {/* 3. Quick Actions */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => navigate('/agency/sellers')} className="px-4 py-2 bg-purple-600 text-white rounded-lg text-xs font-bold hover:bg-purple-700">+ 셀러 초대</button>
        <button onClick={() => navigate('/agency/notices')} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-200">공지 발송</button>
        <button onClick={() => navigate('/agency/compare')} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-200">셀러 비교</button>
        <button onClick={() => navigate('/agency/targets')} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-200">매출 목표</button>
      </div>

      {/* 4. Invite Link */}
      <InviteLinkSection />

      {/* 5. Revenue Trend + CSV Download + Notifications */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-4">
        {/* Revenue Trend */}
        <div className="rounded-2xl bg-white border border-[#E8EAEE] p-5">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold text-gray-900">매출 추이 (7일)</h2>
            <div className="flex items-center gap-3">
              {[
                { label: '라이브', color: '#8B5CF6' },
                { label: '공구', color: '#FF0033' },
                { label: '제휴', color: '#10B981' },
              ].map(l => (
                <div key={l.label} className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full" style={{ background: l.color }} />
                  <span className="text-[10px] text-gray-500">{l.label}</span>
                </div>
              ))}
            </div>
          </div>
          <RevenueTrendChart sellers={sellers} />
        </div>

        {/* CSV Download + Notifications */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-[#E8EAEE] p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-bold text-gray-900">매출 리포트 다운로드</p>
            </div>
            <p className="text-xs text-gray-500 mb-3">셀러별 매출/수수료 CSV 파일</p>
            <div className="flex gap-2">
              {[7, 30, 90].map(d => (
                <button key={d}
                  onClick={() => downloadCSV(d)}
                  className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-200">
                  <Download className="w-3 h-3 inline mr-1" />{d}일
                </button>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-[#E8EAEE] p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-bold text-gray-900">최근 알림</p>
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
            <h2 className="text-sm font-bold text-gray-900">소속 셀러</h2>
            <button
              onClick={() => navigate('/agency/sellers')}
              className="text-xs text-purple-600 hover:underline flex items-center gap-1 font-semibold"
            >
              전체보기 <ArrowUpRight className="w-3 h-3" />
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
              소속 셀러가 없습니다.<br />
              <span className="text-xs">관리자에게 셀러 배정을 요청하세요.</span>
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
                      <p className="text-xs font-semibold text-gray-900">{(s.total_revenue / 10000).toFixed(0)}만원</p>
                      <p className="text-xs text-gray-400">{s.total_orders}건</p>
                    </div>
                    {s.active_streams > 0 && (
                      <span className="flex items-center gap-1 text-xs bg-rose-100 text-rose-600 px-2 py-0.5 rounded-full">
                        <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse" />
                        LIVE
                      </span>
                    )}
                    {statusBadge(s.status)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Orders */}
        <div className="rounded-2xl bg-white border border-[#E8EAEE] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-bold text-gray-900">최근 주문</h2>
            <button
              onClick={() => navigate('/agency/orders')}
              className="text-xs text-purple-600 hover:underline flex items-center gap-1 font-semibold"
            >
              전체보기 <ArrowUpRight className="w-3 h-3" />
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
            <div className="p-8 text-center text-sm text-gray-400">주문 내역이 없습니다.</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {orders.map(o => (
                <div key={o.id} className="flex items-center justify-between px-5 py-3">
                  <div className="min-w-0">
                    <p className="text-xs font-mono text-gray-500">{o.order_number}</p>
                    <p className="text-sm font-medium text-gray-900">{(o.total_amount).toLocaleString()}원</p>
                    <p className="text-xs text-gray-400">{o.seller_business_name}</p>
                  </div>
                  <div className="ml-3 flex-shrink-0">
                    {payBadge(o.payment_status)}
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
            <h2 className="text-sm font-bold text-gray-900">진행 중인 라이브</h2>
            <button
              onClick={() => navigate('/agency/streams')}
              className="text-xs text-purple-600 hover:underline flex items-center gap-1 font-semibold"
            >
              라이브 현황 <ArrowUpRight className="w-3 h-3" />
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
                  보기 <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </AgencyLayout>
  )
}
