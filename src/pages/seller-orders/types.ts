/**
 * 🛡️ 2026-05-02: TD-018 분할 — SellerOrdersPage 공유 타입.
 */

export interface OrderItem {
  id: number
  product_id: number
  product_name: string
  image_url: string | null
  quantity: number
  /** 라인 단가. 서버가 `price` 를 안 싣던 시절(2026-08-02~09-21)엔 화면이 0원을 찍었다 — `unit_price` 폴백. */
  price?: number | null
  unit_price?: number | null
}

export interface Order {
  id: string
  order_number: string
  user_name: string
  total_amount: number
  status: string
  payment_status: string
  shipping_name: string
  shipping_phone: string
  shipping_address: string
  courier: string | null
  tracking_number: string | null
  created_at: string
  updated_at: string
  items?: OrderItem[]
  /**
   * 📦 픽업일(ISO). 주문에 여러 상품이 섞이면 **가장 이른 날** — 손님이 가게에 오는 첫 날이다.
   * 픽업 상품이 없거나 아직 안 정해졌으면 **`null`**(빈 문자열로 채우지 않는다 — 화면이 오해한다).
   * 서버: `seller-orders.routes` GET /orders 의 `product_supply_meta.pickup_date` enrich.
   */
  pickup_date?: string | null
  /**
   * 🧾 주문 종류 — `'voucher'`(이용권) · `'deal'`(교환권) · `'shipping'`(배송).
   * 서버 `order-list-enrich` 가 `orderKindOfItems`(SSOT)로 붙인다. **없으면 배송으로 읽는다**
   * (구 응답·enrich 실패 시 운송장 칸을 지우지 않기 위해 — `orderKindOf` 가 그 폴백을 한다).
   */
  order_kind?: string | null
  user_email?: string | null
}

export interface TrackingForm {
  courier: string
  tracking_number: string
}
