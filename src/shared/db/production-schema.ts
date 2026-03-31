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
  status: string                // 'scheduled' | 'live' | 'ended'
  current_product_id: number | null
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
  is_active: number
  commission_rate: number       // REAL DEFAULT 10.00
  created_at: string
  updated_at: string
}
