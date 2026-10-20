-- 🛡️ 2026-05-17: voucher 카테고리 6종 → 4종 통합.
--
-- 변경:
--   health_voucher   → beauty_voucher  (미용/웰니스 통합)
--   pet_voucher      → etc_voucher     (기타)
--   activity_voucher → etc_voucher     (기타)
--   meal_voucher     → 유지
--   stay_voucher     → 유지
--   beauty_voucher   → 유지
--   (신규)           → etc_voucher
--
-- 영향 테이블: products.category
--   (vouchers/orders 등 다른 테이블은 product_id FK 로 카테고리 indirect — UPDATE 불필요)
--
-- 안전: products.category 컬럼은 CHECK 제약 없음 (free TEXT) → migration UPDATE 직접 가능.
--       만약 frontend / 검색 인덱스에 6종 enum hardcoded 였다면 해당 코드도 함께 갱신.

-- 1. 카테고리 통합 UPDATE
UPDATE products
SET category = 'beauty_voucher', updated_at = datetime('now')
WHERE category = 'health_voucher';

UPDATE products
SET category = 'etc_voucher', updated_at = datetime('now')
WHERE category IN ('pet_voucher', 'activity_voucher');

-- 2. 인덱스 재생성 (카테고리별 조회 빈도 높음)
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);

-- 통합 결과 통계 (확인용 — D1 console 에서 SELECT 로 검증)
-- SELECT category, COUNT(*) FROM products GROUP BY category;
