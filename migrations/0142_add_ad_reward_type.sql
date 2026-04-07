-- 광고 리워드 타입 추가를 위해 point_transactions 테이블 재생성
-- SQLite는 ALTER TABLE로 CHECK 제약 변경이 안 되므로 테이블 재생성 필요

-- 기존 데이터 백업
CREATE TABLE IF NOT EXISTS point_transactions_backup AS SELECT * FROM point_transactions;

-- 기존 테이블 삭제
DROP TABLE IF EXISTS point_transactions;

-- 새 CHECK 제약 조건으로 재생성
CREATE TABLE point_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('charge', 'donate', 'refund', 'ad_reward')),
  amount INTEGER DEFAULT 0,
  commission_amount INTEGER DEFAULT 0,
  points_amount INTEGER DEFAULT 0,
  balance_after INTEGER DEFAULT 0,
  description TEXT,
  payment_key TEXT,
  order_id TEXT,
  stream_id INTEGER,
  seller_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES user_points(user_id)
);

-- 데이터 복원
INSERT INTO point_transactions SELECT * FROM point_transactions_backup;

-- 백업 삭제
DROP TABLE point_transactions_backup;

-- 인덱스 재생성
CREATE INDEX IF NOT EXISTS idx_point_transactions_user ON point_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_point_transactions_type ON point_transactions(type);
