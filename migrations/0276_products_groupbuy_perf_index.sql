-- 🛡️ 2026-05-22 perf: 공구 목록 (홈 GET /api/group-buy/products) 쿼리 가속.
--
-- 기존 인덱스 idx_products_category_active 는 (category, is_active) 만 커버.
-- WHERE: category IN (...) AND is_active=1 AND (group_buy_status=? OR 'all')
-- ORDER BY: created_at DESC
--
-- → 복합 인덱스로 group_buy_status 필터 + ORDER BY created_at 까지 인덱스 seek.
-- partial index (is_active=1) — 비활성 상품 인덱스 공간 절약.

CREATE INDEX IF NOT EXISTS idx_products_groupbuy_feed
  ON products (category, group_buy_status, created_at DESC)
  WHERE is_active = 1;
