/**
 * 장바구니 타입 통합 정의 - 전체 앱 공통 사용
 *
 * ✅ CartPage.tsx, useCart.ts, CheckoutPage.tsx, MyOrdersPage.tsx 공통 사용
 * - id: string | number (DB에 따라 다를 수 있음)
 * - price: price_snapshot 또는 price 두 가지 필드 모두 지원
 */

/**
 * 장바구니 아이템 통합 인터페이스
 *
 * useCart.ts (API 응답)와 CartPage.tsx (로컬 상태) 모두 이 타입 사용
 */
export interface CartItem {
  id: string | number
  product_id: string | number
  product_name: string
  product_image?: string    // useCart.ts 기준 필드명
  image_url?: string        // CartPage.tsx 기준 필드명 (API 응답에 따라 다름)
  quantity: number
  price_snapshot?: number   // 주문 시점 가격 (우선순위 높음)
  price?: number            // 현재 가격 (fallback)
  option_id?: number | string
  option_value?: string
  selected_options?: string[]
  stock_quantity?: number
  product_stock?: number    // API 응답 필드명 (cart.routes.ts → product_stock)
  seller_id?: number | string
  seller_name?: string
  shipping_fee?: number
  free_shipping_threshold?: number
  // 🛡️ 2026-05-19: KT Alpha 교환권 (deal_only=1) 은 '딜' 단위로 표시 + 토스 결제 차단.
  deal_only?: number
}

/**
 * 가격 계산 헬퍼: price_snapshot → price 순서로 사용
 */
export function getCartItemPrice(item: CartItem): number {
  return item.price_snapshot ?? item.price ?? 0
}

/**
 * 장바구니 합계 타입
 */
export interface Cart {
  items: CartItem[]
  total_price: number
  total_quantity: number
}
