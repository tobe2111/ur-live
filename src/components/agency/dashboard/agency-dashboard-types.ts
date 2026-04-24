import { AlertTriangle, TrendingUp, UserCheck, Radio } from 'lucide-react'

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

export type AgencyInsightSeverity = 'high' | 'medium' | 'info'
export type AgencyInsightIcon = typeof AlertTriangle | typeof TrendingUp | typeof UserCheck | typeof Radio

export interface AgencyInsight {
  severity: AgencyInsightSeverity
  icon: AgencyInsightIcon
  title: string
  description?: string
  action?: { label: string; path: string }
}
