/**
 * Drizzle ORM Schema — Production D1 SSOT 매핑
 *
 * 이 파일은 `src/shared/db/production-schema.ts` 의 TypeScript interface 를
 * Drizzle sqliteTable() 로 1:1 매핑합니다.
 *
 * ⚠️ 절대 룰:
 *   1. 컬럼명은 production-schema.ts 와 **완전히 동일** (snake_case 유지).
 *   2. 새 컬럼 추가 금지 — production-schema.ts 가 SSOT.
 *   3. JS 측 필드명도 snake_case 유지 (production-schema interface 와 호환).
 *   4. 스키마 변경 시 production-schema.ts 먼저 수정 → 이 파일 동기화.
 *
 * 도입 배경 (2026-05-23):
 *   - 일주일 동안 SQL 문자열 컬럼 mismatch 로 500 사고 다수 발생
 *     (no such column: address, total_price, recipient_phone, ...).
 *   - SQL 문자열 + production-schema.ts interface 가 컴파일 시 검증 안 됨.
 *   - Drizzle 도입으로 컴파일 에러로 컬럼 mismatch 영구 차단.
 */

import { sqliteTable, integer, real, text } from 'drizzle-orm/sqlite-core'

// ============================================================
// orders 테이블 (OrdersTable)
// ============================================================
export const orders = sqliteTable('orders', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  order_number: text('order_number').notNull().unique(),
  user_id: integer('user_id').notNull(),
  total_amount: integer('total_amount').notNull(),
  payment_key: text('payment_key'),
  payment_status: text('payment_status'),
  shipping_address: text('shipping_address'),
  shipping_name: text('shipping_name'),
  shipping_phone: text('shipping_phone'),
  live_stream_id: integer('live_stream_id'),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
  shipping_memo: text('shipping_memo'),
  courier: text('courier'),
  tracking_number: text('tracking_number'),
  shipped_at: text('shipped_at'),
  delivered_at: text('delivered_at'),
  seller_id: integer('seller_id'),
  commission_rate: real('commission_rate').notNull().default(10.0),
  commission_amount: integer('commission_amount').notNull().default(0),
  seller_amount: integer('seller_amount').notNull().default(0),
  cancelled_at: text('cancelled_at'),
  cancel_reason: text('cancel_reason'),
  settlement_status: text('settlement_status').notNull().default('pending'),
  settled_at: text('settled_at'),
  subtotal: integer('subtotal').notNull().default(0),
  shipping_fee: integer('shipping_fee').notNull().default(0),
  discount_amount: integer('discount_amount').notNull().default(0),
  currency: text('currency').notNull().default('KRW'),
  idempotency_key: text('idempotency_key'),
  locale: text('locale').notNull().default('ko'),
  toss_order_id: text('toss_order_id'),
  toss_payment_key: text('toss_payment_key'),
  payment_method: text('payment_method'),
  paid_at: text('paid_at'),
  status: text('status').notNull().default('PENDING'),
  shipping_company: text('shipping_company'),
  recipient_name: text('recipient_name'),
  recipient_phone: text('recipient_phone'),
  shipping_postal_code: text('shipping_postal_code'),
  refunded_amount: integer('refunded_amount').notNull().default(0),
})

// ============================================================
// order_refund_history 테이블 (OrderRefundHistoryTable)
// ============================================================
export const order_refund_history = sqliteTable('order_refund_history', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  order_id: integer('order_id').notNull(),
  amount: integer('amount').notNull(),
  reason: text('reason'),
  toss_transaction_key: text('toss_transaction_key'),
  created_at: text('created_at').notNull(),
})

