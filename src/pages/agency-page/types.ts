/**
 * 🛡️ 2026-05-02: TD-018 분할 — AgencyPage 공유 타입.
 */

export interface Stats {
  sellers: number
  orders_30d: number
  revenue_30d: number
  net_revenue_30d: number
  active_streams: number
}

export interface Seller {
  id: number
  name: string
  business_name: string
  email: string
  status: string
  commission_rate: number
  total_orders: number
  total_revenue: number
  active_streams: number
}

export interface Order {
  id: number
  order_number: string
  total_amount: number
  payment_status: string
  status: string
  created_at: string
  shipping_name: string
  seller_business_name: string
}

export interface DailyStat {
  date: string
  revenue: number
  orders: number
}

export interface Stream {
  id: number
  title: string
  seller_business_name?: string
  seller_name?: string
  status: string
}

// 🛡️ 2026-04-26 L2: TikTok 스타일 핵심 KPI 6 + 의무 작업
export interface KpiData {
  diamond_total: number
  live_rate: number
  effective_live_rate: number
  active_creators: number
  effective_active_creators: number
  new_creators_today: number
  total_sellers: number
  period_days: number
}

export interface MonthlyTask {
  id: number
  task_type: 'creator_growth' | 'sales_quota' | 'activation'
  target_value: number
  actual_value: number
  status: 'in_progress' | 'completed' | 'failed'
  month: string
}
