import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import SellerLayout from '@/components/SellerLayout'
import {
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
import { formatKSTDate } from '@/utils/date'

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
  const { t } = useTranslation()
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
      setError(t('seller.settlementLoadFailed'))
      if (error.response?.status === 401) {
        navigate('/seller/login')
      }
    } finally {
      setLoading(false)
    }
  }

  async function requestSettlement() {
    const pendingAmount = stats?.pending_amount || 0
    if (pendingAmount <= 0) {
      toast.error(t('seller.noSettlementAmount'))
      return
    }
    if (!confirm(t('seller.confirmSettlementRequest', { amount: pendingAmount.toLocaleString() }))) return

    try {
      const sessionToken = localStorage.getItem('seller_token')
      // Retrieve seller bank info from localStorage or profile
      const sellerBankName = localStorage.getItem('seller_bank_name') || ''
      const sellerAccountNumber = localStorage.getItem('seller_account_number') || ''
      const sellerAccountHolder = localStorage.getItem('seller_account_holder') || localStorage.getItem('seller_name') || ''
      const response = await api.post('/api/seller/settlements/request', {
        amount: pendingAmount,
        bank_name: sellerBankName,
        account_number: sellerAccountNumber,
        account_holder: sellerAccountHolder,
      }, {
        headers: { 'Authorization': `Bearer ${sessionToken}` }
      })

      if (response.data.success) {
        toast.success(t('seller.settlementRequested'))
        loadSettlements()
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('seller.settlementRequestFailed2'))
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
      toast.error(t('seller.settlementDownloadFailed'))
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
      pending: t('common.pending'),
      approved: t('common.completed'),
      paid: t('common.paid'),
      rejected: t('common.cancelled'),
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
          <p className="text-gray-600">{t('seller.settlementLoadingText')}</p>
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
          <Button onClick={() => loadSettlements()}>{t('common.refresh')}</Button>
        </div>
      </div>
    )
  }

  const headerRight = (
    <div className="flex gap-2">
      <Button onClick={() => loadSettlements()} variant="outline" size="sm" className="border-gray-300 text-gray-700 hover:bg-gray-100">
        <RefreshCw className="w-4 h-4 mr-2" />
        {t('common.refresh')}
      </Button>
      <Button onClick={requestSettlement} className="bg-blue-600 hover:bg-blue-700" size="sm">
        <FileText className="w-4 h-4 mr-2" />
        {t('common.apply')}
      </Button>
    </div>
  )

  return (
    <SellerLayout title={t('seller.revenue')} headerRight={headerRight}>
      <div className="max-w-7xl mx-auto">
        {/* Statistics Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center gap-3 mb-2">
                <Clock className="w-8 h-8 text-yellow-600" />
                <div>
                  <p className="text-sm text-gray-600">{t('common.pending')}</p>
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
                  <p className="text-sm text-gray-600">{t('common.completed')}</p>
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
                  <p className="text-sm text-gray-600">{t('common.paid')}</p>
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
                  <p className="text-sm opacity-90">{t('common.settlement')}</p>
                  <p className="text-3xl font-bold">
                    ₩{(stats.pending_amount + stats.approved_amount + stats.paid_amount).toLocaleString()}
                  </p>
                </div>
              </div>
              <p className="text-sm opacity-75">{t('seller.allPeriod')}</p>
            </div>
          </div>
        )}

        {/* Period Filter */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700">
              <Calendar className="w-4 h-4 inline mr-2" />
              {t('seller.periodSelect')}:
            </label>
            <div className="flex gap-2">
              {[
                { value: 'all', label: t('common.all') },
                { value: '1m', label: t('seller.recent1Month') },
                { value: '3m', label: t('seller.recent3Months') },
                { value: '6m', label: t('seller.recent6Months') },
                { value: '1y', label: t('seller.recent1Year') }
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
                    {t('seller.settlementPeriod')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('seller.sales')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('seller.commissionRate')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('seller.commissionAmountColumn')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('seller.settlementAmountColumn')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('common.status')}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('seller.requestDateColumn')}
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
                      {t('common.noData')}
                    </td>
                  </tr>
                ) : (
                  settlements.map((settlement) => (
                    <tr key={settlement.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {formatKSTDate(settlement.period_start)} ~
                        </div>
                        <div className="text-sm text-gray-600">
                          {formatKSTDate(settlement.period_end)}
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
                          {formatKSTDate(settlement.requested_at)}
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
          <h3 className="text-lg font-semibold text-blue-900 mb-3">{t('seller.settlementGuide')}</h3>
          <ul className="space-y-2 text-sm text-blue-800">
            <li>• {t('seller.settlementGuide1')}</li>
            <li>• {t('seller.settlementGuide2')}</li>
            <li>• {t('seller.settlementGuide3')}</li>
            <li>• {t('seller.settlementGuide4')}</li>
            <li>• {t('seller.settlementGuide5')}</li>
          </ul>
        </div>
      </div>
    </SellerLayout>
  )
}
