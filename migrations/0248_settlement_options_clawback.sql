-- 🛡️ 2026-05-16: 정산일자 조절 + 인플 송금방식 선택 + clawback 지원.

-- 1) 인플루언서 송금방식 + 보너스
ALTER TABLE influencer_balances ADD COLUMN payout_method TEXT DEFAULT 'cash';  -- 'cash' / 'deal' / 'mixed'

-- 2) 매장별 정산 주기
ALTER TABLE sellers ADD COLUMN settlement_frequency TEXT DEFAULT 'on_use_plus_7';  -- 'on_use_plus_7' / 'weekly' / 'monthly'
ALTER TABLE sellers ADD COLUMN settlement_day INTEGER DEFAULT 1;  -- monthly 일 때 1~28

-- 3) 인플 송금 정책 (platform_settings)
INSERT INTO platform_settings (key, value, description, updated_at) VALUES
  ('influencer_payout_frequency', 'monthly', '인플 송금 주기 (weekly/biweekly/monthly)', datetime('now')),
  ('influencer_payout_day_of_month', '1', '월간 송금 시 날짜 (1~28)', datetime('now')),
  ('influencer_deal_bonus_pct', '20', '인플이 딜 선택 시 추가 보너스 (%)', datetime('now'))
ON CONFLICT(key) DO NOTHING;

-- 4) 인플 분쟁 (선택)
CREATE TABLE IF NOT EXISTS influencer_disputes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  influencer_id TEXT NOT NULL,
  seller_id INTEGER,
  type TEXT NOT NULL,                           -- 'unfair_block' / 'commission_dispute' / 'other'
  description TEXT NOT NULL,
  status TEXT DEFAULT 'open',                   -- 'open' / 'resolved' / 'rejected'
  resolution TEXT,
  created_at DATETIME DEFAULT (datetime('now')),
  resolved_at DATETIME
);
CREATE INDEX IF NOT EXISTS idx_inf_disputes_status ON influencer_disputes(status, created_at);
