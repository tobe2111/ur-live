// 주문 상태 추적 시스템

export enum OrderStatus {
  PENDING = 'pending',           // 결제 대기
  PAID = 'paid',                 // 결제 완료
  PREPARING = 'preparing',       // 상품 준비중
  SHIPPING = 'shipping',         // 배송중
  DELIVERED = 'delivered',       // 배송 완료
  CANCELLED = 'cancelled',       // 취소
  REFUNDED = 'refunded',         // 환불
}

export const OrderStatusLabels: Record<OrderStatus, string> = {
  [OrderStatus.PENDING]: '결제 대기',
  [OrderStatus.PAID]: '결제 완료',
  [OrderStatus.PREPARING]: '상품 준비중',
  [OrderStatus.SHIPPING]: '배송중',
  [OrderStatus.DELIVERED]: '배송 완료',
  [OrderStatus.CANCELLED]: '취소됨',
  [OrderStatus.REFUNDED]: '환불 완료',
}

export interface Order {
  id: string
  user_id: string
  amount: number
  status: OrderStatus
  payment_key?: string
  created_at: string
  updated_at: string
  items: OrderItem[]
}

export interface OrderItem {
  id: string
  order_id: string
  product_id: string
  product_name: string
  quantity: number
  price_snapshot: number
}

export interface OrderStatusHistory {
  id: string
  order_id: string
  status: OrderStatus
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
