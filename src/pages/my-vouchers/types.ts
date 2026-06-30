// 🧱 2026-06-29 TD: MyVouchersPage god 파일 분해 — 공유 타입(Voucher/ViewMode). verbatim.
export interface Voucher {
  id: number | string  // KT Alpha 는 'kt-{voId}' 형식
  code: string
  status: 'unused' | 'used' | 'expired' | 'refunded' | 'processing'
  product_name: string
  restaurant_name?: string
  restaurant_address?: string
  restaurant_lat?: number
  restaurant_lng?: number
  product_image?: string
  expires_at?: string
  used_at?: string
  created_at: string
  applied_price?: number  // 🛡️ 2026-05-16: voucher 액면가 (차감 금액 안내용)
  product_price?: number
  usage_guide?: string    // 매장이 등록한 사용 가이드 (예: "평일 점심만")
  // 🛡️ 2026-05-25 (A 옵션): KT Alpha 통합 표시
  source?: 'internal' | 'kt_alpha'
  kt_alpha_voucher_order_id?: number
  kt_recipient_phone?: string
  kt_status?: string  // 'sent' | 'processing'
  kt_pin?: string | null  // 🔢 #4: PIN 모드 발급분의 쿠폰 PIN/바코드 (인앱 표시용)
  order_id?: number
  product_id?: number  // 🛡️ /api/vouchers/my 가 v.product_id 반환 — 재구매 딥링크용
  applied_discount_pct?: number  // 🛡️ 할인율(%) — '아낀 돈' 계산용 (product_price 미반환이므로 이걸로)
}

export type ViewMode = 'list' | 'map'
