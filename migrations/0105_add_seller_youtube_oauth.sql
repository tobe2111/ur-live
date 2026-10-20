-- Add seller YouTube OAuth integration table
-- Migration: 0105_add_seller_youtube_oauth.sql
-- Date: 2026-03-10

-- Seller YouTube OAuth credentials
CREATE TABLE IF NOT EXISTS seller_youtube_oauth (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seller_id INTEGER NOT NULL,
  google_email TEXT NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at INTEGER NOT NULL, -- Unix timestamp (ms)
  channel_id TEXT NOT NULL,
  channel_title TEXT NOT NULL,
  channel_thumbnail TEXT,
  subscriber_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (seller_id) REFERENCES sellers(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_seller_youtube_oauth_seller_id ON seller_youtube_oauth(seller_id);
CREATE INDEX IF NOT EXISTS idx_seller_youtube_oauth_channel_id ON seller_youtube_oauth(channel_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_seller_youtube_oauth_unique ON seller_youtube_oauth(seller_id, channel_id);

-- Add YouTube broadcast fields to live_streams if not exists
-- (These were added in 0047 but we ensure they exist)
-- ALTER TABLE live_streams ADD COLUMN youtube_broadcast_id TEXT;
-- ALTER TABLE live_streams ADD COLUMN youtube_stream_key TEXT;
-- ALTER TABLE live_streams ADD COLUMN youtube_live_chat_id TEXT;

-- Add RTMP ingestion fields
ALTER TABLE live_streams ADD COLUMN rtmp_url TEXT;
ALTER TABLE live_streams ADD COLUMN rtmp_key TEXT;
ALTER TABLE live_streams ADD COLUMN youtube_embed_url TEXT;

-- Add stream ready status
-- ALTER TABLE live_streams ADD COLUMN stream_status TEXT DEFAULT 'preparing'; -- preparing, ready, live, ended
-- Note: We already have 'status' column, so we'll use that

-- Update trigger for seller_youtube_oauth
CREATE TRIGGER IF NOT EXISTS update_seller_youtube_oauth_timestamp
AFTER UPDATE ON seller_youtube_oauth
FOR EACH ROW
BEGIN
  UPDATE seller_youtube_oauth SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Verification query (commented out, run manually if needed)
-- SELECT COUNT(*) as total_youtube_auths FROM seller_youtube_oauth;
-- SELECT * FROM seller_youtube_oauth WHERE is_active = 1;
