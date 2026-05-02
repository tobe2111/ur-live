/**
 * 🛡️ 2026-05-02: TD-018 분할 — SellerPage 의 recharts 지연 로드 라인 차트.
 *   recharts 377KB → 대시보드 진입 시 차트 영역만 지연 로드.
 */
import { lazy } from 'react'

const LazyChart = lazy(() => import('recharts').then(m => ({
  default: ({ data, salesLabel, ordersLabel }: { data: { date: string; orders: number; sales: number }[]; salesLabel?: string; ordersLabel?: string }) => {
    const { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } = m
    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#9ca3af" />
          <YAxis yAxisId="left" tick={{ fontSize: 11 }} stroke="#9ca3af" />
          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} stroke="#9ca3af" />
          <Tooltip />
          <Legend />
          <Line yAxisId="left" type="monotone" dataKey="sales" name={salesLabel || 'Sales'} stroke="#3b82f6" strokeWidth={2} dot={false} />
          <Line yAxisId="right" type="monotone" dataKey="orders" name={ordersLabel || 'Orders'} stroke="#f97316" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    )
  }
})))

export default LazyChart
