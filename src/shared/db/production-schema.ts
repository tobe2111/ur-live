/**
 * 프로덕션 DB 스키마 정의 (Single Source of Truth)
 *
 * 이 파일은 실제 프로덕션 D1 DB의 테이블 구조를 정확히 반영합니다.
 * 새로운 쿼리를 작성할 때 반드시 이 파일의 컬럼명을 참조하세요.
 *
 * ⚠️ 주의: 001_initial.sql (신 스키마)과 0001_initial_schema.sql (구 스키마)이
 * 혼재되어 있습니다. 프로덕션은 구 스키마(0001) + 이후 마이그레이션 기반입니다.
 *
 * 최종 확인: 2026-03-31 (debug-schema 엔드포인트로 실제 DB 조회)
 */

// ============================================================
// orders 테이블
// ============================================================
export interface OrdersTable {
  id: number                    // INTEGER PRIMARY KEY AUTOINCREMENT
  order_number: string          // TEXT UNIQUE NOT NULL
  user_id: number               // INTEGER NOT NULL (FK → users.id)
  total_amount: number          // INTEGER NOT NULL
  payment_key: string | null    // TEXT
  payment_status: string | null // TEXT DEFAULT 'pending' — CHECK('pending','approved','failed','cancelled','refunded')
  shipping_address: string | null // TEXT (JSON)
  shipping_name: string | null
  shipping_phone: string | null
  live_stream_id: number | null
  created_at: string
  updated_at: string
  shipping_memo: string | null
  courier: string | null
  tracking_number: string | null
  shipped_at: string | null
  delivered_at: string | null
  seller_id: number | null      // INTEGER (nullable!)
  commission_rate: number        // REAL DEFAULT 10.00
  commission_amount: number      // INTEGER DEFAULT 0
  seller_amount: number          // INTEGER DEFAULT 0
  cancelled_at: string | null
  cancel_reason: string | null
  settlement_status: string      // TEXT DEFAULT 'pending'
  settled_at: string | null
  subtotal: number               // INTEGER DEFAULT 0
  shipping_fee: number           // INTEGER DEFAULT 0
  discount_amount: number        // INTEGER DEFAULT 0
  currency: string               // TEXT DEFAULT 'KRW'
  idempotency_key: string | null
  locale: string                 // TEXT DEFAULT 'ko'
  toss_order_id: string | null
  toss_payment_key: string | null
  payment_method: string | null
  paid_at: string | null
  status: string                 // TEXT NOT NULL DEFAULT 'PENDING'
  shipping_company: string | null
  // Migration 0128: recipient/postal fields for shipping
  recipient_name: string | null
  recipient_phone: string | null
  shipping_postal_code: string | null
  // Migration 0203: partial refund tracking
  refunded_amount: number        // INTEGER DEFAULT 0
}

// ============================================================
// order_refund_history 테이블 (migration 0203)
// 부분 환불 이력 추적
// ============================================================
export interface OrderRefundHistoryTable {
  id: number
  order_id: number              // INTEGER NOT NULL (FK → orders.id)
  amount: number                // INTEGER NOT NULL
  reason: string | null
  toss_transaction_key: string | null
  created_at: string
}

// ============================================================
// order_items 테이블
// ⚠️ created_at, updated_at 컬럼 없음!
// ============================================================
export interface OrderItemsTable {
  id: number                    // INTEGER PRIMARY KEY AUTOINCREMENT
  order_id: number              // INTEGER NOT NULL (FK → orders.id)
  product_id: number            // INTEGER NOT NULL (FK → products.id)
  option_id: number | null
  quantity: number              // INTEGER NOT NULL
  price: number                 // INTEGER NOT NULL (⚠️ 필수!)
  product_name: string          // TEXT NOT NULL
  option_info: string | null
  product_image: string | null
  seller_id: number | null
  unit_price: number            // INTEGER DEFAULT 0
  subtotal: number              // INTEGER DEFAULT 0
  currency: string              // TEXT DEFAULT 'KRW'
  options: string               // TEXT DEFAULT '{}'
  status: string                // TEXT DEFAULT 'PENDING'
}

