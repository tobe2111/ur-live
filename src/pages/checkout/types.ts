/**
 * 🛡️ 2026-05-01: TD-018 분할 — CheckoutPage 공유 타입.
 */
import type { CartItem } from '@/types/cart'

export interface SellerGroup {
  seller_id: number
  seller_name: string
  items: CartItem[]
  subtotal: number
  shipping_fee: number
  free_shipping_threshold: number
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
