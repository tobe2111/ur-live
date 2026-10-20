-- Step 1: Create new users table without NOT NULL constraint on toss_user_id
CREATE TABLE users_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  toss_user_id TEXT UNIQUE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  kakao_id TEXT UNIQUE,
  profile_image TEXT
);

-- Step 2: Copy all data from old table to new table
INSERT INTO users_new (id, toss_user_id, name, email, phone, created_at, updated_at, kakao_id, profile_image)
SELECT id, toss_user_id, name, email, phone, created_at, updated_at, kakao_id, profile_image
FROM users;

-- Step 3: Drop old table
DROP TABLE users;

-- Step 4: Rename new table to users
ALTER TABLE users_new RENAME TO users;

-- Step 5: Create indexes
CREATE INDEX IF NOT EXISTS idx_users_toss_user_id ON users(toss_user_id);
CREATE INDEX IF NOT EXISTS idx_users_kakao_id ON users(kakao_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
