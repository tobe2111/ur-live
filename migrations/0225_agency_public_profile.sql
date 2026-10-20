-- ============================================================
-- Migration 0225: 에이전시 공개 브랜딩 페이지 컬럼
-- ============================================================
-- 컨셉: 에이전시별 공개 페이지 (/agency/<slug>) 노출.
-- 셀러 영입 폼 + 소속 셀러 + 누적 매출 표시.
--
-- 작성: 2026-04-27 (Phase 1-7)
-- ============================================================

ALTER TABLE agencies ADD COLUMN slug TEXT;
ALTER TABLE agencies ADD COLUMN bio TEXT;
ALTER TABLE agencies ADD COLUMN logo_url TEXT;
ALTER TABLE agencies ADD COLUMN cover_url TEXT;
ALTER TABLE agencies ADD COLUMN public_show_revenue INTEGER DEFAULT 0;  -- 매출 노출 여부 (개인정보 보호)
ALTER TABLE agencies ADD COLUMN public_show_sellers INTEGER DEFAULT 1;  -- 소속 셀러 노출 여부

CREATE UNIQUE INDEX IF NOT EXISTS idx_agencies_slug ON agencies(slug) WHERE slug IS NOT NULL;
