/**
 * 공급자(도매상) 대시보드 공유 타입 — SupplierDashboardPage 분해 (순수 추출, 동작 변화 0).
 */
export type Tab = 'overview' | 'catalog' | 'orders' | 'settlements' | 'chat'

export interface Me {
  profile: { business_name: string; email: string; status: string }
  balance: { pending_amount: number; available_amount: number; reserved_amount?: number; paid_amount: number }
  // 🏭 2026-06-30 (할 일 확장): out_of_stock/low_stock 는 승인·노출 상품 중 품절/저재고 수(서버 additive, optional).
  product_counts: { total: number; pending: number; approved: number; rejected: number; out_of_stock?: number; low_stock?: number }
  // 🧭 2026-06-12 (온보딩 마일스톤): 첫 주문/첫 정산 달성 판정용 — 서버 additive.
  milestones?: { orders: number; settlements: number }
}
export interface CatalogItem {
  id: number; name: string; retail_price: number; supply_price: number; stock: number
  category: string | null; approval_status: string; admin_memo: string | null; created_at: string
  supply_visibility?: string; barcode?: string | null; is_brand_product?: number; brand_name?: string | null
  lowest_price_url?: string | null; lowest_price_checked?: number
  pending_supply_price?: number | null; pending_retail_price?: number | null
  pending_price_reason?: string | null
  // 🔧 2026-06-24: GET /products 가 이미 반환하는 편집용 필드(수정 모달 prefill — 데이터 유실 방지).
  description?: string | null; image_url?: string | null; brand_logo_url?: string | null
  min_order_qty?: number; pack_size?: number; order_multiple?: number
}
export interface SettlementItem {
  id: number; order_id: number | null; product_id: number | null; product_name: string | null
  retail_amount: number; supply_amount: number; status: string; created_at: string; available_at: string | null
}
// 🏦 2026-06-09: 정산금 출금 신청.
export interface WithdrawalItem {
  id: number; amount: number; status: 'requested' | 'approved' | 'paid' | 'rejected'
  bank_name: string | null; bank_account: string | null; account_holder: string | null
  admin_memo: string | null; requested_at: string; processed_at: string | null
}
// 🏭 Wave 3c: 매입 역발행 전자세금계산서(제조사→플랫폼).
export interface SupplierTaxInvoiceRow {
  id: number; order_id: number; supply_amount: number; vat_amount: number; total_amount: number
  status: string; provider_ref: string | null; issued_at: string | null; created_at: string
}
export type AnalyticsPeriod = '30d' | '90d' | '12m'
export interface AnalyticsData {
  period: AnalyticsPeriod
  granularity: 'daily' | 'monthly'
  series: { bucket: string; revenue: number; orders: number }[]
  summary: {
    total_revenue: number; order_count: number; avg_order_value: number
    settle_pending: number; settle_available: number; settle_paid: number
  }
  best_sellers: { product_id: number; name: string; image_url: string | null; revenue: number; orders: number }[]
  stock: { total: number; out_of_stock: number; low_stock: number }
}
export interface OrderItem {
  order_id: number; order_number: string | null; status: string; created_at: string
  shipping_name: string | null; shipping_phone: string | null; shipping_address: string | null
  recipient_name: string | null; recipient_phone: string | null
  courier: string | null; tracking_number: string | null; shipped_at: string | null
  line_count: number; total_qty: number; item_names: string | null
}
