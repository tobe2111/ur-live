-- 0019_add_service_terms_to_users.sql
-- Add service terms agreement information to users table

-- Add columns for Kakao service terms tracking
ALTER TABLE users ADD COLUMN service_terms_agreed TEXT; -- JSON string of agreed terms tags
ALTER TABLE users ADD COLUMN terms_agreed_at DATETIME; -- When terms were agreed
ALTER TABLE users ADD COLUMN access_token TEXT; -- For unlink operation (encrypted in production)
