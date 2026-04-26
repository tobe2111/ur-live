-- ============================================================
-- Migration 0216: 쿠폰 캐스케이드 — 에이전시 → 셀러 → 시청자 (Q7)
-- ============================================================
-- 배경: TikTok Backstage 5.3 의 프로모션 쿠폰 3단 흐름.
-- 현재: 셀러 → 시청자 (단일 단계)
-- 목표: 에이전시 → 셀러 (배포) → 시청자 (발급)
--
-- 변경 사항:
-- 1) coupons.distributed_by_agency_id — 에이전시가 배포한 쿠폰 표시
-- 2) coupons.distribution_target_seller_ids — 어느 셀러에게 배포됐는지 (JSON 배열)
-- 3) agency_coupon_distributions — 배포 이력
--
-- 작성일: 2026-04-26
-- 참조: docs/AGENCY_STRATEGY_QUICKWIN.md (Q7)
-- ============================================================

ALTER TABLE coupons ADD COLUMN distributed_by_agency_id INTEGER;
ALTER TABLE coupons ADD COLUMN parent_coupon_id INTEGER;  -- 에이전시 원본 쿠폰 → 셀러별 복제 시 부모 추적

CREATE INDEX IF NOT EXISTS idx_coupons_agency
  ON coupons(distributed_by_agency_id) WHERE distributed_by_agency_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_coupons_parent
  ON coupons(parent_coupon_id) WHERE parent_coupon_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS agency_coupon_distributions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agency_id INTEGER NOT NULL,
  parent_coupon_id INTEGER NOT NULL,    -- 에이전시 원본 쿠폰
  seller_id INTEGER NOT NULL,
  child_coupon_id INTEGER NOT NULL,     -- 셀러별 복제된 쿠폰
  -- 셀러에게 배포된 수량 (셀러가 시청자에게 발급할 수 있는 한도)
  quantity_per_seller INTEGER NOT NULL DEFAULT 0,
  distributed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (agency_id, parent_coupon_id, seller_id),
  FOREIGN KEY (agency_id) REFERENCES agencies(id),
  FOREIGN KEY (parent_coupon_id) REFERENCES coupons(id),
  FOREIGN KEY (seller_id) REFERENCES sellers(id),
  FOREIGN KEY (child_coupon_id) REFERENCES coupons(id)
);

CREATE INDEX IF NOT EXISTS idx_coupon_dist_agency
  ON agency_coupon_distributions(agency_id, distributed_at DESC);
