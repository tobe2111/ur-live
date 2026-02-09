-- Complete DB cleanup and restructure for Kakao-only authentication
-- This migration creates a clean users table without any Toss legacy

PRAGMA foreign_keys = OFF;

-- Create completely new users table
CREATE TABLE users_clean (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  
  -- Authentication identifiers
  kakao_id TEXT UNIQUE,           -- Kakao user ID (primary for Kakao login)
  email TEXT UNIQUE,              -- Email (primary for email login)
  
  -- User information
  name TEXT NOT NULL,
  phone TEXT,
  profile_image TEXT,
  
  -- Password for email login only
  password_hash TEXT,
  
  -- Timestamps
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_login_at DATETIME,
  
  -- Constraints: must have either kakao_id or email
  CHECK (kakao_id IS NOT NULL OR email IS NOT NULL)
);

-- Copy valid users from old table
INSERT INTO users_clean (id, kakao_id, email, name, phone, profile_image, password_hash, created_at, updated_at, last_login_at)
SELECT 
  id,
  kakao_id,
  email,
  name,
  phone,
  profile_image,
  password_hash,
  created_at,
  updated_at,
  last_login_at
FROM users
WHERE kakao_id IS NOT NULL OR email IS NOT NULL;

-- Drop old table
DROP TABLE users;

-- Rename new table
ALTER TABLE users_clean RENAME TO users;

-- Create indexes
CREATE INDEX idx_users_kakao_id ON users(kakao_id);
CREATE INDEX idx_users_email ON users(email);

PRAGMA foreign_keys = ON;
