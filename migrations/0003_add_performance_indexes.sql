-- 성능 최적화를 위한 인덱스 추가

-- 상품 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_products_active_stock ON products(is_active, stock);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_seller_id ON products(seller_id);
CREATE INDEX IF NOT EXISTS idx_products_name_search ON products(name);

-- 라이브 스트림 인덱스
CREATE INDEX IF NOT EXISTS idx_live_streams_status ON live_streams(status);
CREATE INDEX IF NOT EXISTS idx_live_streams_seller_id ON live_streams(seller_id);

-- 주문 테이블 인덱스
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);

-- 장바구니 인덱스
CREATE INDEX IF NOT EXISTS idx_cart_items_user_id ON cart_items(user_id);

-- 판매자 인덱스
CREATE INDEX IF NOT EXISTS idx_sellers_is_featured ON sellers(is_featured_seller);

-- 성능 분석 쿼리 (주석 처리)
-- EXPLAIN QUERY PLAN SELECT * FROM products WHERE is_active = 1 AND stock > 0;
