-- 상품 멀티 이미지 지원 + 대/중/소 카테고리
ALTER TABLE products ADD COLUMN images TEXT DEFAULT '[]';
ALTER TABLE products ADD COLUMN category_main TEXT;
ALTER TABLE products ADD COLUMN category_sub TEXT;
ALTER TABLE products ADD COLUMN category_detail TEXT;
ALTER TABLE products ADD COLUMN option_type TEXT;
ALTER TABLE products ADD COLUMN option_values TEXT DEFAULT '[]';

-- 카테고리 마스터 테이블
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  level TEXT NOT NULL CHECK (level IN ('main', 'sub', 'detail')),
  parent_id INTEGER,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  FOREIGN KEY (parent_id) REFERENCES categories(id)
);

CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id);
CREATE INDEX IF NOT EXISTS idx_categories_level ON categories(level);

-- 기본 카테고리 데이터
INSERT OR IGNORE INTO categories (level, parent_id, name, slug, sort_order) VALUES
  ('main', NULL, '패션', 'fashion', 1),
  ('main', NULL, '뷰티', 'beauty', 2),
  ('main', NULL, '식품', 'food', 3),
  ('main', NULL, '전자기기', 'electronics', 4),
  ('main', NULL, '라이프스타일', 'lifestyle', 5),
  ('main', NULL, '유아동', 'kids', 6),
  ('main', NULL, '잡화', 'misc', 7);
