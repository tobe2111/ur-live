-- 🛡️ 2026-04-28: dashboard_notifications.recipient_type CHECK 제약에 'agency' 추가
--
-- 배경: 0140 에서 ('admin', 'seller') 만 허용했으나, 2026-04-28 에이전시 알림 도입으로
--   recipient_type='agency' INSERT 가 production 에서 throw → 에이전시 가입 신청 알림 등 누락.
--
-- 코드 (dashboard-notifications.routes.ts) 의 ensureTable 은 이미 새 CHECK 제약으로
-- 정의하고 있으므로 신규 D1 인스턴스는 자동 적용됨. 본 migration 은 기존 production
-- 인스턴스를 위한 ALTER 보강.
--
-- SQLite 는 ALTER TABLE 로 CHECK 제약 변경 불가 → 임시 테이블 + INSERT SELECT + RENAME 패턴.
-- 데이터 보존 + 인덱스 재생성.

-- 1) 새 스키마로 임시 테이블
CREATE TABLE IF NOT EXISTS dashboard_notifications_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recipient_type TEXT NOT NULL CHECK (recipient_type IN ('admin', 'seller', 'agency')),
  recipient_id TEXT,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  link TEXT,
  is_read INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT (datetime('now'))
);

-- 2) 기존 데이터 복사 (이미 적용된 인스턴스에서는 no-op — 임시 테이블이 빈 채로 남음)
INSERT OR IGNORE INTO dashboard_notifications_new
SELECT id, recipient_type, recipient_id, type, title, message, link, is_read, created_at
FROM dashboard_notifications;

-- 3) 원본 drop + rename
DROP TABLE IF EXISTS dashboard_notifications;
ALTER TABLE dashboard_notifications_new RENAME TO dashboard_notifications;

-- 4) 인덱스 재생성
CREATE INDEX IF NOT EXISTS idx_dash_notif_recipient ON dashboard_notifications(recipient_type, recipient_id, is_read);
