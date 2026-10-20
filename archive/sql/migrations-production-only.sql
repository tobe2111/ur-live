-- 프로덕션 전용: 주문 시스템 개선
-- 프로덕션 orders 테이블은 이미 order_number, shipping_* 필드 보유
-- 프로덕션 order_items는 이미 product_name, option_info 보유

-- 1. orders 테이블에 shipping_memo만 추가
ALTER TABLE orders ADD COLUMN shipping_memo TEXT;

-- 2. order_items 테이블에 추가 필드 (product_name은 이미 존재)
ALTER TABLE order_items ADD COLUMN product_image TEXT;
ALTER TABLE order_items ADD COLUMN seller_id INTEGER;

-- 3. 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_order_items_seller_id ON order_items(seller_id);

-- 4. 테스트 주문 데이터 추가 (order_number 사용)
INSERT OR IGNORE INTO orders (id, user_id, order_number, total_amount, payment_status, shipping_name, shipping_phone, shipping_address) 
VALUES 
  (1, 1, 'ORDER-20260202-001', 89000, 'approved', '김토스', '010-1234-5678', '서울시 강남구 테헤란로 1234'),
  (2, 1, 'ORDER-20260202-002', 249000, 'approved', '김토스', '010-1234-5678', '서울시 강남구 테헤란로 1234');

-- 5. 테스트 주문 상품 추가
INSERT OR IGNORE INTO order_items (id, order_id, product_id, quantity, price, product_name, product_image, seller_id) 
VALUES 
  (1, 1, 1, 1, 89000, '프리미엄 겨울 패딩', 'https://picsum.photos/400/400?random=1', 1),
  (2, 2, 4, 1, 249000, '스마트워치 프로', 'https://picsum.photos/400/400?random=2', 2);
