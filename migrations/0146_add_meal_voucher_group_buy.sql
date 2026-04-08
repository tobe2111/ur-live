-- 식사권 공동구매 서비스: products 테이블 확장
-- 기존 products 테이블에 컬럼만 추가 (새 테이블 불필요)

-- 식당 정보
ALTER TABLE products ADD COLUMN restaurant_name TEXT;
ALTER TABLE products ADD COLUMN restaurant_address TEXT;
ALTER TABLE products ADD COLUMN restaurant_phone TEXT;
ALTER TABLE products ADD COLUMN restaurant_lat REAL;
ALTER TABLE products ADD COLUMN restaurant_lng REAL;

-- 식사권 정보
ALTER TABLE products ADD COLUMN voucher_expiry DATE;
ALTER TABLE products ADD COLUMN voucher_terms TEXT;

-- 공동구매 정보
ALTER TABLE products ADD COLUMN group_buy_target INTEGER DEFAULT 0;
ALTER TABLE products ADD COLUMN group_buy_current INTEGER DEFAULT 0;
ALTER TABLE products ADD COLUMN group_buy_deadline DATETIME;
ALTER TABLE products ADD COLUMN group_buy_status TEXT DEFAULT 'active' CHECK (group_buy_status IN ('active', 'achieved', 'expired', 'cancelled'));

-- 바우처 코드 테이블
CREATE TABLE IF NOT EXISTS vouchers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  user_id TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'unused' CHECK (status IN ('unused', 'used', 'expired', 'refunded')),
  used_at DATETIME,
  expires_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE INDEX IF NOT EXISTS idx_vouchers_code ON vouchers(code);
CREATE INDEX IF NOT EXISTS idx_vouchers_user ON vouchers(user_id);
CREATE INDEX IF NOT EXISTS idx_vouchers_order ON vouchers(order_id);
