-- Migration: Update admin account to tobe2111@naver.com
-- Date: 2026-03-03
-- Purpose: Change main admin account from admin@example.com to tobe2111@naver.com
--
-- Old Admin Account:
-- - Email: admin@example.com
-- - Password: admin123
--
-- New Admin Account:
-- - Email: tobe2111@naver.com
-- - Password: 358533aa!!
-- - Bcrypt Hash: $2b$10$3WoWNsMd./fG2mMCL3ZlEut5lNMSF7omSONsQwBzDYnfPwE6RptuO

-- ============================================
-- UPDATE ADMIN ACCOUNT
-- ============================================

-- Update or Insert admin account
INSERT OR REPLACE INTO admins (
  id,
  username,
  email,
  password_hash,
  name,
  is_active,
  role,
  created_at,
  updated_at
) VALUES (
  1,
  'tobe2111',
  'tobe2111@naver.com',
  '$2b$10$3WoWNsMd./fG2mMCL3ZlEut5lNMSF7omSONsQwBzDYnfPwE6RptuO',
  '토비',
  1,
  'super_admin',
  datetime('now'),
  datetime('now')
);

-- ============================================
-- VERIFICATION
-- ============================================

-- Verify admin account
SELECT 
  'Admin Account Verification' as check_type,
  id,
  username,
  email,
  name,
  role,
  is_active,
  CASE 
    WHEN password_hash LIKE '$2b$10$3WoWNsMd./fG2mMCL3ZlEut5lNMSF7omSONsQwBzDYnfPwE6RptuO' THEN 'Correct Hash ✅'
    WHEN password_hash LIKE '$2%' THEN 'Different bcrypt hash ⚠️'
    ELSE 'Invalid hash ❌'
  END as password_check
FROM admins
WHERE id = 1;

-- Expected result:
-- username: tobe2111
-- email: tobe2111@naver.com
-- name: 토비
-- role: super_admin
-- is_active: 1
-- password_check: Correct Hash ✅

-- ============================================
-- LOGIN TEST COMMAND
-- ============================================
-- 
-- After running this migration, test login with:
--
-- curl -X POST https://live.ur-team.com/api/admin/login \
--   -H "Content-Type: application/json" \
--   -d '{
--     "email": "tobe2111@naver.com",
--     "password": "358533aa!!"
--   }'
--
-- Expected response:
-- {
--   "success": true,
--   "data": {
--     "token": "eyJhbGc...",
--     "admin": {
--       "id": 1,
--       "username": "tobe2111",
--       "email": "tobe2111@naver.com",
--       "name": "토비"
--     }
--   }
-- }
