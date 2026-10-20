-- Migration 0245: 신규 셀러 ↔ 에이전시 자동 매칭
-- Date: 2026-05-05
--
-- 매일 18시 배치가 가입 60일 이내 + 무소속 셀러를 스코어링해
-- 가장 적합한 에이전시에 자동 매칭 제안을 생성합니다.
--
-- 에이전시가 수락(accepted) → agency_sellers INSERT
-- 30일 내 응답 없으면 만료(expired)로 처리 (다음 배치가 재제안 가능)

CREATE TABLE IF NOT EXISTS agency_match_suggestions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  seller_id    INTEGER NOT NULL,
  agency_id    INTEGER NOT NULL,
  score        REAL    NOT NULL DEFAULT 0,           -- 매칭 점수 (높을수록 적합)
  status       TEXT    NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','accepted','declined','expired')),
  match_reason TEXT,                                 -- JSON: 점수 근거 요약
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at   DATETIME NOT NULL,                    -- 30일 후 자동 만료
  responded_at DATETIME,
  UNIQUE(seller_id, agency_id)                       -- 같은 쌍 중복 방지
);

CREATE INDEX IF NOT EXISTS idx_ams_seller  ON agency_match_suggestions(seller_id, status);
CREATE INDEX IF NOT EXISTS idx_ams_agency  ON agency_match_suggestions(agency_id, status);
CREATE INDEX IF NOT EXISTS idx_ams_expires ON agency_match_suggestions(expires_at, status);
