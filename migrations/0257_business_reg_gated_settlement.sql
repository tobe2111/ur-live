-- 🛡️ 2026-05-18: 사업자 등록증 게이팅 정산 시스템.
--   문제: 사업자등록증 없는 셀러 (개인 인플 / 학생 / 부업) 가 정산 못 받아 진입 장벽.
--   해결:
--     1) sellers.business_registration_status — 검증 상태 (null/pending/verified/rejected)
--     2) 검증된 셀러만 현금 정산 가능 (settlements/request, 딜 환급)
--     3) 비검증 셀러 → 딜(포인트) 적립 + 기프티쇼 상품권 으로만 수령
--     4) 비검증 셀러의 딜은 환급 (현금화) 불가 — 우리 플랫폼 내 사용만
--     5) 모든 상품권/딜 정산은 8.8% 원천징수 + 지급조서 자동 기록
--
--   세무 근거:
--     - 사업자등록 없는 개인에게 지급 = 기타소득 (소득세법 §21)
--     - 8.8% 원천징수 (소득세 8% + 지방세 0.8%)
--     - 연 300만원 초과 시 종합소득 합산 (셀러 의무)
--     - 지급자 (우리) 지급조서 제출 의무 (다음 해 2월말)

-- ─── 1. sellers 테이블 — 사업자 검증 상태 ─────────────────────────────────

ALTER TABLE sellers ADD COLUMN business_registration_status TEXT DEFAULT 'pending';
  -- 'pending'   = 검증 안 됨 (default, 신규 셀러)
  -- 'verified'  = 사업자등록증 검증 완료 (현금 정산 가능)
  -- 'rejected'  = 검증 실패 (사유는 별도 admin 메모)
  -- 'exempt'    = 면제 (어드민이 수동 처리 — 특수 케이스)

ALTER TABLE sellers ADD COLUMN business_registration_image_url TEXT;
  -- 사업자등록증 이미지 R2 URL (셀러 업로드 → 어드민 검증)

ALTER TABLE sellers ADD COLUMN business_registration_verified_at DATETIME;
ALTER TABLE sellers ADD COLUMN business_registration_verified_by INTEGER;
  -- 검증 처리한 admin id (audit)

ALTER TABLE sellers ADD COLUMN business_registration_reject_reason TEXT;

ALTER TABLE sellers ADD COLUMN preferred_settlement_method TEXT DEFAULT 'auto';
  -- 'auto'    = 시스템이 자동 선택 (verified=cash / unverified=deal_or_voucher)
  -- 'cash'    = 현금 (verified 셀러만, 어드민이 차단 가능)
  -- 'voucher' = 모바일 상품권 (KT Alpha)
  -- 'deal'    = 우리 플랫폼 포인트 (딜)

-- ─── 2. seller_deal_balances — 셀러 딜 잔액 (현금 정산 불가 분류) ─────────

