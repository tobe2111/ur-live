-- ============================================================
-- Migration 0231: 에이전시 자사 이벤트 (매출 챌린지)
-- ============================================================
-- 컨셉: TikTok Backstage 의 "자사(Self) 이벤트" 적응.
--   - 에이전시가 자체 매출 챌린지 / 보상 이벤트 생성
--   - 셀러들이 자유 참여 → 달성 시 추가 보상 (딜)
--   - PK 이벤트 (1:1 대결) 와 별개 — 자사 이벤트는 N명 챌린지
--
-- 보상 정책:
--   - 매출 달성 셀러에게 자동 딜 지급
--   - 또는 어드민 수동 처리
--
-- 작성: 2026-04-27 (운영 안정 + 매출 임팩트)
-- ============================================================

CREATE TABLE IF NOT EXISTS agency_self_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agency_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  metric TEXT NOT NULL,                          -- 'revenue' | 'live_count' | 'viewer_peak'
  target_value INTEGER NOT NULL,                 -- 달성 목표 (예: 100만 딜)
  reward_deal INTEGER NOT NULL DEFAULT 0,        -- 달성 시 보상 (딜)
  max_winners INTEGER DEFAULT 100,               -- 보상 받을 수 있는 최대 인원
  status TEXT DEFAULT 'active'
    CHECK (status IN ('active', 'ended', 'cancelled')),
  created_by_email TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_self_events_agency_status
  ON agency_self_events(agency_id, status, end_date);

-- 셀러 참여 + 진행 추적
CREATE TABLE IF NOT EXISTS agency_self_event_participants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL,
  seller_id INTEGER NOT NULL,
  joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  current_value INTEGER DEFAULT 0,               -- 현재 누적 (cron 으로 갱신)
  achieved INTEGER DEFAULT 0,                    -- 0: 미달성, 1: 달성
  achieved_at DATETIME,
  reward_paid INTEGER DEFAULT 0,                 -- 0: 미지급, 1: 지급 완료
  UNIQUE (event_id, seller_id)
);
CREATE INDEX IF NOT EXISTS idx_self_event_participants_event
  ON agency_self_event_participants(event_id, achieved DESC, current_value DESC);
