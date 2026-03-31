-- 셀러 등급 시스템
-- 등급에 따라 수수료율이 달라짐

CREATE TABLE IF NOT EXISTS seller_tiers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  min_monthly_sales INTEGER NOT NULL DEFAULT 0,
  commission_rate REAL NOT NULL,
  benefits TEXT DEFAULT '[]',
  sort_order INTEGER DEFAULT 0
);

-- 기본 등급 데이터
INSERT OR IGNORE INTO seller_tiers (name, min_monthly_sales, commission_rate, benefits, sort_order) VALUES
  ('브론즈', 0,       12.0, '["기본 정산"]', 1),
  ('실버',   1000000, 10.0, '["기본 정산", "우선 노출"]', 2),
  ('골드',   5000000,  8.0, '["기본 정산", "우선 노출", "배너 노출"]', 3),
  ('플래티넘', 10000000, 6.0, '["기본 정산", "우선 노출", "배너 노출", "전담 매니저"]', 4),
  ('다이아', 30000000,  4.0, '["기본 정산", "우선 노출", "배너 노출", "전담 매니저", "수수료 최저"]', 5);
