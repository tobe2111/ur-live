import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import SellerLayout from '@/components/SellerLayout'
import { DashboardPageHeader, DashboardStatCard, DashboardCard, DashboardLoading } from '@/components/dashboard'
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
  FileText,
  BarChart3,
  Table
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

function RevenueCalendar({ dailyData }: { dailyData: { date: string; revenue: number }[] }) {
  const { t } = useTranslation()
  const today = new Date()
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
  const startDay = new Date(today.getFullYear(), today.getMonth(), 1).getDay()

  const dataMap = new Map(dailyData.map(d => [d.date, d.revenue]))
  const maxRevenue = Math.max(...dailyData.map(d => d.revenue), 1)

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold text-gray-900">
          {t('seller.settlements.revenueCalendarTitle', { year: today.getFullYear(), month: today.getMonth() + 1 })}
        </h3>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {[t('seller.settlements.sun'), t('seller.settlements.mon'), t('seller.settlements.tue'), t('seller.settlements.wed'), t('seller.settlements.thu'), t('seller.settlements.fri'), t('seller.settlements.sat')].map(d => (
          <div key={d} className="text-center text-[10px] text-gray-500 py-1 font-medium">{d}</div>
        ))}
        {Array.from({ length: startDay }).map((_, i) => <div key={`e-${i}`} />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`
          const rev = dataMap.get(date) || 0
          const intensity = rev > 0 ? Math.max(0.2, rev / maxRevenue) : 0
          return (
            <div
              key={i}
              className="aspect-square rounded-lg flex flex-col items-center justify-center text-[10px]"
              style={{ backgroundColor: intensity > 0 ? `rgba(236,72,153,${intensity})` : '#f3f4f6' }}
            >
              <span className={rev > 0 ? 'text-white font-bold' : 'text-gray-600'}>{i + 1}</span>
              {rev > 0 && <span className="text-white text-[8px]">{(rev / 10000).toFixed(0)}{t('seller.settlements.tenThousand')}</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function SellerSettlementsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [settlements, setSettlements] = useState<Settlement[]>([])
  const [stats, setStats] = useState<SettlementStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedPeriod, setSelectedPeriod] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('table')
  const [dailyRevenue, setDailyRevenue] = useState<{ date: string; revenue: number }[]>([])

  useEffect(() => {
    const sessionToken = localStorage.getItem('seller_token')
    if (!sessionToken) {
      navigate('/seller/login')
      return
    }
    // Populate bank info from seller profile if not already in localStorage
    if (!localStorage.getItem('seller_bank_name')) {
      api.get('/api/seller/profile', {
        headers: { 'Authorization': `Bearer ${sessionToken}` }
      }).then(res => {
        if (res.data.success && res.data.data) {
          const seller = res.data.data
          if (seller.bank_name) localStorage.setItem('seller_bank_name', seller.bank_name)
          if (seller.bank_account) localStorage.setItem('seller_account_number', seller.bank_account)
          if (seller.account_holder) localStorage.setItem('seller_account_holder', seller.account_holder)
        }
      }).catch(() => { /* profile fetch is best-effort */ })
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

      // Get daily revenue for calendar
      try {
        const dailyRes = await api.get('/api/seller/dashboard/stats?period=30d', {
          headers: { 'Authorization': `Bearer ${sessionToken}` }
        })
        if (dailyRes.data.success && dailyRes.data.data?.daily_revenue) {
          setDailyRevenue(dailyRes.data.data.daily_revenue)
        }
      } catch {
        // daily revenue is optional - calendar will show empty
      }
    } catch (error: unknown) {
      const error_ = error as { response?: { data?: { error?: string; message?: string }; status?: number } };
      if (import.meta.env.DEV) console.error('Failed to load settlements:', error)
      setError(t('seller.settlementLoadFailed'))
      if (error_.response?.status === 401) {
        navigate('/seller/login')
      }
    } finally {
      setLoading(false)
    }
  }

  const hasBankInfo = !!(localStorage.getItem('seller_bank_name') && localStorage.getItem('seller_account_number'))

  async function requestSettlement() {
    const pendingAmount = stats?.pending_amount || 0
    if (pendingAmount <= 0) {
      toast.error(t('seller.noSettlementAmount'))
      return
    }
    if (!hasBankInfo) {
      toast.error(t('seller.bankInfoRequired'))
      return
    }
    if (!confirm(t('seller.confirmSettlementRequest', { amount: pendingAmount.toLocaleString() }))) return

    try {
      const sessionToken = localStorage.getItem('seller_token')
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
    } catch (error: unknown) {
      const error_ = error as { response?: { data?: { error?: string }; status?: number } }
      toast.error(error_.response?.data?.error || t('seller.settlementRequestFailed2'))
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
      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
        {/* 🛡️ 2026-04-22 배치 128: 디자인 시스템 적용 */}
        <DashboardPageHeader
          title={t('seller.revenue')}
          subtitle={t('seller.settlements.notice') || '정산 관리'}
          icon={<DollarSign className="h-5 w-5" />}
        />

        {/* 정산 안내 */}
        <DashboardCard>
          <div className="space-y-1.5 text-sm">
            <p className="font-semibold text-gray-900">📋 {t('seller.settlements.notice')}</p>
            <ul className="space-y-0.5 text-xs text-gray-600">
              <li>• {t('seller.settlements.noticeCycle')}</li>
              <li>• {t('seller.settlements.noticeConfirmed')}</li>
              <li>• {t('seller.settlements.noticeCommission')}</li>
            </ul>
          </div>
        </DashboardCard>

        {/* Bank info warning */}
        {!hasBankInfo && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
            <p className="font-semibold text-amber-900">{t('seller.bankInfoMissing')}</p>
            <p className="mt-0.5 text-xs">{t('seller.bankInfoMissingDesc')}</p>
            <button
              onClick={() => navigate('/seller/business-info#bank-info-section')}
              className="mt-3 rounded-lg bg-amber-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
            >
              {t('seller.registerBankInfo')}
            </button>
          </div>
        )}

        {/* Statistics Cards */}
        {stats && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <DashboardStatCard
              label={t('common.pending')}
              value={`₩${stats.pending_amount.toLocaleString()}`}
              hint={`${stats.total_pending}건`}
              icon={<Clock className="h-4 w-4" />}
              accent="amber"
            />
            <DashboardStatCard
              label={t('common.completed')}
              value={`₩${stats.approved_amount.toLocaleString()}`}
              hint={`${stats.total_approved}건`}
              icon={<CheckCircle className="h-4 w-4" />}
              accent="blue"
            />
            <DashboardStatCard
              label={t('common.paid')}
              value={`₩${stats.paid_amount.toLocaleString()}`}
              hint={`${stats.total_paid}건`}
              icon={<DollarSign className="h-4 w-4" />}
              accent="green"
            />
            <DashboardStatCard
              label={t('common.settlement')}
              value={`₩${(stats.pending_amount + stats.approved_amount + stats.paid_amount).toLocaleString()}`}
              hint={t('seller.allPeriod')}
              icon={<TrendingUp className="h-4 w-4" />}
              accent="violet"
            />
          </div>
        )}

        {/* View Mode Toggle */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                viewMode === 'table'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Table className="w-4 h-4" />
              {t('seller.settlementTableView')}
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                viewMode === 'calendar'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              {t('seller.revenueCalendar')}
            </button>
          </div>
        </div>

        {viewMode === 'calendar' ? (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <RevenueCalendar dailyData={dailyRevenue} />
          </div>
        ) : (
        <>
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
                    {t('seller.actionColumn')}
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
        </>
        )}
      </div>
    </SellerLayout>
  )
}
