import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { useApiQuery } from '@/hooks/queries/useApiQuery'
import { toast } from '@/hooks/useToast'
import { SellerPinPrompt } from '@/components/auth/SellerPinPrompt'
import { Button } from '@/components/ui/button'
import SellerLayout from '@/components/SellerLayout'
import BrandLoader from '@/components/brand/BrandLoader'
import { DashboardPageHeader, DashboardStatCard, DashboardCard } from '@/components/dashboard'
import {
  DollarSign,
  Calendar,
  CheckCircle,
  Clock,
  XCircle,
  TrendingUp,
  RefreshCw,
  FileText,
  BarChart3,
  Table
} from 'lucide-react'
import { formatNumber } from '@/utils/format'
import { confirmDialog } from '@/components/ui/confirm-dialog'

// 🛡️ 2026-06-10: 대형 페이지 분해 — 표현부를 ./seller-settlements/* 로 추출 (동작 변화 0, 순수 이동).
import type { Settlement, SettlementStats } from './seller-settlements/types'
import RevenueCalendar from './seller-settlements/RevenueCalendar'
import DealBalanceCard from './seller-settlements/DealBalanceCard'
import BizRegStatusBanner from './seller-settlements/BizRegStatusBanner'
import BizRegSubmitModal from './seller-settlements/BizRegSubmitModal'
import SettlementsTable from './seller-settlements/SettlementsTable'
import RestaurantSettlementsSection from './seller-settlements/RestaurantSettlementsSection'

export default function SellerSettlementsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [selectedPeriod, setSelectedPeriod] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('table')
  const [pinPrompt, setPinPrompt] = useState(false)

  useEffect(() => {
    const sessionToken = localStorage.getItem('seller_token')
    if (!sessionToken) { navigate('/seller/login'); return }
    // Populate bank info from seller profile if not already in localStorage (best-effort)
    if (!localStorage.getItem('seller_bank_name')) {
      api.get('/api/seller/profile', { headers: { 'Authorization': `Bearer ${sessionToken}` } }).then(res => {
        if (res.data.success && res.data.data) {
          const seller = res.data.data
          if (seller.bank_name) localStorage.setItem('seller_bank_name', seller.bank_name)
          if (seller.bank_account) localStorage.setItem('seller_account_number', seller.bank_account)
          if (seller.account_holder) localStorage.setItem('seller_account_holder', seller.account_holder)
        }
      }).catch(() => { /* best-effort */ })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 🛡️ 2026-06-03 Tier2(대시보드): 수동 페칭 → useApiQuery (settlements[period] + stats + daily revenue).
  const settlementsQ = useApiQuery<Settlement[]>(['seller', 'settlements', selectedPeriod], '/api/seller/settlements', {
    params: selectedPeriod !== 'all' ? { period: selectedPeriod } : {},
    select: (r: any) => (r?.success ? r.data || [] : []),
  })
  const statsQ = useApiQuery<SettlementStats | null>(['seller', 'settlements-stats'], '/api/seller/settlements/stats', { select: (r: any) => (r?.success ? r.data : null) })
  const dailyQ = useApiQuery<{ date: string; revenue: number }[]>(['seller', 'settlements-daily'], '/api/seller/dashboard/stats', { params: { period: '30d' }, select: (r: any) => (r?.success ? (r.data?.daily_revenue || []) : []) })
  const settlements = settlementsQ.data ?? []
  const stats = statsQ.data ?? null
  const dailyRevenue = dailyQ.data ?? []
  const loading = settlementsQ.isLoading || statsQ.isLoading
  const loadSettlements = () => { settlementsQ.refetch(); statsQ.refetch(); dailyQ.refetch() }
  useEffect(() => { if (settlementsQ.isError) setError(t('seller.settlementLoadFailed')) }, [settlementsQ.isError, t])

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
    if (!(await confirmDialog(t('seller.confirmSettlementRequest', { amount: formatNumber(pendingAmount) })))) return

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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <BrandLoader label={t('seller.settlementLoadingText')} />
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
        <BizRegStatusBanner
          status={bizRegStatus}
          imageUrl={bizRegImageUrl}
          rejectReason={bizRegRejectReason}
          onOpenModal={() => setBizRegModalOpen(true)}
        />

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
        <SettlementsTable settlements={settlements} onDownload={downloadSettlement} />

        {/* 🏁 2026-06-11 (플로우 감사 갭#11): 공구 자동정산(restaurant_settlements) — cron 적립분 가시화 */}
        <div className="mt-6">
          <RestaurantSettlementsSection />
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
        <BizRegSubmitModal
          submitting={bizRegSubmitting}
          imageUrl={bizRegSubmitImage}
          businessNumber={bizRegSubmitNumber}
          onImageChange={setBizRegSubmitImage}
          onBusinessNumberChange={setBizRegSubmitNumber}
          onClose={() => setBizRegModalOpen(false)}
          onSubmit={submitBusinessRegistration}
        />
      )}
    </SellerLayout>
  )
}
