-- 🛡️ 2026-05-19: 일반 user 의 딜 → 현금 출금 (추천 수익 / 미사용 잔액 환급).
--
-- 셀러는 별도 sellers.bank_account + business_registration 으로 출금,
-- 일반 user 는 본 테이블 + 출금 시점에 계좌 입력 (간단).
--
-- 정책:
--   최소 출금 10,000딜 (= 10,000원 - 8.8% 원천징수 = 9,120원 입금).
--   일반 user 는 무조건 8.8% (기타소득 — 소득세 8% + 지방세 0.8%).
--   사업자 등록한 user 는 추후 별도 처리 (현재 미지원).
--
-- 흐름:
--   1. user 가 /api/points/withdraw 요청 (amount, bank_name, bank_account, account_holder)
--   2. user_points.balance 즉시 차감 + status='requested' INSERT
--   3. 어드민이 매주 일괄 송금 → status='paid' 갱신
--   4. 송금 실패 시 status='failed' + balance 자동 복구

CREATE TABLE IF NOT EXISTS user_withdrawals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount >= 10000),
  withholding_tax INTEGER NOT NULL DEFAULT 0,  -- 8.8% 원천징수액 (정수)
  net_amount INTEGER NOT NULL,                  -- 실 입금액 (amount - withholding_tax)
  bank_name TEXT NOT NULL,
  bank_account TEXT NOT NULL,                   -- 마스킹 처리 권장 (조회 시)
  account_holder TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested','approved','paid','rejected','failed','cancelled')),
  rejection_reason TEXT,
  requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at DATETIME,
  admin_memo TEXT
);

CREATE INDEX IF NOT EXISTS idx_user_withdrawals_user_status
  ON user_withdrawals(user_id, status, requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_withdrawals_status_requested
  ON user_withdrawals(status, requested_at DESC);
