/**
 * 주문 타입 통합 정의 - 전체 앱 공통 사용
 *
 * ✅ MyOrdersPage.tsx, OrdersTab.tsx, CheckoutPage.tsx 등 모두 이 파일에서 import
 * - id: number | string (DB에 따라 다를 수 있으므로 union type)
 * - status: 모든 상태 포함 (string union)
 */

// ─── 주문 상태 ──────────────────────────────────────────────────────────────

export type OrderStatusValue =
  | 'pending'
  | 'paid'
  | 'preparing'
  | 'shipping'
  | 'delivered'
  | 'cancelled'
  | 'refunded'

/** @deprecated enum 대신 OrderStatusValue 사용 */
export enum OrderStatus {
  PENDING = 'pending',
  PAID = 'paid',
  PREPARING = 'preparing',
  SHIPPING = 'shipping',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
  REFUNDED = 'refunded',
}

export const OrderStatusLabels: Record<OrderStatusValue, string> = {
  pending: '결제 대기',
  paid: '결제 완료',
  preparing: '상품 준비중',
  shipping: '배송중',
  delivered: '배송 완료',
  cancelled: '취소됨',
  refunded: '환불 완료',
}

// ─── 주문 상품 아이템 ────────────────────────────────────────────────────────

/**
 * 주문 내 상품 항목 (DB 응답 기준)
 * - id: 항목 고유 ID (없을 수도 있음)
 * - product_id: 상품 ID
 */
export interface OrderItem {
  id?: number | string
  order_id?: number | string
  product_id: number | string
  product_name: string
  image_url?: string
  quantity: number
  price_snapshot: number
  option_value?: string
}

// ─── 주문 (통합) ─────────────────────────────────────────────────────────────

/**
 * 주문 통합 인터페이스 - MyOrdersPage, OrdersTab, CheckoutPage 공통 사용
 *
 * DB 응답은 id가 number인 경우와 string인 경우가 혼재하므로
 * number | string union으로 정의
 */
export interface Order {
  id: number | string
  order_number?: string
  user_id: number | string
  seller_id?: number | string
  total_amount?: number
  amount?: number                      // 일부 API에서 amount로 반환
  status: OrderStatusValue | string    // DB 값이 항상 enum과 일치하지 않을 수 있음
  payment_method?: string
  payment_key?: string
  shipping_name?: string
  shipping_phone?: string
  shipping_postal_code?: string
  shipping_address?: string
  shipping_address_detail?: string
  courier?: string
  tracking_number?: string
  shipped_at?: string
  delivered_at?: string
  cancelled_at?: string
  refunded_at?: string
  cancel_reason?: string
  refund_status?: 'pending' | 'completed' | 'failed'
  created_at: string
  updated_at?: string
  items?: OrderItem[]
  [key: string]: unknown              // 추가 필드 허용 (API 확장 대비)
}

// ─── 기타 ────────────────────────────────────────────────────────────────────

export interface OrderStatusHistory {
  id: string
  order_id: string
  status: OrderStatusValue
  message?: string
  updated_at: string
}

export interface RefundRequest {
  order_id: string
  reason: string
  refund_amount?: number
}

export interface RefundHistory {
  id: string
  order_id: string
  amount: number
  reason: string
  refunded_at: string
}
