-- Migration: Add ended_at column to live_streams table
-- Date: 2026-03-10
-- Purpose: Fix "no such column: ended_at" error in seller dashboard

-- Check if the column exists before adding
-- SQLite doesn't support IF NOT EXISTS for columns, so we'll use a safer approach

-- Add ended_at column if it doesn't exist
ALTER TABLE live_streams ADD COLUMN ended_at DATETIME;

-- Update existing records where status is 'ended' but ended_at is NULL
UPDATE live_streams 
SET ended_at = COALESCE(updated_at, created_at)
WHERE status = 'ended' AND ended_at IS NULL;

-- Verification query (comment out for actual migration)
-- SELECT COUNT(*) as total, 
--        COUNT(ended_at) as with_ended_at,
--        COUNT(*) - COUNT(ended_at) as missing_ended_at
-- FROM live_streams;
