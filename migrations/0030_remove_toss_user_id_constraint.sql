-- Remove toss_user_id NOT NULL constraint safely
-- This migration preserves all data and foreign keys

PRAGMA foreign_keys = OFF;

-- 1. Create new table without toss_user_id NOT NULL constraint
CREATE TABLE users_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  toss_user_id TEXT UNIQUE,           -- Made nullable
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  phone TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  kakao_id TEXT UNIQUE,
  profile_image TEXT,
  service_terms_agreed TEXT,
  terms_agreed_at DATETIME,
  access_token TEXT,
  password_hash TEXT,
  last_login_at DATETIME
);

-- 2. Copy all data from old table
INSERT INTO users_new 
SELECT * FROM users;

-- 3. Drop old table
DROP TABLE users;

-- 4. Rename new table
ALTER TABLE users_new RENAME TO users;

-- 5. Recreate indexes
CREATE INDEX IF NOT EXISTS idx_users_kakao_id ON users(kakao_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_toss_user_id ON users(toss_user_id);

PRAGMA foreign_keys = ON;
