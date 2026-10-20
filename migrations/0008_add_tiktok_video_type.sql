-- Add tiktok_video_type column to distinguish between TikTok video and live
ALTER TABLE live_streams ADD COLUMN tiktok_video_type TEXT CHECK(tiktok_video_type IN ('video', 'live', NULL));

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_live_streams_tiktok_type ON live_streams(tiktok_video_type);
