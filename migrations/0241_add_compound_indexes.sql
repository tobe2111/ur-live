-- 복합 인덱스 추가 (2026-05-05)
-- point_transactions: WHERE user_id = ? AND type = ? 쿼리 최적화
--   기존: user_id 단일 인덱스로 user 필터 후 type full-scan
--   개선: (user_id, type) 복합 인덱스로 두 조건 모두 인덱스 커버
CREATE INDEX IF NOT EXISTS idx_point_transactions_user_type
  ON point_transactions(user_id, type);

-- point_transactions: created_at 범위 쿼리 (중복 방지 + 최근 거래 조회)
--   WHERE user_id = ? AND type = ? AND created_at > ?
CREATE INDEX IF NOT EXISTS idx_point_transactions_user_type_created
  ON point_transactions(user_id, type, created_at DESC);

-- dashboard_notifications: ORDER BY created_at DESC 커버링
--   기존: (recipient_type, recipient_id, is_read) + 별도 created_at 정렬
--   개선: created_at 포함해 정렬도 인덱스 내 처리
CREATE INDEX IF NOT EXISTS idx_dash_notif_recipient_created
  ON dashboard_notifications(recipient_type, recipient_id, is_read, created_at DESC);
