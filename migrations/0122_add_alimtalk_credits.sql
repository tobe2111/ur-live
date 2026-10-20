-- ============================================================
-- Migration 0122: 알림톡 크레딧 시스템
-- 2026-03-28
--
-- 플랫폼(알리고) 통합 발송 모델:
--   셀러가 크레딧 충전 → 이벤트 발생 시 플랫폼이 자동 발송 → 차감
--
-- 원가: 6.5원/건, 판매가: 9원/건
-- ============================================================

-- 셀러별 크레딧 잔액
CREATE TABLE IF NOT EXISTS seller_credits (
  seller_id   INTEGER PRIMARY KEY,
  balance     INTEGER NOT NULL DEFAULT 0,
  updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- 충전 / 차감 이력
CREATE TABLE IF NOT EXISTS credit_transactions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  seller_id   INTEGER NOT NULL,
  type        TEXT    NOT NULL,  -- 'charge' | 'deduct' | 'refund'
  amount      INTEGER NOT NULL,  -- 건수 (양수=충전, 음수=차감)
  price_paid  INTEGER,           -- 충전 시 실제 결제금액(원)
  description TEXT,
  payment_key TEXT,              -- 토스 결제 키
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_credit_transactions_seller_id ON credit_transactions(seller_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_type      ON credit_transactions(type);

-- 알림톡 발송 로그
CREATE TABLE IF NOT EXISTS alimtalk_logs (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  seller_id    INTEGER NOT NULL,
  receiver     TEXT    NOT NULL,  -- 수신자 전화번호
  template_code TEXT   NOT NULL,
  message      TEXT    NOT NULL,
  order_id     TEXT,              -- 연관 주문 ID
  success      INTEGER NOT NULL DEFAULT 0,
  error_msg    TEXT,
  created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_alimtalk_logs_seller_id ON alimtalk_logs(seller_id);
CREATE INDEX IF NOT EXISTS idx_alimtalk_logs_order_id  ON alimtalk_logs(order_id);
