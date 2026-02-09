-- Rollback and recreate with proper handling
-- Since this failed in production, create new migration version

PRAGMA foreign_keys = OFF;

-- Backup all data first
CREATE TABLE users_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kakao_id TEXT UNIQUE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  profile_image TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  service_terms_agreed BOOLEAN DEFAULT 0,
  terms_agreed_at DATETIME,
  access_token TEXT,
  password_hash TEXT,
  last_login_at DATETIME
);

-- Copy all existing users
INSERT INTO users_new (id, kakao_id, name, email, phone, profile_image, created_at, updated_at, service_terms_agreed, terms_agreed_at, access_token, password_hash, last_login_at)
SELECT id, kakao_id, name, email, phone, profile_image, created_at, updated_at, service_terms_agreed, terms_agreed_at, access_token, password_hash, last_login_at
FROM users;

-- Drop old table
DROP TABLE users;

-- Rename new table
ALTER TABLE users_new RENAME TO users;

-- Recreate indexes
CREATE INDEX IF NOT EXISTS idx_users_kakao_id ON users(kakao_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

PRAGMA foreign_keys = ON;
