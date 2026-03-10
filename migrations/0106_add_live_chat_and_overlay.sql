-- Add live chat cache and overlay state tables
-- Migration: 0106_add_live_chat_and_overlay.sql
-- Date: 2026-03-10

-- Live chat cache (for faster retrieval without YouTube API quota)
CREATE TABLE IF NOT EXISTS live_chat_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stream_id INTEGER NOT NULL,
  chat_id TEXT NOT NULL UNIQUE,
  author TEXT NOT NULL,
  message TEXT NOT NULL,
  timestamp INTEGER NOT NULL, -- Unix timestamp (ms)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (stream_id) REFERENCES live_streams(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_live_chat_cache_stream_id ON live_chat_cache(stream_id);
CREATE INDEX IF NOT EXISTS idx_live_chat_cache_timestamp ON live_chat_cache(timestamp);

-- Live stream overlay state (current product display)
CREATE TABLE IF NOT EXISTS live_stream_overlays (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stream_id INTEGER NOT NULL UNIQUE,
  current_product_id INTEGER,
  overlay_position TEXT DEFAULT 'bottom-right', -- bottom-left, bottom-right, top-left, top-right
  show_price BOOLEAN DEFAULT 1,
  show_discount BOOLEAN DEFAULT 1,
  show_buy_button BOOLEAN DEFAULT 1,
  custom_css TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (stream_id) REFERENCES live_streams(id) ON DELETE CASCADE,
  FOREIGN KEY (current_product_id) REFERENCES products(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_live_stream_overlays_stream_id ON live_stream_overlays(stream_id);

-- Stream analytics (real-time engagement)
CREATE TABLE IF NOT EXISTS stream_analytics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  stream_id INTEGER NOT NULL,
  event_type TEXT NOT NULL, -- viewer_join, viewer_leave, product_click, purchase, chat_message
  product_id INTEGER,
  user_id INTEGER,
  metadata TEXT, -- JSON data
  timestamp INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (stream_id) REFERENCES live_streams(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_stream_analytics_stream_id ON stream_analytics(stream_id);
CREATE INDEX IF NOT EXISTS idx_stream_analytics_event_type ON stream_analytics(event_type);
CREATE INDEX IF NOT EXISTS idx_stream_analytics_timestamp ON stream_analytics(timestamp);

-- Update trigger for overlay state
CREATE TRIGGER IF NOT EXISTS update_live_stream_overlays_timestamp
AFTER UPDATE ON live_stream_overlays
FOR EACH ROW
BEGIN
  UPDATE live_stream_overlays SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Verification query (commented out, run manually if needed)
-- SELECT COUNT(*) as total_chat_messages FROM live_chat_cache;
-- SELECT COUNT(*) as total_overlays FROM live_stream_overlays;
-- SELECT COUNT(*) as total_analytics FROM stream_analytics;
