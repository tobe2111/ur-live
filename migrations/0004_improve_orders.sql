-- 주문 관리 시스템 개선
-- 실행: npx wrangler d1 migrations apply toss-live-commerce-db --local
-- 프로덕션: npx wrangler d1 migrations apply toss-live-commerce-db --remote

-- 1. orders 테이블에 필드 추가
ALTER TABLE orders ADD COLUMN shipping_name TEXT;
ALTER TABLE orders ADD COLUMN shipping_phone TEXT;
ALTER TABLE orders ADD COLUMN shipping_address TEXT;
ALTER TABLE orders ADD COLUMN shipping_memo TEXT;

-- 2. order_items 테이블에 상품 정보 스냅샷 추가
ALTER TABLE order_items ADD COLUMN product_name TEXT NOT NULL DEFAULT '';
ALTER TABLE order_items ADD COLUMN product_image TEXT;
ALTER TABLE order_items ADD COLUMN option_name TEXT;
ALTER TABLE order_items ADD COLUMN seller_id INTEGER;

-- 3. 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_order_items_seller_id ON order_items(seller_id);

-- 4. 테스트 주문 데이터 추가
INSERT OR IGNORE INTO orders (id, user_id, order_no, total_amount, status, payment_method, shipping_name, shipping_phone, shipping_address) 
VALUES 
  (1, 1, 'ORDER-20260202-001', 89000, 'PAY_COMPLETE', 'CARD', '김토스', '010-1234-5678', '서울시 강남구 테헤란로 1234'),
  (2, 1, 'ORDER-20260202-002', 249000, 'SHIPPING', 'CARD', '김토스', '010-1234-5678', '서울시 강남구 테헤란로 1234');

-- 5. 테스트 주문 상품 추가
INSERT OR IGNORE INTO order_items (id, order_id, product_id, quantity, price, product_name, product_image, seller_id) 
VALUES 
  (1, 1, 1, 1, 89000, '프리미엄 겨울 패딩', 'https://picsum.photos/400/400?random=1', 1),
  (2, 2, 4, 1, 249000, '스마트워치 프로', 'https://picsum.photos/400/400?random=2', 2);
