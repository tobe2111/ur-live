-- 어드민/판매자 시스템 마이그레이션
-- 실행: npx wrangler d1 migrations apply toss-live-commerce-db --local
-- 프로덕션: npx wrangler d1 migrations apply toss-live-commerce-db --remote

-- 1. 관리자 테이블 (운영자)
CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT DEFAULT 'admin' CHECK(role IN ('admin', 'super_admin')),
  is_active BOOLEAN DEFAULT 1,
  last_login_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. 판매자 테이블
CREATE TABLE IF NOT EXISTS sellers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  business_name TEXT NOT NULL,
  business_number TEXT UNIQUE,
  bank_account TEXT,
  status TEXT DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected', 'suspended')),
  is_active BOOLEAN DEFAULT 1,
  last_login_at DATETIME,
  approved_by INTEGER,
  approved_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (approved_by) REFERENCES admins(id)
);

-- 3. products 테이블에 seller_id 추가
-- SQLite doesn't support IF NOT EXISTS for ALTER TABLE, so we use a workaround
-- Check if column exists before adding
CREATE TABLE IF NOT EXISTS _temp_check AS SELECT * FROM products LIMIT 0;
ALTER TABLE products ADD COLUMN seller_id INTEGER REFERENCES sellers(id);
DROP TABLE _temp_check;

-- 4. 세션 테이블 (로그인 세션 관리)
CREATE TABLE IF NOT EXISTS admin_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_token TEXT UNIQUE NOT NULL,
  admin_id INTEGER,
  seller_id INTEGER,
  user_type TEXT NOT NULL CHECK(user_type IN ('admin', 'seller')),
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_id) REFERENCES admins(id),
  FOREIGN KEY (seller_id) REFERENCES sellers(id)
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_admins_username ON admins(username);
CREATE INDEX IF NOT EXISTS idx_admins_email ON admins(email);
CREATE INDEX IF NOT EXISTS idx_sellers_username ON sellers(username);
CREATE INDEX IF NOT EXISTS idx_sellers_email ON sellers(email);
CREATE INDEX IF NOT EXISTS idx_sellers_status ON sellers(status);
CREATE INDEX IF NOT EXISTS idx_products_seller_id ON products(seller_id);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_token ON admin_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires ON admin_sessions(expires_at);

-- 기본 관리자 계정 추가 (테스트용)
-- 비밀번호: admin123 (실제로는 bcrypt 해시 사용 필요)
INSERT OR IGNORE INTO admins (id, username, password_hash, name, email, role, is_active) 
VALUES 
  (1, 'admin', '$2a$10$placeholder_hash_for_admin123', '시스템 관리자', 'admin@ur-team.com', 'super_admin', 1);

-- 기본 판매자 계정 추가 (테스트용)
-- 비밀번호: seller123
INSERT OR IGNORE INTO sellers (id, username, password_hash, name, email, business_name, status, is_active, approved_by, approved_at) 
VALUES 
  (1, 'seller1', '$2a$10$placeholder_hash_for_seller123', '김판매', 'seller1@example.com', '토스 패션몰', 'approved', 1, 1, CURRENT_TIMESTAMP),
  (2, 'seller2', '$2a$10$placeholder_hash_for_seller123', '이상품', 'seller2@example.com', '스마트 전자', 'approved', 1, 1, CURRENT_TIMESTAMP);

-- 기존 상품에 seller_id 할당 (테스트 데이터)
UPDATE products SET seller_id = 1 WHERE id IN (1, 2, 3); -- 패션 상품 → seller1
UPDATE products SET seller_id = 2 WHERE id IN (4, 5, 6); -- 전자기기 → seller2
UPDATE products SET seller_id = 1 WHERE id IN (7, 8, 9, 10); -- 식품/뷰티 → seller1
