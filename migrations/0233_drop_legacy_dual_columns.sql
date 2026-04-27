-- ============================================================
-- 0233 — Drop legacy dual columns (TD-005 정규화)
-- ============================================================
--
-- 배경: 프로덕션 DB 에 동일 의미의 컬럼이 이중으로 존재.
--   products.stock (canonical) ↔ products.stock_quantity (legacy)
--   sellers.shipping_fee (canonical) ↔ sellers.base_shipping_fee (legacy)
--
-- 코드는 COALESCE(stock, stock_quantity, 0) 형태 방어 패턴으로 둘 다 처리 중.
-- 이는 type safety 부재 + 새 개발자 혼란 + 한쪽만 update 하는 버그 가능성.
--
-- ── 실행 전제 ──
--   1. 코드에서 stock_quantity / base_shipping_fee write 가 모두 canonical 로 변경됨
--      (이 migration 적용 전 코드 PR 선행)
--   2. TD-001 (D1 Migration CI) 해결됨 — wrangler d1 migrations apply 수동 실행 가능
--   3. 백업: D1 console export 1회 수행
--
-- ── 적용 단계 ──
--   1. UPDATE 로 stock_quantity → stock 동기화 (canonical 누락 row 보정)
--   2. ALTER TABLE 로 legacy 컬럼 DROP (SQLite 는 0036 부터 DROP COLUMN 지원)
--
-- ── 롤백 ──
--   ALTER TABLE products ADD COLUMN stock_quantity INTEGER DEFAULT 0;
--   ALTER TABLE sellers ADD COLUMN base_shipping_fee INTEGER DEFAULT 3000;
--   (값 손실 — 백업 import 필요)
-- ============================================================

-- 1) products: stock 이 NULL 이면 stock_quantity 값으로 동기화
UPDATE products
SET stock = COALESCE(stock, stock_quantity, 0)
WHERE stock IS NULL OR stock = 0;

-- 2) sellers: shipping_fee 이 NULL 이면 base_shipping_fee 값으로 동기화
UPDATE sellers
SET shipping_fee = COALESCE(shipping_fee, base_shipping_fee, 3000)
WHERE shipping_fee IS NULL OR shipping_fee = 0;

-- 3) Drop legacy columns (SQLite 3.36+ 필요)
-- ⚠️ Cloudflare D1 의 SQLite 버전은 3.45+ — DROP COLUMN 지원 확인됨 (2024).
ALTER TABLE products DROP COLUMN stock_quantity;
ALTER TABLE sellers DROP COLUMN base_shipping_fee;

-- 4) 검증 쿼리 (수동 실행)
--   SELECT COUNT(*) FROM pragma_table_info('products') WHERE name='stock_quantity';  -- 0
--   SELECT COUNT(*) FROM pragma_table_info('sellers') WHERE name='base_shipping_fee';  -- 0
