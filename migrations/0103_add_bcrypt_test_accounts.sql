-- Migration: Add test seller and admin accounts with bcrypt hashed passwords
-- Purpose: Replace placeholder passwords with secure bcrypt hashes for testing
-- Date: 2026-03-03
--
-- Test Accounts:
-- 1. tobe2111@naver.com / 358533aa!! (Main seller account)
-- 2. seller1@example.com / seller123 (Test seller)
-- 3. seller@ur-team.com / seller123 (Test seller)
-- 4. admin@example.com / admin123 (Test admin)
--
-- Security Notes:
-- ⚠️  These accounts are for DEVELOPMENT/TESTING ONLY
-- ⚠️  DO NOT use these in production
-- ⚠️  All passwords are hashed with bcrypt (10 salt rounds)
-- ✅  Hardcoded test credentials should be removed from code after migration

-- ============================================
-- SELLERS TABLE
-- ============================================

-- Main seller account: tobe2111@naver.com
-- Password: 358533aa!!
-- Hash: $2b$10$ECEIHTgi3Ge1p3g0qre6a.iGbYDPLytQOlrqjBaHB.Qu.GEECEYZi
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

-- Test seller 1: seller1@example.com
-- Password: seller123
-- Hash: $2b$10$UI/oYUlk9q0BxCaZjLrSx.qtpvmMYbo3vl2sULVgFbMSCgATxbtNm
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
  2,
  'seller1',
  'seller1@example.com',
  '$2b$10$UI/oYUlk9q0BxCaZjLrSx.qtpvmMYbo3vl2sULVgFbMSCgATxbtNm',
  '테스트 셀러1',
  '010-2222-3333',
  '111-22-33344',
  '테스트컴퍼니1',
  'approved',
  1,
  10.0,
  datetime('now'),
  datetime('now')
);

-- Test seller 2: seller@ur-team.com
-- Password: seller123
-- Hash: $2b$10$oxxVVBm7vPJdwcRIGfTWruVGRXVrUxaI/2fBoADvsTv8RaNVDS8GO
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
  3,
  'urteam_seller',
  'seller@ur-team.com',
  '$2b$10$oxxVVBm7vPJdwcRIGfTWruVGRXVrUxaI/2fBoADvsTv8RaNVDS8GO',
  'UR팀 셀러',
  '010-3333-4444',
  '222-33-44455',
  'UR팀컴퍼니',
  'approved',
  1,
  10.0,
  datetime('now'),
  datetime('now')
);

-- Pending seller for testing approval flow: pending@example.com
-- Password: pending123
-- Status: pending (requires admin approval)
INSERT OR IGNORE INTO sellers (
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
  'pending_seller',
  'pending@example.com',
  '$2b$10$Tf5.UtLCIeNRDBR7p0kLY.09uU6/Kf.hMRPZuD7C0OP22BWsJsxPy',
  '대기중인 셀러',
  '010-9999-8888',
  '999-88-77766',
  '대기컴퍼니',
  'pending',
  1,
  10.0,
  datetime('now'),
  datetime('now')
);

-- ============================================
-- ADMINS TABLE
-- ============================================

-- Main admin: tobe2111@naver.com
-- Password: 358533aa!!
-- Hash: $2b$10$3WoWNsMd./fG2mMCL3ZlEut5lNMSF7omSONsQwBzDYnfPwE6RptuO
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
-- VERIFICATION QUERIES
-- ============================================

-- Verify sellers
-- Expected: 4 sellers (3 approved, 1 pending)
SELECT 
  'Sellers Count' as check_type,
  COUNT(*) as total,
  SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
  SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending
FROM sellers;

-- Verify admins
-- Expected: 1 admin
SELECT 
  'Admins Count' as check_type,
  COUNT(*) as total
FROM admins;

-- List all test accounts
SELECT 
  'SELLER' as type,
  id,
  email,
  name,
  status,
  is_active,
  CASE 
    WHEN password_hash LIKE '$2%' THEN 'bcrypt ✅'
    ELSE 'plaintext ❌'
  END as password_security
FROM sellers
WHERE email IN (
  'tobe2111@naver.com',
  'seller1@example.com',
  'seller@ur-team.com',
  'pending@example.com'
)
UNION ALL
SELECT 
  'ADMIN' as type,
  id,
  email,
  name,
  'N/A' as status,
  is_active,
  CASE 
    WHEN password_hash LIKE '$2%' THEN 'bcrypt ✅'
    ELSE 'plaintext ❌'
  END as password_security
FROM admins
WHERE email = 'admin@example.com';

-- ============================================
-- CLEANUP NOTES
-- ============================================
-- 
-- After this migration:
-- 1. ✅ Remove hardcoded credentials from src/index.tsx seller login
-- 2. ✅ Remove test account checks in admin login
-- 3. ✅ All authentication should use bcrypt verification only
-- 4. ⚠️  In production, regenerate all passwords and remove this file
--
-- Example cleanup code in src/index.tsx:
-- 
-- // BEFORE (DELETE THIS):
-- const isTestAccount1 = email === 'seller1@example.com' && password === 'seller123';
-- const isTestAccount2 = email === 'seller@ur-team.com' && password === 'seller123';
-- const isMainAccount = email === 'tobe2111@naver.com' && password === '358533aa!!';
-- let isValidPassword = isTestAccount1 || isTestAccount2 || isMainAccount;
--
-- // AFTER (USE THIS):
-- let isValidPassword = false;
-- if (seller.password_hash?.startsWith('$2')) {
--   isValidPassword = await verifyPassword(password, seller.password_hash);
-- }
