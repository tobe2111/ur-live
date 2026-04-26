-- ============================================================
-- Migration 0208: 에이전시 자동 정산 스케줄 (Agency P0 #3)
-- ============================================================
-- 배경: 현재 정산은 에이전시가 PIN 인증 후 수동 신청. 매주 챙겨야 하는 부담.
-- TikTok Backstage 처럼 옵션화된 자동 정산 + 소득세 3.3% 자동 차감.
--
-- 변경 사항:
-- 1) agencies.auto_settle (0/1) — 에이전시별 자동 정산 ON/OFF
-- 2) agency_settlements.tax_amount, net_amount — 세금 차감 후 실수령액
-- 3) agency_settlements.is_auto — 수동/자동 구분 (감사용)
--
-- 작성일: 2026-04-26
-- 참조: docs/AGENCY_BACKSTAGE_GAP_ANALYSIS.md (P0 #3)
-- ============================================================

ALTER TABLE agencies ADD COLUMN auto_settle INTEGER DEFAULT 0;
ALTER TABLE agency_settlements ADD COLUMN tax_amount INTEGER DEFAULT 0;
ALTER TABLE agency_settlements ADD COLUMN net_amount INTEGER DEFAULT 0;
ALTER TABLE agency_settlements ADD COLUMN is_auto INTEGER DEFAULT 0;

-- 빠른 cron 조회용
CREATE INDEX IF NOT EXISTS idx_agencies_auto_settle
  ON agencies(auto_settle) WHERE auto_settle = 1;
