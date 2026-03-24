-- ============================================================
-- 0111_fix_db_integrity.sql
-- DB 무결성 수정: 누락 테이블 생성, FK 참조 문서화
-- ============================================================
-- Note: SQLite는 외래 키 제약 조건을 런타임에서만 강제함.
-- 0012/0034에서 order_no 참조는 실제로는 적용 안 되므로
-- 여기서 누락 테이블과 인덱스만 추가합니다.
-- ============================================================

-- 1. search_logs 테이블 (ProductRepository에서 참조하나 누락됨)
CREATE TABLE IF NOT EXISTS search_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  search_query TEXT NOT NULL,
  results_count INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_search_logs_user_id ON search_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_search_logs_created_at ON search_logs(created_at);

-- 2. alimtalk_templates에 is_active 컬럼 추가 (admin 대시보드에서 참조)
ALTER TABLE alimtalk_templates ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1;

-- 3. 상품 테이블 — image_url 컬럼 (구 스키마 호환)
-- 일부 쿼리가 thumbnail_url 대신 image_url 참조
ALTER TABLE products ADD COLUMN image_url TEXT;

-- 4. order_items — price 컬럼 alias (unit_price가 실제 컬럼명)
-- admin-management.routes.ts가 oi.price를 참조하므로 별칭 뷰 생성
CREATE VIEW IF NOT EXISTS order_items_view AS
  SELECT
    id,
    order_id,
    product_id,
    seller_id,
    product_name,
    product_image,
    options,
    quantity,
    unit_price AS price,
    unit_price,
    subtotal,
    status,
    created_at,
    updated_at
  FROM order_items;

-- 5. live_streams — 누락 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_live_streams_seller_id ON live_streams(seller_id);
CREATE INDEX IF NOT EXISTS idx_live_streams_status ON live_streams(status);
CREATE INDEX IF NOT EXISTS idx_live_streams_created_at ON live_streams(created_at);

-- 6. products — 누락 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_products_seller_id ON products(seller_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at);

-- 7. orders — 누락 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_seller_id ON orders(seller_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);

-- 8. users — 누락 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- 9. sellers — 누락 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_sellers_status ON sellers(status);
CREATE INDEX IF NOT EXISTS idx_sellers_email ON sellers(email);
