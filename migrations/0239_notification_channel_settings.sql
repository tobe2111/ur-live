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

-- 기본값 시드 (어드민이 변경 가능)
INSERT OR IGNORE INTO notification_channel_settings (notification_type, dashboard_enabled, email_enabled, alimtalk_enabled, push_enabled, description) VALUES
  ('seller_registered',    1, 1, 0, 1, '셀러 가입 신청'),
  ('seller_approved',      1, 1, 1, 1, '셀러 승인 (알림톡 권장)'),
  ('agency_registered',    1, 1, 0, 1, '에이전시 가입 신청'),
  ('agency_approved',      1, 1, 1, 1, '에이전시 승인 (알림톡 권장)'),
  ('new_order',            1, 0, 1, 1, '새 주문 (셀러에게 즉시 알림)'),
  ('order_delivered',      1, 0, 0, 1, '배송 완료'),
  ('gift_received',        0, 1, 1, 0, '선물 수신 (recipient 에게)'),
  ('gift_refunded',        0, 1, 1, 0, '선물 만료 환불'),
  ('settlement_completed', 1, 1, 0, 1, '정산 완료'),
  ('low_stock',            1, 0, 0, 1, '재고 부족'),
  ('settlement_request',   1, 0, 0, 1, '정산 신청 (어드민)');
