-- ============================================================
-- Migration 0218: 에이전시 라이브 노트 (M5)
-- ============================================================
-- 배경: TikTok Backstage 5.2 의 라이브 캘린더 + 에이전트 노트.
-- 에이전시가 진행 중 / 종료된 라이브에 메모/가이드 남기는 기능.
--
-- 활용:
-- - 라이브 진행 중 에이전트가 시기적절한 가이드 제공
-- - 라이브 종료 후 셀러에게 피드백
-- - 캠페인 진행 상황 기록
-- - 운영 이슈 추적
--
-- 작성일: 2026-04-26 (M5)
-- 참조: docs/AGENCY_BACKSTAGE_LEARNING.md (D)
-- ============================================================

CREATE TABLE IF NOT EXISTS agency_live_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agency_id INTEGER NOT NULL,
  live_stream_id INTEGER NOT NULL,
  -- 작성자: agency_members.id (M4) 또는 에이전시 owner (NULL)
  agent_member_id INTEGER,
  -- 노트 유형
  type TEXT NOT NULL DEFAULT 'guidance'
    CHECK (type IN ('guidance','issue','highlight','reminder')),
  -- 본문
  content TEXT NOT NULL,
  -- 라이브 시점 (라이브 시작 후 N초 — 영상 타임라인 매핑)
  live_timestamp_seconds INTEGER,
  -- 셀러에게 표시할지 여부 (true 면 셀러도 볼 수 있음)
  visible_to_seller INTEGER NOT NULL DEFAULT 0,
  -- 셀러가 읽었는지
  read_by_seller_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (agency_id) REFERENCES agencies(id),
  FOREIGN KEY (live_stream_id) REFERENCES live_streams(id),
  FOREIGN KEY (agent_member_id) REFERENCES agency_members(id)
);

CREATE INDEX IF NOT EXISTS idx_live_notes_agency_stream
  ON agency_live_notes(agency_id, live_stream_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_live_notes_seller_visible
  ON agency_live_notes(live_stream_id, visible_to_seller, read_by_seller_at);
