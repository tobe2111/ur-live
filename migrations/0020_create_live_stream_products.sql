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

-- No initial data, to be populated later via API