// ============================================================
// order_items 테이블 (OrderItemsTable)
// ⚠️ created_at, updated_at 컬럼 없음!
// ============================================================
export const order_items = sqliteTable('order_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  order_id: integer('order_id').notNull(),
  product_id: integer('product_id').notNull(),
  option_id: integer('option_id'),
  quantity: integer('quantity').notNull(),
  price: integer('price').notNull(),
  product_name: text('product_name').notNull(),
  option_info: text('option_info'),
  product_image: text('product_image'),
  seller_id: integer('seller_id'),
  unit_price: integer('unit_price').notNull().default(0),
  subtotal: integer('subtotal').notNull().default(0),
  currency: text('currency').notNull().default('KRW'),
  options: text('options').notNull().default('{}'),
  status: text('status').notNull().default('PENDING'),
})

// ============================================================
// products 테이블 (ProductsTable)
// ⚠️ stock (NOT stock_quantity), is_active (NOT status)
// ============================================================
export const products = sqliteTable('products', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  description: text('description'),
  price: integer('price').notNull(),
  original_price: integer('original_price'),
  discount_rate: integer('discount_rate').notNull().default(0),
  image_url: text('image_url'),
  stock: integer('stock').notNull().default(0),
  category: text('category'),
  live_stream_id: integer('live_stream_id'),
  is_active: integer('is_active').notNull().default(1),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
  seller_id: integer('seller_id'),
  version: integer('version').notNull().default(0),
  detail_images: text('detail_images'),
  sold_count: integer('sold_count').notNull().default(0),
  view_count: integer('view_count').notNull().default(0),
  avg_rating: real('avg_rating').notNull().default(0),
  review_count: integer('review_count').notNull().default(0),
  referral_enabled: integer('referral_enabled').default(0),
  referral_commission_rate: real('referral_commission_rate'),
  long_description: text('long_description'),
  compare_at_price: integer('compare_at_price'),
})

// ============================================================
// donations 테이블 (DonationsTable)
// ============================================================
export const donations = sqliteTable('donations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  donor_user_id: integer('donor_user_id').notNull(),
  donor_name: text('donor_name').notNull(),
  seller_id: integer('seller_id').notNull(),
  live_stream_id: integer('live_stream_id').notNull(),
  amount: integer('amount').notNull(),
  commission_rate: real('commission_rate').notNull().default(0.10),
  commission_amount: integer('commission_amount').notNull(),
  credit_amount: integer('credit_amount').notNull(),
  message: text('message').notNull().default(''),
  payment_key: text('payment_key'),
  order_id: text('order_id').notNull().unique(),
  payment_status: text('payment_status').notNull().default('pending'),
  created_at: text('created_at').notNull(),
  completed_at: text('completed_at'),
})

// ============================================================
// live_streams 테이블 (LiveStreamsTable)
// ============================================================
export const live_streams = sqliteTable('live_streams', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  description: text('description'),
  youtube_video_id: text('youtube_video_id').notNull(),
  youtube_broadcast_id: text('youtube_broadcast_id'),
  youtube_stream_key: text('youtube_stream_key'),
  youtube_live_chat_id: text('youtube_live_chat_id'),
  rtmp_url: text('rtmp_url'),
  rtmp_key: text('rtmp_key'),
  youtube_embed_url: text('youtube_embed_url'),
  thumbnail_url: text('thumbnail_url'),
  custom_thumbnail_url: text('custom_thumbnail_url'),
  status: text('status').notNull(),
  current_product_id: integer('current_product_id'),
  current_viewers: integer('current_viewers'),
  total_viewers: integer('total_viewers'),
  peak_viewers: integer('peak_viewers'),
  like_count: integer('like_count'),
  last_error: text('last_error'),
  started_at: text('started_at'),
  disconnected_at: text('disconnected_at'),
  whip_url: text('whip_url'),
  ended_at: text('ended_at'),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
  seller_id: integer('seller_id'),
  scheduled_at: text('scheduled_at'),
  seller_instagram: text('seller_instagram'),
  seller_youtube: text('seller_youtube'),
})

