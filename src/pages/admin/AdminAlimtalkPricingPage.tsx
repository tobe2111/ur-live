/**
 * 어드민 알림톡 요금제 관리 페이지
 * 
 * 기능:
 * - 요금제 목록 조회
 * - 요금제 가격 수정
 * - 요금제 활성화/비활성화
 * - 셀러 알림톡 계정 관리
 * - 발송 통계 조회
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import {
  MessageSquare, 
  DollarSign, 
  Users, 
  TrendingUp,
  ArrowLeft,
  Edit2,
  Save,
  X,
  Check,
  Ban,
  Loader2
} from 'lucide-react'

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
    
    if (!sessionToken || userType !== 'admin') {
      navigate('/admin/login')
      return
    }
    
    loadAllData()
  }, [])

  async function loadAllData() {
    try {
      setLoading(true)
      const sessionToken = localStorage.getItem('admin_token') || localStorage.getItem('admin_session_token')

      const [pricingRes, accountsRes, statsRes] = await Promise.all([
        api.get('/api/admin/alimtalk/pricing', {
          headers: { 'Authorization': `Bearer ${sessionToken}` }
        }),
        api.get('/api/admin/alimtalk/accounts', {
          headers: { 'Authorization': `Bearer ${sessionToken}` }
        }),
        api.get('/api/admin/alimtalk/statistics', {
          headers: { 'Authorization': `Bearer ${sessionToken}` }
        })
      ])

      setPricingPlans(pricingRes.data.data)
      setAccounts(accountsRes.data.data)
      setStats(statsRes.data.data)
      setLoading(false)
    } catch (err: any) {
      console.error('Failed to load alimtalk data:', err)
      if (err.response?.status === 401) {
        navigate('/admin/login')
      }
      setLoading(false)
    }
  }

  async function startEdit(plan: PricingPlan) {
    setEditingId(plan.id)
    setEditPrice(plan.unit_price)
  }

  async function savePrice(id: number) {
    try {
      const sessionToken = localStorage.getItem('admin_token') || localStorage.getItem('admin_session_token')
      
      await api.put(`/api/admin/alimtalk/pricing/${id}`, {
        unit_price: editPrice
      }, {
        headers: { 'Authorization': `Bearer ${sessionToken}` }
      })

      setEditingId(null)
      loadAllData()
    } catch (err: any) {
      console.error('Failed to update price:', err)
      toast.error('가격 수정에 실패했습니다.')
    }
  }

  function cancelEdit() {
    setEditingId(null)
    setEditPrice(0)
  }

  async function toggleAccountStatus(accountId: number, currentStatus: string) {
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active'
    
    try {
      const sessionToken = localStorage.getItem('admin_token') || localStorage.getItem('admin_session_token')
      
      await api.patch(`/api/admin/alimtalk/accounts/${accountId}/status`, {
        status: newStatus
      }, {
        headers: { 'Authorization': `Bearer ${sessionToken}` }
      })

      loadAllData()
    } catch (err: any) {
      console.error('Failed to update account status:', err)
      toast.error('상태 변경에 실패했습니다.')
    }
  }

  function formatPrice(price: number) {
    return new Intl.NumberFormat('ko-KR').format(price || 0)
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleString('ko-KR')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">알림톡 데이터를 불러오는 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/admin')}
                className="text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">💬 알림톡 관리</h1>
                <p className="text-sm text-gray-600">요금제 및 계정 관리</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Statistics Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-2">
                <MessageSquare className="w-8 h-8 text-blue-600" />
              </div>
              <p className="text-sm text-gray-600">총 발송</p>
              <p className="text-3xl font-bold text-gray-900">{formatPrice(stats.total_sent)}</p>
              <p className="text-xs text-gray-500 mt-1">누적 발송 건수</p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-2">
                <DollarSign className="w-8 h-8 text-green-600" />
              </div>
              <p className="text-sm text-gray-600">총 비용</p>
              <p className="text-3xl font-bold text-gray-900">{formatPrice(stats.total_cost)}원</p>
              <p className="text-xs text-gray-500 mt-1">누적 발송 비용</p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-2">
                <Users className="w-8 h-8 text-purple-600" />
              </div>
              <p className="text-sm text-gray-600">활성 계정</p>
              <p className="text-3xl font-bold text-gray-900">{stats.active_accounts}</p>
              <p className="text-xs text-gray-500 mt-1">사용 중인 셀러</p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-2">
                <TrendingUp className="w-8 h-8 text-yellow-600" />
              </div>
              <p className="text-sm text-gray-600">잔액 합계</p>
              <p className="text-3xl font-bold text-gray-900">{formatPrice(stats.total_balance)}원</p>
              <p className="text-xs text-gray-500 mt-1">전체 셀러 잔액</p>
            </div>
          </div>
        )}

        {/* Pricing Plans */}
        <div className="bg-white rounded-lg shadow mb-8">
          <div className="p-6 border-b">
            <h2 className="text-xl font-bold text-gray-900">요금제 관리</h2>
            <p className="text-sm text-gray-600 mt-1">알림톡 발송 요금제 설정</p>
          </div>
          
          <div className="p-6">
            <div className="grid gap-4">
              {pricingPlans.map((plan) => (
                <div 
                  key={plan.id} 
                  className={`border rounded-lg p-4 ${
                    plan.is_active ? 'bg-white' : 'bg-gray-50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
                        {plan.is_active ? (
                          <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">활성</span>
                        ) : (
                          <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded">비활성</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mb-3">{plan.description}</p>
                      
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-gray-500">발송 단가</p>
                          {editingId === plan.id ? (
                            <div className="flex items-center gap-2 mt-1">
                              <input
                                type="number"
                                value={editPrice}
                                onChange={(e) => setEditPrice(Number(e.target.value))}
                                className="border rounded px-2 py-1 w-24"
                                min="0"
                              />
                              <span>원</span>
                            </div>
                          ) : (
                            <p className="font-semibold text-gray-900 mt-1">{formatPrice(plan.unit_price)}원/건</p>
                          )}
                        </div>
                        <div>
                          <p className="text-gray-500">월 할당량</p>
                          <p className="font-semibold text-gray-900 mt-1">{formatPrice(plan.monthly_quota)}건</p>
                        </div>
                        <div>
                          <p className="text-gray-500">할인율</p>
                          <p className="font-semibold text-gray-900 mt-1">{plan.discount_rate}%</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 ml-4">
                      {editingId === plan.id ? (
                        <>
                          <button
                            onClick={() => savePrice(plan.id)}
                            className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                            title="저장"
                          >
                            <Save className="w-5 h-5" />
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="p-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                            title="취소"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => startEdit(plan)}
                          className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                          title="가격 수정"
                        >
                          <Edit2 className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Seller Accounts */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b">
            <h2 className="text-xl font-bold text-gray-900">셀러 알림톡 계정</h2>
            <p className="text-sm text-gray-600 mt-1">등록된 카카오 채널 관리</p>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">셀러</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">채널 ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">발신번호</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">잔액</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">상태</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">등록일</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">관리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {accounts.length > 0 ? accounts.map((account) => (
                  <tr key={account.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {account.seller_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {account.kakao_channel_id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {account.sender_phone}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                      {formatPrice(account.balance)}원
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className={`px-2 py-1 text-xs rounded ${
                        account.status === 'active' 
                          ? 'bg-green-100 text-green-800' 
                          : account.status === 'pending'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {account.status === 'active' ? '활성' : account.status === 'pending' ? '대기' : '중지'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">
                      {formatDate(account.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <button
                        onClick={() => toggleAccountStatus(account.id, account.status)}
                        className={`p-2 rounded-lg ${
                          account.status === 'active'
                            ? 'bg-red-100 text-red-600 hover:bg-red-200'
                            : 'bg-green-100 text-green-600 hover:bg-green-200'
                        }`}
                        title={account.status === 'active' ? '중지' : '활성화'}
                      >
                        {account.status === 'active' ? <Ban className="w-5 h-5" /> : <Check className="w-5 h-5" />}
                      </button>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                      등록된 계정이 없습니다
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
