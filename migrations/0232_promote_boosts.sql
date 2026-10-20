-- ============================================================
-- Migration 0232: 노출 부스팅 쿠폰 (Promote to Live)
-- ============================================================
-- 컨셉: TikTok Backstage 의 Promote to Live 적응.
--   - 에이전시가 셀러에게 "라이브 노출 부스팅 쿠폰" 발급
--   - 셀러가 라이브 시작 시 부스팅 활성화 → 메인 피드/카테고리 상단 노출
--   - 시간 제한 (예: 12시간/24시간/48시간)
--
-- 정책:
--   - 라이브 1회당 1개 쿠폰 사용 가능
--   - 쿠폰 등급: bronze(12h) / silver(24h) / gold(48h)
--   - 사용 후 소진
--
-- 작성: 2026-04-27 (운영 안정 + 매출 임팩트)
-- ============================================================

CREATE TABLE IF NOT EXISTS promote_boost_coupons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agency_id INTEGER NOT NULL,
  seller_id INTEGER NOT NULL,                    -- 발급 대상 셀러
  tier TEXT NOT NULL DEFAULT 'silver'
    CHECK (tier IN ('bronze', 'silver', 'gold')),
  duration_hours INTEGER NOT NULL,               -- 12 / 24 / 48
  status TEXT DEFAULT 'unused'
    CHECK (status IN ('unused', 'active', 'consumed', 'expired')),
  issued_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,                  -- 발급 후 30일 내 사용
  used_at DATETIME,
  used_live_id INTEGER,                          -- 사용된 라이브 ID
  boost_ends_at DATETIME,                        -- 부스팅 종료 시각
  note TEXT
);
CREATE INDEX IF NOT EXISTS idx_promote_seller_unused
  ON promote_boost_coupons(seller_id, status, expires_at);
CREATE INDEX IF NOT EXISTS idx_promote_active_boost
  ON promote_boost_coupons(status, boost_ends_at);
