-- Live stream view tracking for analytics
CREATE TABLE IF NOT EXISTS live_stream_views (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  live_stream_id INTEGER NOT NULL,
  user_id TEXT,
  session_id TEXT NOT NULL,
  watch_duration INTEGER DEFAULT 0,
  joined_at TEXT DEFAULT (datetime('now')),
  left_at TEXT,
  device_type TEXT,
  FOREIGN KEY (live_stream_id) REFERENCES live_streams(id)
);

CREATE INDEX IF NOT EXISTS idx_lsv_stream ON live_stream_views(live_stream_id);
CREATE INDEX IF NOT EXISTS idx_lsv_user ON live_stream_views(user_id);