// ============================================================
// sellers 테이블 (SellersTable)
// ============================================================
export const sellers = sqliteTable('sellers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull(),
  password_hash: text('password_hash').notNull(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  phone: text('phone'),
  business_name: text('business_name').notNull(),
  business_number: text('business_number'),
  bank_account: text('bank_account'),
  status: text('status').notNull(),
  seller_type: text('seller_type').notNull().default('influencer'),
  can_broadcast: integer('can_broadcast').notNull().default(1),
  is_active: integer('is_active').notNull().default(1),
  commission_rate: real('commission_rate').notNull().default(10.0),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
})

// ============================================================
// shipping_addresses 테이블 (ShippingAddressesTable)
// ============================================================
export const shipping_addresses = sqliteTable('shipping_addresses', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  user_id: integer('user_id').notNull(),
  recipient_name: text('recipient_name').notNull(),
  phone: text('phone').notNull(),
  postal_code: text('postal_code').notNull(),
  address: text('address').notNull(),
  address_detail: text('address_detail'),
  is_default: integer('is_default').notNull().default(0),
  country: text('country'),
  state: text('state'),
  city: text('city'),
  label: text('label'),
  delivery_note: text('delivery_note'),
  entry_code: text('entry_code'),
  entry_method: text('entry_method'),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
})

// ============================================================
// stay_voucher 8 tables (migration 0258, 2026-05-18)
// ============================================================
export const product_stay_info = sqliteTable('product_stay_info', {
  product_id: integer('product_id').primaryKey(),
  property_type: text('property_type').notNull(),
  star_rating: integer('star_rating'),
  total_rooms: integer('total_rooms').notNull(),
  check_in_time: text('check_in_time').notNull().default('15:00'),
  check_out_time: text('check_out_time').notNull().default('11:00'),
  address: text('address'),
  region_sido: text('region_sido'),
  region_sigungu: text('region_sigungu'),
  latitude: real('latitude'),
  longitude: real('longitude'),
  amenities: text('amenities'),
  room_amenities: text('room_amenities'),
  cancellation_policy: text('cancellation_policy').notNull(),
  custom_cancellation_text: text('custom_cancellation_text'),
  house_rules: text('house_rules'),
  check_in_instructions: text('check_in_instructions'),
  description_full: text('description_full'),
  nearby_attractions: text('nearby_attractions'),
  min_nights: integer('min_nights').notNull(),
  max_nights: integer('max_nights'),
  advance_booking_days: integer('advance_booking_days').notNull(),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
})

export const product_stay_rooms = sqliteTable('product_stay_rooms', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  product_id: integer('product_id').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  display_order: integer('display_order').notNull(),
  base_guests: integer('base_guests').notNull(),
  max_guests: integer('max_guests').notNull(),
  extra_guest_fee: integer('extra_guest_fee').notNull(),
  bed_config: text('bed_config'),
  room_size_sqm: real('room_size_sqm'),
  base_price_weekday: integer('base_price_weekday').notNull(),
  base_price_weekend: integer('base_price_weekend').notNull(),
  base_price_holiday: integer('base_price_holiday'),
  total_inventory: integer('total_inventory').notNull(),
  amenities: text('amenities'),
  image_urls: text('image_urls'),
  is_active: integer('is_active').notNull(),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
})

export const product_stay_calendar = sqliteTable('product_stay_calendar', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  room_id: integer('room_id').notNull(),
  product_id: integer('product_id').notNull(),
  stay_date: text('stay_date').notNull(),
  available_count: integer('available_count').notNull(),
  price_override: integer('price_override'),
  is_blocked: integer('is_blocked').notNull(),
  blocked_reason: text('blocked_reason'),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
})

