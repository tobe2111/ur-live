-- 쇼츠 테이블
CREATE TABLE IF NOT EXISTS shorts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seller_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  video_url TEXT NOT NULL,          -- YouTube shorts URL 또는 직접 업로드 URL
  youtube_video_id TEXT,            -- YouTube video ID (있으면)
  thumbnail_url TEXT,
  duration INTEGER DEFAULT 0,       -- 초 단위
  view_count INTEGER DEFAULT 0,
  like_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'hidden', 'deleted')),
  product_id INTEGER,               -- 연결된 상품 (있으면)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (seller_id) REFERENCES sellers(id)
);

CREATE INDEX IF NOT EXISTS idx_shorts_seller ON shorts(seller_id);
CREATE INDEX IF NOT EXISTS idx_shorts_status ON shorts(status);
CREATE INDEX IF NOT EXISTS idx_shorts_created ON shorts(created_at DESC);

-- 쇼츠 좋아요 테이블
CREATE TABLE IF NOT EXISTS shorts_likes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shorts_id INTEGER NOT NULL,
  user_id TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(shorts_id, user_id),
  FOREIGN KEY (shorts_id) REFERENCES shorts(id)
);
