-- ============================================================
-- Migration 0212: 에이전시 등급제 (Tier: New/Junior/Senior) - Q1
-- ============================================================
-- 배경: TikTok Backstage 의 핵심 운영 메커니즘. 등급별 기대치/보상 차등화.
--
-- 변경 사항:
-- 1) agencies.tier (new/junior/senior)
-- 2) agencies.tier_evaluated_at — 마지막 자동 평가 시각
-- 3) agencies.tier_locked — 어드민 수동 override 시 1 (자동 평가 무시)
--
-- 등급 기준 (한국 기준):
-- - 신규(new):    가입 후 90일 이내, 전월 매출 < 500만원
-- - 주니어(junior): 가입 후 90일 이상, 전월 매출 < 500만원
-- - 시니어(senior): 전월 매출 ≥ 500만원
--
-- TikTok 원본:
-- - 신규: 6개월 이내 + 다이아 500만 이하
-- - 주니어: 6개월 이상 + 다이아 500만 이하
-- - 시니어: 전월 다이아 500만 이상
--
-- 작성일: 2026-04-26
-- 참조: docs/AGENCY_STRATEGY_QUICKWIN.md (Q1)
-- ============================================================

ALTER TABLE agencies ADD COLUMN tier TEXT NOT NULL DEFAULT 'new'
  CHECK (tier IN ('new','junior','senior'));
ALTER TABLE agencies ADD COLUMN tier_evaluated_at DATETIME;
ALTER TABLE agencies ADD COLUMN tier_locked INTEGER NOT NULL DEFAULT 0;

-- 빠른 조회
CREATE INDEX IF NOT EXISTS idx_agencies_tier ON agencies(tier, status);
