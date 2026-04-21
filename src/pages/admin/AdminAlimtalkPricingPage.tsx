import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import AdminLayout from '@/components/AdminLayout'
import { MessageSquare, DollarSign, Users, TrendingUp, Edit2, Save, X, Plus, Eye, EyeOff } from 'lucide-react'
import { formatKSTDate } from '@/utils/date'

interface AlimtalkPackage {
  id: number
  label: string
  credits: number
  price: number
  is_active: number  // 0 | 1 (SQLite)
  sort_order: number
  created_at: string
  updated_at: string
}

interface SellerCreditRow {
  id: number
  seller_name: string
  email: string
  balance: number
  updated_at: string | null
}

interface AlimtalkStats {
  total_sent: number
  total_cost: number
  active_accounts: number
  total_balance: number
}

interface EditState {
  label: string
  credits: number
  price: number
  is_active: boolean
  sort_order: number
}

export default function AdminAlimtalkPricingPage() {
  const navigate = useNavigate()
  const [packages, setPackages] = useState<AlimtalkPackage[]>([])
  const [accounts, setAccounts] = useState<SellerCreditRow[]>([])
  const [stats, setStats] = useState<AlimtalkStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editState, setEditState] = useState<EditState>({ label: '', credits: 0, price: 0, is_active: true, sort_order: 0 })
  const [showAdd, setShowAdd] = useState(false)
  const [newPkg, setNewPkg] = useState({ label: '', credits: 0, price: 0 })

  useEffect(() => {
    const sessionToken = localStorage.getItem('admin_token') || localStorage.getItem('admin_session_token')
    const userType = localStorage.getItem('user_type')
    if (!sessionToken) { navigate('/admin/login'); return }
    loadAllData()
  }, [])

  async function loadAllData() {
    try {
      setLoading(true)
      const sessionToken = localStorage.getItem('admin_token') || localStorage.getItem('admin_session_token')
      const headers = { 'Authorization': `Bearer ${sessionToken}` }
      const [pricingRes, accountsRes, statsRes] = await Promise.all([
        api.get('/api/admin/alimtalk/pricing', { headers }),
        api.get('/api/admin/alimtalk/accounts', { headers }),
        api.get('/api/admin/alimtalk/statistics', { headers }),
      ])
      setPackages(pricingRes.data.data ?? [])
      setAccounts(accountsRes.data.data ?? [])
      setStats(statsRes.data.data ?? null)
    } catch (err: unknown) {
      const err_ = err as { response?: { data?: { error?: string }; status?: number } }
      if (err_.response?.status === 401) navigate('/admin/login')
      else toast.error('데이터를 불러오지 못했습니다')
    } finally {
      setLoading(false)
    }
  }

  function startEdit(pkg: AlimtalkPackage) {
    setEditingId(pkg.id)
    setEditState({
      label: pkg.label,
      credits: pkg.credits,
      price: pkg.price,
      is_active: pkg.is_active === 1,
      sort_order: pkg.sort_order,
    })
  }

  async function saveEdit(id: number) {
    try {
      const sessionToken = localStorage.getItem('admin_token') || localStorage.getItem('admin_session_token')
      await api.put(`/api/admin/alimtalk/pricing/${id}`, editState, {
        headers: { 'Authorization': `Bearer ${sessionToken}` },
      })
      toast.success('패키지가 저장되었습니다')
      setEditingId(null)
      loadAllData()
    } catch {
      toast.error('저장에 실패했습니다')
    }
  }

  async function addPackage() {
    if (!newPkg.label || newPkg.credits <= 0 || newPkg.price <= 0) {
      toast.error('모든 항목을 입력해주세요')
      return
    }
    try {
      const sessionToken = localStorage.getItem('admin_token') || localStorage.getItem('admin_session_token')
      await api.post('/api/admin/alimtalk/pricing', newPkg, {
        headers: { 'Authorization': `Bearer ${sessionToken}` },
      })
      toast.success('패키지가 추가되었습니다')
      setShowAdd(false)
      setNewPkg({ label: '', credits: 0, price: 0 })
      loadAllData()
    } catch {
      toast.error('패키지 추가에 실패했습니다')
    }
  }

  function unitPrice(pkg: AlimtalkPackage) {
    return pkg.credits > 0 ? (pkg.price / pkg.credits).toFixed(1) : '0'
  }

  function fmt(n: number) { return new Intl.NumberFormat('ko-KR').format(n || 0) }
  function fmtDate(s: string | null) { return s ? formatKSTDate(s) : '-' }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F4F5F7]">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">브랜드메시지 데이터를 불러오는 중...</p>
        </div>
      </div>
    )
  }

  return (
    <AdminLayout title="브랜드메시지 관리">
      {/* 통계 카드 */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: '총 발송', value: `${fmt(stats.total_sent)}건`, icon: <MessageSquare className="w-5 h-5" />, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: '수익 (9원/건)', value: `${fmt(stats.total_cost)}원`, icon: <DollarSign className="w-5 h-5" />, color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: '잔액 보유 셀러', value: `${fmt(stats.active_accounts)}명`, icon: <Users className="w-5 h-5" />, color: 'text-purple-600', bg: 'bg-purple-50' },
            { label: '전체 잔액', value: `${fmt(stats.total_balance)}건`, icon: <TrendingUp className="w-5 h-5" />, color: 'text-amber-600', bg: 'bg-amber-50' },
          ].map(card => (
            <div key={card.label} className="bg-white rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-gray-500">{card.label}</span>
                <div className={`w-8 h-8 rounded-lg ${card.bg} ${card.color} flex items-center justify-center`}>{card.icon}</div>
              </div>
              <p className="text-lg font-bold text-gray-900">{card.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* 패키지 관리 */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">브랜드메시지 패키지 관리</h2>
          <button
            onClick={() => setShowAdd(v => !v)}
            className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-3.5 h-3.5" />
            패키지 추가
          </button>
        </div>

        {/* 새 패키지 추가 폼 */}
        {showAdd && (
          <div className="px-5 py-4 border-b border-gray-100 bg-blue-50">
            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">표시명</label>
                <input
                  type="text"
                  placeholder="예) 2,000건"
                  value={newPkg.label}
                  onChange={e => setNewPkg(p => ({ ...p, label: e.target.value }))}
                  className="w-28 px-2 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">충전 건수</label>
                <input
                  type="number"
                  placeholder="2000"
                  value={newPkg.credits || ''}
                  onChange={e => setNewPkg(p => ({ ...p, credits: Number(e.target.value) }))}
                  className="w-24 px-2 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">판매가 (원)</label>
                <input
                  type="number"
                  placeholder="18000"
                  value={newPkg.price || ''}
                  onChange={e => setNewPkg(p => ({ ...p, price: Number(e.target.value) }))}
                  className="w-28 px-2 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
              <div className="flex gap-2">
                <button onClick={addPackage} className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700">추가</button>
                <button onClick={() => setShowAdd(false)} className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs rounded-lg hover:bg-gray-200">취소</button>
              </div>
            </div>
          </div>
        )}

        <div className="p-5 space-y-3">
          {packages.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">
              등록된 패키지가 없습니다. 새 패키지를 추가해주세요.
            </p>
          ) : packages.map(pkg => (
            <div key={pkg.id} className={`border border-gray-100 rounded-xl p-4 ${pkg.is_active === 0 ? 'opacity-60' : ''}`}>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  {editingId === pkg.id ? (
                    <div className="flex flex-wrap gap-3 items-end">
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">표시명</label>
                        <input
                          type="text"
                          value={editState.label}
                          onChange={e => setEditState(s => ({ ...s, label: e.target.value }))}
                          className="w-28 px-2 py-1 border border-gray-200 rounded-lg text-xs text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">건수</label>
                        <input
                          type="number"
                          value={editState.credits}
                          onChange={e => setEditState(s => ({ ...s, credits: Number(e.target.value) }))}
                          className="w-24 px-2 py-1 border border-gray-200 rounded-lg text-xs text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">판매가 (원)</label>
                        <input
                          type="number"
                          value={editState.price}
                          onChange={e => setEditState(s => ({ ...s, price: Number(e.target.value) }))}
                          className="w-28 px-2 py-1 border border-gray-200 rounded-lg text-xs text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">정렬</label>
                        <input
                          type="number"
                          value={editState.sort_order}
                          onChange={e => setEditState(s => ({ ...s, sort_order: Number(e.target.value) }))}
                          className="w-16 px-2 py-1 border border-gray-200 rounded-lg text-xs text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                      </div>
                      <div className="flex items-center gap-1.5 mt-4">
                        <input
                          type="checkbox"
                          id={`active-${pkg.id}`}
                          checked={editState.is_active}
                          onChange={e => setEditState(s => ({ ...s, is_active: e.target.checked }))}
                          className="rounded"
                        />
                        <label htmlFor={`active-${pkg.id}`} className="text-xs text-gray-600">활성</label>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <h3 className="text-sm font-semibold text-gray-900">{pkg.label}</h3>
                          <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                            pkg.is_active === 1 ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'
                          }`}>
                            {pkg.is_active === 1 ? '활성' : '비활성'}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400">{fmt(pkg.credits)}건 · {fmt(pkg.price)}원 · 건당 {unitPrice(pkg)}원</p>
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 ml-4">
                  {editingId === pkg.id ? (
                    <>
                      <button onClick={() => saveEdit(pkg.id)} className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100">
                        <Save className="w-4 h-4" />
                      </button>
                      <button onClick={() => setEditingId(null)} className="p-1.5 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200">
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={async () => {
                          const sessionToken = localStorage.getItem('admin_token') || localStorage.getItem('admin_session_token')
                          await api.put(`/api/admin/alimtalk/pricing/${pkg.id}`, { is_active: pkg.is_active === 0 }, {
                            headers: { 'Authorization': `Bearer ${sessionToken}` },
                          }).catch(() => toast.error('상태 변경 실패'))
                          loadAllData()
                        }}
                        className="p-1.5 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200"
                        title={pkg.is_active === 1 ? '비활성화' : '활성화'}
                      >
                        {pkg.is_active === 1 ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                      <button onClick={() => startEdit(pkg)} className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100">
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 셀러 브랜드메시지 크레딧 현황 */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">셀러 브랜드메시지 크레딧 현황</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[500px]">
            <thead>
              <tr className="bg-gray-50">
                {['셀러', '이메일', '잔여 크레딧', '최근 충전일'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {accounts.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-400">승인된 셀러가 없습니다</td></tr>
              ) : accounts.map(acc => (
                <tr key={acc.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-xs font-medium text-gray-900">{acc.seller_name}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{acc.email}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold ${acc.balance > 0 ? 'text-emerald-600' : 'text-gray-400'}`}>
                      {fmt(acc.balance)}건
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">{fmtDate(acc.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  )
}
