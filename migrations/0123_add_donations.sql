-- ============================================================
-- Migration 0123: Live Stream Donations
-- 라이브 중 시청자 → 셀러 후원 시스템
-- 후원금의 90%가 셀러 알림톡 크레딧으로 전환 (10% 플랫폼 수수료)
-- ============================================================

CREATE TABLE IF NOT EXISTS donations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  -- 후원 정보
  donor_user_id INTEGER NOT NULL,          -- 후원한 시청자
  donor_name TEXT NOT NULL,                -- 후원자 표시명
  seller_id INTEGER NOT NULL,              -- 받는 셀러
  live_stream_id INTEGER NOT NULL,         -- 후원한 라이브 스트림
  -- 금액
  amount INTEGER NOT NULL,                 -- 후원 금액 (원)
  commission_rate REAL DEFAULT 0.10,       -- 플랫폼 수수료율 (10%)
  commission_amount INTEGER NOT NULL,      -- 수수료 금액
  credit_amount INTEGER NOT NULL,          -- 셀러에게 적립된 크레딧 금액 (원)
  -- 메시지
  message TEXT DEFAULT '',                 -- 후원 메시지
  -- 결제
  payment_key TEXT,                        -- 토스페이먼츠 paymentKey
  order_id TEXT UNIQUE NOT NULL,           -- 고유 주문번호 (DON-xxxxx)
  payment_status TEXT DEFAULT 'pending'    -- pending, completed, failed, refunded
    CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded')),
  -- 타임스탬프
  created_at DATETIME DEFAULT (datetime('now')),
  completed_at DATETIME,
  FOREIGN KEY (donor_user_id) REFERENCES users(id),
  FOREIGN KEY (seller_id) REFERENCES sellers(id),
  FOREIGN KEY (live_stream_id) REFERENCES live_streams(id)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_donations_seller ON donations(seller_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_donations_stream ON donations(live_stream_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_donations_donor ON donations(donor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_donations_order ON donations(order_id);
