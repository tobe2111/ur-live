-- ============================================================
-- Migration 0124: 라이브 후원(도네이션) 시스템
-- ============================================================

-- 후원 내역 테이블
CREATE TABLE IF NOT EXISTS donations (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  stream_id         INTEGER NOT NULL,           -- 라이브 스트림 ID
  seller_id         INTEGER NOT NULL,           -- 셀러 ID
  donor_user_id     TEXT    NOT NULL,           -- 후원자 user_id
  donor_name        TEXT,                       -- 후원자명 (표시용)
  donor_phone       TEXT,                       -- 후원자 연락처
  amount            INTEGER NOT NULL,           -- 후원 금액 (원)
  commission_amount INTEGER NOT NULL,           -- 플랫폼 수수료 (원)
  seller_amount     INTEGER NOT NULL,           -- 셀러 수령액 (원)
  commission_rate   REAL    NOT NULL DEFAULT 15.0,  -- 적용 수수료율 (%)
  payment_key       TEXT,                       -- 토스 결제 키
  order_id          TEXT    UNIQUE,             -- 토스 주문 ID
  status            TEXT    NOT NULL DEFAULT 'PENDING',  -- PENDING|DONE|FAILED|REFUNDED
  message           TEXT,                       -- 후원 메시지 (선택)
  is_anonymous      INTEGER NOT NULL DEFAULT 0, -- 1=익명
  created_at        TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- 후원금 정산 신청 테이블
CREATE TABLE IF NOT EXISTS donation_settlements (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  seller_id         INTEGER NOT NULL,
  total_amount      INTEGER NOT NULL,           -- 정산 신청 후원 총액
  commission_amount INTEGER NOT NULL,           -- 총 수수료
  settlement_amount INTEGER NOT NULL,           -- 실 지급액 (total - commission)
  donation_count    INTEGER NOT NULL DEFAULT 0, -- 포함 후원 건수
  status            TEXT    NOT NULL DEFAULT 'REQUESTED',  -- REQUESTED|DONE|REJECTED
  requested_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  settled_at        TEXT,                       -- 정산 완료 일시
  admin_memo        TEXT,                       -- 어드민 메모
  bank_info         TEXT,                       -- 정산 계좌 정보 (JSON)
  created_at        TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- 셀러 후원 수수료율 컬럼 추가 (기본 15%)
ALTER TABLE sellers ADD COLUMN donation_commission_rate REAL DEFAULT 15.0;

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_donations_stream   ON donations (stream_id);
CREATE INDEX IF NOT EXISTS idx_donations_seller   ON donations (seller_id);
CREATE INDEX IF NOT EXISTS idx_donations_donor    ON donations (donor_user_id);
CREATE INDEX IF NOT EXISTS idx_donations_status   ON donations (status);
CREATE INDEX IF NOT EXISTS idx_don_settlements_seller ON donation_settlements (seller_id);
CREATE INDEX IF NOT EXISTS idx_don_settlements_status ON donation_settlements (status);
