/**
 * Seller Analytics Revenue Chart (Lazy Loaded)
 *
 * Recharts를 동적으로 로드하여 초기 번들에서 377KB를 절감합니다.
 */

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { useTranslation } from 'react-i18next'
import { formatNumber } from '@/utils/format'

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
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="date"
          tickFormatter={(v: string) => v.slice(5)}
          tick={{ fontSize: 10, fill: '#9ca3af' }}
        />
        <YAxis
          tickFormatter={(v: number) => `${(v / 10000).toFixed(0)}${t('seller.salesUnit')}`}
          tick={{ fontSize: 10, fill: '#9ca3af' }}
          width={50}
        />
        <Tooltip
          formatter={(value, name) => {
            if (name === 'revenue') return [`${formatNumber(value ?? 0)}${t('common.won')}`, t('seller.revenueLabel')]
            return [`${value}${t('seller.ordersUnit')}`, t('seller.totalOrdersLabel')]
          }}
          labelFormatter={(label) => String(label)}
        />
        <Legend
          formatter={(value: string) => value === 'revenue' ? t('seller.revenueLabel') : t('seller.totalOrdersLabel')}
        />
        <Line type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="orders" stroke="#10b981" strokeWidth={1.5} dot={false} yAxisId={0} />
      </LineChart>
    </ResponsiveContainer>
  )
}
