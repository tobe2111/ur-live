import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { DollarSign, TrendingUp, Users, Download, CheckCircle, Clock, ArrowLeft } from 'lucide-react'

interface SettlementStats {
  total_orders: number
  total_sales: number
  total_commission: number
  total_seller_amount: number
}

interface SellerSettlement {
  seller_id: number
  seller_name: string
  business_name: string
  commission_rate: number
  order_count: number
  total_sales: number
  commission_amount: number
  seller_amount: number
  pending_amount: number
  settled_amount: number
}

interface SettlementRecord {
  id: number
  order_number: string
  seller_id: number
  seller_name: string
  business_name: string
  total_amount: number
  commission_rate: number
  commission_amount: number
  seller_amount: number
  settlement_status: string
  settled_at: string | null
  created_at: string
  user_name: string
}

export default function AdminSettlementPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('all')
  const [stats, setStats] = useState<SettlementStats | null>(null)
  const [sellers, setSellers] = useState<SellerSettlement[]>([])
  const [records, setRecords] = useState<SettlementRecord[]>([])
  const [selectedSeller, setSelectedSeller] = useState<number | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')

  useEffect(() => {
    // Check admin session
    const token = localStorage.getItem('session_token')
    const userType = localStorage.getItem('user_type')
    if (!token || userType !== 'admin') {
      navigate('/admin/login')
      return
    }

    loadData()
  }, [navigate, period, selectedSeller, statusFilter])

  async function loadData() {
    try {
      setLoading(true)
      const token = localStorage.getItem('session_token')
      const headers = { 'X-Session-Token': token }

      // Load statistics
      const statsRes = await api.get(`/api/admin/settlement/stats?period=${period}`, { headers })
      
      if (statsRes.data.success) {
        setStats(statsRes.data.data.overview)
        setSellers(statsRes.data.data.sellers || [])
      }

      // Load records
      const params = new URLSearchParams()
      if (period !== 'all') params.append('period', period)
      if (selectedSeller) params.append('seller_id', selectedSeller.toString())
      if (statusFilter !== 'all') params.append('status', statusFilter)

      const recordsRes = await api.get(`/api/admin/settlement/records?${params.toString()}`, { headers })
      
      if (recordsRes.data.success) {
        setRecords(recordsRes.data.data || [])
      }

      setLoading(false)
    } catch (err: any) {
      console.error('Failed to load settlement data:', err)
      if (err.response?.status === 401) {
        localStorage.removeItem('session_token')
        localStorage.removeItem('user_type')
        navigate('/admin/login')
      }
      setLoading(false)
    }
  }

  async function updateSettlementStatus(orderId: number, status: string) {
    try {
      const token = localStorage.getItem('session_token')
      await api.patch(
        `/api/admin/settlement/${orderId}/status`,
        { status },
        { headers: { 'X-Session-Token': token } }
      )
      alert('정산 상태가 변경되었습니다')
      loadData()
    } catch (err: any) {
      alert(`상태 변경 실패: ${err.response?.data?.error || err.message}`)
    }
  }

  async function batchComplete(orderIds: number[]) {
    if (!confirm(`${orderIds.length}건의 주문을 정산 완료 처리하시겠습니까?`)) return

    try {
      const token = localStorage.getItem('session_token')
      await api.post(
        '/api/admin/settlement/batch-complete',
        { order_ids: orderIds },
        { headers: { 'X-Session-Token': token } }
      )
      alert('일괄 정산 완료!')
      loadData()
    } catch (err: any) {
      alert(`일괄 처리 실패: ${err.response?.data?.error || err.message}`)
    }
  }

  async function exportCSV() {
    try {
      const token = localStorage.getItem('session_token')
      const params = new URLSearchParams()
      if (period !== 'all') params.append('period', period)
      if (selectedSeller) params.append('seller_id', selectedSeller.toString())

      const response = await api.get(
        `/api/admin/settlement/export-csv?${params.toString()}`,
        {
          headers: { 'X-Session-Token': token },
          responseType: 'blob'
        }
      )

      // Download file
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `settlement_${period}_${Date.now()}.csv`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err: any) {
      alert(`CSV 다운로드 실패: ${err.response?.data?.error || err.message}`)
    }
  }

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(amount)
  }

  function formatDate(dateString: string) {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">로딩 중...</p>
        </div>
      </div>
    )
  }

  const pendingOrders = records.filter(r => r.settlement_status === 'pending')

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/admin')}
              className="text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <h1 className="text-2xl font-bold text-gray-900">💰 정산 대시보드</h1>
          </div>
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
          >
            <Download className="w-4 h-4" />
            CSV 다운로드
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Period Filter */}
        <div className="mb-6 flex gap-2">
          {['today', 'week', 'month', 'all'].map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-lg font-medium ${
                period === p
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              {p === 'today' ? '오늘' : p === 'week' ? '이번 주' : p === 'month' ? '이번 달' : '전체'}
            </button>
          ))}
        </div>

        {/* Stats Grid */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-2">
                <DollarSign className="w-10 h-10 text-blue-600" />
              </div>
              <p className="text-sm text-gray-600">총 판매액</p>
              <p className="text-3xl font-bold text-gray-900">{formatCurrency(stats.total_sales)}</p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-2">
                <TrendingUp className="w-10 h-10 text-green-600" />
              </div>
              <p className="text-sm text-gray-600">총 수수료</p>
              <p className="text-3xl font-bold text-green-900">{formatCurrency(stats.total_commission)}</p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-2">
                <Users className="w-10 h-10 text-purple-600" />
              </div>
              <p className="text-sm text-gray-600">총 정산액</p>
              <p className="text-3xl font-bold text-purple-900">{formatCurrency(stats.total_seller_amount)}</p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between mb-2">
                <CheckCircle className="w-10 h-10 text-orange-600" />
              </div>
              <p className="text-sm text-gray-600">주문 건수</p>
              <p className="text-3xl font-bold text-orange-900">{stats.total_orders}건</p>
            </div>
          </div>
        )}

        {/* Seller Settlement Summary */}
        <div className="bg-white rounded-lg shadow mb-8">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900">셀러별 정산 현황</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">판매자</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">사업자명</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">주문수</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">판매액</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">수수료율</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">수수료</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">정산액</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">정산대기</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">정산완료</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {sellers.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-4 text-center text-gray-500">
                      정산 데이터가 없습니다
                    </td>
                  </tr>
                ) : (
                  sellers.map(seller => (
                    <tr
                      key={seller.seller_id}
                      className={`cursor-pointer hover:bg-gray-50 ${
                        selectedSeller === seller.seller_id ? 'bg-blue-50' : ''
                      }`}
                      onClick={() => setSelectedSeller(selectedSeller === seller.seller_id ? null : seller.seller_id)}
                    >
                      <td className="px-6 py-4 text-sm text-gray-900">{seller.seller_name}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{seller.business_name || '-'}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{seller.order_count}건</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{formatCurrency(seller.total_sales)}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{seller.commission_rate}%</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{formatCurrency(seller.commission_amount)}</td>
                      <td className="px-6 py-4 text-sm font-semibold text-blue-900">{formatCurrency(seller.seller_amount)}</td>
                      <td className="px-6 py-4 text-sm text-yellow-600">{formatCurrency(seller.pending_amount)}</td>
                      <td className="px-6 py-4 text-sm text-green-600">{formatCurrency(seller.settled_amount)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Settlement Records */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">정산 내역</h2>
            <div className="flex gap-2">
              {['all', 'pending', 'completed'].map(status => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-3 py-1 rounded-lg text-sm font-medium ${
                    statusFilter === status
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {status === 'all' ? '전체' : status === 'pending' ? '대기중' : '완료'}
                </button>
              ))}
              {pendingOrders.length > 0 && (
                <button
                  onClick={() => batchComplete(pendingOrders.map(r => r.id))}
                  className="ml-4 px-3 py-1 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
                >
                  일괄 정산 완료 ({pendingOrders.length})
                </button>
              )}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">주문번호</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">판매자</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">구매자</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">주문금액</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">수수료</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">정산액</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">상태</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">주문일시</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">액션</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {records.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-4 text-center text-gray-500">
                      정산 내역이 없습니다
                    </td>
                  </tr>
                ) : (
                  records.map(record => (
                    <tr key={record.id}>
                      <td className="px-6 py-4 text-sm text-gray-900">{record.order_number}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{record.seller_name}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{record.user_name || '익명'}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{formatCurrency(record.total_amount)}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {formatCurrency(record.commission_amount)}
                        <span className="ml-1 text-xs text-gray-500">({record.commission_rate}%)</span>
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-blue-900">
                        {formatCurrency(record.seller_amount)}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full ${
                          record.settlement_status === 'completed'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {record.settlement_status === 'completed' ? (
                            <><CheckCircle className="w-3 h-3" /> 완료</>
                          ) : (
                            <><Clock className="w-3 h-3" /> 대기</>
                          )}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">{formatDate(record.created_at)}</td>
                      <td className="px-6 py-4">
                        {record.settlement_status === 'pending' ? (
                          <button
                            onClick={() => updateSettlementStatus(record.id, 'completed')}
                            className="text-green-600 hover:text-green-800 text-sm font-medium"
                          >
                            정산완료
                          </button>
                        ) : (
                          <button
                            onClick={() => updateSettlementStatus(record.id, 'pending')}
                            className="text-gray-600 hover:text-gray-800 text-sm font-medium"
                          >
                            대기로 변경
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
