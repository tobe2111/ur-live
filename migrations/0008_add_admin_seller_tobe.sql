-- ⚡ Admin Seller Account Creation
-- This migration adds the main admin seller account for tobe2111@naver.com
-- 
-- 🎯 Purpose:
--   - Create admin seller account for production use
--   - Ensure proper status (approved) and active state
--   - Use placeholder password hash for development (REPLACE IN PRODUCTION)
--
-- 📝 Usage:
--   Local: npx wrangler d1 execute lister-db --local --file=./migrations/0008_add_admin_seller_tobe.sql
--   Remote: npx wrangler d1 execute lister-db --remote --file=./migrations/0008_add_admin_seller_tobe.sql
--
-- ⚠️ SECURITY WARNING:
--   This migration uses a placeholder password hash for development.
--   In production, you MUST replace this with a proper bcrypt hash.
--
-- 🔐 Generate a proper bcrypt hash:
--   Node.js:
--     const bcrypt = require('bcryptjs');
--     const hash = await bcrypt.hash('358533aa!!', 10);
--     console.log(hash); // Use this value in production
--

-- Insert or replace admin seller account
-- Using INSERT OR REPLACE to handle both new inserts and updates
INSERT OR REPLACE INTO sellers (
  id,
  username,
  email,
  password_hash,
  name,
  phone,
  business_name,
  business_number,
  status,
  is_active,
  approved_at,
  created_at,
  updated_at
) VALUES (
  999,  -- Fixed ID for admin seller
  'tobe2111',
  'tobe2111@naver.com',
  'placeholder_hash_for_358533aa!!',  -- ⚠️ REPLACE WITH BCRYPT HASH IN PRODUCTION
  '정지원',
  '010-0000-0000',  -- Update with real phone number
  'Ur Team Corporation',
  '000-00-00000',  -- Update with real business number
  'approved',  -- Already approved
  1,  -- Active
  datetime('now'),
  datetime('now'),
  datetime('now')
);

-- Verify the insertion
SELECT 
  id,
  username,
  email,
  name,
  business_name,
  status,
  is_active,
  created_at
FROM sellers 
WHERE email = 'tobe2111@naver.com';

-- 📊 Expected Output:
-- ┌─────┬───────────┬──────────────────────┬─────────┬───────────────────────┬──────────┬───────────┬─────────────────────┐
-- │ id  │ username  │ email                │ name    │ business_name         │ status   │ is_active │ created_at          │
-- ├─────┼───────────┼──────────────────────┼─────────┼───────────────────────┼──────────┼───────────┼─────────────────────┤
-- │ 999 │ tobe2111  │ tobe2111@naver.com   │ 정지원   │ Ur Team Corporation   │ approved │ 1         │ 2026-03-03...       │
-- └─────┴───────────┴──────────────────────┴─────────┴───────────────────────┴──────────┴───────────┴─────────────────────┘
