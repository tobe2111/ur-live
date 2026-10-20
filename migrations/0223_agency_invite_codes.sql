-- ============================================================
-- Migration 0223: 에이전시 영입 코드 (QR / 링크)
-- ============================================================
-- 컨셉: TikTok Backstage QR 영입 시스템 적응. 에이전시별 고유 코드 발급
--   → 셀러가 회원가입 시 ?invite=<code> 로 자동 매핑.
--
-- 정책: 7일 유효 (TikTok 동일), 최대 사용 횟수 제한 (기본 100회).
-- 만료된 코드는 멱등 cleanup cron 으로 정리 가능 (옵션).
--
-- 작성: 2026-04-27 (Phase 1-3)
-- ============================================================

CREATE TABLE IF NOT EXISTS agency_invite_codes (
  code TEXT PRIMARY KEY,                -- 8자 영숫자 (대문자만)
  agency_id INTEGER NOT NULL,
  label TEXT,                           -- 에이전시가 메모 (예: "오프라인 박람회용")
  max_uses INTEGER DEFAULT 100,
  used_count INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_by_email TEXT,                -- 발급자 (에이전시 멤버 이메일)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL          -- 발급 시 +7일
);
CREATE INDEX IF NOT EXISTS idx_agency_invite_codes_agency
  ON agency_invite_codes(agency_id, is_active, expires_at);

-- 영입 사용 로그 (어떤 셀러가 어떤 코드로 가입했는지)
CREATE TABLE IF NOT EXISTS agency_invite_usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL,
  agency_id INTEGER NOT NULL,
  seller_id INTEGER NOT NULL,
  used_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_agency_invite_usage_code
  ON agency_invite_usage(code, used_at DESC);
CREATE INDEX IF NOT EXISTS idx_agency_invite_usage_agency
  ON agency_invite_usage(agency_id, used_at DESC);
