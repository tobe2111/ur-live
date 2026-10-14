/**
 * 셀러 매출 추이 차트 — 2026-10-11 recharts → 직접 그린 SVG(`svg-charts.tsx`).
 * 매출·주문 두 선이 **같은 세로축**을 쓴다(종전 recharts 설정 그대로 — yAxisId 0 공유).
 */
import { useTranslation } from '@/lib/i18n-lite'
import { formatNumber } from '@/utils/format'
import { SvgLineChart } from './svg-charts'

interface RevenueDataPoint {
  date: string
  revenue: number
  orders: number
}

interface SellerAnalyticsChartProps {
  data: RevenueDataPoint[]
}

export default function SellerAnalyticsChart({ data }: SellerAnalyticsChartProps) {
  const { t } = useTranslation()
  return (
    <SvgLineChart
      data={data}
      xKey="date"
      height={240}
      legend
      series={[
        { key: 'revenue', color: '#374151', width: 2, label: t('seller.revenueLabel') },
        { key: 'orders', color: '#6b7280', width: 1.5, label: t('seller.totalOrdersLabel') },
      ]}
      xFormat={(v) => v.slice(5)}
      yFormat={(v) => `${(v / 10000).toFixed(0)}${t('seller.salesUnit')}`}
      tip={(d) => (
        <>
          <p className="text-gray-500">{d.date}</p>
          <p className="font-semibold text-gray-900">{t('seller.revenueLabel')} {formatNumber(d.revenue ?? 0)}{t('common.won')}</p>
          <p className="text-gray-700">{t('seller.totalOrdersLabel')} {d.orders}{t('seller.ordersUnit')}</p>
        </>
      )}
    />
  )
}
