-- 2026-05-05 P0 데이터 정합성 + 정규제 + 권한 분리 인프라
-- 1) 인덱스 — affiliate_earnings, referral_commissions
-- 2) admin_users.role — sub-role 분리 (super/ops/cs/finance)
-- 3) saga_executions — 결제 saga 추적 (Toss 확정 후 DB 실패 자동 복구)
-- 4) abuse_detections — 어뷰징 패턴 자동 감지 적재
-- 5) order_commissions — referral/affiliate 통합 (한 주문 = 한 종류만)

-- ═══════════════════════════════════════════════════════════════
-- 1) 인덱스: affiliate_earnings, referral_commissions
-- ═══════════════════════════════════════════════════════════════
-- WHERE order_id = ? AND status = 'granted' (환불 시 reverse 쿼리)
CREATE INDEX IF NOT EXISTS idx_affiliate_earnings_order_status
  ON affiliate_earnings(order_id, status);
CREATE INDEX IF NOT EXISTS idx_affiliate_earnings_referrer
  ON affiliate_earnings(referrer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_affiliate_earnings_buyer
  ON affiliate_earnings(buyer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_referral_commissions_order_status
  ON referral_commissions(order_id, status);
CREATE INDEX IF NOT EXISTS idx_referral_commissions_beneficiary
  ON referral_commissions(beneficiary_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_referral_commissions_source
  ON referral_commissions(source_user_id);
CREATE INDEX IF NOT EXISTS idx_referral_commissions_tier
  ON referral_commissions(tier, status);

-- ═══════════════════════════════════════════════════════════════
-- 2) admins.role — sub-role 확장
-- 기존 'super_admin' 외에 'ops'/'cs'/'finance' 추가 인정
-- 'super'(전권) | 'ops'(운영, settlement 제외) | 'cs'(조회+환불) | 'finance'(정산)
-- ═══════════════════════════════════════════════════════════════
-- admins 테이블에 role 컬럼이 이미 존재함 (admin-accounts.routes.ts 참조)
-- 본 마이그레이션은 코드 측의 requireAdminRole() 미들웨어와 짝.
-- 기존 super_admin 은 super 로 동등 처리 (auth.ts 미들웨어).
-- 신규 admin 등록 시 운영자가 명시적으로 ops/cs/finance 지정해야 분리 효과.

-- ═══════════════════════════════════════════════════════════════
-- 3) saga_executions — 결제 saga 추적 (P0)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS saga_executions (
  id TEXT PRIMARY KEY,                  -- saga_id (UUID 또는 paymentKey)
  saga_type TEXT NOT NULL,              -- 'payment_confirm' | 'refund' | 'donation_confirm'
  status TEXT NOT NULL CHECK(status IN ('started','compensating','completed','failed')),
  current_step INTEGER NOT NULL DEFAULT 0,
  payload TEXT NOT NULL,                -- JSON
  error TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT (datetime('now')),
  updated_at DATETIME DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_saga_status_updated
  ON saga_executions(status, updated_at);
CREATE INDEX IF NOT EXISTS idx_saga_type_status
  ON saga_executions(saga_type, status);

-- ═══════════════════════════════════════════════════════════════
-- 4) abuse_detections — 어뷰징 적재 (P0)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS abuse_detections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pattern TEXT NOT NULL,                -- 'self_purchase' | 'self_donation' | 'self_referral' | 'circular_referral' | 'rapid_signups_same_ip' | 'unusual_donation_pattern'
  user_id TEXT,
  ref_type TEXT,                        -- 'order' | 'donation' | 'commission'
  ref_id TEXT,
  evidence TEXT NOT NULL,               -- JSON
  severity TEXT NOT NULL CHECK(severity IN ('low','medium','high')),
  reviewed INTEGER DEFAULT 0,
  reviewed_at DATETIME,
  reviewer_id TEXT,
  resolution TEXT,                      -- 'allowed' | 'blocked' | 'refunded'
  created_at DATETIME DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_abuse_pattern_severity
  ON abuse_detections(pattern, severity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_abuse_user
  ON abuse_detections(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_abuse_unreviewed
  ON abuse_detections(reviewed, severity, created_at DESC) WHERE reviewed = 0;

-- ═══════════════════════════════════════════════════════════════
-- 5) compliance_audit — 다단계 규제 모니터링 (P0)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS compliance_audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  audit_date DATE NOT NULL,
  metric TEXT NOT NULL,                 -- 'tier_3_commission_users' | 'recruit_only_revenue' 등
  value REAL NOT NULL,
  threshold REAL NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('ok','warning','violation')),
  evidence TEXT,                        -- JSON
  created_at DATETIME DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_compliance_date_status
  ON compliance_audit(audit_date DESC, status);