// ============================================================
// products 테이블
// ⚠️ stock (NOT stock_quantity), is_active (NOT status)
//
// 🛡️ 2026-04-22: legacy stock_quantity 컬럼이 일부 환경에 추가된 상태(ALTER TABLE).
//    코드에서 `p.stock ?? p.stock_quantity ?? 0` 패턴으로 fallback 사용 중이나,
//    INSERT/UPDATE 는 항상 `stock` 만 사용. SQL 쿼리에서 stock_quantity 를
//    SELECT 하는 것은 OK (없으면 NULL → COALESCE 가 처리).
//    신규 코드는 `stock` 만 사용할 것.
// ============================================================
export interface ProductsTable {
  id: number                    // INTEGER PRIMARY KEY AUTOINCREMENT
  name: string                  // TEXT NOT NULL
  description: string | null
  price: number                 // INTEGER NOT NULL
  original_price: number | null
  discount_rate: number         // INTEGER DEFAULT 0
  image_url: string | null
  stock: number                 // INTEGER DEFAULT 0 (⚠️ NOT stock_quantity!)
  category: string | null
  live_stream_id: number | null
  is_active: number             // BOOLEAN DEFAULT 1 (⚠️ NOT status!)
  created_at: string
  updated_at: string
  seller_id: number | null
  version: number               // INTEGER DEFAULT 0
  detail_images: string | null
  // migration 0129: sold_count (기존)
  sold_count: number            // INTEGER DEFAULT 0 — 판매 건수
  // migration 0205: 랭킹 통계
  view_count: number            // INTEGER DEFAULT 0 — 상품 상세 조회 수
  avg_rating: number            // REAL DEFAULT 0 — 리뷰 평균 별점
  review_count: number          // INTEGER DEFAULT 0 — 리뷰 개수
  // migration 0271 (2026-05-19): 상품 추천 (affiliate) 시스템.
  //   referral_enabled = 1 인 상품만 사용자가 공유하고 보상 받을 수 있음.
  //   referral_commission_rate NULL → platform_settings.affiliate_commission_rate (기본 5%)
  //   정책: 셀러 상품 OFF / 어드민 큐레이션 ON / KT Alpha 교환권 OFF (default).
  referral_enabled: number | null              // INTEGER DEFAULT 0
  referral_commission_rate: number | null      // REAL — ratio (0.05 = 5%)
  // 🛡️ 2026-05-23: repair-schema 배포로 추가된 컬럼 (사고 fix #23 일괄).
  long_description: string | null              // TEXT — 어드민 상품 상세 마크다운 설명
  compare_at_price: number | null              // INTEGER — 할인 전 정가 (Cafe24 sync / 어드민 등록 시 사용)
}

// ============================================================
// donations 테이블
// ⚠️ live_stream_id (NOT stream_id), credit_amount (NOT seller_amount),
//    payment_status (NOT status), is_anonymous 없음
// ============================================================
export interface DonationsTable {
  id: number
  donor_user_id: number         // INTEGER NOT NULL
  donor_name: string            // TEXT NOT NULL
  seller_id: number             // INTEGER NOT NULL
  live_stream_id: number        // INTEGER NOT NULL (⚠️ NOT stream_id!)
  amount: number                // INTEGER NOT NULL
  commission_rate: number       // REAL DEFAULT 0.10
  commission_amount: number     // INTEGER NOT NULL
  credit_amount: number         // INTEGER NOT NULL (⚠️ NOT seller_amount!)
  message: string               // TEXT DEFAULT ''
  payment_key: string | null
  order_id: string              // TEXT UNIQUE NOT NULL
  payment_status: string        // TEXT DEFAULT 'pending' (⚠️ NOT status!, 소문자!)
  created_at: string
  completed_at: string | null   // (⚠️ NOT updated_at!)
}

