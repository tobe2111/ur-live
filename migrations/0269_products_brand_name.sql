-- 🛡️ 2026-05-19: products.brand_name 컬럼 추가 — KT Alpha 교환권 브랜드 2차 분류.
--
--   카테고리 (편의점/카페 등) 1차 분류 + 브랜드 (스타벅스/GS25 등) 2차 분류.
--   gift_catalog.brand_name 을 products.brand_name 에 복제.

ALTER TABLE products ADD COLUMN brand_name TEXT;
CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand_name) WHERE brand_name IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_category_brand ON products(category, brand_name);
