-- 상품 바코드 + 재고 입출고 관리
ALTER TABLE products ADD COLUMN barcode TEXT;
ALTER TABLE products ADD COLUMN sku_code TEXT;
ALTER TABLE products ADD COLUMN min_stock_alert INTEGER DEFAULT 5;

CREATE TABLE IF NOT EXISTS stock_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  seller_id INTEGER,
  type TEXT NOT NULL CHECK (type IN ('in', 'out', 'adjust', 'return')),
  quantity INTEGER NOT NULL,
  stock_before INTEGER NOT NULL DEFAULT 0,
  stock_after INTEGER NOT NULL DEFAULT 0,
  reason TEXT,
  memo TEXT,
  created_by TEXT,
  created_at DATETIME DEFAULT (datetime('now')),
  FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_seller ON stock_movements(seller_id);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
