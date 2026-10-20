-- ============================================================
-- Migration 0279: 배송 시스템 재설계 (Phase 2)
-- 2026-05-25
--
-- 목적:
--   1. 지역별 추가 배송비 (제주/도서산간) — 기존 UI 만 있고 가격 미반영
--   2. 배송 추적 audit (tracker.delivery 무료 API + 외부 페이지 + cron sync 3중)
--   3. 일괄 송장 CSV 업로드 (어드민, 운영 cost ↓)
--   4. 14일 추정 → 7일 추정 + tracker.delivery 자동 갱신
--
-- 의존: orders (기존), users.id (INTEGER)
-- 영구성:
--   * orders 컬럼 추가는 idempotent ALTER (repair-schema 등록)
--   * regional_shipping_fees seed 는 idempotent INSERT
-- ============================================================

-- ── 1. orders 컬럼 추가 (배송 추적) ────────────────────────
ALTER TABLE orders ADD COLUMN region_code TEXT;
-- 'normal' | 'jeju' | 'island' | 'mountain' | 'unsupported'
ALTER TABLE orders ADD COLUMN extra_shipping_fee INTEGER NOT NULL DEFAULT 0;
ALTER TABLE orders ADD COLUMN last_tracking_sync_at DATETIME;
ALTER TABLE orders ADD COLUMN tracking_status TEXT;
-- 'pending' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'returned'
ALTER TABLE orders ADD COLUMN tracking_carrier_code TEXT;
-- tracker.delivery 표준 코드 (예: 'kr.cjlogistics' / 'kr.hanjin')

-- ── 2. regional_shipping_fees (지역 추가비 매트릭스 SSOT) ──
CREATE TABLE IF NOT EXISTS regional_shipping_fees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  region_code TEXT NOT NULL,
  -- 'jeju' / 'island' / 'mountain'
  postal_code_pattern TEXT NOT NULL,
  -- '63%' (LIKE 패턴) 또는 '40200-40299' (range, dash 구분)
  extra_fee INTEGER NOT NULL,
  description TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_regional_shipping_active
  ON regional_shipping_fees(is_active, region_code);

-- seed: 제주 / 울릉도 / 도서산간 (idempotent via NOT EXISTS check)
INSERT OR IGNORE INTO regional_shipping_fees (id, region_code, postal_code_pattern, extra_fee, description)
VALUES
  (1, 'jeju', '63%', 3000, '제주특별자치도 (63xxx)'),
  (2, 'island', '40200-40240', 5000, '울릉도'),
  (3, 'island', '23004-23010', 5000, '백령도'),
  (4, 'island', '23100-23129', 5000, '연평도'),
  (5, 'island', '46900-46999', 5000, '거제 일부 도서');

-- ── 3. shipping_tracking_events (추적 이벤트 audit) ──────
CREATE TABLE IF NOT EXISTS shipping_tracking_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  carrier_code TEXT,
  tracking_number TEXT,
  status TEXT NOT NULL,
  -- pending / in_transit / out_for_delivery / delivered / returned / error
  status_text TEXT,
  -- 택배사 raw 텍스트 ("배송중", "배달완료" 등)
  location TEXT,
  occurred_at DATETIME,
  -- 택배사 이벤트 발생 시각 (서버 sync 시각과 별도)
  source TEXT NOT NULL DEFAULT 'tracker_delivery',
  -- 'tracker_delivery' | 'manual' | 'cron'
  raw_response TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id)
);

CREATE INDEX IF NOT EXISTS idx_shipping_events_order
  ON shipping_tracking_events(order_id, created_at DESC);

-- ── 4. 부분 정리 (deprecated 컬럼 표시만, 데이터 보존) ─────
-- sellers.shipping_fee (구) 는 향후 별도 cleanup migration 에서 DROP.
-- 현재는 base_shipping_fee 와 병존 (TECHNICAL_DEBT.md #56-58).
