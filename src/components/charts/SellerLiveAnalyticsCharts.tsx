/**
 * Seller Live Analytics Charts (Lazy Loaded)
 *
 * Recharts를 동적으로 로드하여 초기 번들에서 377KB를 절감합니다.
 */

import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'

interface CombinedPoint {
  minute: string
  chat: number
  orders: number
  revenue: number
}

interface ChatPoint {
  minute: string
  count: number
}

interface OrderPoint {
  minute: string
  order_count: number
  revenue: number
}

export function CombinedTimelineChart({
  data,
  chatName,
  ordersName,
}: {
  data: CombinedPoint[]
  chatName: string
  ordersName: string
}) {
  return (
    <ResponsiveContainer width="100%" height={250}>
      <LineChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
        <XAxis dataKey="minute" tick={{ fontSize: 10, fill: '#9CA3AF' }} />
        <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} width={40} />
        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E5E7EB' }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Line type="monotone" dataKey="chat" stroke="#F97316" strokeWidth={2} name={chatName} dot={false} />
        <Line type="monotone" dataKey="orders" stroke="#10B981" strokeWidth={2} name={ordersName} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}

export function ChatBarChart({
  data,
  chatCountLabel,
}: {
  data: ChatPoint[]
  chatCountLabel: string
}) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
        <XAxis dataKey="minute" tick={{ fontSize: 10, fill: '#9CA3AF' }} />
        <YAxis tick={{ fontSize: 10, fill: '#9CA3AF' }} width={35} />
        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E5E7EB' }} />
        <Bar dataKey="count" fill="#F97316" radius={[4, 4, 0, 0]} name={chatCountLabel} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export function OrderRevenueChart({
  data,
  orderCountLabel,
  salesLabel,
}: {
  data: OrderPoint[]
  orderCountLabel: string
  salesLabel: string
}) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
        <XAxis dataKey="minute" tick={{ fontSize: 10, fill: '#9CA3AF' }} />
        <YAxis yAxisId="left" tick={{ fontSize: 10, fill: '#9CA3AF' }} width={35} />
        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: '#9CA3AF' }} width={60} />
        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E5E7EB' }} />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        <Bar yAxisId="left" dataKey="order_count" fill="#10B981" radius={[4, 4, 0, 0]} name={orderCountLabel} />
        <Line yAxisId="right" type="monotone" dataKey="revenue" stroke="#2563EB" strokeWidth={2} name={salesLabel} dot={false} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export default function SellerLiveAnalyticsCharts() {
  return null
}
