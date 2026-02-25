-- Fix notifications table if user_type column is missing
-- This migration is idempotent (can be run multiple times safely)

-- Check if notifications table exists and has user_type column
-- If table exists but column is missing, we need to recreate it

-- Step 1: Create new notifications table with correct schema
CREATE TABLE IF NOT EXISTS notifications_new (
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

-- Step 2: Copy existing data if old table exists
-- (This will fail silently if old table doesn't have user_type column)
INSERT OR IGNORE INTO notifications_new (id, user_type, user_id, type, title, message, link, is_read, created_at, read_at)
SELECT id, user_type, user_id, type, title, message, link, is_read, created_at, read_at
FROM notifications
WHERE EXISTS (SELECT 1 FROM notifications LIMIT 1);

-- Step 3: Drop old table
DROP TABLE IF EXISTS notifications;

-- Step 4: Rename new table
ALTER TABLE notifications_new RENAME TO notifications;

-- Step 5: Recreate indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_type, user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);
