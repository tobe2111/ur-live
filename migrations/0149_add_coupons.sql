-- 쿠폰 시스템
CREATE TABLE IF NOT EXISTS coupons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('percent', 'fixed')),
  value INTEGER NOT NULL,
  min_order_amount INTEGER DEFAULT 0,
  max_discount INTEGER,
  total_count INTEGER DEFAULT 0,
  used_count INTEGER DEFAULT 0,
  seller_id INTEGER,
  is_active INTEGER DEFAULT 1,
  starts_at DATETIME,
  expires_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS coupon_uses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  coupon_id INTEGER NOT NULL,
  user_id TEXT NOT NULL,
  order_id INTEGER,
  discount_amount INTEGER NOT NULL,
  used_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(coupon_id, user_id)
);

-- 셀러 팔로우
CREATE TABLE IF NOT EXISTS seller_follows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  seller_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, seller_id)
);

-- 알림 센터
CREATE TABLE IF NOT EXISTS user_notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  link TEXT,
  is_read INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_notifications_user ON user_notifications(user_id, is_read);
