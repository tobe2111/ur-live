import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import { DashboardCard, DashboardStatCard } from '@/components/dashboard'
import { formatNumber } from '@/utils/format'
import { Clock, Send, CheckCircle, CalendarClock } from 'lucide-react'
import { formatKSTDate } from '@/utils/date'

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
  /** 🕙 미지급 중 아직 유보 기간이 안 지난 몫. 서버가 안 주면(구버전 응답) 0 → 종전 화면과 동일. */
  held?: number
  /** 유보 역일. 0 이거나 없으면 유보 없음 → 문구도 종전 그대로. */
  hold_days?: number
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  pending: { label: '집계됨 · 지급대기', cls: 'bg-tone-warn-bg text-tone-warn' },
  approved: { label: '승인 · 송금예정', cls: 'bg-tone-info-bg text-tone-info' },
  sent: { label: '지급완료', cls: 'bg-tone-ok-bg text-tone-ok' },
  failed: { label: '실패', cls: 'bg-tone-bad-bg text-tone-bad' },
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
  // 🕙 2026-09-24 (유보 10일의 짝): 이 화면은 '미지급' 힌트로 **"다음 집계 대상"** 이라고 적고
  //   맨 위 카드는 **"매주 자동으로 처리됩니다"** 라고 말해 왔다. 유보가 생긴 뒤 그건 방금 적립된
  //   돈에 대해 거짓이다 — 사장님은 숫자가 떠 있는데 2주간 안 움직이는 것을 본다.
  //   ⚠️ **서버가 준 값만 쓴다.** 화면이 유보일을 지어내면 `payout_hold_days` 를 바꾼 날 안내가
  //     거짓말이 된다(2026-09-04 결제 화면에서 값을 치르고 배운 규칙과 같은 클래스).
  const holdDays = data?.hold_days ?? 0
  const held = Math.min(payable, Math.max(0, data?.held ?? 0))
  const readyNow = Math.max(0, payable - held)

  return (
    <div className="space-y-4">
      {/* 자동 정산 안내 */}
      <DashboardCard>
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-lg bg-gray-100 p-2 text-gray-500">
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
            {holdDays > 0 && (
              <p className="text-xs text-gray-600">
                {t('seller.autoPayout.holdNotice', {
                  days: holdDays,
                  defaultValue:
                    '카드 대금이 결제대행사에서 들어오는 데 시간이 걸려, 정산 원장에 적립된 날(= 이용권이 실제로 사용된 날)로부터 {{days}}일이 지난 금액부터 집계됩니다. 환불·취소는 유보와 무관하게 즉시 반영됩니다.',
                })}
              </p>
            )}
          </div>
        </div>
      </DashboardCard>

      {/* 실제 지급 현황 (payouts SSOT) */}
      {/* 📱 2026-09-15 모바일 특화: 폰은 세 숫자를 한 줄 타일로(세로로 쌓으면 첫 화면이 숫자 셋으로 끝난다). PC 는 스탯 카드. */}
      <div className="grid grid-cols-3 gap-2 sm:hidden">
        {[
          { label: t('seller.autoPayout.payableShort', { defaultValue: '미지급' }), value: payable, tone: 'text-tone-warn' },
          { label: t('seller.autoPayout.scheduledShort', { defaultValue: '지급 예정' }), value: scheduled, tone: 'text-brand-text' },
          { label: t('seller.autoPayout.sentShort', { defaultValue: '지급 완료' }), value: sent, tone: 'text-gray-900' },
        ].map((c) => (
          <div key={c.label} className="min-w-0 rounded-[var(--dash-radius,16px)] border border-rule bg-white px-3 py-2.5">
            <p className="truncate text-[11px] font-semibold text-gray-500">{c.label}</p>
            <p className={`dash-num mt-0.5 truncate text-[15px] font-extrabold leading-tight ${c.tone}`}>{formatNumber(c.value)}</p>
          </div>
        ))}
      </div>
      <div className="hidden gap-3 sm:grid sm:grid-cols-3">
        <DashboardStatCard
          label={t('seller.autoPayout.payable', { defaultValue: '미지급 (정산 예정 잔액)' })}
          value={`₩${formatNumber(payable)}`}
          hint={held > 0
            ? t('seller.autoPayout.payableHintHold', {
                ready: formatNumber(readyNow),
                held: formatNumber(held),
                defaultValue: '₩{{ready}} 다음 집계 · ₩{{held}} 유보 중',
              })
            : t('seller.autoPayout.payableHint', { defaultValue: '다음 집계 대상' })}
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
                      {p.sent_at ? ` · ${formatKSTDate(p.sent_at)} 송금` : ''}
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
