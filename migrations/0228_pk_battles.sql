-- ============================================================
-- Migration 0228: PK 이벤트 (셀러 vs 셀러 매출 경쟁)
-- ============================================================
-- 컨셉: TikTok LIVE 의 PK 이벤트 적응. 두 셀러가 30분 동안 매출 경쟁,
--   시청자 응원 = 시청자 결제 = 매출. 시간 종료 시 매출 높은 셀러 우승.
--
-- 정책:
--   - 에이전시가 PK 매칭 (소속 셀러 2명)
--   - 두 셀러 모두 라이브 중이어야 함
--   - 지속 시간: 15/30/60분
--   - 우승 시 시스템 자동 보상 (어드민 설정 가능)
--
-- 작성: 2026-04-27 (Phase 2-7)
-- ============================================================

CREATE TABLE IF NOT EXISTS pk_battles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agency_id INTEGER,                                    -- 매칭한 에이전시 (NULL 가능 = 어드민 매칭)
  seller_a_id INTEGER NOT NULL,
  seller_b_id INTEGER NOT NULL,
  live_a_id INTEGER,                                    -- 셀러 A 의 라이브 ID
  live_b_id INTEGER,                                    -- 셀러 B 의 라이브 ID
  duration_minutes INTEGER NOT NULL,                    -- 15/30/60
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'live', 'ended', 'cancelled')),
  started_at DATETIME,
  ends_at DATETIME,
  revenue_a INTEGER DEFAULT 0,                          -- 셀러 A 매출 (실시간 집계)
  revenue_b INTEGER DEFAULT 0,                          -- 셀러 B 매출
  winner_seller_id INTEGER,                             -- 종료 후 결정
  winner_reward_deal INTEGER DEFAULT 0,                 -- 우승자 보상
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_pk_battles_agency
  ON pk_battles(agency_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pk_battles_active
  ON pk_battles(status, ends_at);
