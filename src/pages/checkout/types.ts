/**
 * 🛡️ 2026-05-01: TD-018 분할 — CheckoutPage 공유 타입.
 */
import type { CartItem } from '@/types/cart'

export interface GroupBuyTier {
  count: number
  discount: number
}

export interface SellerGroup {
  seller_id: number
  seller_name: string
  items: CartItem[]
  subtotal: number
  shipping_fee: number
  free_shipping_threshold: number
  /** 📦 2026-09-01: 그룹 전체가 비배송(이용권·교환권)인가 — 배송비 줄 자체를 숨긴다. */
  no_shipping?: boolean
}

export interface ShippingAddress {
  id: number
  recipient_name: string
  phone: string
  postal_code: string
  address: string
  address_detail: string
  is_default: number
}
