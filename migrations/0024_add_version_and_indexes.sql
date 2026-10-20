-- Add version column for optimistic locking
-- 낙관적 락을 위한 버전 컬럼 추가

ALTER TABLE products ADD COLUMN version INTEGER DEFAULT 0;

-- Update existing products to have version 0
UPDATE products SET version = 0 WHERE version IS NULL;

-- Create performance indexes
-- 성능 최적화를 위한 인덱스 추가

-- 주문 조회 최적화
CREATE INDEX IF NOT EXISTS idx_orders_user_created ON orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_seller_status ON orders(seller_id, payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_number ON orders(order_number);

-- 주문 아이템 조회 최적화
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id);

-- 상품 조회 최적화
CREATE INDEX IF NOT EXISTS idx_products_seller_active ON products(seller_id, is_active);
CREATE INDEX IF NOT EXISTS idx_products_stream_active ON products(live_stream_id, is_active);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);

-- 장바구니 조회 최적화
CREATE INDEX IF NOT EXISTS idx_cart_user ON cart_items(user_id, added_at DESC);
CREATE INDEX IF NOT EXISTS idx_cart_product ON cart_items(product_id);

-- 라이브 스트림 조회 최적화
CREATE INDEX IF NOT EXISTS idx_streams_status ON live_streams(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_streams_seller ON live_streams(seller_id, status);

-- 세션 조회 최적화
CREATE INDEX IF NOT EXISTS idx_sessions_token ON admin_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_sessions_seller ON admin_sessions(seller_id);
