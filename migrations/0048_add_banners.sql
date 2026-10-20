-- Create banners table for main homepage banner management
CREATE TABLE IF NOT EXISTS banners (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  image_url TEXT NOT NULL,
  link_url TEXT,
  description TEXT,
  is_active BOOLEAN DEFAULT 1,
  display_order INTEGER DEFAULT 0,
  start_date DATETIME,
  end_date DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create index for active banners query
CREATE INDEX IF NOT EXISTS idx_banners_active_order ON banners(is_active, display_order, start_date, end_date);

-- Insert default banner
INSERT INTO banners (title, image_url, link_url, description, is_active, display_order) VALUES 
('UR-Live 메인 배너', 'https://www.genspark.ai/api/files/s/Hrg6eI8k?cache_control=3600', '#live-section', '실시간 라이브 쇼핑 - 보는 순간 바로 구매!', 1, 0);