// ============================================================
// live_streams 테이블
// ============================================================
export interface LiveStreamsTable {
  id: number
  title: string
  description: string | null
  youtube_video_id: string
  youtube_broadcast_id: string | null
  youtube_stream_key: string | null
  youtube_live_chat_id: string | null
  rtmp_url: string | null
  rtmp_key: string | null
  youtube_embed_url: string | null
  thumbnail_url: string | null
  custom_thumbnail_url: string | null   // 2026-05-10: 셀러 업로드 (YouTube auto thumb 와 별도)
  status: string                // 'scheduled' | 'live' | 'ended'
  current_product_id: number | null
  current_viewers: number | null
  total_viewers: number | null
  peak_viewers: number | null
  like_count: number | null
  last_error: string | null     // 2026-05-10: OME push / YouTube broadcast 자동감지 실패 시 셀러 진단용
  started_at: string | null     // 2026-05-11: admission webhook 이 status='live' 와 동시에 박음
  disconnected_at: string | null // 2026-05-13: OME closing webhook 시 grace period 진입. reconnect 시 클리어
  whip_url: string | null       // 2026-05-13: YouTube WHIP direct ingest URL (webrtc ingestion 시)
  ended_at: string | null
  created_at: string
  updated_at: string
  seller_id: number | null
  scheduled_at: string | null
  seller_instagram: string | null
  seller_youtube: string | null
}

// ============================================================
// sellers 테이블 (구 스키마: 0003_add_admin_seller.sql)
// ============================================================
export interface SellersTable {
  id: number
  username: string
  password_hash: string
  name: string
  email: string
  phone: string | null
  business_name: string
  business_number: string | null
  bank_account: string | null
  status: string                // 'pending' | 'approved' | 'rejected' | 'suspended'
  // migration 0272 (2026-05-19): D 공동구매 3자 분배 위한 구분.
  //   'influencer' — 본인이 라이브 송출 + 상품 판매 (기본)
  //   'store_owner' — 라이브 안 함, 상품만 등록 + 정산 받음 (가게 사장님)
  //   'both' — 라이브 + 공급 둘 다
  seller_type: string           // DEFAULT 'influencer'
  can_broadcast: number         // 0=라이브 금지 (store_owner default) / 1=가능 (influencer default)
  is_active: number
  commission_rate: number       // REAL DEFAULT 10.00
  created_at: string
  updated_at: string
}

// ─── shipping_addresses (0001 + migration 0204) ────────────────
export interface ShippingAddressesTable {
  id: number
  user_id: number
  recipient_name: string
  phone: string
  postal_code: string
  address: string
  address_detail: string | null
  is_default: number            // 0 | 1
  country: string | null
  state: string | null
  city: string | null
  // migration 0204 — 실무 필수 필드
  label: string | null          // 배송지 별칭 ('집', '회사', '부모님댁')
  delivery_note: string | null  // 배송 메모 (최대 200자)
  entry_code: string | null     // 공동현관 비밀번호 (최대 20자)
  entry_method: 'free' | 'password' | 'intercom' | 'pickup_box' | null  // DEFAULT 'free'
  created_at: string
  updated_at: string
}

// ─── product_reviews (0001) + migration 0205 통계 컬럼 ──────────
// products 테이블에 view_count/avg_rating/review_count 추가 (0205 migration)
// 해당 컬럼은 ProductsTable 위의 primary interface에서 관리

// ─── stay_voucher 8 tables (migration 0258, 2026-05-18) ────────────────
//   야놀자/Booking.com 수준 숙소 공구 — PR 1-6 완료.
//   SSOT routes: src/features/seller/api/seller-stays.routes.ts + stays-public.routes.ts.

export interface ProductStayInfoTable {
  product_id: number              // PK + FK
  property_type: string           // 'hotel'|'motel'|'pension'|'guesthouse'|'resort'|'glamping'|'house'
  star_rating: number | null
  total_rooms: number
  check_in_time: string           // 'HH:MM' DEFAULT '15:00'
  check_out_time: string          // DEFAULT '11:00'
  address: string | null
  region_sido: string | null
  region_sigungu: string | null
  latitude: number | null
  longitude: number | null
  amenities: string | null         // JSON array
  room_amenities: string | null
  cancellation_policy: string     // 'flexible'|'standard'|'strict'|'non_refundable'
  custom_cancellation_text: string | null
  house_rules: string | null
  check_in_instructions: string | null
  description_full: string | null
  nearby_attractions: string | null
  min_nights: number
  max_nights: number | null
  advance_booking_days: number
  created_at: string
  updated_at: string
}

