import { CartItem } from '@/types/cart'

export interface ShippingAddress {
  id: number
  recipient_name: string
  phone: string
  postal_code: string
  address: string
  address_detail: string
  is_default: number
}

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
}

export interface NewAddressForm {
  recipient_name: string
  phone: string
  postal_code: string
  address: string
  address_detail: string
  is_default: number
}
