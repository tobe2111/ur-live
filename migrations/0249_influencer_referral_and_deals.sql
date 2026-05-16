-- 🛡️ 2026-05-16: 인플루언서 매장 영입 + 협업 제안 인프라.

-- 1) 매장 영입 referral (Phase 1)
ALTER TABLE sellers ADD COLUMN referred_by_influencer TEXT;     -- 영입한 인플 ID
ALTER TABLE sellers ADD COLUMN referral_bonus_until DATETIME;   -- 영입 보너스 만료 시점

-- 2) 매장-인플 협업 제안 (Phase 2)
CREATE TABLE IF NOT EXISTS seller_influencer_deals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seller_id INTEGER NOT NULL,
  influencer_id TEXT NOT NULL,
  commission_pct REAL NOT NULL,           -- 우대 commission (예: 1.5)
  starts_at DATETIME DEFAULT (datetime('now')),
  ends_at DATETIME,                        -- NULL = 무기한
  status TEXT DEFAULT 'proposed',          -- 'proposed' / 'active' / 'expired' / 'cancelled' / 'rejected'
  proposed_by TEXT NOT NULL,               -- 'seller' / 'influencer'
  message TEXT,                            -- 협상 메시지 (양측 공유)
  created_at DATETIME DEFAULT (datetime('now')),
  responded_at DATETIME,
  UNIQUE(seller_id, influencer_id)
);
CREATE INDEX IF NOT EXISTS idx_seller_inf_deals_seller ON seller_influencer_deals(seller_id, status);
CREATE INDEX IF NOT EXISTS idx_seller_inf_deals_inf ON seller_influencer_deals(influencer_id, status);

-- 3) platform_settings — 어드민 조정 가능
INSERT INTO platform_settings (key, value, description, updated_at) VALUES
  ('seller_referral_bonus_pct', '1', '인플 매장 영입 시 추가 commission (%)', datetime('now')),
  ('seller_referral_bonus_months', '6', '영입 보너스 기간 (개월)', datetime('now')),
  ('max_influencer_commission_pct', '2', '인플 commission 최대 cap (%, 영입+협상 중첩 방지)', datetime('now'))
ON CONFLICT(key) DO NOTHING;