export const stay_bookings = sqliteTable('stay_bookings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  order_id: integer('order_id').notNull(),
  product_id: integer('product_id').notNull(),
  room_id: integer('room_id').notNull(),
  seller_id: integer('seller_id').notNull(),
  user_id: integer('user_id').notNull(),
  check_in_date: text('check_in_date').notNull(),
  check_out_date: text('check_out_date').notNull(),
  nights: integer('nights').notNull(),
  guest_count: integer('guest_count').notNull(),
  guest_name: text('guest_name').notNull(),
  guest_phone: text('guest_phone').notNull(),
  guest_email: text('guest_email'),
  special_request: text('special_request'),
  room_total: integer('room_total').notNull(),
  extra_guest_fee: integer('extra_guest_fee').notNull(),
  cleaning_fee: integer('cleaning_fee').notNull(),
  tax_amount: integer('tax_amount').notNull(),
  total_amount: integer('total_amount').notNull(),
  status: text('status').notNull(),
  check_in_code: text('check_in_code'),
  checked_in_at: text('checked_in_at'),
  checked_in_by: integer('checked_in_by'),
  checked_out_at: text('checked_out_at'),
  cancelled_at: text('cancelled_at'),
  cancellation_reason: text('cancellation_reason'),
  refund_amount: integer('refund_amount'),
  refunded_at: text('refunded_at'),
  no_show_marked_at: text('no_show_marked_at'),
  no_show_marked_by: integer('no_show_marked_by'),
  dispute_id: integer('dispute_id'),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
})

export const stay_booking_reviews = sqliteTable('stay_booking_reviews', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  booking_id: integer('booking_id').notNull().unique(),
  product_id: integer('product_id').notNull(),
  user_id: integer('user_id').notNull(),
  rating_cleanliness: integer('rating_cleanliness'),
  rating_location: integer('rating_location'),
  rating_service: integer('rating_service'),
  rating_facility: integer('rating_facility'),
  rating_value: integer('rating_value'),
  rating_overall: integer('rating_overall').notNull(),
  title: text('title'),
  comment: text('comment'),
  photos: text('photos'),
  seller_reply: text('seller_reply'),
  seller_replied_at: text('seller_replied_at'),
  is_visible: integer('is_visible').notNull(),
  is_verified: integer('is_verified').notNull(),
  helpful_count: integer('helpful_count').notNull(),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
})

export const stay_property_amenities = sqliteTable('stay_property_amenities', {
  code: text('code').primaryKey(),
  label_ko: text('label_ko').notNull(),
  label_en: text('label_en').notNull(),
  icon_emoji: text('icon_emoji'),
  category: text('category').notNull(),
  display_order: integer('display_order').notNull(),
  is_active: integer('is_active').notNull(),
})

export const stay_booking_status_log = sqliteTable('stay_booking_status_log', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  booking_id: integer('booking_id').notNull(),
  prev_status: text('prev_status'),
  new_status: text('new_status').notNull(),
  changed_by_role: text('changed_by_role').notNull(),
  changed_by_id: integer('changed_by_id'),
  reason: text('reason'),
  created_at: text('created_at').notNull(),
})

// ============================================================
// seller_deal_balances / seller_deal_transactions (migration 0257)
// ============================================================
export const seller_deal_balances = sqliteTable('seller_deal_balances', {
  seller_id: integer('seller_id').primaryKey(),
  gated_deal_amount: integer('gated_deal_amount').notNull(),
  redeemable_deal_amount: integer('redeemable_deal_amount').notNull(),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
})

export const seller_deal_transactions = sqliteTable('seller_deal_transactions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  seller_id: integer('seller_id').notNull(),
  amount: integer('amount').notNull(),
  bucket: text('bucket').notNull(),
  type: text('type').notNull(),
  reference_id: text('reference_id'),
  memo: text('memo'),
  created_at: text('created_at').notNull(),
})

export const voucher_orders = sqliteTable('voucher_orders', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  seller_id: integer('seller_id').notNull(),
  source: text('source').notNull(),
  goods_code: text('goods_code').notNull(),
  goods_name: text('goods_name').notNull(),
  unit_price: integer('unit_price').notNull(),
  quantity: integer('quantity').notNull(),
  total_amount: integer('total_amount').notNull(),
  recipient_phone: text('recipient_phone').notNull(),
  withholding_amount: integer('withholding_amount').notNull(),
  net_amount: integer('net_amount').notNull(),
  status: text('status').notNull(),
  external_order_id: text('external_order_id'),
  coupon_code: text('coupon_code'),
  failure_reason: text('failure_reason'),
  created_at: text('created_at').notNull(),
  sent_at: text('sent_at'),
  updated_at: text('updated_at').notNull(),
})

