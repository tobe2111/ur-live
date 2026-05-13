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
  seller_type: string           // 'influencer' | 'store_owner' | 'both' — DEFAULT 'influencer'
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