export interface ProductStayRoomsTable {
  id: number
  product_id: number
  name: string
  description: string | null
  display_order: number
  base_guests: number
  max_guests: number
  extra_guest_fee: number
  bed_config: string | null
  room_size_sqm: number | null
  base_price_weekday: number
  base_price_weekend: number
  base_price_holiday: number | null
  total_inventory: number
  amenities: string | null         // JSON array
  image_urls: string | null        // JSON array
  is_active: number
  created_at: string
  updated_at: string
}

export interface ProductStayCalendarTable {
  id: number
  room_id: number
  product_id: number
  stay_date: string                // 'YYYY-MM-DD'
  available_count: number
  price_override: number | null
  is_blocked: number
  blocked_reason: string | null
  created_at: string
  updated_at: string
}

export interface StayBookingsTable {
  id: number
  order_id: number
  product_id: number
  room_id: number
  seller_id: number
  user_id: number
  check_in_date: string
  check_out_date: string
  nights: number
  guest_count: number
  guest_name: string
  guest_phone: string
  guest_email: string | null
  special_request: string | null
  room_total: number
  extra_guest_fee: number
  cleaning_fee: number
  tax_amount: number
  total_amount: number
  status: string                   // 'pending'|'confirmed'|'checked_in'|'checked_out'|'cancelled'|'no_show'|'refunded'|'dispute'
  check_in_code: string | null     // 8자리 (예: 'A3K7-9M2P')
  checked_in_at: string | null
  checked_in_by: number | null
  checked_out_at: string | null
  cancelled_at: string | null
  cancellation_reason: string | null
  refund_amount: number | null
  refunded_at: string | null
  no_show_marked_at: string | null
  no_show_marked_by: number | null
  dispute_id: number | null
  created_at: string
  updated_at: string
}

export interface StayBookingReviewsTable {
  id: number
  booking_id: number               // UNIQUE — 1 booking = 1 review
  product_id: number
  user_id: number
  rating_cleanliness: number | null
  rating_location: number | null
  rating_service: number | null
  rating_facility: number | null
  rating_value: number | null
  rating_overall: number
  title: string | null
  comment: string | null
  photos: string | null            // JSON array
  seller_reply: string | null
  seller_replied_at: string | null
  is_visible: number
  is_verified: number
  helpful_count: number
  created_at: string
  updated_at: string
}

export interface StayPropertyAmenitiesTable {
  code: string                     // PK
  label_ko: string
  label_en: string
  icon_emoji: string | null
  category: string                 // 'property'|'room'|'service'
  display_order: number
  is_active: number
}

export interface StayBookingStatusLogTable {
  id: number
  booking_id: number
  prev_status: string | null
  new_status: string
  changed_by_role: string          // 'user'|'seller'|'admin'|'system'
  changed_by_id: number | null
  reason: string | null
  created_at: string
}

// ─── sellers 확장 (migration 0257, 2026-05-18) ──────────────────────────
//   사업자등록 게이팅 정산. SellersTable 의 추가 컬럼:
//   - business_registration_status: 'pending'|'verified'|'rejected'|'exempt'
//   - business_registration_image_url
//   - business_registration_verified_at / _by / _reject_reason
//   - preferred_settlement_method: 'auto'|'cash'|'voucher'|'deal'

export interface SellerDealBalancesTable {
  seller_id: number                // PK + FK
  gated_deal_amount: number        // 환급 불가 (사업자 미등록 적립)
  redeemable_deal_amount: number   // 환급 가능
  created_at: string
  updated_at: string
}

export interface SellerDealTransactionsTable {
  id: number
  seller_id: number
  amount: number
  bucket: string                   // 'gated'|'redeemable'
  type: string                     // 'settlement_accrual'|'voucher_redeem'|'platform_use'|'cash_withdraw'|'admin_adjust'
  reference_id: string | null
  memo: string | null
  created_at: string
}

export interface VoucherOrdersTable {
  id: number
  seller_id: number
  source: string                   // 'kt_alpha'|'kakao_gift'|'manual'
  goods_code: string
  goods_name: string
  unit_price: number
  quantity: number
  total_amount: number
  recipient_phone: string
  withholding_amount: number
  net_amount: number
  status: string                   // 'pending'|'processing'|'sent'|'failed'|'cancelled'|'used'
  external_order_id: string | null
  coupon_code: string | null
  failure_reason: string | null
  created_at: string
  sent_at: string | null
  updated_at: string
}

