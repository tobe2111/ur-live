-- Quick Fix: Add admin and seller accounts for tobe2111@naver.com
-- Run this immediately to fix login issues
-- Date: 2026-03-03

-- ============================================
-- SELLER ACCOUNT
-- ============================================
-- Email: tobe2111@naver.com
-- Password: 358533aa!!
-- Bcrypt Hash: $2b$10$ECEIHTgi3Ge1p3g0qre6a.iGbYDPLytQOlrqjBaHB.Qu.GEECEYZi

INSERT OR REPLACE INTO sellers (
  id,
  username,
  email,
  password_hash,
  name,
  phone,
  business_number,
  company_name,
  status,
  is_active,
  commission_rate,
  created_at,
  updated_at
) VALUES (
  1,
  'tobe2111',
  'tobe2111@naver.com',
  '$2b$10$ECEIHTgi3Ge1p3g0qre6a.iGbYDPLytQOlrqjBaHB.Qu.GEECEYZi',
  '토비',
  '010-1234-5678',
  '123-45-67890',
  '리스터코퍼레이션',
  'approved',
  1,
  10.0,
  datetime('now'),
  datetime('now')
);

-- ============================================
-- ADMIN ACCOUNT
-- ============================================
-- Email: tobe2111@naver.com
-- Password: 358533aa!!
-- Bcrypt Hash: $2b$10$3WoWNsMd./fG2mMCL3ZlEut5lNMSF7omSONsQwBzDYnfPwE6RptuO

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

-- Check seller account
SELECT 
  'SELLER' as type,
  id,
  username,
  email,
  name,
  status,
  is_active,
  CASE 
    WHEN password_hash LIKE '$2b$10$ECEIHTgi3Ge1p3g0qre6a.%' THEN '✅ Correct'
    WHEN password_hash LIKE '$2%' THEN '⚠️ Different bcrypt'
    ELSE '❌ Invalid'
  END as password_check
FROM sellers 
WHERE email = 'tobe2111@naver.com';

-- Check admin account
SELECT 
  'ADMIN' as type,
  id,
  username,
  email,
  name,
  role,
  is_active,
  CASE 
    WHEN password_hash LIKE '$2b$10$3WoWNsMd.%' THEN '✅ Correct'
    WHEN password_hash LIKE '$2%' THEN '⚠️ Different bcrypt'
    ELSE '❌ Invalid'
  END as password_check
FROM admins 
WHERE email = 'tobe2111@naver.com';

-- ============================================
-- EXPECTED RESULTS
-- ============================================
--
-- SELLER:
-- id: 1
-- username: tobe2111
-- email: tobe2111@naver.com
-- name: 토비
-- status: approved
-- is_active: 1
-- password_check: ✅ Correct
--
-- ADMIN:
-- id: 1
-- username: tobe2111
-- email: tobe2111@naver.com
-- name: 토비
-- role: super_admin
-- is_active: 1
-- password_check: ✅ Correct
