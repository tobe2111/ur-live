-- ============================================
-- UR-Live Complete Database Init Script
-- Schema + Test Accounts
-- ============================================

-- ============================================
-- Part 1: Create Tables
-- ============================================

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  firebase_uid TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  phone TEXT,
  profile_image TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Admins Table
CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('super_admin', 'admin')) DEFAULT 'admin',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. Sellers Table
CREATE TABLE IF NOT EXISTS sellers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  business_name TEXT NOT NULL,
  business_number TEXT UNIQUE NOT NULL,
  phone TEXT NOT NULL,
  address TEXT,
  description TEXT,
  bank_account TEXT,
  bank_name TEXT,
  account_holder TEXT,
  business_registration_file TEXT,
  tax_email TEXT,
  representative_name TEXT,
  business_address TEXT,
  status TEXT NOT NULL CHECK(status IN ('pending', 'approved', 'suspended', 'rejected')) DEFAULT 'pending',
  commission_rate REAL DEFAULT 10.00,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4. Products Table
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seller_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  price REAL NOT NULL,
  stock INTEGER DEFAULT 0,
  image TEXT,
  category TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (seller_id) REFERENCES sellers(id)
);

-- 5. Orders Table
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  total_price REAL NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled')) DEFAULT 'pending',
  shipping_address TEXT,
  tracking_number TEXT,
  payment_key TEXT,
  payment_method TEXT,
  cancel_reason TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);

-- 6. Cart Table
CREATE TABLE IF NOT EXISTS cart (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  options TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);

-- 7. Shipping Addresses Table
CREATE TABLE IF NOT EXISTS shipping_addresses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  recipient_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  address_detail TEXT,
  postal_code TEXT NOT NULL,
  is_default INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 8. Live Streams Table
CREATE TABLE IF NOT EXISTS live_streams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seller_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  thumbnail TEXT,
  stream_url TEXT,
  youtube_video_id TEXT,
  status TEXT NOT NULL CHECK(status IN ('scheduled', 'live', 'ended')) DEFAULT 'scheduled',
  scheduled_at DATETIME,
  started_at DATETIME,
  ended_at DATETIME,
  viewer_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (seller_id) REFERENCES sellers(id)
);

-- 9. Banners Table
CREATE TABLE IF NOT EXISTS banners (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  image TEXT NOT NULL,
  link TEXT,
  display_order INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  start_date DATETIME,
  end_date DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 10. Wishlist Table
CREATE TABLE IF NOT EXISTS wishlist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (product_id) REFERENCES products(id),
  UNIQUE(user_id, product_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_firebase_uid ON users(firebase_uid);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_admins_email ON admins(email);
CREATE INDEX IF NOT EXISTS idx_sellers_email ON sellers(email);
CREATE INDEX IF NOT EXISTS idx_sellers_status ON sellers(status);
CREATE INDEX IF NOT EXISTS idx_products_seller_id ON products(seller_id);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_product_id ON orders(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_cart_user_id ON cart(user_id);
CREATE INDEX IF NOT EXISTS idx_shipping_addresses_user_id ON shipping_addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_live_streams_seller_id ON live_streams(seller_id);
CREATE INDEX IF NOT EXISTS idx_live_streams_status ON live_streams(status);
CREATE INDEX IF NOT EXISTS idx_wishlist_user_id ON wishlist(user_id);
CREATE INDEX IF NOT EXISTS idx_wishlist_product_id ON wishlist(product_id);

-- ============================================
-- Part 2: Test Accounts
-- ============================================

-- Super Admin Account
INSERT OR IGNORE INTO admins (username, email, password_hash, name, role, created_at)
VALUES ('admin', 'admin@ur-team.com', 'IfqvDOc4FxiF7m9hwgbJwQ==$vSTw9LaDbGKEM/cHnAZ8VpkzmlwP9gfULizMG4tKQXU=', '관리자', 'super_admin', datetime('now'));

-- Approved Seller Account
INSERT OR IGNORE INTO sellers (username, email, password_hash, name, business_name, business_number, phone, status, commission_rate, created_at, updated_at)
VALUES ('testseller', 'seller@ur-team.com', 'itUVt4fdTdIdveuBvEh7iQ==$fiOwHhE6D+RBRi3cEQPsB5hc1z74K6dQYhq3/D+dbKM=', '테스트 셀러', '테스트 상점', '123-45-67890', '010-1234-5678', 'approved', 10.00, datetime('now'), datetime('now'));

-- Moderator Admin Account
INSERT OR IGNORE INTO admins (username, email, password_hash, name, role, created_at)
VALUES ('moderator', 'moderator@ur-team.com', 'IfqvDOc4FxiF7m9hwgbJwQ==$vSTw9LaDbGKEM/cHnAZ8VpkzmlwP9gfULizMG4tKQXU=', '모더레이터', 'admin', datetime('now'));

-- Pending Seller Account
INSERT OR IGNORE INTO sellers (username, email, password_hash, name, business_name, business_number, phone, status, commission_rate, created_at, updated_at)
VALUES ('pendingseller', 'pending@ur-team.com', 'itUVt4fdTdIdveuBvEh7iQ==$fiOwHhE6D+RBRi3cEQPsB5hc1z74K6dQYhq3/D+dbKM=', '대기 셀러', '대기중 상점', '999-88-77666', '010-9999-8888', 'pending', 10.00, datetime('now'), datetime('now'));

-- ============================================
-- Test Accounts Summary
-- ============================================
-- 1. Super Admin: admin@ur-team.com / admin123
-- 2. Approved Seller: seller@ur-team.com / seller123
-- 3. Moderator: moderator@ur-team.com / admin123
-- 4. Pending Seller: pending@ur-team.com / seller123
