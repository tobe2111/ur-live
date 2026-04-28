-- 🛡️ 2026-04-28: 선물하기 (Gifts)
--
-- 비즈니스 컨셉:
--   라이브 시청 중 시청자(sender)가 다른 사람(recipient)에게 상품을 선물.
--   sender 가 결제 → recipient 에게 카카오톡 알림 → recipient 가 받기/수령 주소 입력.
--
-- 핵심 모델:
--   gifts: 선물 단위 (sender + recipient + product + payment + claim 상태)
--   recipient 식별: phone (필수) + name (선택). 휴대폰으로 알림톡 발송.
--   claim: 받은 사람이 주소·옵션 입력 후 실제 발송 결정.

CREATE TABLE IF NOT EXISTS gifts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sender_user_id INTEGER NOT NULL,             -- 결제한 사람 (users.id)
  recipient_phone TEXT NOT NULL,               -- 수신자 전화번호 (정규화: 01012345678)
  recipient_name TEXT,                         -- 수신자 이름 (선택)
  product_id INTEGER NOT NULL,
  order_id INTEGER,                             -- 결제 완료 후 연결 (orders.id)
  message TEXT,                                 -- 보내는 메시지 (200자 제한)
  amount INTEGER NOT NULL,                      -- 결제 금액 (원)

  -- 상태 흐름:
  --   pending      : 결제 대기
  --   paid         : 결제 완료, 수신자 알림 발송됨
  --   claimed      : 수신자가 받기 + 주소 입력 완료
  --   shipped      : 셀러가 발송 처리
  --   delivered    : 배송 완료
  --   expired      : 30일 내 미수령 → 환불 또는 sender 에게 반환
  --   refunded     : 환불 완료 (만료 또는 거부)
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'claimed', 'shipped', 'delivered', 'expired', 'refunded')),

  -- recipient 가 claim 시 입력 (별도 테이블 분리도 가능했으나 1:1 이라 인라인)
  claim_address TEXT,
  claim_address_detail TEXT,
  claim_postal_code TEXT,
  claim_phone TEXT,                             -- 수령자 본인 검증된 전화 (recipient_phone 과 같거나 다를 수 있음)
  claim_user_id INTEGER,                        -- 수신자가 가입/로그인 했으면 매핑
  claim_token TEXT UNIQUE,                      -- 수령 페이지 접근 토큰 (URL 에 포함)

  paid_at DATETIME,
  claimed_at DATETIME,
  shipped_at DATETIME,
  delivered_at DATETIME,
  expires_at DATETIME,                          -- 결제 시각 + 30일
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

  FOREIGN KEY (sender_user_id) REFERENCES users(id),
  FOREIGN KEY (product_id) REFERENCES products(id),
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (claim_user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_gifts_sender ON gifts(sender_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gifts_recipient_phone ON gifts(recipient_phone, status);
CREATE INDEX IF NOT EXISTS idx_gifts_status ON gifts(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_gifts_claim_token ON gifts(claim_token);
CREATE INDEX IF NOT EXISTS idx_gifts_order ON gifts(order_id);