export interface TaxWithholdingLogTable {
  id: number
  seller_id: number
  payout_year: number
  payout_month: number
  gross_amount: number
  withholding_rate: number         // 8.8 default
  withholding_amount: number
  net_amount: number
  source_type: string              // 'settlement_cash'|'voucher_order'|'deal_redeem'
  source_id: string | null
  ytd_gross_amount: number
  reportable: number               // 1: 300만 초과 / 0: 분리과세 가능
  reported_at: string | null
  created_at: string
}

// ─── orders 확장 (migration 0258, 2026-05-18) ──────────────────────────
//   숙소 예약 메타 (빠른 조회용 캐시 컬럼) — OrdersTable 추가:
//   stay_booking_id / stay_check_in_date / stay_check_out_date / stay_nights

// ============================================================
// user_points 테이블 (migration 0130 + repair-schema 보강)
// ⚠️ user_id 는 TEXT (Firebase UID / 카카오 user_id 등 다양한 형태)
// ============================================================
export interface UserPointsTable {
  user_id: string                  // TEXT PRIMARY KEY
  balance: number                  // INTEGER NOT NULL DEFAULT 0
  total_charged: number            // INTEGER NOT NULL DEFAULT 0
  total_donated: number            // INTEGER NOT NULL DEFAULT 0
  // 🛡️ 2026-05-23: repair-schema 배포로 추가 — 총 사용 누적 (충전 vs 사용 추적).
  total_used: number               // INTEGER DEFAULT 0
  created_at: string
  updated_at: string
}

// ============================================================
// settlements 테이블 (셀러 정산 신청 + 자동 정산 보고서 양쪽 모두 사용)
// 🛡️ 2026-05-23: 신규/자동집계 양쪽 컬럼이 혼재 — repair-schema 로 ALTER 통합.
// ============================================================
export interface SettlementsTable {
  id: number
  seller_id: number                // INTEGER NOT NULL (0 = 시스템 집계 마커)
  period_start: string             // 'YYYY-MM-DD'
  period_end: string               // 'YYYY-MM-DD'
  status: string                   // 'pending'|'approved'|'paid'|'rejected'
  // 셀러 정산 신청 입력 (수동 신청 path)
  amount: number | null            // INTEGER — 신청 금액
  bank_name: string | null
  account_number: string | null
  account_holder: string | null
  // 자동 정산 보고서 집계 컬럼 (settlement-automation.ts 가 INSERT)
  total_sales: number              // INTEGER DEFAULT 0
  total_platform_fee: number       // INTEGER DEFAULT 0
  total_settlement: number         // INTEGER DEFAULT 0
  generated_at: string | null      // DATETIME — 보고서 생성 시각
  created_at: string
}

// ============================================================
// donation_settlements 테이블 (후원금 정산 신청)
// ============================================================
export interface DonationSettlementsTable {
  id: number
  seller_id: number                // INTEGER NOT NULL
  total_amount: number             // INTEGER NOT NULL
  commission_amount: number        // INTEGER NOT NULL
  settlement_amount: number        // INTEGER NOT NULL
  donation_count: number           // INTEGER NOT NULL
  status: string                   // 'REQUESTED'|'APPROVED'|'PAID'|'REJECTED'
  bank_info: string | null         // TEXT (JSON)
  // 🛡️ 2026-05-23: repair-schema 배포로 추가 — 본 settlement 에 포함된 donation id 들 JSON 배열.
  donation_ids: string | null      // TEXT (JSON array of donation ids)
  created_at: string
  updated_at: string
}

// ============================================================
// vouchers 테이블 (migration 0146)
// ⚠️ updated_at 컬럼 없음! UPDATE 시 SET updated_at 금지.
// ============================================================
export interface VouchersTable {
  id: number
  order_id: number                 // INTEGER NOT NULL (FK → orders.id)
  product_id: number               // INTEGER NOT NULL (FK → products.id)
  user_id: string                  // TEXT NOT NULL
  code: string                     // TEXT UNIQUE NOT NULL
  status: string                   // 'unused'|'used'|'expired'|'refunded'
  used_at: string | null
  expires_at: string | null
  created_at: string
  applied_discount_pct: number | null   // 0258 migration 등 후속 컬럼 — production 에 존재
}

