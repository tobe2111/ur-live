-- Remove toss_user_id completely - only use Kakao login
-- SQLite doesn't support DROP COLUMN, so recreate table

PRAGMA foreign_keys=OFF;

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

-- Only copy users with kakao_id (skip Toss users)
INSERT INTO users_new (id, kakao_id, name, email, phone, profile_image, created_at, updated_at)
SELECT id, kakao_id, name, email, phone, profile_image, created_at, updated_at 
FROM users 
WHERE kakao_id IS NOT NULL;

DROP TABLE users;

ALTER TABLE users_new RENAME TO users;

CREATE INDEX idx_users_kakao_id ON users(kakao_id);

PRAGMA foreign_keys=ON;
