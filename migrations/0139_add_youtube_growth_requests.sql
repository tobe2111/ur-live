-- 유튜브 구독자 늘리기 신청
CREATE TABLE IF NOT EXISTS youtube_growth_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seller_id INTEGER NOT NULL,
  channel_url TEXT NOT NULL,
  current_subscribers INTEGER DEFAULT 0,
  target_subscribers INTEGER NOT NULL DEFAULT 1000,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'rejected')),
  admin_memo TEXT,
  requested_at DATETIME DEFAULT (datetime('now')),
  completed_at DATETIME,
  FOREIGN KEY (seller_id) REFERENCES sellers(id)
);
