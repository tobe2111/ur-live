-- Migration 0025: Advanced Composite Indexes for Query Optimization
-- 복합 쿼리 성능 최적화를 위한 추가 인덱스

-- seller_business_info 테이블 인덱스 (tax invoice 조회 최적화)
CREATE INDEX IF NOT EXISTS idx_seller_business_seller ON seller_business_info(seller_id);

-- shipping_addresses 테이블 인덱스 (사용자 배송지 조회 최적화)
CREATE INDEX IF NOT EXISTS idx_shipping_user_default ON shipping_addresses(user_id, is_default DESC);

-- product_options 테이블 복합 인덱스 (상품 옵션 조회 최적화)
CREATE INDEX IF NOT EXISTS idx_product_options_product ON product_options(product_id);

-- orders 테이블 추가 복합 인덱스 (주문 검색 최적화)
CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders(payment_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_user_payment ON orders(user_id, payment_status, created_at DESC);

-- 기존 인덱스 효율성 분석을 위한 ANALYZE 실행
ANALYZE;
