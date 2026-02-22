-- 정산 시스템 테이블
-- 작성일: 2026-02-22
-- 설명: 자동 정산 계산 및 보고서 생성

-- 1. 정산 마스터 테이블
CREATE TABLE IF NOT EXISTS settlements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  period_start DATE NOT NULL,           -- 정산 시작일
  period_end DATE NOT NULL,             -- 정산 종료일
  total_sales INTEGER NOT NULL,         -- 총 매출
  total_platform_fee INTEGER NOT NULL,  -- 총 플랫폼 수수료
  total_settlement INTEGER NOT NULL,    -- 총 정산 금액
  status TEXT DEFAULT 'pending',        -- pending, completed, cancelled
  generated_at DATETIME NOT NULL,       -- 생성 시각
  completed_at DATETIME,                -- 완료 시각
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_settlements_period ON settlements(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_settlements_status ON settlements(status);

-- 2. 정산 상세 테이블 (셀러별)
CREATE TABLE IF NOT EXISTS settlement_details (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  settlement_id INTEGER NOT NULL,
  seller_id INTEGER NOT NULL,
  total_sales INTEGER NOT NULL,        -- 매출
  total_orders INTEGER NOT NULL,       -- 주문 건수
  platform_fee INTEGER NOT NULL,       -- 플랫폼 수수료
  shipping_fee INTEGER NOT NULL,       -- 배송비 수입
  refund_amount INTEGER NOT NULL,      -- 환불 금액
  settlement_amount INTEGER NOT NULL,  -- 정산 금액
  status TEXT DEFAULT 'pending',       -- pending, paid, cancelled
  paid_at DATETIME,                    -- 지급 시각
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (settlement_id) REFERENCES settlements(id) ON DELETE CASCADE,
  FOREIGN KEY (seller_id) REFERENCES sellers(id)
);

CREATE INDEX IF NOT EXISTS idx_settlement_details_settlement ON settlement_details(settlement_id);
CREATE INDEX IF NOT EXISTS idx_settlement_details_seller ON settlement_details(seller_id);
CREATE INDEX IF NOT EXISTS idx_settlement_details_status ON settlement_details(status);

-- 3. 정산 이력 테이블
CREATE TABLE IF NOT EXISTS settlement_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  settlement_id INTEGER NOT NULL,
  seller_id INTEGER NOT NULL,
  action TEXT NOT NULL,                -- generated, paid, cancelled
  amount INTEGER NOT NULL,
  note TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (settlement_id) REFERENCES settlements(id) ON DELETE CASCADE,
  FOREIGN KEY (seller_id) REFERENCES sellers(id)
);

CREATE INDEX IF NOT EXISTS idx_settlement_history_settlement ON settlement_history(settlement_id);
CREATE INDEX IF NOT EXISTS idx_settlement_history_seller ON settlement_history(seller_id);
CREATE INDEX IF NOT EXISTS idx_settlement_history_created ON settlement_history(created_at);
