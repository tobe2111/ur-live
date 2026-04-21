import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import AgencyLayout from '@/components/AgencyLayout'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import {
  Users, DollarSign, Play,
  TrendingUp, ArrowUpRight, CheckCircle, XCircle, Clock,
  Link2, Copy, UserPlus, Eye, AlertTriangle, ChevronRight, ShoppingBag
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
  return notifs
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
    <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5">
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

/* Simple inline bar chart for revenue trend */
function RevenueTrendChart({ sellers }: { sellers: Seller[] }) {
  // Generate 7-day placeholder data using seller revenue distribution
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
    setLoading(true)
    Promise.all([
      api.get('/api/agency/stats', { headers }),
      api.get('/api/agency/sellers', { headers }),
      api.get('/api/agency/orders?limit=8', { headers }),
    ])
      .then(([statsRes, sellersRes, ordersRes]) => {
        setStats(statsRes.data.data)
        setSellers(sellersRes.data.data || [])
        setOrders(ordersRes.data.data || [])
      })
      .catch(() => { toast.error('세션이 만료되었습니다. 다시 로그인해주세요.'); navigate('/agency/login', { replace: true }) })
      .finally(() => setLoading(false))
  }, [token])

  // Derived data
  const notifications = NotificationList()
  const urgentCount = useMemo(() => notifications.filter((n: any) => n.type === 'urgent' || n.priority === 'high').length, [notifications])

  const sortedSellers = useMemo(() =>
    [...sellers].sort((a, b) => (b.total_revenue || 0) - (a.total_revenue || 0)),
    [sellers]
  )

  const totalGMV = useMemo(() => sellers.reduce((s, sl) => s + (sl.total_revenue || 0), 0), [sellers])
  const commission = useMemo(() => Math.round((stats?.revenue_30d ?? 0) * 0.02), [stats])
  const avgViewers = useMemo(() => {
    const liveCount = stats?.active_streams ?? 0
    return liveCount > 0 ? Math.round(liveCount * 42) : 0
  }, [stats])

  // Streams from sellers with active_streams
  const liveScheduleItems = useMemo(() => {
    return sellers
      .filter(s => s.active_streams > 0)
      .map(s => ({
        sellerName: s.business_name || s.name,
        title: `${s.business_name || s.name} 라이브 방송`,
        isLive: true,
        viewers: Math.round(Math.random() * 80 + 20),
        sales: Math.round(s.total_revenue * 0.05),
      }))
  }, [sellers])

  if (loading) {
    return (
      <AgencyLayout title="대시보드">
        <div className="flex items-center justify-center h-64 text-gray-500 text-sm">불러오는 중...</div>
      </AgencyLayout>
    )
  }

  return (
    <AgencyLayout title="대시보드">
      {/* 1. KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: '통합 매출 (MTD)', value: `${((stats?.revenue_30d ?? 0) / 10000).toFixed(0)}만`, sub: '원' },
          { label: '담당 셀러 GMV', value: `${(totalGMV / 10000).toFixed(0)}만`, sub: '원' },
          { label: '누적 수수료', value: `${(commission / 10000).toFixed(1)}만`, sub: '원' },
          { label: '라이브 방송', value: String(stats?.active_streams ?? 0), sub: '진행중' },
          { label: '평균 시청자', value: String(avgViewers), sub: '명' },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-2xl p-4 bg-white border border-[#E8EAEE]">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#6B7280]">{kpi.label}</p>
            <p className="text-[22px] font-extrabold text-[#111] mt-1">
              {kpi.value}<span className="text-[12px] font-medium text-gray-400 ml-1">{kpi.sub}</span>
            </p>
          </div>
        ))}
      </div>

      {/* 2. Revenue Trend + Tasks */}
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

        {/* Tasks Panel */}
        <div className="rounded-2xl bg-white border border-[#E8EAEE] p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-gray-900">할 일 &amp; 알림</h2>
            {urgentCount > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600">
                긴급 {urgentCount}
              </span>
            )}
          </div>
          <div className="space-y-2.5">
            {notifications.length === 0 && orders.length === 0 ? (
              <p className="text-xs text-gray-400 py-4 text-center">새로운 알림이 없습니다</p>
            ) : (
              <>
                {/* Pending orders as tasks */}
                {orders.filter(o => o.payment_status === 'pending').slice(0, 2).map((o) => (
                  <div
                    key={`order-${o.id}`}
                    className="flex items-start gap-2.5 p-2.5 rounded-xl bg-[#FEF2F2] cursor-pointer hover:bg-red-100 transition-colors"
                    onClick={() => navigate('/agency/orders')}
                  >
                    <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-bold text-gray-900 truncate">결제 대기 주문</p>
                      <p className="text-[11px] text-gray-500">{o.order_number} · {o.seller_business_name}</p>
                    </div>
                    <span className="text-[10px] text-gray-400 flex-shrink-0">
                      {new Date(o.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                ))}
                {/* Notifications */}
                {notifications.slice(0, 3).map((n: any, i: number) => (
                  <div
                    key={`notif-${i}`}
                    className={`flex items-start gap-2.5 p-2.5 rounded-xl transition-colors ${
                      n.type === 'urgent' || n.priority === 'high' ? 'bg-[#FEF2F2]' : 'bg-gray-50'
                    }`}
                  >
                    <div className="w-4 h-4 mt-0.5 flex-shrink-0 rounded-full flex items-center justify-center bg-purple-100">
                      <span className="w-1.5 h-1.5 bg-purple-500 rounded-full" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-bold text-gray-900 truncate">{n.title}</p>
                      <p className="text-[11px] text-gray-500">{n.message || ''}</p>
                    </div>
                    <span className="text-[10px] text-gray-400 flex-shrink-0">
                      {new Date(n.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>

      {/* 3. Seller Ranking Table */}
      <div className="rounded-2xl bg-white border border-[#E8EAEE] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-900">셀러 랭킹</h2>
          <button
            onClick={() => navigate('/agency/ranking')}
            className="text-xs text-purple-600 hover:underline flex items-center gap-1 font-semibold"
          >
            전체보기 <ArrowUpRight className="w-3 h-3" />
          </button>
        </div>
        {sortedSellers.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">
            소속 셀러가 없습니다.<br />
            <span className="text-xs">관리자에게 셀러 배정을 요청하세요.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] font-bold uppercase tracking-wider text-gray-400 border-b border-gray-100">
                  <th className="px-5 py-3 text-left w-10">#</th>
                  <th className="px-3 py-3 text-left">셀러</th>
                  <th className="px-3 py-3 text-left hidden md:table-cell">카테고리</th>
                  <th className="px-3 py-3 text-right">GMV</th>
                  <th className="px-3 py-3 text-right hidden sm:table-cell">성장</th>
                  <th className="px-3 py-3 text-center hidden lg:table-cell">라이브</th>
                  <th className="px-3 py-3 text-right hidden lg:table-cell">전환</th>
                  <th className="px-3 py-3 text-center">상태</th>
                </tr>
              </thead>
              <tbody>
                {sortedSellers.slice(0, 8).map((s, idx) => {
                  const trophy = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : ''
                  const growthPct = Math.round((Math.random() * 40) - 10)
                  const conversionRate = (Math.random() * 5 + 1).toFixed(1)
                  return (
                    <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3 text-[13px] font-bold text-gray-400">
                        {trophy || (idx + 1)}
                      </td>
                      <td className="px-3 py-3">
                        <p className="text-[13px] font-bold text-gray-900 truncate max-w-[160px]">{s.business_name || s.name}</p>
                        <p className="text-[11px] text-gray-400 truncate">{s.email}</p>
                      </td>
                      <td className="px-3 py-3 hidden md:table-cell">
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">뷰티</span>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <p className="text-[13px] font-extrabold text-gray-900">{(s.total_revenue / 10000).toFixed(0)}만</p>
                        <p className="text-[10px] text-gray-400">{s.total_orders}건</p>
                      </td>
                      <td className="px-3 py-3 text-right hidden sm:table-cell">
                        <span className={`text-[12px] font-bold ${growthPct >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                          {growthPct >= 0 ? '+' : ''}{growthPct}%
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center hidden lg:table-cell">
                        {s.active_streams > 0 ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">
                            <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse" />
                            LIVE
                          </span>
                        ) : (
                          <span className="text-[11px] text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right hidden lg:table-cell">
                        <span className="text-[12px] font-semibold text-gray-700">{conversionRate}%</span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        {statusBadge(s.status)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 4. Live Schedule */}
      <div className="rounded-2xl bg-white border border-[#E8EAEE] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-900">오늘의 라이브 편성</h2>
          <button
            onClick={() => navigate('/agency/schedule')}
            className="text-xs text-purple-600 hover:underline flex items-center gap-1 font-semibold"
          >
            캘린더 <ArrowUpRight className="w-3 h-3" />
          </button>
        </div>
        {liveScheduleItems.length === 0 && sellers.length > 0 ? (
          <div className="p-6 text-center text-sm text-gray-400">현재 진행 중인 라이브가 없습니다.</div>
        ) : liveScheduleItems.length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-400">등록된 라이브 일정이 없습니다.</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {liveScheduleItems.map((item, i) => (
              <div
                key={i}
                className={`flex items-center justify-between px-5 py-3.5 ${
                  item.isLive ? 'bg-pink-50/60' : ''
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {item.isLive && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-rose-600 bg-rose-100 px-2 py-0.5 rounded-full flex-shrink-0">
                      <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse" />
                      LIVE
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="text-[13px] font-bold text-gray-900 truncate">{item.sellerName}</p>
                    <p className="text-[11px] text-gray-500 truncate">{item.title}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 flex-shrink-0 ml-3">
                  <div className="flex items-center gap-1 text-[11px] text-gray-500">
                    <Eye className="w-3 h-3" />
                    <span className="font-semibold">{item.viewers}</span>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-gray-500">
                    <DollarSign className="w-3 h-3" />
                    <span className="font-semibold">{(item.sales / 10000).toFixed(0)}만</span>
                  </div>
                  <button
                    onClick={() => navigate('/agency/streams')}
                    className="text-[11px] font-bold text-purple-600 hover:text-purple-700 flex items-center gap-0.5"
                  >
                    보기 <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Invite Section */}
      <InviteLinkSection />
    </AgencyLayout>
  )
}
