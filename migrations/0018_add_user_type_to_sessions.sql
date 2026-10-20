-- Add 'user' type to admin_sessions for Kakao login users
-- Modify user_type CHECK constraint to include 'user'

-- Step 1: Create new table with updated constraint
CREATE TABLE admin_sessions_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_token TEXT UNIQUE NOT NULL,
  admin_id INTEGER,
  seller_id INTEGER,
  user_type TEXT NOT NULL CHECK(user_type IN ('admin', 'seller', 'user')),
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_id) REFERENCES admins(id),
  FOREIGN KEY (seller_id) REFERENCES sellers(id)
);

-- Step 2: Copy existing data
INSERT INTO admin_sessions_new (id, session_token, admin_id, seller_id, user_type, expires_at, created_at)
SELECT id, session_token, admin_id, seller_id, user_type, expires_at, created_at
FROM admin_sessions;

-- Step 3: Drop old table
DROP TABLE admin_sessions;

-- Step 4: Rename new table
ALTER TABLE admin_sessions_new RENAME TO admin_sessions;

-- Step 5: Create index
CREATE INDEX IF NOT EXISTS idx_admin_sessions_token ON admin_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires ON admin_sessions(expires_at);
