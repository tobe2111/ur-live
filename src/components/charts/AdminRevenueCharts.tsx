/**
 * Admin Revenue Analytics Charts (Lazy Loaded)
 *
 * Recharts를 동적으로 로드하여 초기 번들에서 377KB를 절감합니다.
 */

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { formatNumber } from '@/utils/format'

interface RevenueDataPoint {
  date: string
  revenue: number
  order_count: number
}

interface CategoryData {
  category: string
  revenue: number
  order_count: number
}

function fmt(n: number | null | undefined): string {
  return formatNumber(n ?? 0)
}

export function RevenueBarChart({ chartData }: { chartData: RevenueDataPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6B7280' }} />
        <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} tickFormatter={(v) => `${(v / 10000).toFixed(0)}만`} />
        <Tooltip
          contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12 }}
          formatter={(value) => [`${fmt(Number(value ?? 0))}원`, '매출']}
        />
        <Bar dataKey="revenue" fill="#3B82F6" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function OrderCountLineChart({ chartData }: { chartData: RevenueDataPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6B7280' }} />
        <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} />
        <Tooltip
          contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12 }}
          formatter={(value) => [`${fmt(Number(value ?? 0))}건`, '주문']}
        />
        <Line type="monotone" dataKey="order_count" stroke="#8B5CF6" strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  )
}

export function CategoryPieChart({ categories, colors }: { categories: CategoryData[]; colors: string[] }) {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <PieChart>
        <Pie
          data={categories}
          dataKey="revenue"
          nameKey="category"
          cx="50%"
          cy="50%"
          outerRadius={90}
          label={(props: { category?: string; percent?: number }) => `${props.category} ${((props.percent ?? 0) * 100).toFixed(0)}%`}
          labelLine={{ stroke: '#9CA3AF' }}
          fontSize={11}
        >
          {categories.map((_, i) => (
            <Cell key={i} fill={colors[i % colors.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ borderRadius: 8, border: '1px solid #E5E7EB', fontSize: 12 }}
          formatter={(value) => [`${fmt(Number(value ?? 0))}원`]}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}

// Default export: bundled component that includes all three charts used together.
// Components above are named exports for granular use.
export default function AdminRevenueCharts({
  chartData,
  categories,
  colors,
}: {
  chartData: RevenueDataPoint[]
  categories: CategoryData[]
  colors: string[]
}) {
  return (
    <>
      <RevenueBarChart chartData={chartData} />
      <OrderCountLineChart chartData={chartData} />
      <CategoryPieChart categories={categories} colors={colors} />
    </>
  )
}
