-- Push Notification 시스템 테이블
-- 작성일: 2026-02-22
-- 설명: Web Push API 구독 관리

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  user_type TEXT NOT NULL,              -- user, seller, admin
  endpoint TEXT NOT NULL UNIQUE,        -- Push service endpoint
  p256dh TEXT NOT NULL,                 -- Encryption key
  auth TEXT NOT NULL,                   -- Auth secret
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id, user_type);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint ON push_subscriptions(endpoint);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_active ON push_subscriptions(is_active);

-- Push 알림 발송 이력
CREATE TABLE IF NOT EXISTS push_notification_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  user_type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data TEXT,                            -- JSON
  status TEXT DEFAULT 'sent',           -- sent, failed, expired
  sent_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_push_history_user ON push_notification_history(user_id, user_type);
CREATE INDEX IF NOT EXISTS idx_push_history_sent ON push_notification_history(sent_at);
