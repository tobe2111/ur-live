-- ============================================================
-- Migration 0214: 에이전시 메시지 템플릿 (Q2)
-- ============================================================
-- 배경: TikTok Backstage 의 IM (Instant Message) Scout 모델.
-- 에이전시가 셀러 영입/관리/리액티베이션 메시지를 템플릿화.
-- 변수 치환 ({{seller_name}}, {{agency_name}}) 지원.
--
-- 1차 구현: 본인 소속 셀러에게 in-app 알림 (agency_notifications) 발송.
-- 2차 (선택): 알림톡 / 이메일 외부 채널 통합.
--
-- 변경 사항:
-- 1) agency_message_templates: 템플릿 CRUD
-- 2) agency_message_sends: 발송 이력
--
-- 작성일: 2026-04-26
-- 참조: docs/AGENCY_STRATEGY_QUICKWIN.md (Q2)
-- ============================================================

CREATE TABLE IF NOT EXISTS agency_message_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agency_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  -- 템플릿 본문 ({{seller_name}}, {{agency_name}}, {{commission_rate}} 등 변수)
  body TEXT NOT NULL,
  -- 카테고리 (필터링 용)
  category TEXT NOT NULL DEFAULT 'general'
    CHECK (category IN ('invite','follow_up','reactivation','announcement','general')),
  is_active INTEGER NOT NULL DEFAULT 1,
  -- 사용 횟수 (효과적인 템플릿 분석)
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_by_user_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (agency_id) REFERENCES agencies(id)
);

CREATE INDEX IF NOT EXISTS idx_agency_templates_agency
  ON agency_message_templates(agency_id, is_active, category);

CREATE TABLE IF NOT EXISTS agency_message_sends (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agency_id INTEGER NOT NULL,
  template_id INTEGER,
  channel TEXT NOT NULL DEFAULT 'in_app'
    CHECK (channel IN ('in_app','alimtalk','email')),
  recipient_seller_id INTEGER,
  recipient_count INTEGER DEFAULT 1,
  -- 실제 보낸 본문 (변수 치환 후)
  rendered_body TEXT,
  status TEXT NOT NULL DEFAULT 'sent'
    CHECK (status IN ('queued','sent','failed','partial')),
  error_message TEXT,
  sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (agency_id) REFERENCES agencies(id),
  FOREIGN KEY (template_id) REFERENCES agency_message_templates(id)
);

CREATE INDEX IF NOT EXISTS idx_agency_sends_agency
  ON agency_message_sends(agency_id, sent_at DESC);
