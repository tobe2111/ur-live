-- ============================================================
-- Migration 0215: 에이전시 의무 작업 (Q6)
-- ============================================================
-- 배경: TikTok Backstage 1.2 4부 — 매월 반드시 지켜야 하는 작업 3종
--   1) 유키 크리에이터 육성 과제
--   2) 매출 과제 (신규/주니어 대상)
--   3) 크리에이터 활성화 작업
--
-- 1차 구현: 진행률 표시만 (페널티 없음). 등급 평가 입력값으로 활용.
--
-- 변경 사항:
-- 1) agency_monthly_tasks: 월별 의무 작업 진행 상황
--
-- 작성일: 2026-04-26
-- 참조: docs/AGENCY_STRATEGY_QUICKWIN.md (Q6)
-- ============================================================

CREATE TABLE IF NOT EXISTS agency_monthly_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agency_id INTEGER NOT NULL,
  month TEXT NOT NULL,                    -- YYYY-MM
  -- task_type: 어떤 의무 작업인지
  task_type TEXT NOT NULL CHECK (task_type IN (
    'creator_growth',      -- 신규 크리에이터 영입 N명
    'sales_quota',         -- 월 매출 N원
    'activation'           -- 1시간 이상 라이브 진행 셀러 N명
  )),
  target_value INTEGER NOT NULL,
  actual_value INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'in_progress'
    CHECK (status IN ('in_progress','completed','failed')),
  completed_at DATETIME,
  last_calculated_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (agency_id, month, task_type),
  FOREIGN KEY (agency_id) REFERENCES agencies(id)
);

CREATE INDEX IF NOT EXISTS idx_agency_tasks_agency_month
  ON agency_monthly_tasks(agency_id, month);
