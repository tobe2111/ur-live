/**
 * 📊 Recharts Dashboard Charts Component (Lazy Loaded)
 * 
 * 성능 최적화:
 * - Recharts는 ~80KB (gzip) 크기
 * - 판매자 대시보드에서만 필요
 * - Lazy loading으로 초기 번들 크기 감소
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
  PieChart,
  Pie,
  Cell
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
  colors: string[]
}

export default function DashboardCharts({ daily, topProducts, colors }: DashboardChartsProps) {
  return (
    <>
      {/* 일별 매출 차트 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">📈 일별 매출 추이</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={daily}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip 
              formatter={(value: number) => `₩${value.toLocaleString()}`}
              labelStyle={{ color: '#000' }}
            />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="sales" 
              stroke="#3B82F6" 
              strokeWidth={2}
              name="매출액"
              dot={{ fill: '#3B82F6', r: 4 }}
              activeDot={{ r: 6 }}
            />
            <Line 
              type="monotone" 
              dataKey="orders" 
              stroke="#10B981" 
              strokeWidth={2}
              name="주문 수"
              dot={{ fill: '#10B981', r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* 상품별 매출 순위 */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">🏆 상품별 매출 TOP 5</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={topProducts.slice(0, 5)}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="product_name" 
              angle={-15}
              textAnchor="end"
              height={80}
            />
            <YAxis />
            <Tooltip 
              formatter={(value: number) => `₩${value.toLocaleString()}`}
              labelStyle={{ color: '#000' }}
            />
            <Legend />
            <Bar 
              dataKey="total_revenue" 
              fill="#3B82F6"
              name="매출액"
              radius={[8, 8, 0, 0]}
            >
              {topProducts.slice(0, 5).map((entry, index) => (
                <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 주문 상태 분포 (Pie Chart) */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">📊 상품별 주문 비율</h2>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={topProducts.slice(0, 5)}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ product_name, percent }: any) => 
                `${product_name} (${(percent * 100).toFixed(0)}%)`
              }
              outerRadius={80}
              fill="#8884d8"
              dataKey="order_count"
            >
              {topProducts.slice(0, 5).map((entry, index) => (
                <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </>
  )
}
