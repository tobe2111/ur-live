import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AgencyLayout from '@/components/AgencyLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import { Users as UsersIcon } from 'lucide-react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { Search, TrendingUp, ShoppingBag, Play } from 'lucide-react'

interface Seller {
  id: number
  name: string
  business_name: string
  email: string
  phone: string | null
  status: string
  commission_rate: number
  total_orders: number
  total_revenue: number
  active_streams: number
  created_at: string
}

interface SellerStats {
  period: string
  orders: { order_count: number; revenue: number; net_revenue: number } | null
  streams: { stream_count: number; total_viewers: number } | null
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    approved: { label: '승인', cls: 'bg-green-100 text-green-700' },
    pending:  { label: '대기', cls: 'bg-amber-100 text-amber-700' },
    rejected: { label: '거부', cls: 'bg-red-100 text-red-700' },
    suspended:{ label: '정지', cls: 'bg-gray-100 text-gray-600' },
  }
  const s = map[status] || { label: status, cls: 'bg-gray-100 text-gray-600' }
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.cls}`}>{s.label}</span>
}

export default function AgencySellersPage() {
  const navigate = useNavigate()
  const [sellers, setSellers] = useState<Seller[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Seller | null>(null)
  const [sellerStats, setSellerStats] = useState<SellerStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(false)
  const [period, setPeriod] = useState('30d')

  const token = localStorage.getItem('agency_token')
  const headers = { Authorization: `Bearer ${token}` }

  useEffect(() => {
    if (!token) { navigate('/agency/login', { replace: true }); return }
    api.get('/api/agency/sellers', { headers })
      .then(r => setSellers(r.data.data || []))
      .catch(() => { toast.error('세션이 만료되었습니다. 다시 로그인해주세요.'); navigate('/agency/login', { replace: true }) })
      .finally(() => setLoading(false))
  }, [token])

  async function loadStats(seller: Seller, p = period) {
    setSelected(seller)
    setStatsLoading(true)
    try {
      const r = await api.get(`/api/agency/sellers/${seller.id}/stats?period=${p}`, { headers })
      setSellerStats(r.data.data)
    } finally {
      setStatsLoading(false)
    }
  }

  async function changePeriod(p: string) {
    setPeriod(p)
    if (selected) loadStats(selected, p)
  }

  const filtered = sellers.filter(s =>
    !search ||
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.business_name || '').toLowerCase().includes(search.toLowerCase()) ||
    s.email.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <AgencyLayout title="셀러 관리">
      <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
        {/* 🛡️ 2026-04-22 배치 130: 디자인 시스템 적용 */}
        <DashboardPageHeader
          title="셀러 관리"
          subtitle="소속 셀러 목록 및 상세 관리"
          icon={<UsersIcon className="h-5 w-5" />}
        />
      <div className="flex gap-5">
        {/* Seller list */}
        <div className="flex-1 min-w-0">
          <div className="bg-white rounded-xl border border-gray-200">
            <div className="px-5 py-4 border-b border-gray-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="셀러 검색..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {loading ? (
              <div className="p-8 text-center text-sm text-gray-400">불러오는 중...</div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-400">셀러가 없습니다.</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {filtered.map(s => (
                  <button
                    key={s.id}
                    onClick={() => loadStats(s)}
                    className={`w-full flex items-center justify-between px-5 py-4 text-left hover:bg-gray-50 transition-colors ${
                      selected?.id === s.id ? 'bg-indigo-50' : ''
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-900 truncate">{s.business_name || s.name}</p>
                        {s.active_streams > 0 && (
                          <span className="flex items-center gap-1 text-xs bg-rose-100 text-rose-600 px-2 py-0.5 rounded-full flex-shrink-0">
                            <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse" />
                            LIVE
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">{s.email}</p>
                    </div>
                    <div className="flex items-center gap-3 ml-3 flex-shrink-0">
                      <div className="text-right">
                        <p className="text-xs font-semibold text-gray-900">{(s.total_revenue / 10000).toFixed(0)}만원</p>
                        <p className="text-xs text-indigo-500 font-medium">수수료 {Math.round(s.total_revenue * (s.commission_rate || 2) / 100).toLocaleString()}원</p>
                        <p className="text-xs text-gray-400">{s.total_orders}건</p>
                      </div>
                      <StatusBadge status={s.status} />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Stats panel */}
        {selected && (
          <div className="w-80 flex-shrink-0">
            <div className="bg-white rounded-xl border border-gray-200 sticky top-0">
              <div className="px-5 py-4 border-b border-gray-100">
                <p className="text-sm font-semibold text-gray-900">{selected.business_name || selected.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">{selected.email}</p>
                <div className="flex gap-2 mt-3">
                  {(['7d', '30d', '90d'] as const).map(p => (
                    <button
                      key={p}
                      onClick={() => changePeriod(p)}
                      className={`flex-1 py-1 text-xs rounded-lg font-medium transition-colors ${
                        period === p
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {p === '7d' ? '7일' : p === '30d' ? '30일' : '90일'}
                    </button>
                  ))}
                </div>
              </div>

              {statsLoading ? (
                <div className="p-6 text-center text-sm text-gray-400">로딩중...</div>
              ) : sellerStats ? (
                <div className="p-5 space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <ShoppingBag className="w-3.5 h-3.5 text-blue-500" />
                        <span className="text-xs text-gray-500">주문</span>
                      </div>
                      <p className="text-lg font-bold text-gray-900">{sellerStats.orders?.order_count ?? 0}</p>
                      <p className="text-xs text-gray-400">건</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                        <span className="text-xs text-gray-500">매출</span>
                      </div>
                      <p className="text-lg font-bold text-gray-900">
                        {((sellerStats.orders?.revenue ?? 0) / 10000).toFixed(1)}만
                      </p>
                      <p className="text-xs text-gray-400">원</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <TrendingUp className="w-3.5 h-3.5 text-violet-500" />
                        <span className="text-xs text-gray-500">셀러수익</span>
                      </div>
                      <p className="text-lg font-bold text-gray-900">
                        {((sellerStats.orders?.net_revenue ?? 0) / 10000).toFixed(1)}만
                      </p>
                      <p className="text-xs text-gray-400">원</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Play className="w-3.5 h-3.5 text-rose-500" />
                        <span className="text-xs text-gray-500">라이브</span>
                      </div>
                      <p className="text-lg font-bold text-gray-900">{sellerStats.streams?.stream_count ?? 0}</p>
                      <p className="text-xs text-gray-400">회</p>
                    </div>
                  </div>

                  <div className="bg-indigo-50 rounded-lg p-3">
                    <p className="text-xs text-indigo-600 font-medium mb-1">수수료율</p>
                    <p className="text-xl font-bold text-indigo-700">{selected.commission_rate}%</p>
                  </div>

                  <div className="space-y-1 text-xs text-gray-500">
                    <div className="flex justify-between">
                      <span>총 시청자</span>
                      <span className="font-medium text-gray-700">{(sellerStats.streams?.total_viewers ?? 0).toLocaleString()}명</span>
                    </div>
                    <div className="flex justify-between">
                      <span>가입일</span>
                      <span className="font-medium text-gray-700">{new Date(selected.created_at).toLocaleDateString('ko-KR')}</span>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>
      </div>
    </AgencyLayout>
  )
}
