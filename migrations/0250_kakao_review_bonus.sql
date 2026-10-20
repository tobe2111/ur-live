-- 🛡️ 2026-05-16: 카카오맵 후기 작성 보너스 + 매장 매출 분석.
--
-- 유저가 voucher 사용 후 카카오맵 후기 작성 → URL 제출 → 어드민 검증 → 보너스 딜 지급.
-- 검증 인프라: 1차 honor system (무작위 검증), 2차 OCR (Workers AI 미래 도입).

CREATE TABLE IF NOT EXISTS kakao_review_submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  voucher_id INTEGER NOT NULL,
  user_id TEXT NOT NULL,
  product_id INTEGER,
  seller_id INTEGER,
  review_url TEXT NOT NULL,                     -- 카카오맵 후기 URL
  bonus_amount INTEGER DEFAULT 0,               -- 지급된 보너스 금액
  status TEXT DEFAULT 'submitted',              -- 'submitted' / 'approved' / 'rejected' / 'paid'
  admin_notes TEXT,
  created_at DATETIME DEFAULT (datetime('now')),
  reviewed_at DATETIME,
  paid_at DATETIME,
  UNIQUE(voucher_id)                            -- 1 voucher = 1 review submission
);
CREATE INDEX IF NOT EXISTS idx_kakao_review_status ON kakao_review_submissions(status, created_at);
CREATE INDEX IF NOT EXISTS idx_kakao_review_seller ON kakao_review_submissions(seller_id, status);

-- platform_settings: 보너스 금액 + 검증 정책 (어드민 조정)
INSERT INTO platform_settings (key, value, description, updated_at) VALUES
  ('kakao_review_bonus_amount', '1000', '카카오맵 후기 작성 시 보너스 딜 (원)', datetime('now')),
  ('kakao_review_auto_approve', '0', '0 = 어드민 수동 검증, 1 = 자동 승인 (honor system)', datetime('now'))
ON CONFLICT(key) DO NOTHING;
