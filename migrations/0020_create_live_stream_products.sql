-- Create live_stream_products junction table
CREATE TABLE IF NOT EXISTS live_stream_products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  live_stream_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (live_stream_id) REFERENCES live_streams(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  UNIQUE(live_stream_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_live_stream_products_stream ON live_stream_products(live_stream_id);
CREATE INDEX IF NOT EXISTS idx_live_stream_products_product ON live_stream_products(product_id);

-- Link existing streams with products
INSERT OR IGNORE INTO live_stream_products (live_stream_id, product_id, created_at) VALUES
-- Stream 1 (프리미엄 헤드폰): products 1, 2
(1, 1, datetime('now')),
(1, 2, datetime('now')),
-- Stream 2 (골드 주얼리): product 6
(2, 6, datetime('now')),
-- Stream 3 (스니커즈): product 17
(3, 17, datetime('now')),
-- Stream 15 (팔찌): product 6
(15, 6, datetime('now')),
-- Stream 19 (참치): product 19
(19, 19, datetime('now')),
-- Stream 20 (떡국떡): product 18
(20, 18, datetime('now'));
