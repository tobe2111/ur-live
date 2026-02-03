-- 카카오 로그인을 위한 users 테이블 수정 (phone은 이미 존재)
ALTER TABLE users ADD COLUMN kakao_id TEXT;
ALTER TABLE users ADD COLUMN profile_image TEXT;

-- 배송지 테이블 생성
CREATE TABLE IF NOT EXISTS shipping_addresses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  recipient_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  postal_code TEXT,
  address TEXT NOT NULL,
  address_detail TEXT,
  is_default INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 주문 테이블에 셀러 및 배송지 ID 추가 (shipping_address, shipping_name, shipping_phone은 이미 존재)
ALTER TABLE orders ADD COLUMN seller_id INTEGER;
ALTER TABLE orders ADD COLUMN shipping_address_id INTEGER;
ALTER TABLE orders ADD COLUMN recipient_name TEXT;
ALTER TABLE orders ADD COLUMN recipient_phone TEXT;
ALTER TABLE orders ADD COLUMN shipping_postal_code TEXT;
ALTER TABLE orders ADD COLUMN commission_rate REAL DEFAULT 10.00;
ALTER TABLE orders ADD COLUMN commission_amount INTEGER DEFAULT 0;
ALTER TABLE orders ADD COLUMN seller_amount INTEGER DEFAULT 0;

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_users_kakao_id ON users(kakao_id);
CREATE INDEX IF NOT EXISTS idx_shipping_addresses_user_id ON shipping_addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_seller_id ON orders(seller_id);
