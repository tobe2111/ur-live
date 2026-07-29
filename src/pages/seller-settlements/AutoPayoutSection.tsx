import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import { DashboardCard, DashboardStatCard } from '@/components/dashboard'
import { formatNumber } from '@/utils/format'
import { Clock, Send, CheckCircle, CalendarClock } from 'lucide-react'

// 💸 2026-07-01 (정산 정합 — 대표 승인 "자동 정산 하나로 통일"):
//   셀러가 보는 정산 = 실제 자동 지급 파이프라인(payouts)의 진짜 숫자.
//   원장(ledger) seller:N credit 이 미지급(payable), 집계된 건이 지급예정, 송금된 건이 지급완료.
//   고장난 '정산 신청'(seller_deal_balances 미적립) 대신 이 읽기 전용 뷰가 SSOT.
type Payout = {
  id: number
  amount: number
  period_start: string
  period_end: string
  status: 'pending' | 'approved' | 'sent' | 'failed' | 'cancelled'
  admin_memo: string | null
  created_at: string
  sent_at: string | null
}
type PayoutData = {
  payable: number
  scheduled_total: number
  sent_total: number
  payouts: Payout[]
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  pending: { label: '집계됨 · 지급대기', cls: 'bg-amber-100 text-amber-800' },
  approved: { label: '승인 · 송금예정', cls: 'bg-blue-100 text-blue-800' },
  sent: { label: '지급완료', cls: 'bg-green-100 text-green-800' },
  failed: { label: '실패', cls: 'bg-red-100 text-red-700' },
  cancelled: { label: '취소', cls: 'bg-gray-100 text-gray-600' },
}

export default function AutoPayoutSection() {
  const { t } = useTranslation()
  const [data, setData] = useState<PayoutData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('seller_token')
    if (!token) { setLoading(false); return }
    api.get('/api/seller/payouts', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => { if (r.data?.success) setData(r.data.data) })
      .catch(() => { /* fail-soft */ })
      .finally(() => setLoading(false))
  }, [])

  const payable = data?.payable ?? 0
  const scheduled = data?.scheduled_total ?? 0
  const sent = data?.sent_total ?? 0
  const payouts = data?.payouts ?? []

  return (
    <div className="space-y-4">
      {/* 자동 정산 안내 */}
      <DashboardCard>
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-lg bg-blue-50 p-2 text-blue-600">
            <CalendarClock className="h-5 w-5" />
          </div>
          <div className="space-y-1 text-sm">
            <p className="font-semibold text-gray-900">
              {t('seller.autoPayout.title', { defaultValue: '정산은 매주 자동으로 처리됩니다' })}
            </p>
            <p className="text-xs text-gray-600">
              {t('seller.autoPayout.desc', {
                defaultValue: '동네딜 공구·이용권 매출이 매주 자동 집계되어 등록하신 계좌로 순차 지급됩니다. 별도의 정산 신청은 필요 없습니다.',
              })}
            </p>
          </div>
        </div>
      </DashboardCard>

      {/* 실제 지급 현황 (payouts SSOT) */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <DashboardStatCard
          label={t('seller.autoPayout.payable', { defaultValue: '미지급 (정산 예정 잔액)' })}
          value={`₩${formatNumber(payable)}`}
          hint={t('seller.autoPayout.payableHint', { defaultValue: '다음 집계 대상' })}
          icon={<Clock className="h-4 w-4" />}
          accent="amber"
        />
        <DashboardStatCard
          label={t('seller.autoPayout.scheduled', { defaultValue: '지급 예정 (송금 대기)' })}
          value={`₩${formatNumber(scheduled)}`}
          hint={t('seller.autoPayout.scheduledHint', { defaultValue: '집계 완료 · 순차 송금' })}
          icon={<Send className="h-4 w-4" />}
          accent="blue"
        />
        <DashboardStatCard
          label={t('seller.autoPayout.sent', { defaultValue: '지급 완료' })}
          value={`₩${formatNumber(sent)}`}
          hint={t('seller.autoPayout.sentHint', { defaultValue: '누적 송금액' })}
          icon={<CheckCircle className="h-4 w-4" />}
          accent="green"
        />
      </div>

      {/* 지급 내역 */}
      <DashboardCard>
        <p className="mb-3 text-sm font-semibold text-gray-900">
          {t('seller.autoPayout.history', { defaultValue: '자동 정산 지급 내역' })}
        </p>
        {loading ? (
          <p className="py-6 text-center text-sm text-gray-400">{t('common.loading', { defaultValue: '불러오는 중…' })}</p>
        ) : payouts.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-400">
            {t('seller.autoPayout.empty', { defaultValue: '아직 자동 정산 내역이 없습니다. 매출이 발생하면 매주 집계됩니다.' })}
          </p>
        ) : (
          <div className="divide-y divide-gray-100">
            {payouts.map(p => {
              const s = STATUS_LABEL[p.status] || STATUS_LABEL.pending
              return (
                <div key={p.id} className="flex items-center justify-between py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900">₩{formatNumber(p.amount)}</p>
                    <p className="text-xs text-gray-500">
                      {p.period_start} ~ {p.period_end}
                      {p.sent_at ? ` · ${new Date(p.sent_at).toLocaleDateString('ko-KR')} 송금` : ''}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${s.cls}`}>{s.label}</span>
                </div>
              )
            })}
          </div>
        )}
      </DashboardCard>
    </div>
  )
}
