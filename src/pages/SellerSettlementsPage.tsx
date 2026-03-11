import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  ArrowLeft, 
  DollarSign,
  Calendar,
  CheckCircle,
  Clock,
  XCircle,
  Download,
  Eye,
  TrendingUp,
  Loader2,
  RefreshCw,
  FileText
} from 'lucide-react'

interface Settlement {
  id: number
  seller_id: number
  period_start: string
  period_end: string
  total_sales: number
  commission_rate: number
  commission_amount: number
  settlement_amount: number
  status: 'pending' | 'approved' | 'paid' | 'rejected'
  requested_at: string
  approved_at: string | null
  paid_at: string | null
  created_at: string
  updated_at: string
}

interface SettlementStats {
  total_pending: number
  total_approved: number
  total_paid: number
  pending_amount: number
  approved_amount: number
  paid_amount: number
}

export default function SellerSettlementsPage() {
  const navigate = useNavigate()
  const [settlements, setSettlements] = useState<Settlement[]>([])
  const [stats, setStats] = useState<SettlementStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedPeriod, setSelectedPeriod] = useState<string>('all')

  useEffect(() => {
    const sessionToken = localStorage.getItem('seller_token')
    if (!sessionToken) {
      navigate('/seller/login')
      return
    }
    loadSettlements()
  }, [selectedPeriod])

  async function loadSettlements() {
    setLoading(true)
    setError('')

    try {
      const sessionToken = localStorage.getItem('seller_token')
      
      // Get settlements
      const response = await api.get('/api/seller/settlements', {
        headers: { 'Authorization': `Bearer ${sessionToken}` },
        params: selectedPeriod !== 'all' ? { period: selectedPeriod } : {}
      })

      if (response.data.success) {
        setSettlements(response.data.data)
      }

      // Get stats
      const statsResponse = await api.get('/api/seller/settlements/stats', {
        headers: { 'Authorization': `Bearer ${sessionToken}` }
      })

      if (statsResponse.data.success) {
        setStats(statsResponse.data.data)
      }
    } catch (error: any) {
      console.error('Failed to load settlements:', error)
      setError('정산 내역을 불러올 수 없습니다.')
      if (error.response?.status === 401) {
        navigate('/seller/login')
      }
    } finally {
      setLoading(false)
    }
  }

  async function requestSettlement() {
    if (!confirm('이번 달 정산을 신청하시겠습니까?')) return

    try {
      const sessionToken = localStorage.getItem('seller_token')
      const response = await api.post('/api/seller/settlements/request', {}, {
        headers: { 'Authorization': `Bearer ${sessionToken}` }
      })

      if (response.data.success) {
        alert('정산 신청이 완료되었습니다.')
        loadSettlements()
      }
    } catch (error: any) {
      alert(error.response?.data?.error || '정산 신청에 실패했습니다.')
    }
  }

  async function downloadSettlement(settlementId: number) {
    try {
      const sessionToken = localStorage.getItem('seller_token')
      const response = await api.get(`/api/seller/settlements/${settlementId}/download`, {
        headers: { 'Authorization': `Bearer ${sessionToken}` },
        responseType: 'blob'
      })

      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `settlement_${settlementId}.pdf`)
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch (error) {
      alert('정산서 다운로드에 실패했습니다.')
    }
  }

  function getStatusBadge(status: string) {
    const styles: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-blue-100 text-blue-800',
      paid: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800'
    }

    const labels: Record<string, string> = {
      pending: '대기 중',
      approved: '승인됨',
      paid: '지급 완료',
      rejected: '거부됨'
    }

    return (
      <Badge className={styles[status] || 'bg-gray-100 text-gray-800'}>
        {labels[status] || status}
      </Badge>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">정산 내역을 불러오는 중...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 mb-4">{error}</p>
          <Button onClick={() => loadSettlements()}>다시 시도</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/seller')}
                className="text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">정산 관리</h1>
                <p className="text-sm text-gray-600">판매 정산 내역 및 관리</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => loadSettlements()}
                variant="outline"
                size="sm"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                새로고침
              </Button>
              <Button
                onClick={requestSettlement}
                className="bg-blue-600 hover:bg-blue-700"
                size="sm"
              >
                <FileText className="w-4 h-4 mr-2" />
                정산 신청
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Statistics Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center gap-3 mb-2">
                <Clock className="w-8 h-8 text-yellow-600" />
                <div>
                  <p className="text-sm text-gray-600">대기 중</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.total_pending}</p>
                </div>
              </div>
              <p className="text-sm text-yellow-600 font-medium">
                ₩{stats.pending_amount.toLocaleString()}
              </p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center gap-3 mb-2">
                <CheckCircle className="w-8 h-8 text-blue-600" />
                <div>
                  <p className="text-sm text-gray-600">승인됨</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.total_approved}</p>
                </div>
              </div>
              <p className="text-sm text-blue-600 font-medium">
                ₩{stats.approved_amount.toLocaleString()}
              </p>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center gap-3 mb-2">
                <DollarSign className="w-8 h-8 text-green-600" />
                <div>
                  <p className="text-sm text-gray-600">지급 완료</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.total_paid}</p>
                </div>
              </div>
              <p className="text-sm text-green-600 font-medium">
                ₩{stats.paid_amount.toLocaleString()}
              </p>
            </div>

            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow p-6 text-white col-span-1 md:col-span-3">
              <div className="flex items-center gap-3 mb-2">
                <TrendingUp className="w-10 h-10" />
                <div>
                  <p className="text-sm opacity-90">총 정산 금액</p>
                  <p className="text-3xl font-bold">
                    ₩{(stats.pending_amount + stats.approved_amount + stats.paid_amount).toLocaleString()}
                  </p>
                </div>
              </div>
              <p className="text-sm opacity-75">전체 기간 누적</p>
            </div>
          </div>
        )}

        {/* Period Filter */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700">
              <Calendar className="w-4 h-4 inline mr-2" />
              기간 선택:
            </label>
            <div className="flex gap-2">
              {[
                { value: 'all', label: '전체' },
                { value: '1m', label: '최근 1개월' },
                { value: '3m', label: '최근 3개월' },
                { value: '6m', label: '최근 6개월' },
                { value: '1y', label: '최근 1년' }
              ].map(period => (
                <button
                  key={period.value}
                  onClick={() => setSelectedPeriod(period.value)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedPeriod === period.value
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {period.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Settlements Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    정산 기간
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    총 매출
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    수수료율
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    수수료 금액
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    정산 금액
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    상태
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    신청일
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    액션
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {settlements.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                      정산 내역이 없습니다.
                    </td>
                  </tr>
                ) : (
                  settlements.map((settlement) => (
                    <tr key={settlement.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {new Date(settlement.period_start).toLocaleDateString('ko-KR')} ~
                        </div>
                        <div className="text-sm text-gray-600">
                          {new Date(settlement.period_end).toLocaleDateString('ko-KR')}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          ₩{settlement.total_sales.toLocaleString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {settlement.commission_rate}%
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-red-600 font-medium">
                          -₩{settlement.commission_amount.toLocaleString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-green-600 font-bold">
                          ₩{settlement.settlement_amount.toLocaleString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(settlement.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {new Date(settlement.requested_at).toLocaleDateString('ko-KR')}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <Button
                          onClick={() => downloadSettlement(settlement.id)}
                          variant="ghost"
                          size="sm"
                          disabled={settlement.status === 'pending'}
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Help Text */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">💡 정산 안내</h3>
          <ul className="space-y-2 text-sm text-blue-800">
            <li>• 정산은 매월 1일부터 말일까지의 매출을 기준으로 합니다.</li>
            <li>• 정산 신청은 익월 1일부터 가능합니다.</li>
            <li>• 정산 금액 = 총 매출 - 수수료 ({stats?.pending_amount ? '현재 수수료율 기준' : '판매자별 수수료율 적용'})</li>
            <li>• 관리자 승인 후 영업일 기준 3-5일 내 지급됩니다.</li>
            <li>• 정산서는 승인 후 다운로드 가능합니다.</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
