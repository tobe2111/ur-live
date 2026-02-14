-- 채팅 메시지 테이블
CREATE TABLE IF NOT EXISTS chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  live_stream_id INTEGER NOT NULL,
  user_id INTEGER,
  user_name TEXT NOT NULL,
  user_avatar TEXT,
  message TEXT NOT NULL,
  is_seller BOOLEAN DEFAULT 0,
  is_admin BOOLEAN DEFAULT 0,
  is_deleted BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (live_stream_id) REFERENCES live_streams(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- 채팅 메시지 인덱스
CREATE INDEX IF NOT EXISTS idx_chat_messages_live_stream ON chat_messages(live_stream_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user ON chat_messages(user_id);

-- 채팅 금지 사용자 테이블
CREATE TABLE IF NOT EXISTS chat_bans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  live_stream_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  banned_by INTEGER NOT NULL,
  reason TEXT,
  banned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME,
  FOREIGN KEY (live_stream_id) REFERENCES live_streams(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (banned_by) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_chat_bans_live_user ON chat_bans(live_stream_id, user_id);
