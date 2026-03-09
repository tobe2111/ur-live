/**
 * 📊 Recharts Dashboard Charts Component (Lazy Loaded)
 * 
 * 성능 최적화:
 * - Recharts는 ~80KB (gzip) 크기
 * - 판매자 대시보드에서만 필요
 * - Lazy loading으로 초기 번들 크기 감소
 * 
 * Updated: 2026-03-09
 */

import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

interface DailyStats {
  date: string
  orders: number
  sales: number
  completed_orders: number
}

interface TopProduct {
  product_id: number
  product_name: string
  order_count: number
  total_quantity: number
  total_revenue: number
}

interface DashboardChartsProps {
  daily: DailyStats[]
  topProducts: TopProduct[]
  formatPrice: (price: number) => string
  formatNumber: (num: number) => string
  formatShortPrice: (price: number) => string
}

export default function DashboardCharts({ 
  daily, 
  topProducts, 
  formatPrice, 
  formatNumber, 
  formatShortPrice 
}: DashboardChartsProps) {
  return (
    <>
      {/* 일별 매출 차트 */}
      <div className="mb-6">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={daily} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => {
                const date = new Date(value)
                return `${date.getMonth() + 1}/${date.getDate()}`
              }}
            />
            <YAxis 
              yAxisId="left"
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => formatShortPrice(value)}
            />
            <YAxis 
              yAxisId="right" 
              orientation="right"
              tick={{ fontSize: 12 }}
            />
            <Tooltip 
              formatter={(value: any, name: string) => {
                if (name === '매출액') return formatPrice(value)
                return formatNumber(value)
              }}
              labelFormatter={(label) => {
                const date = new Date(label)
                return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`
              }}
            />
            <Legend />
            <Line 
              yAxisId="left"
              type="monotone" 
              dataKey="sales" 
              stroke="#3B82F6" 
              strokeWidth={2}
              name="매출액"
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
            <Line 
              yAxisId="right"
              type="monotone" 
              dataKey="orders" 
              stroke="#10B981" 
              strokeWidth={2}
              name="주문 수"
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* 상품별 매출 순위 Bar Chart */}
      <div>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={topProducts} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="product_name" 
              tick={{ fontSize: 12 }}
              angle={-15}
              textAnchor="end"
              height={80}
            />
            <YAxis 
              tick={{ fontSize: 12 }}
              tickFormatter={(value) => formatShortPrice(value)}
            />
            <Tooltip 
              formatter={(value: any, name: string) => {
                if (name === '매출액') return formatPrice(value)
                return formatNumber(value)
              }}
            />
            <Legend />
            <Bar dataKey="total_revenue" fill="#8B5CF6" name="매출액" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </>
  )
}
