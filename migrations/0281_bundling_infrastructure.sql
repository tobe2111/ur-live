-- ============================================================
-- Migration 0281: 합배송 인프라 (Phase 6)
-- 2026-05-25
--
-- 목적: 같은 ship-from / 같은 사용자 / 같은 배송지 묶음 처리.
--   현재 ENABLE_BUNDLING=false — UI 활성 X. 인프라만 영구 보존.
--   Phase 6 본격 도입 시 정책 ENABLE_BUNDLING=true 로 활성.
--
-- 영구성:
--   * products.bundling_key — 같은 key 끼리 합배송 (NULL = 단독 배송)
--   * orders.consolidated_with — 합배송 묶음 그룹 ID (NULL = 단독)
--   * 후속 PR 에서 체크아웃 그룹핑 로직 + 어드민 묶음 발송 UI
-- ============================================================

ALTER TABLE products ADD COLUMN bundling_key TEXT;
-- 같은 key (예: 'seller_42_warehouse_A') 끼리 묶음 가능

ALTER TABLE orders ADD COLUMN consolidated_with TEXT;
-- 합배송 그룹 ID (UUID-like). NULL = 단독 배송.

CREATE INDEX IF NOT EXISTS idx_products_bundling_key
  ON products(bundling_key) WHERE bundling_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_consolidated
  ON orders(consolidated_with) WHERE consolidated_with IS NOT NULL;
