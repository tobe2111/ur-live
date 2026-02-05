-- Remove Toss completely - Kakao login only
-- Recreate users table without toss_user_id

PRAGMA foreign_keys=OFF;

-- Create new users table (Kakao only)
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

-- Copy only Kakao users (skip any Toss-only users)
INSERT INTO users_new (id, kakao_id, name, email, phone, profile_image, created_at, updated_at)
SELECT id, kakao_id, name, email, phone, profile_image, created_at, updated_at
FROM users
WHERE kakao_id IS NOT NULL AND kakao_id NOT LIKE 'toss_%';

-- Drop old table
DROP TABLE users;

-- Rename new table
ALTER TABLE users_new RENAME TO users;

-- Create index
CREATE INDEX idx_users_kakao_id ON users(kakao_id);

PRAGMA foreign_keys=ON;
