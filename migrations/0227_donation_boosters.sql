-- ============================================================
-- Migration 0227: 라이브 후원 부스터 이벤트
-- ============================================================
-- 컨셉: 셀러가 라이브 중 일정 시간 동안 후원 2배 매칭 발동.
-- 시청자가 후원 시 우리 시스템이 매칭 금액 자동 계산 + 표시.
--
-- 정책:
--   - 셀러 1회 라이브 당 최대 1회 부스터
--   - 부스터 지속 시간: 5/10/15분 중 선택
--   - 매칭률: 1.5x / 2x / 3x 중 선택 (높을수록 짧음)
--   - 매칭 금액은 시청자 결제와 별개로 셀러 수익에서 차감
--     (또는 어드민이 보상 — 정책 결정용 컬럼 booster_payer 으로 추후 확장)
--
-- 작성: 2026-04-27 (Phase 2-5)
-- ============================================================

CREATE TABLE IF NOT EXISTS donation_boosters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  live_stream_id INTEGER NOT NULL,
  seller_id INTEGER NOT NULL,
  multiplier REAL NOT NULL DEFAULT 2.0,    -- 매칭 배수 (1.5/2/3)
  duration_seconds INTEGER NOT NULL,       -- 지속 시간 (300/600/900)
  started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  ends_at DATETIME NOT NULL,
  total_donation_amount INTEGER DEFAULT 0, -- 부스터 동안 받은 후원 합계
  total_matched_amount INTEGER DEFAULT 0,  -- 매칭으로 추가된 금액
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'ended', 'cancelled'))
);
CREATE INDEX IF NOT EXISTS idx_donation_boosters_live
  ON donation_boosters(live_stream_id, status);
CREATE INDEX IF NOT EXISTS idx_donation_boosters_seller
  ON donation_boosters(seller_id, started_at DESC);
