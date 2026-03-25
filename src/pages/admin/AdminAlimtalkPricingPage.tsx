import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import AdminLayout from '@/components/AdminLayout'
import { MessageSquare, DollarSign, Users, TrendingUp, Edit2, Save, X, Check, Ban } from 'lucide-react'

interface PricingPlan {
  id: number
  name: string
  description: string
  unit_price: number
  monthly_quota: number
  discount_rate: number
  is_active: boolean
  created_at: string
  updated_at: string
}

interface AlimtalkAccount {
  id: number
  seller_id: number
  seller_name: string
  kakao_channel_id: string
  sender_phone: string
  balance: number
  status: string
  created_at: string
}

interface AlimtalkStats {
  total_sent: number
  total_cost: number
  active_accounts: number
  total_balance: number
}

export default function AdminAlimtalkPricingPage() {
  const navigate = useNavigate()
  const [pricingPlans, setPricingPlans] = useState<PricingPlan[]>([])
  const [accounts, setAccounts] = useState<AlimtalkAccount[]>([])
  const [stats, setStats] = useState<AlimtalkStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editPrice, setEditPrice] = useState<number>(0)

  useEffect(() => {
    const sessionToken = localStorage.getItem('admin_token') || localStorage.getItem('admin_session_token')
    const userType = localStorage.getItem('user_type')
    if (!sessionToken || userType !== 'admin') { navigate('/admin/login'); return }
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
        api.get('/api/admin/alimtalk/statistics', { headers })
      ])
      setPricingPlans(pricingRes.data.data)
      setAccounts(accountsRes.data.data)
      setStats(statsRes.data.data)
    } catch (err: any) {
      if (err.response?.status === 401) navigate('/admin/login')
    } finally { setLoading(false) }
  }

  async function savePrice(id: number) {
    try {
      const sessionToken = localStorage.getItem('admin_token') || localStorage.getItem('admin_session_token')
      await api.put(`/api/admin/alimtalk/pricing/${id}`, { unit_price: editPrice }, {
        headers: { 'Authorization': `Bearer ${sessionToken}` }
      })
      setEditingId(null); loadAllData()
    } catch { toast.error('가격 수정에 실패했습니다.') }
  }

  async function toggleAccountStatus(accountId: number, currentStatus: string) {
    try {
      const sessionToken = localStorage.getItem('admin_token') || localStorage.getItem('admin_session_token')
      await api.patch(`/api/admin/alimtalk/accounts/${accountId}/status`, {
        status: currentStatus === 'active' ? 'suspended' : 'active'
      }, { headers: { 'Authorization': `Bearer ${sessionToken}` } })
      loadAllData()
    } catch { toast.error('상태 변경에 실패했습니다.') }
  }

  function fmt(n: number) { return new Intl.NumberFormat('ko-KR').format(n || 0) }
  function fmtDate(s: string) { return new Date(s).toLocaleString('ko-KR') }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F4F5F7]">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">알림톡 데이터를 불러오는 중...</p>
        </div>
      </div>
    )
  }

  return (
    <AdminLayout title="알림톡 관리">
      {/* 통계 카드 */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: '총 발송', value: `${fmt(stats.total_sent)}건`, icon: <MessageSquare className="w-5 h-5" />, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: '총 비용', value: `${fmt(stats.total_cost)}원`, icon: <DollarSign className="w-5 h-5" />, color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: '활성 계정', value: `${stats.active_accounts}개`, icon: <Users className="w-5 h-5" />, color: 'text-purple-600', bg: 'bg-purple-50' },
            { label: '잔액 합계', value: `${fmt(stats.total_balance)}원`, icon: <TrendingUp className="w-5 h-5" />, color: 'text-amber-600', bg: 'bg-amber-50' },
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

      {/* 요금제 관리 */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">요금제 관리</h2>
        </div>
        <div className="p-5 space-y-3">
          {pricingPlans.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">등록된 요금제가 없습니다</p>
          ) : pricingPlans.map(plan => (
            <div key={plan.id} className={`border border-gray-100 rounded-xl p-4 ${!plan.is_active ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-semibold text-gray-900">{plan.name}</h3>
                    <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${plan.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                      {plan.is_active ? '활성' : '비활성'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mb-3">{plan.description}</p>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs text-gray-400 mb-1">발송 단가</p>
                      {editingId === plan.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            value={editPrice}
                            onChange={e => setEditPrice(Number(e.target.value))}
                            className="w-24 px-2 py-1 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            min="0"
                          />
                          <span className="text-xs text-gray-500">원</span>
                        </div>
                      ) : (
                        <p className="text-sm font-semibold text-gray-900">{fmt(plan.unit_price)}원/건</p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-1">월 할당량</p>
                      <p className="text-sm font-semibold text-gray-900">{fmt(plan.monthly_quota)}건</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 mb-1">할인율</p>
                      <p className="text-sm font-semibold text-gray-900">{plan.discount_rate}%</p>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 ml-4">
                  {editingId === plan.id ? (
                    <>
                      <button onClick={() => savePrice(plan.id)} className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100"><Save className="w-4 h-4" /></button>
                      <button onClick={() => setEditingId(null)} className="p-1.5 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200"><X className="w-4 h-4" /></button>
                    </>
                  ) : (
                    <button onClick={() => { setEditingId(plan.id); setEditPrice(plan.unit_price) }} className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100"><Edit2 className="w-4 h-4" /></button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 셀러 알림톡 계정 */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">셀러 알림톡 계정</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px]">
            <thead>
              <tr className="bg-gray-50">
                {['셀러', '채널 ID', '발신번호', '잔액', '상태', '등록일', '관리'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {accounts.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">등록된 계정이 없습니다</td></tr>
              ) : accounts.map(account => (
                <tr key={account.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-xs font-medium text-gray-900">{account.seller_name}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">{account.kakao_channel_id}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">{account.sender_phone}</td>
                  <td className="px-4 py-3 text-xs text-gray-700">{fmt(account.balance)}원</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${
                      account.status === 'active' ? 'bg-emerald-50 text-emerald-700' :
                      account.status === 'pending' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'
                    }`}>
                      {account.status === 'active' ? '활성' : account.status === 'pending' ? '대기' : '중지'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">{fmtDate(account.created_at)}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleAccountStatus(account.id, account.status)}
                      className={`p-1.5 rounded-lg ${account.status === 'active' ? 'bg-red-50 text-red-500 hover:bg-red-100' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}
                    >
                      {account.status === 'active' ? <Ban className="w-3.5 h-3.5" /> : <Check className="w-3.5 h-3.5" />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  )
}
