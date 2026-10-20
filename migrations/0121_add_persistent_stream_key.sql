-- Add persistent (reusable) YouTube stream key to seller_youtube_oauth
-- Sellers only need to set RTMP URL+key in OBS/Prism once
-- Each broadcast reuses the same stream (different broadcast, same RTMP key)

ALTER TABLE seller_youtube_oauth ADD COLUMN default_stream_id TEXT;
ALTER TABLE seller_youtube_oauth ADD COLUMN default_rtmp_url TEXT;
ALTER TABLE seller_youtube_oauth ADD COLUMN default_rtmp_key TEXT;
