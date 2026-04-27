-- ============================================================
-- Migration 0221: TikTok 비디오 캐시 (T2)
-- ============================================================
-- 배경: T1 의 Display API 호출 결과를 영구 저장 (반복 호출 방지).
-- 셀러 프로필에 TikTok 비디오 위젯 표시 + 자동 sync.
--
-- 작성: 2026-04-26 (T2)
-- ============================================================

CREATE TABLE IF NOT EXISTS tiktok_videos_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  seller_id INTEGER NOT NULL,
  -- TikTok 비디오 영구 ID
  video_id TEXT NOT NULL,
  title TEXT,
  cover_image_url TEXT,
  share_url TEXT,
  view_count INTEGER DEFAULT 0,
  like_count INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  share_count INTEGER DEFAULT 0,
  -- TikTok 의 비디오 생성 시각 (unix seconds)
  tiktok_create_time INTEGER,
  -- 우리 측 sync 시각
  fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  -- 셀러가 위젯에서 숨길 수 있음
  hidden_by_seller INTEGER NOT NULL DEFAULT 0,
  UNIQUE (seller_id, video_id),
  FOREIGN KEY (seller_id) REFERENCES sellers(id)
);

CREATE INDEX IF NOT EXISTS idx_tiktok_videos_seller_time
  ON tiktok_videos_cache(seller_id, tiktok_create_time DESC);
CREATE INDEX IF NOT EXISTS idx_tiktok_videos_views
  ON tiktok_videos_cache(seller_id, view_count DESC);
