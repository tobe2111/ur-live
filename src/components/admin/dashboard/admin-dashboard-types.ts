export interface ApiError {
  response?: { status?: number; data?: { error?: string } }
  message?: string
}

export interface Seller {
  id: number
  email: string
  username?: string
  name?: string
  phone?: string
  business_name?: string
  business_number?: string
  company_name?: string
  status: string
  commission_rate?: number
  can_manipulate_stats?: number
  linked_user_id?: number | null
  created_at: string
  // seller_business_info joined fields
  biz_number?: string
  biz_name?: string
  ceo_name?: string
  business_type?: string
  business_category?: string
  postal_code?: string
  address?: string
  address_detail?: string
  biz_phone?: string
  biz_email?: string
  biz_is_verified?: number
  biz_verified_at?: string | null
}

export interface Stream {
  id: number
  title: string
  seller_id: number
  status: string
  youtube_video_id: string
  created_at: string
  seller_name?: string
  viewer_count?: number
}

export interface Stats {
  totalSellers: number
  activeSellers: number
  totalStreams: number
  activeStreams: number
}

export interface DashboardStats {
  todaySales: number
  todayOrders: number
  currentVisitors: number
  liveStreams: number
}

export interface Alert {
  type: 'success' | 'warning' | 'error'
  emoji: string
  title: string
  message: string
}
