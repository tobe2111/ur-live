import { Package, XCircle, BarChart3, AlertTriangle } from 'lucide-react'
import { formatWon, formatNumber } from '@/utils/format'
import type { AnalyticsData, AnalyticsPeriod } from './types'

// 🏭 BIZ-6 (2026-06-08): 분석 탭 — 매출 시계열(CSS 막대) + 요약 카드 + 베스트셀러 + 재고 경고.
//   차트 라이브러리 미사용(critical path 보호) — inline CSS bar.
//   매출은 net(환불 클로백 음수 포함) 집계 — 서버 응답 그대로 표시.
export default function AnalyticsTab({ data, loading, period, setPeriod, t }: {
  data: AnalyticsData | null
  loading: boolean
  period: AnalyticsPeriod
  setPeriod: (p: AnalyticsPeriod) => void
  t: (k: string, o?: Record<string, unknown>) => string
}) {
  const periods: { key: AnalyticsPeriod; label: string }[] = [
    { key: '30d', label: t('supplier.period30d', { defaultValue: '최근 30일' }) },
    { key: '90d', label: t('supplier.period90d', { defaultValue: '최근 90일' }) },
    { key: '12m', label: t('supplier.period12m', { defaultValue: '최근 12개월' }) },
  ]
  const s = data?.summary
  const maxRev = Math.max(1, ...((data?.series || []).map(p => Math.abs(p.revenue))))

  const cards = [
    { label: t('supplier.aTotalRevenue', { defaultValue: '총 매출(기간)' }), value: formatWon(s?.total_revenue ?? 0), cls: 'text-gray-900' },
    { label: t('supplier.aOrderCount', { defaultValue: '주문 수' }), value: formatNumber(s?.order_count ?? 0), cls: 'text-gray-900' },
    { label: t('supplier.aAvgOrder', { defaultValue: '객단가' }), value: formatWon(s?.avg_order_value ?? 0), cls: 'text-gray-900' },
    { label: t('supplier.aSettlePending', { defaultValue: '정산 대기' }), value: formatWon(s?.settle_pending ?? 0), cls: 'text-amber-600' },
    { label: t('supplier.aSettleAvailable', { defaultValue: '출금 가능' }), value: formatWon(s?.settle_available ?? 0), cls: 'text-blue-600' },
    { label: t('supplier.aSettlePaid', { defaultValue: '지급 완료(누적)' }), value: formatWon(s?.settle_paid ?? 0), cls: 'text-green-600' },
  ]

  return (
    <div className="space-y-6">
      {/* 기간 선택 */}
      <div className="flex gap-1 bg-white rounded-xl p-1 border border-gray-200 w-fit">
        {periods.map(p => (
          <button key={p.key} onClick={() => setPeriod(p.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${period === p.key ? 'bg-[#FC5424] text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
            {p.label}
          </button>
        ))}
      </div>

      {loading && !data ? (
        <div className="py-16 text-center text-gray-400 text-sm">{t('common.loading', { defaultValue: '불러오는 중...' })}</div>
      ) : (
        <>
          {/* 요약 카드 */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {cards.map(c => (
              <div key={c.label} className="bg-white rounded-2xl border border-gray-200 p-4">
                <p className="text-xs text-gray-500 mb-1">{c.label}</p>
                <p className={`text-lg lg:text-xl font-bold ${c.cls}`}>{c.value}</p>
              </div>
            ))}
          </div>

          {/* 재고 경고 */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-2xl border border-gray-200 p-4 text-center">
              <p className="text-xs text-gray-500 mb-1">{t('supplier.aStockTotal', { defaultValue: '공급상품' })}</p>
              <p className="text-xl font-bold text-gray-900">{formatNumber(data?.stock.total ?? 0)}</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 p-4 text-center">
              <p className="text-xs text-gray-500 mb-1 inline-flex items-center gap-1 justify-center"><XCircle className="w-3 h-3 text-red-500" />{t('supplier.aStockOut', { defaultValue: '품절' })}</p>
              <p className="text-xl font-bold text-red-500">{formatNumber(data?.stock.out_of_stock ?? 0)}</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 p-4 text-center">
              <p className="text-xs text-gray-500 mb-1 inline-flex items-center gap-1 justify-center"><AlertTriangle className="w-3 h-3 text-amber-500" />{t('supplier.aStockLow', { defaultValue: '저재고' })}</p>
              <p className="text-xl font-bold text-amber-600">{formatNumber(data?.stock.low_stock ?? 0)}</p>
            </div>
          </div>

          {/* 매출 시계열 (CSS 막대) */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <p className="text-sm font-semibold text-gray-900 mb-4 inline-flex items-center gap-1.5"><BarChart3 className="w-4 h-4 text-[#FC5424]" />{t('supplier.aRevenueTrend', { defaultValue: '매출 추이' })}</p>
            {(data?.series || []).length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-10">{t('supplier.aNoData', { defaultValue: '해당 기간 매출 데이터가 없습니다.' })}</p>
            ) : (
              <div className="flex items-end gap-1 h-40 overflow-x-auto pb-1" role="img" aria-label={t('supplier.aRevenueTrend', { defaultValue: '매출 추이' })}>
                {(data?.series || []).map(p => {
                  const h = Math.max(2, Math.round((Math.abs(p.revenue) / maxRev) * 100))
                  const neg = p.revenue < 0
                  return (
                    <div key={p.bucket} className="flex-1 min-w-[8px] flex flex-col items-center justify-end h-full group relative">
                      <div className={`w-full rounded-t ${neg ? 'bg-red-300' : 'bg-[#FC5424]/70'} group-hover:bg-[#FC5424] transition-colors`} style={{ height: `${h}%` }} />
                      <div className="absolute bottom-full mb-1 hidden group-hover:block whitespace-nowrap bg-gray-900 text-white text-[10px] rounded px-1.5 py-1 z-10">
                        {p.bucket}<br />{formatWon(p.revenue)} · {formatNumber(p.orders)}{t('supplier.aOrdersUnit', { defaultValue: '건' })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
            <p className="text-[11px] text-gray-400 mt-2">
              {data?.granularity === 'monthly'
                ? t('supplier.aMonthly', { defaultValue: '월별 순매출 (환불 반영)' })
                : t('supplier.aDaily', { defaultValue: '일별 순매출 (환불 반영)' })}
            </p>
          </div>

          {/* 베스트셀러 top 10 */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5">
            <p className="text-sm font-semibold text-gray-900 mb-4">{t('supplier.aBestSellers', { defaultValue: '베스트셀러 TOP 10' })}</p>
            {(data?.best_sellers || []).length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">{t('supplier.aNoBest', { defaultValue: '판매 데이터가 없습니다.' })}</p>
            ) : (
              <ul className="divide-y divide-gray-100">
                {(data?.best_sellers || []).map((b, i) => (
                  <li key={b.product_id} className="flex items-center gap-3 py-2.5">
                    <span className="w-5 text-center text-sm font-bold text-gray-400 shrink-0">{i + 1}</span>
                    {b.image_url
                      ? <img src={b.image_url} alt="" className="w-9 h-9 rounded-lg object-cover bg-gray-100 shrink-0" loading="lazy" />
                      : <div className="w-9 h-9 rounded-lg bg-gray-100 shrink-0 flex items-center justify-center"><Package className="w-4 h-4 text-gray-300" /></div>}
                    <span className="flex-1 min-w-0 text-sm text-gray-900 truncate">{b.name}</span>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold text-gray-900">{formatWon(b.revenue)}</p>
                      <p className="text-[11px] text-gray-400">{formatNumber(b.orders)}{t('supplier.aOrdersUnit', { defaultValue: '건' })}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  )
}
