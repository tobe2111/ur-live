import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApiQuery } from '@/hooks/queries/useApiQuery'
import AdminLayout from '@/components/AdminLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import {
  BarChart3, TrendingUp, Repeat, Users, Store, ShoppingCart,
  AlertCircle, Loader2, Info,
} from 'lucide-react'
import { formatWon, formatNumber, safeNum } from '@/utils/format'
import { useTranslation } from 'react-i18next'

// 🆕 2026-06-08 어드민 비즈니스 지표 대시보드 — 경영 viability 판단용 read-only KPI.
//   GET /api/admin/business-metrics/overview?period=30d|90d|12m. 라이트 고정 테마(dark: 금지).
//   순수익률은 ESTIMATE — 가정(PG 2.5% / 수수료 5% / 후원 15%)을 화면에 명시.

type Period = '30d' | '90d' | '12m'

interface OverviewResponse {
  success: boolean
  period: Period
  assumptions: {
    consumer_commission_pct: number
    donation_fee_pct: number
    pg_fee_pct: number
    note: string
  }
  gmv: {
    consumer: number
    wholesale: number
    combined: number
    time_series: Array<{ bucket: string; consumer: number; wholesale: number; total: number }>
    time_series_granularity: 'daily' | 'monthly'
  }
  revenue: {
    estimate: boolean
    gross: number
    breakdown: { consumer_commission: number; wholesale_margin: number; donation_fee: number }
    est_pg_cost: number
    net: number
    net_take_rate_pct: number
  }
  orders: { consumer: number; wholesale: number; total: number; aov: number }
  repeat_purchase: { buyers_total: number; buyers_repeat: number; rate_pct: number }
  active: { sellers: number; buyers: number; new_buyers: number; returning_buyers: number }
  liabilities: { credit_outstanding: number; supplier_payable: number }
  donations_total: number
}

const PERIODS: Array<{ key: Period; labelKey: string; fallback: string }> = [
  { key: '30d', labelKey: 'admin.bizMetrics.p30d', fallback: '최근 30일' },
  { key: '90d', labelKey: 'admin.bizMetrics.p90d', fallback: '최근 90일' },
  { key: '12m', labelKey: 'admin.bizMetrics.p12m', fallback: '최근 12개월' },
]

