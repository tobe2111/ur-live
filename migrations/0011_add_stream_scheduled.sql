-- Add scheduled_at column to live_streams
ALTER TABLE live_streams ADD COLUMN scheduled_at DATETIME;
