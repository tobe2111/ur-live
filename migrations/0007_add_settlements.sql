-- 정산 테이블 생성
CREATE TABLE IF NOT EXISTS settlements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seller_id INTEGER NOT NULL,
  settlement_type TEXT NOT NULL DEFAULT 'daily', -- daily, weekly, monthly
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_orders INTEGER DEFAULT 0,
  total_amount INTEGER DEFAULT 0, -- 총 매출액
  commission_amount INTEGER DEFAULT 0, -- 플랫폼 수수료 (10%)
  net_amount INTEGER DEFAULT 0, -- 셀러 정산 금액 (90%)
  status TEXT DEFAULT 'pending', -- pending, completed, paid
  paid_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (seller_id) REFERENCES sellers(id)
);

-- 정산 상세 항목 테이블
CREATE TABLE IF NOT EXISTS settlement_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  settlement_id INTEGER NOT NULL,
  order_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  amount INTEGER NOT NULL, -- 상품 금액
  commission_amount INTEGER NOT NULL, -- 해당 상품의 수수료
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (settlement_id) REFERENCES settlements(id),
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);

-- 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_settlements_seller_id ON settlements(seller_id);
CREATE INDEX IF NOT EXISTS idx_settlements_period ON settlements(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_settlement_items_settlement_id ON settlement_items(settlement_id);
CREATE INDEX IF NOT EXISTS idx_settlement_items_order_id ON settlement_items(order_id);
