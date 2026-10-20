-- Cafe24 OAuth tokens
CREATE TABLE IF NOT EXISTS cafe24_auth (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mall_id TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  scopes TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Cafe24 product mapping (cafe24 product_no <-> our product id)
CREATE TABLE IF NOT EXISTS cafe24_product_map (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cafe24_product_no INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  cafe24_mall_id TEXT NOT NULL,
  last_synced_at TEXT DEFAULT (datetime('now')),
  UNIQUE(cafe24_product_no, cafe24_mall_id),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);
