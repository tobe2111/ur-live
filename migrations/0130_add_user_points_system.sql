-- 유저 팀 포인트 시스템
-- 1팀 = 1원 상당, 충전 시 15% 수수료 차감

CREATE TABLE IF NOT EXISTS user_points (
  user_id TEXT PRIMARY KEY,
  balance INTEGER NOT NULL DEFAULT 0,
  total_charged INTEGER NOT NULL DEFAULT 0,
  total_donated INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT (datetime('now')),
  updated_at DATETIME DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS point_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('charge', 'donate', 'refund')),
  amount INTEGER NOT NULL,
  commission_amount INTEGER NOT NULL DEFAULT 0,
  points_amount INTEGER NOT NULL DEFAULT 0,
  balance_after INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  payment_key TEXT,
  order_id TEXT,
  stream_id INTEGER,
  seller_id INTEGER,
  created_at DATETIME DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_point_transactions_user ON point_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_point_transactions_type ON point_transactions(type);
