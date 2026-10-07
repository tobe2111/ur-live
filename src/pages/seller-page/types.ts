/**
 * 🛡️ 2026-05-02: TD-018 분할 — SellerPage 공유 타입.
 * 📱 2026-09-14: 홈이 M2 로 다시 그려지며 라이브·KPI·인사이트용 타입은 지웠다(소비처 0).
 */

export interface Order {
  id: number
  order_number: string
  user_name: string
  user_email: string
  total_amount: number
  status: string
  shipping_name: string
  shipping_phone: string
  payment_method: string
  created_at: string
  /** 🧾 `'voucher'`·`'deal'`·`'shipping'` — 서버 `order-list-enrich` 가 붙인다. "처리 대기" 판정에 쓴다(`order-stage`). */
  order_kind?: string | null
  vouchers?: Array<{ status?: string | null }>
}
