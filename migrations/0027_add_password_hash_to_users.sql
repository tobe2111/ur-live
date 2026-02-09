-- Add password_hash column to users table for ID/PW login support

ALTER TABLE users ADD COLUMN password_hash TEXT;
