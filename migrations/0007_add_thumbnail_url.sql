-- Add thumbnail_url column to live_streams table
ALTER TABLE live_streams ADD COLUMN thumbnail_url TEXT;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_live_streams_thumbnail ON live_streams(thumbnail_url);
