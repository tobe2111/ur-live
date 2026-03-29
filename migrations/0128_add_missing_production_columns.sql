-- ============================================================
-- Migration 0128: 프로덕션 D1 누락 항목 일괄 추가
-- D1 콘솔에서 각 구문을 하나씩 실행하세요.
-- 이미 존재하는 항목은 에러 무시하고 다음 구문 실행.
-- ============================================================

-- ── live_streams 테이블 (001_initial.sql에 없음) ──────────────────────────────
CREATE TABLE IF NOT EXISTS live_streams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seller_id INTEGER REFERENCES sellers(id),
  title TEXT NOT NULL,
  description TEXT,
  youtube_video_id TEXT,
  status TEXT DEFAULT 'scheduled' CHECK(status IN ('scheduled', 'live', 'ended')),
  current_product_id INTEGER,
  viewer_count INTEGER DEFAULT 0,
  stream_key TEXT,
  rtmp_url TEXT,
  scheduled_at DATETIME,
  started_at DATETIME,
  ended_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ── orders 테이블 누락 컬럼들 ─────────────────────────────────────────────────
ALTER TABLE orders ADD COLUMN payment_status TEXT DEFAULT 'pending';
ALTER TABLE orders ADD COLUMN seller_id INTEGER;
ALTER TABLE orders ADD COLUMN settlement_status TEXT DEFAULT 'pending';
ALTER TABLE orders ADD COLUMN settled_at DATETIME;
ALTER TABLE orders ADD COLUMN order_number TEXT;
ALTER TABLE orders ADD COLUMN courier TEXT;
ALTER TABLE orders ADD COLUMN tracking_number TEXT;
ALTER TABLE orders ADD COLUMN shipped_at DATETIME;
ALTER TABLE orders ADD COLUMN delivered_at DATETIME;
ALTER TABLE orders ADD COLUMN recipient_name TEXT;
ALTER TABLE orders ADD COLUMN recipient_phone TEXT;
ALTER TABLE orders ADD COLUMN shipping_postal_code TEXT;
ALTER TABLE orders ADD COLUMN shipping_address TEXT;
ALTER TABLE orders ADD COLUMN shipping_address_detail TEXT;
ALTER TABLE orders ADD COLUMN commission_rate REAL DEFAULT 10.0;
ALTER TABLE orders ADD COLUMN commission_amount INTEGER DEFAULT 0;
ALTER TABLE orders ADD COLUMN seller_amount INTEGER DEFAULT 0;

-- ── sellers 테이블 누락 컬럼들 ───────────────────────────────────────────────
ALTER TABLE sellers ADD COLUMN commission_rate REAL DEFAULT 10.0;
ALTER TABLE sellers ADD COLUMN can_manipulate_stats INTEGER DEFAULT 0;
ALTER TABLE sellers ADD COLUMN donation_commission_rate REAL DEFAULT 15.0;
ALTER TABLE sellers ADD COLUMN display_name TEXT;
ALTER TABLE sellers ADD COLUMN profile_image TEXT;
ALTER TABLE sellers ADD COLUMN bio TEXT;
ALTER TABLE sellers ADD COLUMN sns_instagram TEXT;
ALTER TABLE sellers ADD COLUMN sns_youtube TEXT;
ALTER TABLE sellers ADD COLUMN sns_facebook TEXT;
ALTER TABLE sellers ADD COLUMN sns_twitter TEXT;
ALTER TABLE sellers ADD COLUMN website_url TEXT;
ALTER TABLE sellers ADD COLUMN kakao_chat_url TEXT;
ALTER TABLE sellers ADD COLUMN youtube_email TEXT;
ALTER TABLE sellers ADD COLUMN bank_account TEXT;
ALTER TABLE sellers ADD COLUMN bank_name TEXT;
ALTER TABLE sellers ADD COLUMN account_holder TEXT;
ALTER TABLE sellers ADD COLUMN description TEXT;
ALTER TABLE sellers ADD COLUMN address TEXT;
ALTER TABLE sellers ADD COLUMN address_detail TEXT;
ALTER TABLE sellers ADD COLUMN is_active INTEGER DEFAULT 1;
ALTER TABLE sellers ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP;