CREATE TABLE IF NOT EXISTS seller_deal_balances (
  seller_id INTEGER PRIMARY KEY,
  -- gated_deal: 비검증 셀러가 적립한 딜. 환급 불가, 플랫폼 내 사용만.
  gated_deal_amount INTEGER NOT NULL DEFAULT 0,
  -- redeemable_deal: 검증 후 적립한 딜. 환급 가능 (단, 8.8% 원천징수).
  redeemable_deal_amount INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (seller_id) REFERENCES sellers(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_seller_deal_balances_seller ON seller_deal_balances(seller_id);

-- ─── 3. seller_deal_transactions — 딜 적립/사용 이력 ────────────────────

CREATE TABLE IF NOT EXISTS seller_deal_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seller_id INTEGER NOT NULL,
  amount INTEGER NOT NULL,             -- 양수: 적립, 음수: 사용/차감
  bucket TEXT NOT NULL,                -- 'gated' (환급 불가) / 'redeemable' (환급 가능)
  type TEXT NOT NULL,                  -- 'settlement_accrual' / 'voucher_redeem' / 'platform_use' / 'cash_withdraw' / 'admin_adjust'
  reference_id TEXT,                   -- 참조 (예: settlements.id / voucher_orders.id)
  memo TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (seller_id) REFERENCES sellers(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_seller_deal_tx_seller_created ON seller_deal_transactions(seller_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_seller_deal_tx_type ON seller_deal_transactions(type, created_at DESC);

-- ─── 4. voucher_orders — 기프티쇼 상품권 주문 (KT Alpha 통합 대비) ───────

CREATE TABLE IF NOT EXISTS voucher_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seller_id INTEGER NOT NULL,
  source TEXT NOT NULL,                -- 'kt_alpha' / 'kakao_gift' / 'manual'
  goods_code TEXT NOT NULL,            -- KT Alpha 측 상품 코드
  goods_name TEXT NOT NULL,
  goods_image_url TEXT,
  unit_price INTEGER NOT NULL,         -- 1장 가격
  quantity INTEGER NOT NULL DEFAULT 1,
  total_amount INTEGER NOT NULL,       -- unit_price * quantity
  recipient_phone TEXT NOT NULL,       -- 발송 대상 (셀러 본인 전화)
  -- 원천징수 (비검증 셀러)
  withholding_amount INTEGER NOT NULL DEFAULT 0,    -- 8.8% 원천징수 금액
  net_amount INTEGER NOT NULL,                       -- 실제 셀러 수령 = total_amount (상품권은 100% 받음, 원천징수는 별도 차감 처리)
  status TEXT NOT NULL DEFAULT 'pending',
    -- 'pending'   = 신청 대기
    -- 'processing' = KT Alpha API 호출 중
    -- 'sent'      = 발송 완료
    -- 'failed'    = 발송 실패
    -- 'cancelled' = 취소 (사용 전)
    -- 'used'      = 사용 완료 (조회 시 갱신)
  external_order_id TEXT,              -- KT Alpha 측 주문 번호
  coupon_code TEXT,                    -- 발급된 쿠폰 코드 (있을 시)
  failure_reason TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at DATETIME,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (seller_id) REFERENCES sellers(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_voucher_orders_seller ON voucher_orders(seller_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_voucher_orders_status ON voucher_orders(status, created_at DESC);

-- ─── 5. tax_withholding_log — 원천징수 + 지급조서 ───────────────────────

CREATE TABLE IF NOT EXISTS tax_withholding_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seller_id INTEGER NOT NULL,
  payout_year INTEGER NOT NULL,         -- 해당 연도 (지급조서 단위)
  payout_month INTEGER NOT NULL,        -- 1-12
  gross_amount INTEGER NOT NULL,        -- 총 지급액 (원천징수 전)
  withholding_rate REAL NOT NULL DEFAULT 8.8,  -- 8.8% (소득세 8 + 지방세 0.8)
  withholding_amount INTEGER NOT NULL,  -- 원천징수액
  net_amount INTEGER NOT NULL,          -- 실 수령액 = gross - withholding
  source_type TEXT NOT NULL,            -- 'settlement_cash' / 'voucher_order' / 'deal_redeem'
  source_id TEXT,                       -- 참조 (settlements.id 등)
  ytd_gross_amount INTEGER NOT NULL,    -- 연 누계 지급액 (300만원 임계 추적)
  reportable INTEGER NOT NULL DEFAULT 1, -- 0: 분리과세 (300만 이하) / 1: 종합소득 합산 의무 (300만 초과)
  reported_at DATETIME,                  -- 지급조서 국세청 제출 시각
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (seller_id) REFERENCES sellers(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_tax_withholding_seller_year ON tax_withholding_log(seller_id, payout_year, payout_month);
CREATE INDEX IF NOT EXISTS idx_tax_withholding_reportable ON tax_withholding_log(payout_year, reportable);

-- ─── 6. 기존 sellers 의 검증된 셀러 마이그레이션 ──────────────────────────
-- business_number 가 있고 status='approved' 인 셀러는 자동 'verified' 처리.
-- (어드민이 이미 사업자 등록증 확인 후 승인했다고 가정)
UPDATE sellers
   SET business_registration_status = 'verified',
       business_registration_verified_at = datetime('now')
 WHERE status = 'approved'
   AND business_number IS NOT NULL
   AND length(business_number) >= 10
   AND business_registration_status = 'pending';
