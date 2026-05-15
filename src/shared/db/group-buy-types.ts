/**
 * 🛡️ 2026-05-15 (TD-G02): 공구 관련 D1 row 타입 정의 (재사용).
 *
 * 사용:
 *   const product = await DB.prepare(...).first<GroupBuyProductRow>()
 */

export interface GroupBuyProductRow {
  id: number
  name: string
  description: string | null
  price: number
  original_price: number | null
  image_url: string | null
  category: string
  seller_id: number
  is_active: number
  stock: number | null

  // group-buy fields
  group_buy_target: number
  group_buy_current: number
  group_buy_status: 'active' | 'achieved' | 'expired' | 'cancelled' | string
  group_buy_deadline: string | null
  group_buy_tiers: string | null
  milestone_notified_50?: number
  milestone_notified_80?: number
  milestone_notified_lastone?: number

  // restaurant / venue
  restaurant_name: string | null
  restaurant_address: string | null
  restaurant_phone: string | null
  restaurant_lat: number | null
  restaurant_lng: number | null

  // voucher
  voucher_expiry: string | null
  voucher_terms: string | null
  store_verify_pin: string | null
  store_owner_token: string | null

  created_at: string
  updated_at: string
}

export interface VoucherRow {
  id: number
  order_id: number
  product_id: number
  user_id: string
  code: string
  status: 'unused' | 'used' | 'expired' | 'refunded' | string
  used_at: string | null
  expires_at: string | null
  applied_discount_pct: number | null
  applied_price: number | null
  reminder_d7_sent_at?: string | null
  reminder_d1_sent_at?: string | null
  created_at: string
}

export interface OrderRow {
  id: number
  order_number: string
  user_id: string
  seller_id: number
  subtotal: number
  shipping_fee: number
  discount_amount: number
  total_amount: number
  currency: string
  status: 'PAID' | 'CANCELLED' | 'REFUNDED' | 'PENDING' | string
  payment_method: 'deal_points' | 'toss' | string
  payment_key: string | null
  created_at: string
  updated_at: string
}

export interface ParticipantRow {
  masked_name: string
  avatar: string | null
  created_at: string
  quantity: number
}
