import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { SellerPinPrompt } from '@/components/auth/SellerPinPrompt'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import SellerLayout from '@/components/SellerLayout'
import ImageUpload from '@/components/upload/ImageUpload'
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
import { formatNumber } from '@/utils/format'

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
  const [pinPrompt, setPinPrompt] = useState(false)

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
    if (!confirm(t('seller.confirmSettlementRequest', { amount: formatNumber(pendingAmount) }))) return

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
      const error_ = error as { response?: { data?: { error?: string; code?: string }; status?: number } }
      const code = error_.response?.data?.code
      if (code === 'PIN_REQUIRED') {
        setPinPrompt(true)
        return
      }
      if (code === 'PIN_NOT_SET') {
        toast.error(t('seller.settlements.pinNotSet', { defaultValue: '보안 PIN이 설정되지 않았어요. 프로필에서 먼저 설정해주세요.' }))
        navigate('/seller/profile')
        return
      }
      // 🛡️ 2026-05-18: 사업자등록 미검증 — 검증 흐름으로 안내.
      if (code === 'BUSINESS_REGISTRATION_REQUIRED') {
        toast.error(error_.response?.data?.error || '사업자등록증 검증이 필요합니다')
        setBizRegModalOpen(true)
        return
      }
      toast.error(error_.response?.data?.error || t('seller.settlementRequestFailed2'))
    }
  }

  // 🛡️ 2026-05-18: 사업자등록 검증 상태 + 옵션 조회.
  const [bizRegStatus, setBizRegStatus] = useState<string>('pending')
  const [bizRegImageUrl, setBizRegImageUrl] = useState<string | null>(null)
  const [bizRegRejectReason, setBizRegRejectReason] = useState<string | null>(null)
  const [bizRegModalOpen, setBizRegModalOpen] = useState(false)
  const [bizRegSubmitImage, setBizRegSubmitImage] = useState('')
  const [bizRegSubmitNumber, setBizRegSubmitNumber] = useState('')
  const [bizRegSubmitting, setBizRegSubmitting] = useState(false)

  useEffect(() => {
    const sessionToken = localStorage.getItem('seller_token')
    if (!sessionToken) return
    api.get('/api/seller/settlement-options', { headers: { Authorization: `Bearer ${sessionToken}` } })
      .then((res) => {
        if (res.data?.success) {
          const br = res.data.data.business_registration
          setBizRegStatus(br?.status || 'pending')
          setBizRegImageUrl(br?.image_url || null)
          setBizRegRejectReason(br?.reject_reason || null)
        }
      })
      .catch(() => { /* fail-soft */ })
  }, [])

  async function submitBusinessRegistration() {
    if (!bizRegSubmitImage.trim()) {
      toast.error('이미지 URL 을 입력해주세요')
      return
    }
    setBizRegSubmitting(true)
    try {
      const sessionToken = localStorage.getItem('seller_token')
      const res = await api.post('/api/seller/business-registration/submit',
        { image_url: bizRegSubmitImage.trim(), business_number: bizRegSubmitNumber.trim() },
        { headers: { Authorization: `Bearer ${sessionToken}` } })
      if (res.data?.success) {
        toast.success(res.data.message || '제출되었습니다')
        setBizRegStatus('pending')
        setBizRegImageUrl(bizRegSubmitImage.trim())
        setBizRegModalOpen(false)
        setBizRegSubmitImage('')
        setBizRegSubmitNumber('')
      }
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } }
      toast.error(ax.response?.data?.error || '제출 실패')
    } finally {
      setBizRegSubmitting(false)
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
          subtitle={t('seller.settlements.notice', { defaultValue: '정산 관리' })}
          icon={<DollarSign className="h-5 w-5" />}
        />

        {/* 🛡️ 2026-05-18: 사업자등록 검증 상태 배너 — 현금 정산 가능 여부 안내. */}
        {bizRegStatus !== 'verified' && bizRegStatus !== 'exempt' && (
          <div className={`rounded-xl p-4 border ${
            bizRegStatus === 'rejected' ? 'bg-red-50 border-red-200' :
            bizRegStatus === 'pending' && bizRegImageUrl ? 'bg-amber-50 border-amber-200' :
            'bg-blue-50 border-blue-200'
          }`}>
            <div className="flex items-start gap-3">
              <span className="text-2xl shrink-0">
                {bizRegStatus === 'rejected' ? '⚠️' : bizRegImageUrl ? '⏳' : '📋'}
              </span>
              <div className="flex-1 min-w-0">
                <p className={`font-bold text-sm ${
                  bizRegStatus === 'rejected' ? 'text-red-900' :
                  bizRegImageUrl ? 'text-amber-900' : 'text-blue-900'
                }`}>
                  {bizRegStatus === 'rejected' ? '사업자등록 반려됨 — 재제출 필요' :
                   bizRegImageUrl ? '사업자등록 검증 대기 중' :
                   '사업자등록증을 등록하면 현금 정산이 가능합니다'}
                </p>
                {bizRegStatus === 'rejected' && bizRegRejectReason && (
                  <p className="text-xs text-red-700 mt-1.5 bg-red-100 px-2 py-1 rounded">
                    반려 사유: {bizRegRejectReason}
                  </p>
                )}
                <p className="text-xs text-gray-600 mt-1.5">
                  {bizRegImageUrl && bizRegStatus === 'pending'
                    ? '어드민 검증 후 알려드립니다 (보통 1-3 영업일)'
                    : '미등록 상태 — 현재는 딜(포인트) / 상품권으로만 수령 가능 · 딜은 플랫폼 내 사용만 가능 (현금화 불가)'}
                </p>
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => setBizRegModalOpen(true)}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-md ${
                      bizRegStatus === 'rejected'
                        ? 'bg-red-600 text-white hover:bg-red-700'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {bizRegImageUrl ? '다시 제출하기' : '사업자등록증 등록하기'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 🛡️ 2026-05-18: 딜 잔액 + 환급 + 원천징수 현황 */}
        <DealBalanceCard />

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
              value={`₩${formatNumber(stats.pending_amount)}`}
              hint={`${stats.total_pending}${t('seller.ordersUnit', { defaultValue: '건' })}`}
              icon={<Clock className="h-4 w-4" />}
              accent="amber"
            />
            <DashboardStatCard
              label={t('common.completed')}
              value={`₩${formatNumber(stats.approved_amount)}`}
              hint={`${stats.total_approved}${t('seller.ordersUnit', { defaultValue: '건' })}`}
              icon={<CheckCircle className="h-4 w-4" />}
              accent="blue"
            />
            <DashboardStatCard
              label={t('common.paid')}
              value={`₩${formatNumber(stats.paid_amount)}`}
              hint={`${stats.total_paid}${t('seller.ordersUnit', { defaultValue: '건' })}`}
              icon={<DollarSign className="h-4 w-4" />}
              accent="green"
            />
            <DashboardStatCard
              label={t('common.settlement')}
              value={`₩${formatNumber(stats.pending_amount + stats.approved_amount + stats.paid_amount)}`}
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
                          ₩{formatNumber(settlement.total_sales)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {settlement.commission_rate}%
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-red-600 font-medium">
                          -₩{formatNumber(settlement.commission_amount)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-green-600 font-bold">
                          ₩{formatNumber(settlement.settlement_amount)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(settlement.status)}
                        {/* 🛡️ 배치 170: 예상 입금일 표시 */}
                        {settlement.status === 'pending' && (
                          <p className="text-[10px] text-amber-600 mt-0.5">
                            {t('seller.settlementEstimate', '예상 입금: 요청 후 영업일 3~5일')}
                          </p>
                        )}
                        {settlement.status === 'approved' && (
                          <p className="text-[10px] text-blue-600 mt-0.5">
                            {t('seller.settlementApprovedEstimate', '입금 예정: 1~2 영업일 내')}
                          </p>
                        )}
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
      {pinPrompt && (
        <SellerPinPrompt
          role="seller"
          onVerified={() => { setPinPrompt(false); requestSettlement() }}
          onCancel={() => setPinPrompt(false)}
        />
      )}
      {/* 🛡️ 2026-05-18: 사업자등록증 제출 모달. */}
      {bizRegModalOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => !bizRegSubmitting && setBizRegModalOpen(false)}
          role="presentation"
        >
          <div
            className="bg-white rounded-2xl w-full max-w-md p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <h3 className="text-lg font-bold text-gray-900 mb-1">사업자등록증 등록</h3>
            <p className="text-xs text-gray-500 mb-4">
              검증 완료 시 현금 정산 + 딜 환급이 가능합니다 (1-3 영업일 소요)
            </p>
            <div className="space-y-3">
              <ImageUpload
                label="사업자등록증 이미지"
                required
                value={bizRegSubmitImage}
                onChange={(url) => setBizRegSubmitImage(url)}
                tokenKey="seller_token"
                aspectRatio="auto"
              />
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  사업자등록번호 (선택)
                </label>
                <input
                  type="text"
                  value={bizRegSubmitNumber}
                  onChange={(e) => setBizRegSubmitNumber(e.target.value)}
                  placeholder="123-45-67890"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  disabled={bizRegSubmitting}
                />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button
                type="button"
                onClick={() => setBizRegModalOpen(false)}
                disabled={bizRegSubmitting}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-200 disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={submitBusinessRegistration}
                disabled={bizRegSubmitting || !bizRegSubmitImage.trim()}
                className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {bizRegSubmitting ? '제출 중...' : '제출하기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </SellerLayout>
  )
}

// 🛡️ 2026-05-18: 딜 잔액 + 환급 + 원천징수 카드 (셀러 본인용)
function DealBalanceCard() {
  const [balance, setBalance] = useState<{
    gated_deal_amount: number
    redeemable_deal_amount: number
    total: number
    business_verified: boolean
    withdrawable: number
    notice: string
  } | null>(null)
  const [tax, setTax] = useState<{
    year: number; total_gross: number; total_withheld: number; total_net: number
    payouts_count: number; reportable: boolean; threshold: number
  } | null>(null)
  const [withdrawOpen, setWithdrawOpen] = useState(false)
  const [voucherOpen, setVoucherOpen] = useState(false)
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('seller_token')
    if (!token) return
    api.get('/api/seller/deal-balance', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => { if (r.data?.success) setBalance(r.data.data) }).catch(() => { /* noop */ })
    api.get('/api/seller/tax-summary', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => { if (r.data?.success) setTax(r.data.data) }).catch(() => { /* noop */ })
  }, [])

  async function withdraw() {
    const amount = Number(withdrawAmount) || 0
    if (amount < 10_000) { toast.error('최소 환급 금액은 10,000 딜입니다'); return }
    if (balance && amount > balance.withdrawable) {
      toast.error(`환급 가능 잔액 부족 (보유: ${balance.withdrawable.toLocaleString()})`); return
    }
    if (!confirm(`${amount.toLocaleString()}딜 환급 신청? (8.8% 원천징수 차감 후 ${Math.floor(amount * 0.912).toLocaleString()}원 입금 예정)`)) return
    setSubmitting(true)
    try {
      const token = localStorage.getItem('seller_token')
      const sellerBankName = localStorage.getItem('seller_bank_name') || ''
      const sellerAccountNumber = localStorage.getItem('seller_account_number') || ''
      const sellerAccountHolder = localStorage.getItem('seller_account_holder') || localStorage.getItem('seller_name') || ''
      const r = await api.post('/api/seller/deal-withdraw', {
        amount,
        bank_name: sellerBankName,
        account_number: sellerAccountNumber,
        account_holder: sellerAccountHolder,
      }, { headers: { Authorization: `Bearer ${token}` } })
      if (r.data?.success) {
        toast.success(r.data.data.message || '환급 신청 완료')
        setWithdrawOpen(false)
        setWithdrawAmount('')
        // 잔액 다시 로드.
        api.get('/api/seller/deal-balance', { headers: { Authorization: `Bearer ${token}` } })
          .then(rr => { if (rr.data?.success) setBalance(rr.data.data) })
        api.get('/api/seller/tax-summary', { headers: { Authorization: `Bearer ${token}` } })
          .then(rr => { if (rr.data?.success) setTax(rr.data.data) })
      }
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string; code?: string } } }
      if (ax.response?.data?.code === 'BUSINESS_REGISTRATION_REQUIRED') {
        toast.error('사업자등록증 검증 후 환급 가능합니다')
      } else if (ax.response?.data?.code === 'PIN_REQUIRED') {
        toast.error('PIN 인증이 필요합니다 — 프로필에서 설정해주세요')
      } else {
        toast.error(ax.response?.data?.error || '환급 실패')
      }
    } finally { setSubmitting(false) }
  }

  if (!balance) return null

  return (
    <DashboardCard>
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-gray-500">딜 잔액</p>
            <p className="text-2xl font-extrabold text-gray-900 mt-1">
              {balance.total.toLocaleString()}<span className="text-sm font-medium ml-1">딜</span>
            </p>
          </div>
          {balance.business_verified && balance.withdrawable > 0 && (
            <button
              type="button"
              onClick={() => setWithdrawOpen(true)}
              className="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700"
            >
              💸 환급 신청
            </button>
          )}
          {/* 🛡️ 2026-05-19: 모든 셀러 (검증/미검증 둘 다) 가 상품권으로 받기 가능 */}
          {balance.total > 0 && (
            <button
              type="button"
              onClick={() => setVoucherOpen(true)}
              className="px-3 py-1.5 bg-pink-500 text-white text-xs font-bold rounded-lg hover:bg-pink-600 ml-2"
            >
              🎁 상품권으로 받기
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2 bg-emerald-50 rounded">
            <p className="text-emerald-700 font-bold">환급 가능</p>
            <p className="text-base font-extrabold text-gray-900 mt-0.5">
              {balance.withdrawable.toLocaleString()}
            </p>
          </div>
          <div className="p-2 bg-gray-50 rounded">
            <p className="text-gray-600 font-bold">플랫폼 내 사용 only</p>
            <p className="text-base font-extrabold text-gray-900 mt-0.5">
              {(balance.total - balance.withdrawable).toLocaleString()}
            </p>
          </div>
        </div>

        <p className="text-[11px] text-gray-500 italic">{balance.notice}</p>

        {/* 원천징수 현황 (verified 셀러만) */}
        {balance.business_verified && tax && tax.payouts_count > 0 && (
          <div className="mt-2 pt-3 border-t border-gray-100">
            <p className="text-xs font-bold text-gray-500 mb-2">📊 {tax.year}년 원천징수 현황</p>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div>
                <p className="text-gray-500 text-[10px]">총 지급</p>
                <p className="font-bold">₩{tax.total_gross.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-gray-500 text-[10px]">원천징수 8.8%</p>
                <p className="font-bold text-red-600">-₩{tax.total_withheld.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-gray-500 text-[10px]">실 수령</p>
                <p className="font-bold text-emerald-600">₩{tax.total_net.toLocaleString()}</p>
              </div>
            </div>
            {tax.reportable && (
              <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-[11px] text-amber-900">
                ⚠️ 연 누계 300만원 초과 — 다음 해 5월 종합소득세 신고 의무 (분리과세 X)
              </div>
            )}
          </div>
        )}
      </div>

      {/* 환급 모달 */}
      {withdrawOpen && (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm p-4 flex items-center justify-center"
          onClick={() => !submitting && setWithdrawOpen(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-gray-900 mb-1">딜 환급 신청</h3>
            <p className="text-xs text-gray-500 mb-4">8.8% 원천징수 후 계좌 입금 — 최소 10,000 딜</p>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">환급 금액</label>
              <input
                type="number"
                value={withdrawAmount}
                onChange={e => setWithdrawAmount(e.target.value)}
                placeholder={`최대 ${balance.withdrawable.toLocaleString()}`}
                min={10000}
                max={balance.withdrawable}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900"
                disabled={submitting}
              />
              {withdrawAmount && Number(withdrawAmount) >= 10000 && (
                <div className="mt-2 p-2 bg-gray-50 rounded text-xs space-y-0.5">
                  <p className="flex justify-between"><span className="text-gray-500">총 지급</span><span className="font-bold">₩{Number(withdrawAmount).toLocaleString()}</span></p>
                  <p className="flex justify-between"><span className="text-gray-500">원천징수 (8.8%)</span><span className="font-bold text-red-600">-₩{Math.floor(Number(withdrawAmount) * 0.088).toLocaleString()}</span></p>
                  <p className="flex justify-between pt-1 border-t border-gray-200"><span className="text-gray-700 font-bold">실 수령</span><span className="font-extrabold text-emerald-600">₩{(Number(withdrawAmount) - Math.floor(Number(withdrawAmount) * 0.088)).toLocaleString()}</span></p>
                </div>
              )}
            </div>
            <div className="flex gap-2 mt-5">
              <button type="button" onClick={() => setWithdrawOpen(false)} disabled={submitting}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-semibold rounded-lg disabled:opacity-50">
                취소
              </button>
              <button type="button" onClick={withdraw} disabled={submitting || Number(withdrawAmount) < 10000}
                className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50">
                {submitting ? '신청 중...' : '환급 신청'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🛡️ 2026-05-19: 상품권으로 받기 모달 */}
      {voucherOpen && (
        <VoucherRedeemModal
          totalBalance={balance.total}
          onClose={() => setVoucherOpen(false)}
          onSuccess={() => {
            setVoucherOpen(false)
            // 잔액 갱신
            const token = localStorage.getItem('seller_token')
            api.get('/api/seller/deal-balance', { headers: { Authorization: `Bearer ${token}` } })
              .then(rr => { if (rr.data?.success) setBalance(rr.data.data) })
          }}
        />
      )}
    </DashboardCard>
  )
}

// 🛡️ 2026-05-19: 상품권 (KT Alpha) 발송 모달 — 비사업자 셀러 핵심 흐름.
interface CatalogItem {
  gift_code: string
  name: string
  brand_name: string
  brand_icon_url?: string
  sale_price: number
  real_price: number
  discount_rate: number
  image_url_small?: string
  valid_period_type?: string
  valid_period_days?: number
  goods_type_detail?: string
}

function VoucherRedeemModal({ totalBalance, onClose, onSuccess }: {
  totalBalance: number; onClose: () => void; onSuccess: () => void
}) {
  const [items, setItems] = useState<CatalogItem[]>([])
  const [markupPct, setMarkupPct] = useState(5)
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState<CatalogItem | null>(null)
  const [qty, setQty] = useState(1)
  // 🛡️ KT Alpha 가이드라인: 본인 명의 휴대폰 강제 — 셀러 회원가입 시 등록한 phone 만 허용.
  const [sellerPhone, setSellerPhone] = useState('')
  // 🛡️ KT Alpha 가이드라인: 발송 전 두 가지 동의 강제.
  const [acceptExpiry, setAcceptExpiry] = useState(false)
  const [acceptB2B, setAcceptB2B] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => { load() }, []) // eslint-disable-line

  async function load() {
    setLoading(true)
    try {
      const token = localStorage.getItem('seller_token')
      const r = await api.get(`/api/seller/voucher-catalog?q=${encodeURIComponent(q)}`,
        { headers: { Authorization: `Bearer ${token}` } })
      if (r.data?.success) {
        setItems(r.data.data.items || [])
        setMarkupPct(Number(r.data.data.markup_pct) || 5)
        setSellerPhone(String(r.data.data.seller_phone || ''))
      }
    } catch { /* fail-soft */ } finally { setLoading(false) }
  }

  function unitDeduct(item: CatalogItem) {
    return Math.floor(item.real_price * (1 + markupPct / 100))
  }
  const totalDeduct = selected ? unitDeduct(selected) * qty : 0
  const hasPhone = /^01\d{8,9}$/.test(sellerPhone)
  const canSubmit = selected && totalDeduct > 0 && totalDeduct <= totalBalance
    && hasPhone && acceptExpiry && acceptB2B

  const phoneMasked = hasPhone
    ? sellerPhone.replace(/(\d{3})(\d{3,4})(\d{4})/, '$1-$2-$3')
    : ''

  async function submit() {
    if (!selected) return
    if (!acceptExpiry || !acceptB2B) { toast.error('약관 동의 필요'); return }
    if (!confirm(`${selected.name} × ${qty} → ${phoneMasked}\n차감 예정: ₩${totalDeduct.toLocaleString()}\n\n⚠️ 30일 유효기간 / 환불 불가 동의하신 것 맞나요?`)) return
    setSubmitting(true)
    try {
      const token = localStorage.getItem('seller_token')
      const r = await api.post('/api/seller/voucher-redeem', {
        gift_code: selected.gift_code,
        qty,
        phone: sellerPhone,
        terms_accepted_expiry: acceptExpiry,
        terms_accepted_b2b: acceptB2B,
      }, { headers: { Authorization: `Bearer ${token}` } })
      if (r.data?.success) {
        toast.success(`✅ 발송 완료 (${r.data.data.qty}건, 차감 ₩${r.data.data.total_deduct.toLocaleString()})`)
        onSuccess()
      }
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { error?: string } } }
      toast.error(ax.response?.data?.error || '발송 실패')
    } finally { setSubmitting(false) }
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm p-4 flex items-center justify-center"
      onClick={() => !submitting && onClose()}>
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-900">🎁 상품권으로 받기</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              잔액 ₩{totalBalance.toLocaleString()} 에서 차감 · KT Alpha (기프티쇼) B2B 정산
            </p>
          </div>
          <button onClick={onClose} disabled={submitting} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>

        {/* 🛡️ KT Alpha 가이드라인 — 30일 유효기간 / 환불 불가 / B2B 사전 고지 */}
        <div className="mx-5 mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-900 space-y-1">
          <p className="font-bold flex items-center gap-1">⚠️ 발송 전 반드시 확인하세요</p>
          <ul className="list-disc list-inside space-y-0.5 ml-1">
            <li><b>유효기간 30일 고정</b> — 연장 불가</li>
            <li><b>발송 후 환불 / 취소 불가</b> (KT Alpha B2B 쿠폰 정책)</li>
            <li><b>본인 명의 휴대폰만 발송 가능</b> — 회원가입 시 등록한 번호로 강제 발송</li>
            <li>발송 = 셀러 적립금에서 즉시 차감 (현금 정산 대체)</li>
          </ul>
        </div>

        {/* 검색 + 카탈로그 */}
        <div className="px-5 py-3 border-b border-gray-100">
          <div className="flex gap-2">
            <input type="text" value={q} onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && load()}
              placeholder="브랜드명 / 상품명 검색"
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            <button onClick={load} className="text-xs px-3 py-2 bg-gray-100 rounded-lg">검색</button>
          </div>
        </div>

        {/* 카탈로그 그리드 */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <p className="text-xs text-gray-500 text-center py-8">로딩 중...</p>
          ) : items.length === 0 ? (
            <p className="text-xs text-gray-500 text-center py-8">
              카탈로그 비어있음 — 어드민이 sync 후 다시 시도해주세요
            </p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {items.map((item) => {
                const deduct = unitDeduct(item)
                const isSel = selected?.gift_code === item.gift_code
                return (
                  <button key={item.gift_code} type="button"
                    onClick={() => setSelected(item)}
                    className={`border-2 rounded-lg overflow-hidden text-left ${
                      isSel ? 'border-pink-500 bg-pink-50' : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}>
                    <div className="aspect-square bg-gray-100">
                      {item.image_url_small && <img src={item.image_url_small} alt={item.name} className="w-full h-full object-cover" loading="lazy" />}
                    </div>
                    <div className="p-2">
                      <p className="text-[10px] text-gray-500 font-semibold">{item.brand_name}</p>
                      <p className="text-xs font-bold text-gray-900 line-clamp-2">{item.name}</p>
                      <div className="mt-1.5">
                        <p className="text-[10px] text-gray-400 line-through">₩{item.sale_price.toLocaleString()}</p>
                        <p className="text-xs font-extrabold text-pink-600">차감 ₩{deduct.toLocaleString()}</p>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* 선택 요약 + 발송 */}
        {selected && (
          <div className="px-5 py-4 border-t border-gray-200 bg-gray-50">
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">수량</label>
                <input type="number" min={1} max={10} value={qty}
                  onChange={(e) => setQty(Math.max(1, Math.min(10, Number(e.target.value) || 1)))}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">받을 휴대폰 (본인 명의 강제)</label>
                {hasPhone ? (
                  <div className="px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg text-sm font-mono text-gray-700 flex items-center gap-2">
                    🔒 {phoneMasked}
                  </div>
                ) : (
                  <div className="px-3 py-2 bg-red-50 border border-red-300 rounded-lg text-xs text-red-700">
                    셀러 본인 휴대폰 미등록 — <a href="/seller/profile" className="underline font-bold">설정에서 등록</a>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded p-3 text-xs mb-3 space-y-0.5">
              <p className="flex justify-between"><span className="text-gray-500">선택 상품</span><span className="font-semibold">{selected.name} × {qty}</span></p>
              <p className="flex justify-between"><span className="text-gray-500">단가 (markup {markupPct}% 포함)</span><span>₩{unitDeduct(selected).toLocaleString()}</span></p>
              <p className="flex justify-between pt-1 border-t border-gray-200"><span className="text-gray-700 font-bold">총 차감액</span><span className="text-base font-extrabold text-pink-600">₩{totalDeduct.toLocaleString()}</span></p>
              {totalDeduct > totalBalance && (
                <p className="text-red-600 text-[11px] font-bold mt-1">⚠️ 잔액 부족 (보유 ₩{totalBalance.toLocaleString()})</p>
              )}
            </div>

            {/* 🛡️ KT Alpha 가이드라인 — 발송 전 동의 체크박스 강제 */}
            <div className="bg-white border border-amber-200 rounded p-3 mb-3 space-y-2">
              <label className="flex items-start gap-2 text-[11px] text-gray-700 cursor-pointer">
                <input type="checkbox" checked={acceptExpiry} onChange={(e) => setAcceptExpiry(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-pink-500 flex-shrink-0" />
                <span>
                  <b className="text-amber-700">[필수]</b> 본 상품권은 <b>발행일로부터 30일 유효</b>하며,
                  발송 후 <b>환불 / 취소 / 유효기간 연장이 불가</b>함을 확인했습니다 (KT Alpha B2B 쿠폰 정책).
                </span>
              </label>
              <label className="flex items-start gap-2 text-[11px] text-gray-700 cursor-pointer">
                <input type="checkbox" checked={acceptB2B} onChange={(e) => setAcceptB2B(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-pink-500 flex-shrink-0" />
                <span>
                  <b className="text-amber-700">[필수]</b> 본 상품권은 <b>유어딜이 자사 셀러(본인)에게 지급하는 B2B 정산 수단</b>이며,
                  최종 소비자 판매 목적이 아님을 확인했습니다. 본인 명의 휴대폰으로만 발송됩니다.
                </span>
              </label>
            </div>

            <div className="flex gap-2">
              <button onClick={onClose} disabled={submitting}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-semibold rounded-lg disabled:opacity-50">
                취소
              </button>
              <button onClick={submit} disabled={submitting || !canSubmit}
                className="flex-1 px-4 py-2 bg-pink-500 text-white text-sm font-bold rounded-lg hover:bg-pink-600 disabled:opacity-50 disabled:cursor-not-allowed">
                {submitting ? '발송 중...' : `🎁 ₩${totalDeduct.toLocaleString()} 차감 후 발송`}
              </button>
            </div>
            {!canSubmit && selected && (
              <p className="text-[10px] text-amber-600 mt-2 text-center">
                {!hasPhone && '· 셀러 본인 휴대폰 등록 필요 '}
                {(!acceptExpiry || !acceptB2B) && '· 약관 2종 동의 필요 '}
                {totalDeduct > totalBalance && '· 잔액 부족'}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
