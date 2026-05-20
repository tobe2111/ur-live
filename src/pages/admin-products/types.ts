/**
 * 🛡️ 2026-05-02: TD-018 분할 — AdminProductsPage 공유 타입 + 빈 폼 상수.
 */

export interface Product {
  id: number
  name: string
  description: string
  long_description?: string
  price: number
  compare_at_price?: number
  supply_price?: number
  is_supply_product?: boolean
  stock: number
  image_url: string
  detail_images?: string | string[]
  is_active: boolean
  product_type: 'live' | 'featured'
  category: string
  seller_id?: number
  seller_name?: string
  sold_count?: number
  created_at: string
  // 🛡️ 2026-05-19: 추천 (affiliate) 시스템 — 상품별 ON/OFF + 보상률 override.
  referral_enabled?: number              // 0=OFF / 1=ON. 어드민 토글로 변경.
  referral_commission_rate?: number | null  // NULL=platform default (5%). 0.0~0.5 범위.
  deal_only?: number                     // KT Alpha 교환권 여부 (1 = 딜 전용)
}

export interface SupplySalesRow {
  supply_product_id: number
  supply_product_name: string
  supply_price: number
  seller_product_id: number
  seller_product_name: string
  seller_price: number
  seller_id: number
  seller_name: string
  business_name: string
  order_count: number
  total_qty: number
  total_revenue: number
  total_supply_cost: number
  seller_margin: number
}

export interface SupplySalesSummary {
  total_orders: number
  total_qty: number
  total_revenue: number
  total_supply_cost: number
}

export interface SampleRequest {
  id: number
  seller_id: number
  seller_name: string
  seller_email: string
  product_id: number
  product_name: string
  retail_price: number
  supply_price: number
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  seller_memo: string | null
  admin_memo: string | null
  created_at: string
  approved_at: string | null
}

export const EMPTY_FORM = {
  name: '', description: '', long_description: '', price: '', compare_at_price: '',
  supply_price: '', stock: '', image_url: '', detail_images: ['', '', '', ''] as string[],
  category: 'lifestyle', product_type: 'featured' as 'live' | 'featured',
  is_supply_product: false
}
