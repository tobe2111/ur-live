-- 주문 관리 시스템 개선
-- 실행: npx wrangler d1 migrations apply toss-live-commerce-db --local
-- 프로덕션: npx wrangler d1 migrations apply toss-live-commerce-db --remote

-- 1. orders 테이블에 필드 추가 (프로덕션에는 이미 모든 컬럼 존재)
-- 로컬에만 적용 - 주석 처리 (프로덕션에서는 이미 존재)
-- ALTER TABLE orders ADD COLUMN shipping_name TEXT;
-- ALTER TABLE orders ADD COLUMN shipping_phone TEXT;
-- ALTER TABLE orders ADD COLUMN shipping_address TEXT;
-- ALTER TABLE orders ADD COLUMN shipping_memo TEXT;

-- 2. order_items 테이블에 상품 정보 스냅샷 추가
-- product_name, product_image, seller_id는 이미 존재하므로 스킵
-- ALTER TABLE order_items ADD COLUMN product_name TEXT NOT NULL DEFAULT '';
-- ALTER TABLE order_items ADD COLUMN product_image TEXT;
ALTER TABLE order_items ADD COLUMN option_name TEXT;
-- ALTER TABLE order_items ADD COLUMN seller_id INTEGER;

-- 3. 인덱스 추가
-- seller_id 컬럼이 없으므로 주석 처리
-- CREATE INDEX IF NOT EXISTS idx_order_items_seller_id ON order_items(seller_id);

-- 4. 테스트 주문 데이터 추가는 seed.sql에서 처리
-- user_id=1이 존재하지 않을 수 있으므로 주석 처리

-- 5. 테스트 주문 상품 추가는 seed.sql에서 처리
