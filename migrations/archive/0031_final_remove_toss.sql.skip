-- FINAL CLEANUP: Completely remove all Toss references from DB
-- Drop toss_user_id column permanently

PRAGMA foreign_keys = OFF;

-- Create final clean users table
CREATE TABLE users_final (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  -- Authentication
  kakao_id TEXT UNIQUE,
  email TEXT UNIQUE,
  password_hash TEXT,
  
  -- User info
  name TEXT NOT NULL,
  phone TEXT,
  profile_image TEXT,
  
  -- Timestamps
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_login_at DATETIME,
  
  -- At least one auth method required
  CHECK (kakao_id IS NOT NULL OR email IS NOT NULL)
);

-- Copy all existing users (excluding toss_user_id)
INSERT INTO users_final (
  id, kakao_id, email, password_hash, name, phone, 
  profile_image, created_at, updated_at, last_login_at
)
SELECT 
  id, kakao_id, email, password_hash, name, phone,
  profile_image, created_at, updated_at, last_login_at
FROM users;

-- Drop old table
DROP TABLE users;

-- Rename to users
ALTER TABLE users_final RENAME TO users;

-- Create indexes
CREATE INDEX idx_users_kakao_id ON users(kakao_id);
CREATE INDEX idx_users_email ON users(email);

PRAGMA foreign_keys = ON;
