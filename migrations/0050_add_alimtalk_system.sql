-- 알림톡 시스템 구축
-- 작성일: 2026-02-22
-- 설명: 알리고 알림톡 통합 시스템 (요금제, 계정, 템플릿, 발송, 충전)

-- 1. 알림톡 요금제 (어드민이 관리)
CREATE TABLE IF NOT EXISTS alimtalk_pricing (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  plan_name TEXT NOT NULL,                 -- 기본, 스탠다드, 프리미엄
  min_quantity INTEGER NOT NULL,           -- 최소 충전 건수
  max_quantity INTEGER,                    -- 최대 충전 건수 (NULL이면 무제한)
  unit_price INTEGER NOT NULL,             -- 건당 단가 (원)
  is_active BOOLEAN DEFAULT TRUE,          -- 활성화 여부
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 기본 요금제 삽입
INSERT INTO alimtalk_pricing (plan_name, min_quantity, max_quantity, unit_price, is_active) VALUES
  ('기본', 1000, 4999, 15, TRUE),
  ('스탠다드', 5000, 19999, 13, TRUE),
  ('프리미엄', 20000, NULL, 11, TRUE);

-- 2. 알림톡 계정 (셀러별 알림톡 계정)
CREATE TABLE IF NOT EXISTS alimtalk_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seller_id INTEGER NOT NULL,
  kakao_channel_id TEXT NOT NULL,         -- 카카오톡 채널 ID (@myshop)
  channel_name TEXT NOT NULL,              -- 채널명
  sender_key TEXT,                         -- 알리고 발신키 (등록 후 발급)
  phone_number TEXT NOT NULL,              -- 발신번호
  status TEXT DEFAULT 'pending',           -- pending, active, suspended, rejected
  balance INTEGER DEFAULT 0,               -- 잔액 (건수)
  total_sent INTEGER DEFAULT 0,            -- 총 발송 건수
  total_failed INTEGER DEFAULT 0,          -- 총 실패 건수
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (seller_id) REFERENCES sellers(id)
);

CREATE INDEX IF NOT EXISTS idx_alimtalk_accounts_seller ON alimtalk_accounts(seller_id);
CREATE INDEX IF NOT EXISTS idx_alimtalk_accounts_status ON alimtalk_accounts(status);

-- 3. 알림톡 템플릿
CREATE TABLE IF NOT EXISTS alimtalk_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL,
  template_code TEXT NOT NULL,             -- 템플릿 코드 (ORDER_CONFIRM_001)
  template_name TEXT NOT NULL,             -- 템플릿명
  template_content TEXT NOT NULL,          -- 템플릿 내용 (#{변수} 포함)
  template_type TEXT DEFAULT 'basic',      -- basic, extra, channel, complex
  status TEXT DEFAULT 'pending',           -- pending, approved, rejected
  rejection_reason TEXT,                   -- 반려 사유
  approved_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (account_id) REFERENCES alimtalk_accounts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_alimtalk_templates_account ON alimtalk_templates(account_id);
CREATE INDEX IF NOT EXISTS idx_alimtalk_templates_code ON alimtalk_templates(template_code);
CREATE INDEX IF NOT EXISTS idx_alimtalk_templates_status ON alimtalk_templates(status);

-- 4. 알림톡 발송 내역
CREATE TABLE IF NOT EXISTS alimtalk_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL,
  template_id INTEGER NOT NULL,
  order_id INTEGER,                        -- 주문 연동 (선택)
  recipient_phone TEXT NOT NULL,           -- 수신자 전화번호
  message_content TEXT NOT NULL,           -- 실제 발송 내용
  status TEXT DEFAULT 'pending',           -- pending, sent, failed
  sent_at DATETIME,
  failed_reason TEXT,
  cost INTEGER DEFAULT 0,                  -- 발송 비용 (원)
  aligo_message_id TEXT,                   -- 알리고 메시지 ID
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (account_id) REFERENCES alimtalk_accounts(id) ON DELETE CASCADE,
  FOREIGN KEY (template_id) REFERENCES alimtalk_templates(id) ON DELETE SET NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_alimtalk_messages_account ON alimtalk_messages(account_id);
CREATE INDEX IF NOT EXISTS idx_alimtalk_messages_status ON alimtalk_messages(status);
CREATE INDEX IF NOT EXISTS idx_alimtalk_messages_created ON alimtalk_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_alimtalk_messages_order ON alimtalk_messages(order_id);

-- 5. 알림톡 충전 내역
CREATE TABLE IF NOT EXISTS alimtalk_charges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL,
  amount INTEGER NOT NULL,                 -- 충전 건수
  price INTEGER NOT NULL,                  -- 충전 금액 (원)
  unit_price INTEGER NOT NULL,             -- 건당 단가 (원)
  payment_method TEXT DEFAULT 'card',      -- card, bank_transfer
  payment_status TEXT DEFAULT 'pending',   -- pending, completed, failed, cancelled
  payment_id TEXT,                         -- TossPayments 결제 ID
  order_id TEXT,                           -- TossPayments 주문 ID
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  FOREIGN KEY (account_id) REFERENCES alimtalk_accounts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_alimtalk_charges_account ON alimtalk_charges(account_id);
CREATE INDEX IF NOT EXISTS idx_alimtalk_charges_status ON alimtalk_charges(payment_status);
CREATE INDEX IF NOT EXISTS idx_alimtalk_charges_created ON alimtalk_charges(created_at);
