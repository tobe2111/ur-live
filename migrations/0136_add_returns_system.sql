-- 0136_add_returns_system.sql
-- 반품/환불 시스템 테이블

CREATE TABLE IF NOT EXISTS returns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  order_number TEXT NOT NULL,
  user_id TEXT NOT NULL,
  seller_id INTEGER,
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','approved','rejected','shipped','received','inspected','refunded','cancelled')),
  reason TEXT NOT NULL,
  detail_reason TEXT,
  return_shipping_company TEXT,
  return_tracking_number TEXT,
  inspection_result TEXT CHECK (inspection_result IN ('approved','rejected')),
  inspection_notes TEXT,
  refund_amount INTEGER NOT NULL DEFAULT 0,
  refund_method TEXT DEFAULT 'original',
  requested_at DATETIME DEFAULT (datetime('now')),
  approved_at DATETIME,
  shipped_at DATETIME,
  received_at DATETIME,
  inspected_at DATETIME,
  refunded_at DATETIME,
  FOREIGN KEY (order_id) REFERENCES orders(id)
);
CREATE INDEX IF NOT EXISTS idx_returns_order ON returns(order_id);
CREATE INDEX IF NOT EXISTS idx_returns_user ON returns(user_id);
CREATE INDEX IF NOT EXISTS idx_returns_seller ON returns(seller_id, status);
