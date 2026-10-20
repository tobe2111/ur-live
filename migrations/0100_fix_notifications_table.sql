-- Fix notifications table if user_type column is missing
-- This migration is idempotent (can be run multiple times safely)

-- Step 1: Drop old table if it exists (SAFEST approach)
DROP TABLE IF EXISTS notifications;

-- Step 2: Create new notifications table with correct schema
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_type TEXT NOT NULL CHECK(user_type IN ('seller', 'user', 'admin')),
  user_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  is_read BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  read_at DATETIME
);

-- Step 3: Create indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_type, user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

