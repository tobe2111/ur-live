-- ============================================================
-- Migration 0213: 에이전시 셀러 신청 자동 평가 (Q3)
-- ============================================================
-- 배경: TikTok Backstage 의 신청 평가 모델
--   = 라이브 시청 시작 후 30일 동안 라이브 진행 시간 평가
-- 우리: 신규 셀러가 가입 후 30일 동안 활동 데이터 (라이브 시간 + 매출)
--      자동으로 evaluation_score 계산 → 어드민 추천만 (자동 처리 X)
--
-- 변경 사항:
-- 1) agency_creator_approvals.evaluated_at — 자동 평가 완료 시각
-- 2) agency_creator_approvals.evaluation_score (0~100)
-- 3) agency_creator_approvals.auto_decision (recommend_approve / recommend_reject / inconclusive)
-- 4) agency_creator_approvals.evaluation_data (JSON snapshot)
--
-- 작성일: 2026-04-26
-- 참조: docs/AGENCY_STRATEGY_QUICKWIN.md (Q3)
-- ============================================================

ALTER TABLE agency_creator_approvals ADD COLUMN evaluated_at DATETIME;
ALTER TABLE agency_creator_approvals ADD COLUMN evaluation_score REAL;
ALTER TABLE agency_creator_approvals ADD COLUMN auto_decision TEXT
  CHECK (auto_decision IN ('recommend_approve', 'recommend_reject', 'inconclusive'));
ALTER TABLE agency_creator_approvals ADD COLUMN evaluation_data TEXT;  -- JSON

-- 빠른 조회 (cron 매일 evaluated_at IS NULL 인 30일 경과 신청 찾기)
CREATE INDEX IF NOT EXISTS idx_approvals_eval
  ON agency_creator_approvals(status, evaluated_at, created_at);
