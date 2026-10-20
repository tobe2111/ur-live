-- 🛡️ 2026-05-17: products.product_type CHECK 제거.
--
-- 배경: migration 0010 정의 'CHECK(product_type IN ("live","featured"))'.
--   cafe24 import 코드 (cafe24-api.service.ts:389) 가 'synced' 사용 → CHECK 위반 → 500 (silent fail 아님!).
--   cafe24 동기화 실패 사용자 인지 어려움.
--
-- 해결: CHECK 제거 (0118 패턴).

ALTER TABLE products ADD COLUMN _product_type_bak TEXT;
UPDATE products SET _product_type_bak = product_type;
ALTER TABLE products DROP COLUMN product_type;
ALTER TABLE products ADD COLUMN product_type TEXT DEFAULT 'featured';
UPDATE products SET product_type = COALESCE(_product_type_bak, 'featured');
ALTER TABLE products DROP COLUMN _product_type_bak;

CREATE INDEX IF NOT EXISTS idx_products_type ON products(product_type);
