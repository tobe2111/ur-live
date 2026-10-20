-- 위시리스트 (찜하기) 테이블 생성
-- 작성일: 2026-02-22

-- 위시리스트 테이블
CREATE TABLE IF NOT EXISTS wishlists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT (datetime('now')),
  updated_at DATETIME DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  UNIQUE(user_id, product_id) -- 한 사용자가 같은 상품을 중복으로 찜할 수 없음
);

-- 인덱스 생성 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_wishlists_user_id ON wishlists(user_id);
CREATE INDEX IF NOT EXISTS idx_wishlists_product_id ON wishlists(product_id);
CREATE INDEX IF NOT EXISTS idx_wishlists_created_at ON wishlists(created_at DESC);

-- 위시리스트 뷰 (상품 정보 포함)
CREATE VIEW IF NOT EXISTS wishlist_details AS
SELECT 
  w.id,
  w.user_id,
  w.product_id,
  w.created_at,
  p.name as product_name,
  p.price,
  p.original_price,
  p.discount_rate,
  p.image_url,
  p.stock,
  p.category,
  p.is_active,
  s.display_name as seller_name,
  s.id as seller_id
FROM wishlists w
JOIN products p ON w.product_id = p.id
LEFT JOIN sellers s ON p.seller_id = s.id
ORDER BY w.created_at DESC;
