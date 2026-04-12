-- 셀러 멀티 플랫폼 RTMP 송출 대상 테이블
-- OBS multi-rtmp 또는 프리즘 외부 RTMP 설정에 사용
CREATE TABLE IF NOT EXISTS seller_rtmp_destinations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seller_id INTEGER NOT NULL,
  platform TEXT NOT NULL,           -- 'tiktok', 'instagram', 'twitch', 'facebook', 'naver', 'afreeca', 'kick', 'custom'
  label TEXT NOT NULL,              -- 사용자 지정 이름 (예: "틱톡 라이브")
  rtmp_url TEXT NOT NULL,           -- RTMP 서버 URL
  rtmp_key TEXT NOT NULL,           -- 스트림 키
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_seller_rtmp_dest_seller ON seller_rtmp_destinations(seller_id, is_active);