export default function AdminBusinessMetricsPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [period, setPeriod] = useState<Period>('30d')
  const h = { headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` } }

  useEffect(() => {
    if (!localStorage.getItem('admin_token')) navigate('/admin/login', { replace: true })
  }, [navigate])

  const { data, isLoading: loading } = useApiQuery<OverviewResponse>(
    ['admin', 'business-metrics', period],
    `/api/admin/business-metrics/overview?period=${period}`,
    { headers: h.headers, select: (r: any) => r as OverviewResponse },
  )

  const series = data?.gmv.time_series ?? []
  const maxTotal = series.reduce((m, s) => Math.max(m, safeNum(s.total)), 0)
  const granularity = data?.gmv.time_series_granularity ?? 'daily'

  return (
    <AdminLayout title={t('admin.bizMetrics.navTitle', { defaultValue: '비즈니스 지표' })}>
      <div className="ur-content-full px-4 lg:px-8 py-6">
        <DashboardPageHeader
          icon={<BarChart3 className="w-5 h-5" />}
          title={t('admin.bizMetrics.title', { defaultValue: '비즈니스 지표' })}
          subtitle={t('admin.bizMetrics.subtitle', { defaultValue: '사업 viability 판단용 핵심 지표 — GMV, 순수익률, 반복구매율, 활성 사용자, 채권/채무' })}
        />

        {/* 기간 토글 */}
        <div className="mt-4 mb-5 flex items-center gap-2">
          {PERIODS.map(p => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                period === p.key
                  ? 'bg-gray-900 text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {t(p.labelKey, { defaultValue: p.fallback })}
            </button>
          ))}
        </div>

        {/* 추정치 disclaimer */}
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800 leading-relaxed">
            {t('admin.bizMetrics.disclaimer', {
              defaultValue: '순수익률은 추정치입니다. 가정 — PG 수수료 2.5%, 플랫폼 수수료 5%, 후원 수수료 15%. 실제 PG 정산서가 아닙니다.',
            })}
            {data?.assumptions && (
              <span className="block text-xs text-amber-700 mt-1">
                {t('admin.bizMetrics.assumptionsApplied', { defaultValue: '적용된 가정' })}: PG {safeNum(data.assumptions.pg_fee_pct)}% · {t('admin.bizMetrics.commission', { defaultValue: '수수료' })} {safeNum(data.assumptions.consumer_commission_pct)}% · {t('admin.bizMetrics.donationFee', { defaultValue: '후원' })} {safeNum(data.assumptions.donation_fee_pct)}%
              </span>
            )}
          </p>
        </div>

        {loading && !data ? (
          <div className="flex justify-center py-24"><Loader2 className="w-7 h-7 animate-spin text-gray-400" /></div>
        ) : (
          <>
            {/* KPI 카드 그리드 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <KpiCard
                icon={<TrendingUp className="w-4 h-4" />}
                label={t('admin.bizMetrics.gmv', { defaultValue: 'GMV (총거래액)' })}
                value={formatWon(data?.gmv.combined)}
                sub={`${t('admin.bizMetrics.consumer', { defaultValue: '소비자' })} ${formatWon(data?.gmv.consumer)} · ${t('admin.bizMetrics.wholesale', { defaultValue: '도매' })} ${formatWon(data?.gmv.wholesale)}`}
              />
              <KpiCard
                icon={<BarChart3 className="w-4 h-4" />}
                label={t('admin.bizMetrics.netTakeRate', { defaultValue: '순수익률 (추정)' })}
                value={`${formatNumber(data?.revenue.net_take_rate_pct)}%`}
                sub={`${t('admin.bizMetrics.netRevenue', { defaultValue: '순수익' })} ${formatWon(data?.revenue.net)}`}
                estimate
              />
              <KpiCard
                icon={<Repeat className="w-4 h-4" />}
                label={t('admin.bizMetrics.repeatRate', { defaultValue: '반복구매율' })}
                value={`${formatNumber(data?.repeat_purchase.rate_pct)}%`}
                sub={`${formatNumber(data?.repeat_purchase.buyers_repeat)} / ${formatNumber(data?.repeat_purchase.buyers_total)} ${t('admin.bizMetrics.buyersUnit', { defaultValue: '명' })}`}
              />
              <KpiCard
                icon={<ShoppingCart className="w-4 h-4" />}
                label={t('admin.bizMetrics.aov', { defaultValue: '객단가 (AOV)' })}
                value={formatWon(data?.orders.aov)}
                sub={`${t('admin.bizMetrics.orders', { defaultValue: '주문' })} ${formatNumber(data?.orders.total)}${t('admin.bizMetrics.ordersUnit', { defaultValue: '건' })}`}
              />
              <KpiCard
                icon={<Store className="w-4 h-4" />}
                label={t('admin.bizMetrics.activeSellers', { defaultValue: '활성 셀러' })}
                value={formatNumber(data?.active.sellers)}
                sub={t('admin.bizMetrics.activeSellersSub', { defaultValue: '기간 내 1건 이상 판매' })}
              />
              <KpiCard
                icon={<Users className="w-4 h-4" />}
                label={t('admin.bizMetrics.activeBuyers', { defaultValue: '활성 구매자' })}
                value={formatNumber(data?.active.buyers)}
                sub={`${t('admin.bizMetrics.newBuyers', { defaultValue: '신규' })} ${formatNumber(data?.active.new_buyers)} · ${t('admin.bizMetrics.returningBuyers', { defaultValue: '재방문' })} ${formatNumber(data?.active.returning_buyers)}`}
              />
              <KpiCard
                icon={<AlertCircle className="w-4 h-4" />}
                label={t('admin.bizMetrics.creditOutstanding', { defaultValue: '여신 미수금' })}
                value={formatWon(data?.liabilities.credit_outstanding)}
                sub={t('admin.bizMetrics.creditOutstandingSub', { defaultValue: '미상환 외상 (플랫폼 채권)' })}
                danger
              />
              <KpiCard
                icon={<AlertCircle className="w-4 h-4" />}
                label={t('admin.bizMetrics.supplierPayable', { defaultValue: '공급사 미지급' })}
                value={formatWon(data?.liabilities.supplier_payable)}
                sub={t('admin.bizMetrics.supplierPayableSub', { defaultValue: '정산 대기/가용 (플랫폼 채무)' })}
                danger
              />
            </div>

            {/* 순수익 구성 (추정) */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                {t('admin.bizMetrics.revenueBreakdown', { defaultValue: '순수익 구성 (추정)' })}
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
                  {t('admin.bizMetrics.estimateBadge', { defaultValue: '추정' })}
                </span>
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 text-sm">
                <RevenueLine label={t('admin.bizMetrics.consumerCommission', { defaultValue: '소비자 수수료' })} value={data?.revenue.breakdown.consumer_commission} positive />
                <RevenueLine label={t('admin.bizMetrics.wholesaleMargin', { defaultValue: '도매 마진' })} value={data?.revenue.breakdown.wholesale_margin} positive />
                <RevenueLine label={t('admin.bizMetrics.donationFeeRev', { defaultValue: '후원 수수료' })} value={data?.revenue.breakdown.donation_fee} positive />
                <RevenueLine label={t('admin.bizMetrics.estPgCost', { defaultValue: 'PG 비용 (추정)' })} value={data?.revenue.est_pg_cost} negative />
                <RevenueLine label={t('admin.bizMetrics.netRevenue', { defaultValue: '순수익' })} value={data?.revenue.net} emphasize />
              </div>
            </div>

            {/* GMV 시계열 — CSS bar (차트 라이브러리 없음) */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">
                {t('admin.bizMetrics.gmvTrend', { defaultValue: 'GMV 추이' })}
                <span className="ml-2 text-xs font-normal text-gray-400">
                  {granularity === 'monthly'
                    ? t('admin.bizMetrics.monthly', { defaultValue: '월별' })
                    : t('admin.bizMetrics.daily', { defaultValue: '일별' })}
                </span>
              </h3>
              {series.length === 0 ? (
                <p className="text-gray-400 text-sm py-8 text-center">
                  {t('admin.bizMetrics.noData', { defaultValue: '표시할 데이터가 없습니다' })}
                </p>
              ) : (
                <div className="space-y-1.5">
                  {series.map(s => {
                    const total = safeNum(s.total)
                    const pct = maxTotal > 0 ? (total / maxTotal) * 100 : 0
                    const consumerPct = total > 0 ? (safeNum(s.consumer) / total) * 100 : 0
                    return (
                      <div key={s.bucket} className="flex items-center gap-3">
                        <span className="w-20 shrink-0 text-[11px] text-gray-400 font-mono tabular-nums">{s.bucket}</span>
                        <div className="flex-1 h-5 bg-gray-100 rounded overflow-hidden relative">
                          <div className="h-full flex" style={{ width: `${pct}%` }}>
                            <div className="h-full bg-indigo-500" style={{ width: `${consumerPct}%` }} title="소비자" />
                            <div className="h-full bg-emerald-500" style={{ width: `${100 - consumerPct}%` }} title="도매" />
                          </div>
                        </div>
                        <span className="w-24 shrink-0 text-right text-[11px] text-gray-600 tabular-nums">{formatWon(total)}</span>
                      </div>
                    )
                  })}
                </div>
              )}
              {/* 범례 */}
              <div className="flex items-center gap-4 mt-4 text-xs text-gray-500">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-indigo-500" />{t('admin.bizMetrics.consumer', { defaultValue: '소비자' })}</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-emerald-500" />{t('admin.bizMetrics.wholesale', { defaultValue: '도매' })}</span>
              </div>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  )
}

function KpiCard({ icon, label, value, sub, danger, estimate }: {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  danger?: boolean
  estimate?: boolean
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center gap-2 text-gray-500 mb-2">
        <span className={danger ? 'text-rose-500' : 'text-gray-400'}>{icon}</span>
        <span className="text-xs font-medium">{label}</span>
        {estimate && (
          <span className="text-[10px] font-medium px-1 py-0.5 rounded bg-amber-100 text-amber-700">추정</span>
        )}
      </div>
      <div className={`text-2xl font-bold tabular-nums ${danger ? 'text-rose-600' : 'text-gray-900'}`}>{value}</div>
      {sub && <div className="text-xs text-gray-400 mt-1 leading-snug">{sub}</div>}
    </div>
  )
}

function RevenueLine({ label, value, positive, negative, emphasize }: {
  label: string
  value: number | undefined
  positive?: boolean
  negative?: boolean
  emphasize?: boolean
}) {
  const color = emphasize ? 'text-gray-900' : negative ? 'text-rose-600' : positive ? 'text-emerald-600' : 'text-gray-700'
  const prefix = negative ? '−' : ''
  return (
    <div>
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`font-semibold tabular-nums ${color} ${emphasize ? 'text-lg' : ''}`}>
        {prefix}{formatWon(value)}
      </div>
    </div>
  )
}
