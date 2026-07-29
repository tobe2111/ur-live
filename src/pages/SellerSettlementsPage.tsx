import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { useApiQuery } from '@/hooks/queries/useApiQuery'
import { toast } from '@/hooks/useToast'
import { Button } from '@/components/ui/button'
import SellerLayout from '@/components/SellerLayout'
import BrandLoader from '@/components/brand/BrandLoader'
import { DashboardPageHeader } from '@/components/dashboard'
import {
  DollarSign,
  Calendar,
  XCircle,
  RefreshCw,
  BarChart3,
  Table
} from 'lucide-react'

// 🛡️ 2026-06-10: 대형 페이지 분해 — 표현부를 ./seller-settlements/* 로 추출 (동작 변화 0, 순수 이동).
import type { Settlement, SettlementStats } from './seller-settlements/types'
import RevenueCalendar from './seller-settlements/RevenueCalendar'
import DealBalanceCard from './seller-settlements/DealBalanceCard'
import AutoPayoutSection from './seller-settlements/AutoPayoutSection'
import BizRegStatusBanner from './seller-settlements/BizRegStatusBanner'
import BizRegSubmitModal from './seller-settlements/BizRegSubmitModal'
import SettlementsTable from './seller-settlements/SettlementsTable'
import RestaurantSettlementsSection from './seller-settlements/RestaurantSettlementsSection'
import SettlementTaxInvoicesSection from './seller-settlements/SettlementTaxInvoicesSection'

export default function SellerSettlementsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [selectedPeriod, setSelectedPeriod] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('table')

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
  const dailyRevenue = dailyQ.data ?? []
  const loading = settlementsQ.isLoading || statsQ.isLoading
  const loadSettlements = () => { settlementsQ.refetch(); statsQ.refetch(); dailyQ.refetch() }
  useEffect(() => { if (settlementsQ.isError) setError(t('seller.settlementLoadFailed')) }, [settlementsQ.isError, t])

  const hasBankInfo = !!(localStorage.getItem('seller_bank_name') && localStorage.getItem('seller_account_number'))

  // 💸 2026-07-01 (정산 정합 — 대표 승인 "자동 정산 하나로 통일"): 고장난 '정산 신청'(/settlements/request,
  //   seller_deal_balances 미적립으로 항상 실패) 제거. 정산은 주간 자동 집계(payouts)로 처리 →
  //   AutoPayoutSection 이 실제 지급 현황을 노출. 셀러는 계좌만 등록하면 됨(아래 bank 경고 유지).

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

        {/* 💸 2026-07-01 (정산 정합): 실제 자동 지급(payouts) 현황 — 셀러 정산의 진짜 숫자 SSOT.
            고장난 '정산 신청' 통계카드(settlements 테이블, 대부분 빈값) 대체. */}
        <AutoPayoutSection />

        {/* 🛡️ 2026-05-18: 딜 잔액 + 환급 + 원천징수 현황 (비사업자 교환권/원천징수) */}
        <DealBalanceCard />

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

        {/* 정산/환급 신청 이력 (레거시 수동 경로 — 비사업자 환급 등). 자동 정산은 상단 AutoPayoutSection 참조. */}
        <p className="mb-2 text-xs font-medium text-gray-500">
          {t('seller.settlements.manualHistory', { defaultValue: '정산/환급 신청 이력' })}
        </p>
        <SettlementsTable settlements={settlements} onDownload={downloadSettlement} />

        {/* 🏁 2026-06-11 (플로우 감사 갭#11): 공구 자동정산(restaurant_settlements) — cron 적립분 가시화 */}
        <div className="mt-6">
          <RestaurantSettlementsSection />
        </div>

        {/* 🧾 2026-07-01: 정산 매입세금계산서 역발행(셀러→플랫폼) — 승인 흐름 */}
        <div className="mt-6">
          <SettlementTaxInvoicesSection />
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