export const tax_withholding_log = sqliteTable('tax_withholding_log', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  seller_id: integer('seller_id').notNull(),
  payout_year: integer('payout_year').notNull(),
  payout_month: integer('payout_month').notNull(),
  gross_amount: integer('gross_amount').notNull(),
  withholding_rate: real('withholding_rate').notNull(),
  withholding_amount: integer('withholding_amount').notNull(),
  net_amount: integer('net_amount').notNull(),
  source_type: text('source_type').notNull(),
  source_id: text('source_id'),
  ytd_gross_amount: integer('ytd_gross_amount').notNull(),
  reportable: integer('reportable').notNull(),
  reported_at: text('reported_at'),
  created_at: text('created_at').notNull(),
})

// ============================================================
// user_points 테이블 (UserPointsTable)
// ⚠️ user_id 는 TEXT
// ============================================================
export const user_points = sqliteTable('user_points', {
  user_id: text('user_id').primaryKey(),
  balance: integer('balance').notNull().default(0),
  total_charged: integer('total_charged').notNull().default(0),
  total_donated: integer('total_donated').notNull().default(0),
  total_used: integer('total_used').notNull().default(0),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
})

// ============================================================
// settlements 테이블 (SettlementsTable)
// ============================================================
export const settlements = sqliteTable('settlements', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  seller_id: integer('seller_id').notNull(),
  period_start: text('period_start').notNull(),
  period_end: text('period_end').notNull(),
  status: text('status').notNull(),
  amount: integer('amount'),
  bank_name: text('bank_name'),
  account_number: text('account_number'),
  account_holder: text('account_holder'),
  total_sales: integer('total_sales').notNull().default(0),
  total_platform_fee: integer('total_platform_fee').notNull().default(0),
  total_settlement: integer('total_settlement').notNull().default(0),
  generated_at: text('generated_at'),
  created_at: text('created_at').notNull(),
})

// ============================================================
// donation_settlements 테이블 (DonationSettlementsTable)
// ============================================================
export const donation_settlements = sqliteTable('donation_settlements', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  seller_id: integer('seller_id').notNull(),
  total_amount: integer('total_amount').notNull(),
  commission_amount: integer('commission_amount').notNull(),
  settlement_amount: integer('settlement_amount').notNull(),
  donation_count: integer('donation_count').notNull(),
  status: text('status').notNull(),
  bank_info: text('bank_info'),
  donation_ids: text('donation_ids'),
  created_at: text('created_at').notNull(),
  updated_at: text('updated_at').notNull(),
})

// ============================================================
// vouchers 테이블 (VouchersTable)
// ⚠️ updated_at 컬럼 없음!
// ============================================================
export const vouchers = sqliteTable('vouchers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  order_id: integer('order_id').notNull(),
  product_id: integer('product_id').notNull(),
  user_id: text('user_id').notNull(),
  code: text('code').notNull().unique(),
  status: text('status').notNull(),
  used_at: text('used_at'),
  expires_at: text('expires_at'),
  created_at: text('created_at').notNull(),
  applied_discount_pct: real('applied_discount_pct'),
})

// ============================================================
// Type inference helpers
// ============================================================
export type OrderRow = typeof orders.$inferSelect
export type NewOrderRow = typeof orders.$inferInsert
export type OrderItemRow = typeof order_items.$inferSelect
export type NewOrderItemRow = typeof order_items.$inferInsert
export type ProductRow = typeof products.$inferSelect
export type SellerRow = typeof sellers.$inferSelect
export type DonationRow = typeof donations.$inferSelect
export type LiveStreamRow = typeof live_streams.$inferSelect
