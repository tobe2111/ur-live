-- Add firebase_uid column to users table
ALTER TABLE users ADD COLUMN firebase_uid TEXT;

-- Create index for fast lookup
CREATE INDEX IF NOT EXISTS idx_users_firebase_uid ON users(firebase_uid);