-- ── seller_business_info 테이블 (없으면 생성) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS seller_business_info (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seller_id INTEGER NOT NULL,
  business_number TEXT,
  business_name TEXT,
  ceo_name TEXT,
  business_type TEXT,
  business_category TEXT,
  postal_code TEXT,
  address TEXT,
  address_detail TEXT,
  phone TEXT,
  email TEXT,
  is_verified INTEGER DEFAULT 0,
  verified_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (seller_id) REFERENCES sellers(id)
);

-- ── seller_credits 테이블 ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS seller_credits (
  seller_id INTEGER PRIMARY KEY,
  balance INTEGER NOT NULL DEFAULT 0,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (seller_id) REFERENCES sellers(id)
);

-- ── credit_transactions 테이블 ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS credit_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seller_id INTEGER NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('charge', 'deduct', 'refund')),
  amount INTEGER NOT NULL,
  price_paid INTEGER,
  description TEXT,
  payment_key TEXT UNIQUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (seller_id) REFERENCES sellers(id)
);

-- ── alimtalk_logs 테이블 ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS alimtalk_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seller_id INTEGER,
  receiver TEXT,
  template_code TEXT,
  message TEXT,
  order_id TEXT,
  success INTEGER DEFAULT 0,
  error_msg TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ── alimtalk_packages 테이블 ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS alimtalk_packages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  label TEXT NOT NULL,
  credits INTEGER NOT NULL,
  price INTEGER NOT NULL,
  is_active INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0
);

-- ── donations 테이블 ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS donations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  donor_user_id TEXT,
  seller_id INTEGER NOT NULL,
  live_stream_id INTEGER,
  amount INTEGER NOT NULL,
  commission_rate REAL DEFAULT 0.15,
  commission_amount INTEGER DEFAULT 0,
  seller_amount INTEGER DEFAULT 0,
  message TEXT,
  donor_name TEXT DEFAULT '익명',
  is_anonymous INTEGER DEFAULT 0,
  status TEXT DEFAULT 'DONE' CHECK(status IN ('DONE', 'REFUNDED')),
  toss_payment_key TEXT,
  toss_order_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ── donation_settlements 테이블 ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS donation_settlements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seller_id INTEGER NOT NULL,
  total_amount INTEGER NOT NULL DEFAULT 0,
  commission_amount INTEGER NOT NULL DEFAULT 0,
  settlement_amount INTEGER NOT NULL DEFAULT 0,
  donation_count INTEGER NOT NULL DEFAULT 0,
  bank_info TEXT,
  status TEXT DEFAULT 'REQUESTED' CHECK(status IN ('REQUESTED', 'DONE', 'REJECTED')),
  admin_memo TEXT,
  requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  settled_at DATETIME,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (seller_id) REFERENCES sellers(id)
);

-- ── rate_limit_attempts 테이블 ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rate_limit_attempts (
  key TEXT NOT NULL,
  action TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL DEFAULT 1,
  UNIQUE(key, action, window_start)
);

-- ── admin_audit_logs 테이블 ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id TEXT NOT NULL,
  admin_email TEXT,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  before_value TEXT,
  after_value TEXT,
  ip TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── 기본 alimtalk 패키지 데이터 (없으면 추가) ────────────────────────────────
INSERT OR IGNORE INTO alimtalk_packages (id, label, credits, price, is_active, sort_order)
VALUES
  (1, '기본 100건', 100, 2500, 1, 1),
  (2, '스탠다드 500건', 500, 12500, 1, 2),
  (3, '프리미엄 1000건', 1000, 25000, 1, 3),
  (4, '비즈니스 3000건', 3000, 75000, 1, 4);
