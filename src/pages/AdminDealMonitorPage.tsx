import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import AdminLayout from '@/components/AdminLayout'
import { Gift, TrendingUp, Users, Zap, Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { formatKST } from '@/utils/date'

interface DealStats {
  totals: {
    total_transactions: number
    total_charged_amount: number
    total_commission: number
    total_points_issued: number
    unique_users: number
  }
  today: { count: number; amount: number; commission: number }
  thisMonth: { count: number; amount: number; commission: number }
  donations: { total_donations: number; total_donated: number }
}

interface ChargeRecord {
  id: number
  user_id: string
  amount: number
  commission_amount: number
  points_amount: number
  balance_after: number
  description: string
  payment_key: string
  order_id: string
  created_at: string
  current_balance: number
  user_total_charged: number
  user_total_donated: number
}

interface UserSummary {
  user_id: string
  balance: number
  total_charged: number
  total_donated: number
  first_charge_date: string
  last_activity: string
  charge_count: number
  last_charged: string
}

type Tab = 'charges' | 'users'

function fmt(n: number | null | undefined): string {
  return (n ?? 0).toLocaleString()
}

export default function AdminDealMonitorPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<DealStats | null>(null)
  const [tab, setTab] = useState<Tab>('charges')
  const [charges, setCharges] = useState<ChargeRecord[]>([])
  const [users, setUsers] = useState<UserSummary[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [sort, setSort] = useState('total_charged')

  useEffect(() => {
    const token = localStorage.getItem('admin_token')
    if (!token) { navigate('/admin/login'); return }
    loadStats()
  }, [navigate])

  useEffect(() => {
    if (tab === 'charges') loadCharges()
    else loadUsers()
  }, [tab, page, search, sort])

  async function loadStats() {
    try {
      const res = await api.get('/api/admin/deals/stats')
      if (res.data.success) setStats(res.data.data)
    } catch (err: any) {
      if (err.response?.status === 401) {
        localStorage.removeItem('admin_token')
        navigate('/admin/login')
      }
    }
  }

  async function loadCharges() {
    try {
      setLoading(true)
      const params = new URLSearchParams({ page: String(page), limit: '20' })
      if (search) params.append('search', search)
      const res = await api.get(`/api/admin/deals/charges?${params}`)
      if (res.data.success) {
        setCharges(res.data.data)
        setTotalPages(res.data.pagination.totalPages)
      }
    } catch { /* handled by interceptor */ } finally {
      setLoading(false)
    }
  }

  async function loadUsers() {
    try {
      setLoading(true)
      const params = new URLSearchParams({ page: String(page), limit: '20', sort })
      const res = await api.get(`/api/admin/deals/users?${params}`)
      if (res.data.success) {
        setUsers(res.data.data)
        setTotalPages(res.data.pagination.totalPages)
      }
    } catch { /* handled by interceptor */ } finally {
      setLoading(false)
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setPage(1)
    setSearch(searchInput)
  }

  function switchTab(t: Tab) {
    setTab(t)
    setPage(1)
    setSearch('')
    setSearchInput('')
  }

  function shortId(uid: string) {
    if (!uid) return '-'
    return uid.length > 12 ? uid.slice(0, 6) + '...' + uid.slice(-4) : uid
  }

  const s = stats

  return (
    <AdminLayout title="딜 충전 모니터링">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Gift className="w-5 h-5 text-pink-600" />}
          label="총 충전액"
          value={`${fmt(s?.totals.total_charged_amount)}원`}
          sub={`수수료 ${fmt(s?.totals.total_commission)}원`}
          bg="bg-pink-50"
        />
        <StatCard
          icon={<Zap className="w-5 h-5 text-amber-600" />}
          label="발급 딜"
          value={`${fmt(s?.totals.total_points_issued)}딜`}
          sub={`후원 ${fmt(s?.donations.total_donated)}딜`}
          bg="bg-amber-50"
        />
        <StatCard
          icon={<TrendingUp className="w-5 h-5 text-blue-600" />}
          label="오늘"
          value={`${fmt(s?.today.amount)}원`}
          sub={`${fmt(s?.today.count)}건`}
          bg="bg-blue-50"
        />
        <StatCard
          icon={<Users className="w-5 h-5 text-green-600" />}
          label="충전 유저"
          value={`${fmt(s?.totals.unique_users)}명`}
          sub={`이번 달 ${fmt(s?.thisMonth.amount)}원`}
          bg="bg-green-50"
        />
      </div>

      {/* Tabs & Search */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="flex gap-1">
            <button
              onClick={() => switchTab('charges')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === 'charges' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              충전 내역
            </button>
            <button
              onClick={() => switchTab('users')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                tab === 'users' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              유저별 요약
            </button>
          </div>
          {tab === 'charges' && (
            <form onSubmit={handleSearch} className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  placeholder="유저ID / 주문번호"
                  className="pl-9 pr-3 py-2 text-sm border rounded-lg w-56 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <button type="submit" className="px-3 py-2 bg-gray-100 text-sm rounded-lg hover:bg-gray-200">
                검색
              </button>
            </form>
          )}
          {tab === 'users' && (
            <select
              value={sort}
              onChange={e => { setSort(e.target.value); setPage(1) }}
              className="text-sm border rounded-lg px-3 py-2"
            >
              <option value="total_charged">충전액순</option>
              <option value="total_donated">후원액순</option>
              <option value="balance">잔액순</option>
              <option value="last_charged">최근충전순</option>
            </select>
          )}
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : tab === 'charges' ? (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">일시</th>
                  <th className="px-4 py-3 text-left font-medium">유저ID</th>
                  <th className="px-4 py-3 text-right font-medium">결제액</th>
                  <th className="px-4 py-3 text-right font-medium">수수료</th>
                  <th className="px-4 py-3 text-right font-medium">충전 딜</th>
                  <th className="px-4 py-3 text-right font-medium">현재 잔액</th>
                  <th className="px-4 py-3 text-left font-medium">주문번호</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {charges.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-12 text-gray-400">충전 내역이 없습니다</td></tr>
                ) : charges.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatKST(c.created_at)}</td>
                    <td className="px-4 py-3 font-mono text-xs" title={c.user_id}>{shortId(c.user_id)}</td>
                    <td className="px-4 py-3 text-right font-medium">{fmt(c.amount)}원</td>
                    <td className="px-4 py-3 text-right text-gray-500">{fmt(c.commission_amount)}원</td>
                    <td className="px-4 py-3 text-right text-pink-600 font-medium">{fmt(c.points_amount)}딜</td>
                    <td className="px-4 py-3 text-right">{fmt(c.current_balance)}딜</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500 truncate max-w-[160px]" title={c.order_id}>{c.order_id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">유저ID</th>
                  <th className="px-4 py-3 text-right font-medium">충전 횟수</th>
                  <th className="px-4 py-3 text-right font-medium">총 충전액</th>
                  <th className="px-4 py-3 text-right font-medium">총 후원액</th>
                  <th className="px-4 py-3 text-right font-medium">현재 잔액</th>
                  <th className="px-4 py-3 text-left font-medium">최근 충전</th>
                  <th className="px-4 py-3 text-left font-medium">가입일</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {users.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-12 text-gray-400">충전 유저가 없습니다</td></tr>
                ) : users.map(u => (
                  <tr key={u.user_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs" title={u.user_id}>{shortId(u.user_id)}</td>
                    <td className="px-4 py-3 text-right">{fmt(u.charge_count)}회</td>
                    <td className="px-4 py-3 text-right font-medium">{fmt(u.total_charged)}딜</td>
                    <td className="px-4 py-3 text-right text-amber-600">{fmt(u.total_donated)}딜</td>
                    <td className="px-4 py-3 text-right text-pink-600 font-medium">{fmt(u.balance)}딜</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{u.last_charged ? formatKST(u.last_charged) : '-'}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{u.first_charge_date ? formatKST(u.first_charge_date) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 py-4 border-t">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm text-gray-600">{page} / {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}

function StatCard({ icon, label, value, sub, bg }: {
  icon: React.ReactNode; label: string; value: string; sub: string; bg: string
}) {
  return (
    <div className={`${bg} rounded-xl p-4 border border-gray-100`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-sm text-gray-600 font-medium">{label}</span>
      </div>
      <p className="text-xl font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500 mt-1">{sub}</p>
    </div>
  )
}
