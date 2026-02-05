-- Remove toss_user_id column from users table
-- This migration removes all Toss-related columns and keeps only Kakao login

-- Step 1: Create new users table without toss_user_id
CREATE TABLE users_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kakao_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  profile_image TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Step 2: Copy Kakao users only (exclude Toss-only users)
INSERT INTO users_new (id, kakao_id, name, email, phone, profile_image, created_at, updated_at)
SELECT id, kakao_id, name, email, phone, profile_image, created_at, updated_at
FROM users
WHERE kakao_id IS NOT NULL;

-- Step 3: Drop old table
DROP TABLE users;

-- Step 4: Rename new table
ALTER TABLE users_new RENAME TO users;

-- Step 5: Create indexes
CREATE INDEX IF NOT EXISTS idx_users_kakao_id ON users(kakao_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
