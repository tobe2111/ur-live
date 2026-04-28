-- 🛡️ 2026-04-28: 알림 채널 설정 — 어드민이 종류별로 ON/OFF
--
-- notification_type: 'seller_registered' | 'seller_approved' | 'agency_registered' |
--                   'agency_approved' | 'new_order' | 'gift_received' | 'gift_refunded' |
--                   'settlement_completed' | 'low_stock' | ...
--
-- channels JSON: { "dashboard": true, "email": true, "alimtalk": false, "push": true }
--   - dashboard: 무료, 대시보드 인앱 알림 (DashboardNotificationBell)
--   - email: 무료 (Resend 3000건/월) ~ 1.5원/건
--   - alimtalk: 8원/건 (카카오 알림톡, Aligo)
--   - push: 무료 (Web Push, VAPID)

CREATE TABLE IF NOT EXISTS notification_channel_settings (
  notification_type TEXT PRIMARY KEY,
  -- 각 채널 enabled (1=on, 0=off)
  dashboard_enabled INTEGER NOT NULL DEFAULT 1,
  email_enabled INTEGER NOT NULL DEFAULT 0,
  alimtalk_enabled INTEGER NOT NULL DEFAULT 0,
  push_enabled INTEGER NOT NULL DEFAULT 1,
  -- 운영 메모 (어드민이 비용 추정 등 메모)
  description TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 기본값 시드 (어드민이 변경 가능). 2026-04-28 갱신 — 38종 망라.
-- 코드 (admin-notification-settings.routes.ts) 의 ensureTable() 시드와 동기화.
INSERT OR IGNORE INTO notification_channel_settings (notification_type, dashboard_enabled, email_enabled, alimtalk_enabled, push_enabled, description) VALUES
  -- 가입·승인
  ('seller_registered',      1, 1, 0, 1, '[어드민] 셀러 가입 신청'),
  ('seller_approved',        1, 1, 1, 1, '[셀러] 가입 승인 (알림톡 권장)'),
  ('seller_rejected',        1, 1, 0, 0, '[셀러] 가입 거절'),
  ('agency_registered',      1, 1, 0, 1, '[어드민] 에이전시 가입 신청'),
  ('agency_approved',        1, 1, 1, 1, '[에이전시] 가입 승인 (알림톡 권장)'),
  -- 주문·배송
  ('new_order',              1, 0, 1, 1, '[셀러] 새 주문 (즉시 알림 권장)'),
  ('order_delivered',        1, 0, 0, 1, '[셀러+어드민] 배송 완료'),
  ('purchase_confirmed',     1, 0, 0, 1, '[셀러] 구매 확정 (정산 가능)'),
  ('return_request',         1, 1, 0, 1, '[셀러+어드민] 반품 신청'),
  ('order_cancelled',        1, 0, 0, 1, '[셀러+어드민] 주문 취소'),
  ('deal_payment',           1, 0, 0, 1, '[어드민] 딜 결제'),
  -- 정산
  ('settlement_completed',   1, 1, 0, 1, '[셀러] 정산 완료'),
  ('settlement_request',     1, 0, 0, 1, '[어드민] 셀러 정산 신청'),
  ('agency_settlement',      1, 0, 0, 1, '[어드민] 에이전시 정산 신청'),
  -- 후원·리뷰
  ('donation_received',      1, 0, 1, 1, '[셀러] 후원 받음 (라이브)'),
  ('new_review',             1, 0, 0, 1, '[셀러] 새 리뷰 등록'),
  -- 경매
  ('auction_won',            1, 0, 0, 1, '[user] 경매 낙찰 (결제 안내)'),
  ('auction_outbid',         0, 0, 0, 1, '[user] 더 높은 입찰자 등장 (push 권장)'),
  ('auction_promoted',       1, 0, 0, 1, '[user] 차순위 승격 낙찰'),
  -- 재고·딜
  ('low_stock',              1, 0, 0, 1, '[셀러] 재고 부족 (5개 이하)'),
  ('deal_charged',           1, 0, 0, 0, '[어드민] 딜 충전'),
  -- 선물
  ('gift_received',          0, 1, 1, 0, '[recipient] 선물 수신 (외부 사용자)'),
  ('gift_refunded',          0, 1, 1, 0, '[sender] 선물 만료 환불'),
  -- 셀러 부가 서비스
  ('supply_registered',      1, 0, 0, 1, '[어드민] 공급 상품 등록'),
  ('sample_request',         1, 0, 0, 1, '[어드민] 샘플 신청'),
  ('youtube_growth_request', 1, 0, 0, 1, '[어드민] 유튜브 성장 신청'),
  ('youtube_growth_update',  1, 1, 0, 1, '[셀러] 유튜브 성장 진행 업데이트'),
  -- 사용자 지향 (확장 가능)
  ('order_paid',             0, 1, 0, 1, '[user] 결제 완료 영수증'),
  ('order_shipped',          0, 1, 0, 1, '[user] 배송 시작'),
  ('live_starting',          0, 0, 0, 1, '[user] 관심 셀러 라이브 시작'),
  ('wishlist_price_drop',    0, 1, 0, 1, '[user] 위시리스트 가격 인하'),
  ('coupon_expiring',        0, 0, 0, 1, '[user] 쿠폰 만료 임박'),
  ('password_reset',         0, 1, 0, 0, '[user] 비밀번호 재설정 요청'),
  ('welcome',                0, 1, 0, 1, '[user] 가입 환영'),
  -- 운영
  ('system_alert',           1, 1, 0, 0, '[어드민] 시스템 에러/장애'),
  ('payment_failed',         1, 0, 0, 1, '[어드민] 결제 실패'),
  ('inactive_seller',        1, 1, 0, 0, '[어드민] 부진 셀러 detect'),
  ('inactive_agency',        1, 1, 0, 0, '[어드민] 부진 에이전시 detect');
