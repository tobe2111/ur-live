-- 🛡️ 2026-05-16: 인플루언서 정산 인프라 (4계정 split 모델).
--
-- 정산 구조:
--   T+0 결제 시 ledger split: 유어딜 5% / 인플 / 사용자보너스 / 에이전시 / 셀러 receivable_pending
--   T+사용 (voucher.used_at): seller receivable_pending → settled
--   T+사용+7일: 셀러 송금 + 인플 pending → available
--   매월 1일: 인플 available → 일괄 송금 (사업소득 3.3% or 기타소득 8.8%)

-- 1) 인플루언서 잔액 (entity = user account 또는 별도 인플루언서 ID)
CREATE TABLE IF NOT EXISTS influencer_balances (
  influencer_id TEXT PRIMARY KEY,
  pending_amount INTEGER DEFAULT 0,           -- T+0 ~ T+7 (환불 가능 기간)
  available_amount INTEGER DEFAULT 0,         -- T+7+ (송금 대기)
  total_paid_out INTEGER DEFAULT 0,           -- 누적 송금액
  business_number TEXT,                       -- 사업자번호 (선택)
  tax_type TEXT DEFAULT 'other_income',       -- 'business_income' (3.3%) / 'other_income' (8.8%) / 'unreported'
  bank_name TEXT,
  bank_account TEXT,
  account_holder TEXT,
  created_at DATETIME DEFAULT (datetime('now')),
  updated_at DATETIME DEFAULT (datetime('now'))
);

-- 2) 인플루언서 attribution (결제별 commission 추적)
CREATE TABLE IF NOT EXISTS influencer_attributions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  influencer_id TEXT NOT NULL,
  order_id INTEGER,
  voucher_id INTEGER,
  product_id INTEGER,
  seller_id INTEGER,
  commission_amount INTEGER NOT NULL,
  status TEXT DEFAULT 'pending',              -- 'pending' / 'available' / 'paid' / 'clawed_back'
  created_at DATETIME DEFAULT (datetime('now')),
  available_at DATETIME,                       -- T+7 시점
  paid_at DATETIME,
  clawback_reason TEXT
);
CREATE INDEX IF NOT EXISTS idx_inf_attr_influencer ON influencer_attributions(influencer_id, status);
CREATE INDEX IF NOT EXISTS idx_inf_attr_voucher ON influencer_attributions(voucher_id);
CREATE INDEX IF NOT EXISTS idx_inf_attr_order ON influencer_attributions(order_id);
CREATE INDEX IF NOT EXISTS idx_inf_attr_pending_avail ON influencer_attributions(status, available_at);

-- 3) 셀러 → 인플루언서 차단 매핑
CREATE TABLE IF NOT EXISTS seller_blocked_influencers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seller_id INTEGER NOT NULL,
  influencer_id TEXT NOT NULL,
  reason TEXT,
  blocked_at DATETIME DEFAULT (datetime('now')),
  unblocked_at DATETIME,
  UNIQUE(seller_id, influencer_id)
);
CREATE INDEX IF NOT EXISTS idx_seller_blocked_inf_seller ON seller_blocked_influencers(seller_id, unblocked_at);

-- 4) 셀러 전체 마케팅 ON/OFF + 공구별 referral 비활성
ALTER TABLE sellers ADD COLUMN marketing_enabled INTEGER DEFAULT 1;
ALTER TABLE products ADD COLUMN referral_disabled INTEGER DEFAULT 0;

-- 5) 셀러 receivable 상태 분리 (pending → settled → paid_out)
--    기존 seller_receivable_pending 만 있던 ledger 모델에서 settled 단계 추가.
--    실제 ledger entry 는 event_type 으로 구분 → 별도 컬럼 추가 없이 ledger_entries 활용.

-- 6) Default settings (admin 이 /admin/operations-guide 또는 settings 페이지에서 조정)
INSERT INTO platform_settings (key, value, description, updated_at) VALUES
  ('platform_margin_pct', '5', '유어딜 운영 마진 (%)', datetime('now')),
  ('influencer_commission_pct', '0.5', '인플루언서 referral commission (%)', datetime('now')),
  ('user_referral_bonus_pct', '0.5', '사용자 referral 보너스 (%)', datetime('now')),
  ('agency_commission_pct', '2', '에이전시 commission (%)', datetime('now')),
  ('refund_window_days', '7', '매장 송금 전 환불 가능 기간 (일)', datetime('now')),
  ('influencer_payout_min', '100000', '인플루언서 월 최소 송금액 (원, 미달 시 누적)', datetime('now'))
ON CONFLICT(key) DO NOTHING;
