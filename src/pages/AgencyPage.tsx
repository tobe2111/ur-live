import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AgencyLayout from '@/components/AgencyLayout'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import {
  Users, ShoppingBag, DollarSign, Play,
  TrendingUp, ArrowUpRight, CheckCircle, XCircle, Clock, Download, Bell
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
  const headers = { Authorization: `Bearer ${localStorage.getItem('agency_token')}` }
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
          <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-1.5 shrink-0" />
          <div>
            <p className="text-gray-700 font-medium">{n.title}</p>
            <p className="text-gray-400">{new Date(n.created_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

function StatCard({ label, value, icon: Icon, color, sub }: {
  label: string; value: string; icon: React.ComponentType<{ className?: string }>; color: string; sub?: string
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] sm:text-xs font-medium text-gray-500 mb-0.5 sm:mb-1">{label}</p>
          <p className="text-lg sm:text-2xl font-bold text-gray-900">{value}</p>
          {sub && <p className="text-[10px] sm:text-xs text-gray-400 mt-0.5 sm:mt-1">{sub}</p>}
        </div>
        <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
        </div>
      </div>
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

  if (loading) {
    return (
      <AgencyLayout title="대시보드">
        <div className="flex items-center justify-center h-64 text-gray-500 text-sm">불러오는 중...</div>
      </AgencyLayout>
    )
  }

  return (
    <AgencyLayout title="대시보드">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-4">
        <StatCard
          label="소속 셀러"
          value={String(stats?.sellers ?? 0)}
          icon={Users}
          color="bg-blue-600"
          sub="명"
        />
        <StatCard
          label="이번달 주문"
          value={String(stats?.orders_30d ?? 0)}
          icon={ShoppingBag}
          color="bg-blue-500"
          sub="30일 기준"
        />
        <StatCard
          label="이번달 매출"
          value={`${((stats?.revenue_30d ?? 0) / 10000).toFixed(0)}만원`}
          icon={DollarSign}
          color="bg-emerald-500"
          sub="결제 완료 기준"
        />
        <StatCard
          label="셀러 수익"
          value={`${((stats?.net_revenue_30d ?? 0) / 10000).toFixed(0)}만원`}
          icon={TrendingUp}
          color="bg-violet-500"
          sub="수수료 제외"
        />
        <StatCard
          label="진행중 라이브"
          value={String(stats?.active_streams ?? 0)}
          icon={Play}
          color="bg-rose-500"
          sub="현재 방송"
        />
      </div>

      {/* 빠른 실행 */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => navigate('/agency/sellers')} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold">+ 셀러 초대</button>
        <button onClick={() => navigate('/agency/notices')} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium">공지 발송</button>
        <button onClick={() => navigate('/agency/compare')} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium">셀러 비교</button>
        <button onClick={() => navigate('/agency/targets')} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium">매출 목표</button>
      </div>

      {/* Quick Actions: 리포트 다운로드 + 알림 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-gray-900">매출 리포트 다운로드</p>
            <p className="text-xs text-gray-500 mt-0.5">셀러별 매출/수수료 CSV 파일</p>
          </div>
          <div className="flex gap-2">
            {[7, 30, 90].map(d => (
              <a key={d} href={`/api/agency/report/csv?period=${d}`}
                onClick={e => { e.preventDefault(); window.open(`/api/agency/report/csv?period=${d}`, '_blank') }}
                className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg text-xs font-medium hover:bg-gray-200">
                <Download className="w-3 h-3 inline mr-1" />{d}일
              </a>
            ))}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-bold text-gray-900">최근 알림</p>
            <Bell className="w-4 h-4 text-gray-400" />
          </div>
          <NotificationList />
        </div>
      </div>

      {/* Sellers + Orders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-5">
        {/* Sellers */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">소속 셀러</h2>
            <button
              onClick={() => navigate('/agency/sellers')}
              className="text-xs text-indigo-600 hover:underline flex items-center gap-1"
            >
              전체보기 <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
          {sellers.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400">
              소속 셀러가 없습니다.<br />
              <span className="text-xs">관리자에게 셀러 배정을 요청하세요.</span>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {sellers.slice(0, 6).map(s => (
                <div key={s.id} className="flex items-center justify-between px-5 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{s.business_name || s.name}</p>
                    <p className="text-xs text-gray-400">{s.email}</p>
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
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">최근 주문</h2>
            <button
              onClick={() => navigate('/agency/orders')}
              className="text-xs text-indigo-600 hover:underline flex items-center gap-1"
            >
              전체보기 <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
          {orders.length === 0 ? (
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
    </AgencyLayout>
  )
}
