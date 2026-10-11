/**
 * 어드민 매출 분석 차트 3종 — 2026-10-11 recharts → 직접 그린 SVG(`svg-charts.tsx`).
 * 이름·props 는 종전과 같다(`AdminRevenueAnalyticsPage` 무수정). 대시보드라 라이트 고정.
 */
import { formatNumber } from '@/utils/format'
import { SvgBarChart, SvgLineChart, SvgPieChart } from './svg-charts'

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
    <SvgBarChart
      data={chartData}
      xKey="date"
      series={{ key: 'revenue', color: '#374151', label: '매출' }}
      height={320}
      yFormat={(v) => `${(v / 10000).toFixed(0)}만`}
      tip={(d) => (<><p className="text-gray-500">{d.date}</p><p className="font-semibold text-gray-900">매출 {fmt(d.revenue)}원</p></>)}
    />
  )
}

export function OrderCountLineChart({ chartData }: { chartData: RevenueDataPoint[] }) {
  return (
    <SvgLineChart
      data={chartData}
      xKey="date"
      series={[{ key: 'order_count', color: '#4b5563', width: 2, label: '주문' }]}
      height={280}
      dots
      yFormat={(v) => fmt(v)}
      tip={(d) => (<><p className="text-gray-500">{d.date}</p><p className="font-semibold text-gray-900">주문 {fmt(d.order_count)}건</p></>)}
    />
  )
}

export function CategoryPieChart({ categories, colors }: { categories: CategoryData[]; colors: string[] }) {
  return (
    <SvgPieChart
      data={categories}
      valueKey="revenue"
      nameKey="category"
      colors={colors}
      height={250}
      tip={(d) => (<><p className="text-gray-500">{d.category}</p><p className="font-semibold text-gray-900">{fmt(d.revenue)}원</p></>)}
    />
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
