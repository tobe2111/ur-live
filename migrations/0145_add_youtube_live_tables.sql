-- 라이브 방송 YouTube 연동에 필요한 테이블/컬럼 추가

-- 1. seller_youtube_oauth 테이블 (YouTube OAuth 토큰 저장)
CREATE TABLE IF NOT EXISTS seller_youtube_oauth (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seller_id INTEGER NOT NULL,
  google_email TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  channel_id TEXT NOT NULL,
  channel_title TEXT,
  channel_thumbnail TEXT,
  subscriber_count INTEGER DEFAULT 0,
  default_stream_id TEXT,
  default_rtmp_url TEXT,
  default_rtmp_key TEXT,
  has_persistent_key INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(seller_id, channel_id)
);

CREATE INDEX IF NOT EXISTS idx_seller_youtube_oauth_seller ON seller_youtube_oauth(seller_id);

-- 2. live_streams에 YouTube/RTMP 컬럼 추가
-- SQLite ALTER TABLE은 한 번에 하나씩만 가능
ALTER TABLE live_streams ADD COLUMN youtube_broadcast_id TEXT;
ALTER TABLE live_streams ADD COLUMN youtube_stream_key TEXT;
ALTER TABLE live_streams ADD COLUMN youtube_live_chat_id TEXT;
ALTER TABLE live_streams ADD COLUMN rtmp_url TEXT;
ALTER TABLE live_streams ADD COLUMN rtmp_key TEXT;
ALTER TABLE live_streams ADD COLUMN youtube_embed_url TEXT;
ALTER TABLE live_streams ADD COLUMN youtube_url TEXT;
ALTER TABLE live_streams ADD COLUMN seller_instagram TEXT;
ALTER TABLE live_streams ADD COLUMN seller_youtube TEXT;
ALTER TABLE live_streams ADD COLUMN seller_facebook TEXT;
ALTER TABLE live_streams ADD COLUMN current_product_id INTEGER;
ALTER TABLE live_streams ADD COLUMN product_display_mode TEXT DEFAULT 'current_only';

-- 3. stream_products 테이블 (방송-상품 연결)
CREATE TABLE IF NOT EXISTS stream_products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stream_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(stream_id, product_id),
  FOREIGN KEY (stream_id) REFERENCES live_streams(id),
  FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE INDEX IF NOT EXISTS idx_stream_products_stream ON stream_products(stream_id);
