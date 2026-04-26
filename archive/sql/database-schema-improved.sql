-- ============================================
-- UR-Live Database Schema (IMPROVED)
-- Complete Database Structure with Proper Foreign Key Constraints
-- ============================================

-- ============================================
-- 1. Users Table (일반 사용자)
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  firebase_uid TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  phone TEXT,
  profile_image TEXT,
  is_active INTEGER DEFAULT 1,
  last_login_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 2. Admins Table (관리자)
-- ============================================
CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('super_admin', 'admin')) DEFAULT 'admin',
  is_active INTEGER DEFAULT 1,
  last_login_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 3. Sellers Table (셀러)
-- ============================================
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
  is_active INTEGER DEFAULT 1,
  commission_rate REAL DEFAULT 10.00,
  last_login_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 4. Products Table (상품)
-- ============================================
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seller_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  price REAL NOT NULL,
  stock INTEGER DEFAULT 0,
  image TEXT,
  category TEXT,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (seller_id) REFERENCES sellers(id) ON DELETE CASCADE
);

-- ============================================
-- 5. Orders Table (주문)
-- ============================================
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
  -- 🚨 CASCADE 추가: 유저 삭제 시 주문도 삭제
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  -- ⚠️ RESTRICT: 상품 삭제 시 주문이 있으면 삭제 방지 (데이터 무결성)
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
);

-- ============================================
-- 6. Order Items Table (주문 아이템)
-- ============================================
CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  price REAL NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT
);

-- ============================================
-- 7. Cart Table (장바구니)
-- ============================================
CREATE TABLE IF NOT EXISTS cart (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  options TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- ============================================
-- 8. Shipping Addresses Table (배송지)
-- ============================================
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
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================
-- 9. Live Streams Table (라이브 스트리밍)
-- ============================================
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
  FOREIGN KEY (seller_id) REFERENCES sellers(id) ON DELETE CASCADE
);

-- ============================================
-- 10. Wishlist Table (찜 목록)
-- ============================================
CREATE TABLE IF NOT EXISTS wishlists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  UNIQUE(user_id, product_id)
);

-- ============================================
-- 11. Reviews Table (리뷰)
-- ============================================
CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  order_id INTEGER,
  rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
  comment TEXT,
  images TEXT, -- JSON array of image URLs
  is_verified_purchase INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
);

-- ============================================
-- 12. Notifications Table (알림)
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('order', 'payment', 'shipping', 'promotion', 'system')),
  is_read INTEGER DEFAULT 0,
  link TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ============================================
-- 13. Points Table (포인트)
-- ============================================
CREATE TABLE IF NOT EXISTS points (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  amount INTEGER NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('earn', 'use', 'expire', 'refund')),
  reason TEXT NOT NULL,
  order_id INTEGER,
  expires_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
);

-- ============================================
-- 14. Coupons Table (쿠폰)
-- ============================================
CREATE TABLE IF NOT EXISTS coupons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  discount_type TEXT NOT NULL CHECK(discount_type IN ('percentage', 'fixed')),
  discount_value REAL NOT NULL,
  min_purchase_amount REAL DEFAULT 0,
  max_discount_amount REAL,
  usage_limit INTEGER,
  used_count INTEGER DEFAULT 0,
  valid_from DATETIME NOT NULL,
  valid_until DATETIME NOT NULL,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- 15. User Coupons Table (사용자 쿠폰)
-- ============================================
CREATE TABLE IF NOT EXISTS user_coupons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  coupon_id INTEGER NOT NULL,
  is_used INTEGER DEFAULT 0,
  used_at DATETIME,
  order_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE CASCADE,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
  UNIQUE(user_id, coupon_id)
);

-- ============================================
-- 16. Banners Table (배너)
-- ============================================
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

-- ============================================
-- 17. Stream Products (라이브 스트림 - 상품 연결)
-- ============================================
CREATE TABLE IF NOT EXISTS stream_products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stream_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  display_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (stream_id) REFERENCES live_streams(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  UNIQUE(stream_id, product_id)
);

-- ============================================
-- Indexes for Performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_users_firebase_uid ON users(firebase_uid);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_admins_email ON admins(email);
CREATE INDEX IF NOT EXISTS idx_admins_is_active ON admins(is_active);
CREATE INDEX IF NOT EXISTS idx_sellers_email ON sellers(email);
CREATE INDEX IF NOT EXISTS idx_sellers_status ON sellers(status);
CREATE INDEX IF NOT EXISTS idx_sellers_is_active ON sellers(is_active);
CREATE INDEX IF NOT EXISTS idx_products_seller_id ON products(seller_id);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_product_id ON orders(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_cart_user_id ON cart(user_id);
CREATE INDEX IF NOT EXISTS idx_cart_product_id ON cart(product_id);
CREATE INDEX IF NOT EXISTS idx_shipping_addresses_user_id ON shipping_addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_live_streams_seller_id ON live_streams(seller_id);
CREATE INDEX IF NOT EXISTS idx_live_streams_status ON live_streams(status);
CREATE INDEX IF NOT EXISTS idx_wishlists_user_id ON wishlists(user_id);
CREATE INDEX IF NOT EXISTS idx_wishlists_product_id ON wishlists(product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_product_id ON reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_points_user_id ON points(user_id);
CREATE INDEX IF NOT EXISTS idx_user_coupons_user_id ON user_coupons(user_id);
CREATE INDEX IF NOT EXISTS idx_user_coupons_is_used ON user_coupons(is_used);
CREATE INDEX IF NOT EXISTS idx_stream_products_stream_id ON stream_products(stream_id);
CREATE INDEX IF NOT EXISTS idx_stream_products_product_id ON stream_products(product_id);

-- ============================================
-- Triggers for Updated At
-- ============================================
CREATE TRIGGER IF NOT EXISTS update_users_timestamp 
AFTER UPDATE ON users
BEGIN
  UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_admins_timestamp 
AFTER UPDATE ON admins
BEGIN
  UPDATE admins SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_sellers_timestamp 
AFTER UPDATE ON sellers
BEGIN
  UPDATE sellers SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_products_timestamp 
AFTER UPDATE ON products
BEGIN
  UPDATE products SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_orders_timestamp 
AFTER UPDATE ON orders
BEGIN
  UPDATE orders SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_cart_timestamp 
AFTER UPDATE ON cart
BEGIN
  UPDATE cart SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_shipping_addresses_timestamp 
AFTER UPDATE ON shipping_addresses
BEGIN
  UPDATE shipping_addresses SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_live_streams_timestamp 
AFTER UPDATE ON live_streams
BEGIN
  UPDATE live_streams SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_reviews_timestamp 
AFTER UPDATE ON reviews
BEGIN
  UPDATE reviews SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_banners_timestamp 
AFTER UPDATE ON banners
BEGIN
  UPDATE banners SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
