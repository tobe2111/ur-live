-- 라이브 스트림과 상품 연결
-- Stream 1 (프리미엄 헤드폰): 상품 1, 2
INSERT OR IGNORE INTO live_stream_products (live_stream_id, product_id, created_at) VALUES
(1, 1, datetime('now')),
(1, 2, datetime('now'));

-- Stream 2 (골드 주얼리): 상품 6
INSERT OR IGNORE INTO live_stream_products (live_stream_id, product_id, created_at) VALUES
(2, 6, datetime('now'));

-- Stream 3 (스니커즈): 상품 17
INSERT OR IGNORE INTO live_stream_products (live_stream_id, product_id, created_at) VALUES
(3, 17, datetime('now'));

-- Stream 15 (팔찌 세트): 상품 6
INSERT OR IGNORE INTO live_stream_products (live_stream_id, product_id, created_at) VALUES
(15, 6, datetime('now'));

-- Stream 19 (참치): 상품 19
INSERT OR IGNORE INTO live_stream_products (live_stream_id, product_id, created_at) VALUES
(19, 19, datetime('now'));

-- Stream 20 (떡국떡): 상품 18
INSERT OR IGNORE INTO live_stream_products (live_stream_id, product_id, created_at) VALUES
(20, 18, datetime('now'));
