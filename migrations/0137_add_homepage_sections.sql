-- 홈페이지 커스텀 섹션 관리
CREATE TABLE IF NOT EXISTS homepage_sections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  subtitle TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  layout TEXT DEFAULT 'grid3' CHECK (layout IN ('grid3', 'grid2', 'scroll')),
  created_at DATETIME DEFAULT (datetime('now')),
  updated_at DATETIME DEFAULT (datetime('now'))
);

-- 섹션에 포함된 상품
CREATE TABLE IF NOT EXISTS section_products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  section_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (section_id) REFERENCES homepage_sections(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id),
  UNIQUE(section_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_section_products_section ON section_products(section_id, sort_order);

-- 상품에 섹션 태그 (상품 설정에서 선택 가능)
ALTER TABLE products ADD COLUMN section_ids TEXT DEFAULT '[]';
