// ─── Seller Dashboard Types ──────────────────────────────────────────────────

export interface DashboardStats {
  totalRevenue: number
  totalOrders: number
  activeStreams: number
  totalViewers: number
  pendingOrders: number
  cancelledOrders: number
  completedOrders: number
  avgOrderValue: number
  totalProducts?: number
  totalStreams?: number
  lowStockCount?: number
  pendingSettlement?: number
}

export interface DailyStats {
  date: string
  orders: number
  sales: number
}

export interface TopProduct {
  product_id: number
  product_name: string
  order_count: number
  total_revenue: number
}

export interface Order {
  id: number
  order_number: string
  user_name: string
  user_email: string
  total_amount: number
  status: string
  shipping_name: string
  shipping_phone: string
  payment_method: string
  created_at: string
}

export interface LiveStream {
  id: number
  title: string
  status: 'scheduled' | 'live' | 'ended'
  viewer_count: number
  created_at: string
  youtube_video_id: string
}
