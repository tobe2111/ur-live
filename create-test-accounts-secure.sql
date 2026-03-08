-- =============================================
-- UR-Live Test Accounts Setup
-- =============================================
-- 
-- 이 스크립트는 테스트용 관리자 및 셀러 계정을 생성합니다.
-- PBKDF2 암호화 (100,000 iterations)로 보안 강화됨
--
-- 실행 방법:
-- 1. Cloudflare Dashboard 접속:
--    https://dash.cloudflare.com → Workers & Pages → D1 Database → toss-live-commerce-db → Console
-- 
-- 2. 이 스크립트 전체를 복사하여 Console에 붙여넣기 후 실행
--
-- 3. 또는 Wrangler CLI 사용:
--    npx wrangler d1 execute toss-live-commerce-db --remote --file=create-test-accounts-secure.sql
--
-- =============================================

-- =============================================
-- 1. 관리자 계정 (Admin)
-- =============================================

-- 계정 정보:
-- - 이메일: admin@ur-team.com
-- - 비밀번호: admin123
-- - 역할: super_admin
-- - 로그인: https://live.ur-team.com/admin/login

INSERT OR IGNORE INTO admins (
  username,
  email,
  password_hash,
  name,
  role,
  created_at
) VALUES (
  'admin',
  'admin@ur-team.com',
  'IfqvDOc4FxiF7m9hwgbJwQ==$vSTw9LaDbGKEM/cHnAZ8VpkzmlwP9gfULizMG4tKQXU=',
  '관리자',
  'super_admin',
  datetime('now')
);

-- =============================================
-- 2. 셀러 계정 (Seller)
-- =============================================

-- 계정 정보:
-- - 이메일: seller@ur-team.com
-- - 비밀번호: seller123
-- - 상태: approved (승인됨)
-- - 수수료: 10%
-- - 로그인: https://live.ur-team.com/seller/login

INSERT OR IGNORE INTO sellers (
  username,
  email,
  password_hash,
  name,
  business_name,
  business_number,
  phone,
  status,
  commission_rate,
  created_at,
  updated_at
) VALUES (
  'testseller',
  'seller@ur-team.com',
  'itUVt4fdTdIdveuBvEh7iQ==$fiOwHhE6D+RBRi3cEQPsB5hc1z74K6dQYhq3/D+dbKM=',
  '테스트 셀러',
  '테스트 상점',
  '123-45-67890',
  '010-1234-5678',
  'approved',
  10.00,
  datetime('now'),
  datetime('now')
);

-- =============================================
-- 3. 계정 생성 확인
-- =============================================

-- 관리자 계정 확인
SELECT 
  '관리자 계정' as account_type,
  id, username, email, name, role, created_at
FROM admins 
WHERE email = 'admin@ur-team.com';

-- 셀러 계정 확인
SELECT 
  '셀러 계정' as account_type,
  id, username, email, name, business_name, status, commission_rate, created_at
FROM sellers 
WHERE email = 'seller@ur-team.com';

-- =============================================
-- 4. 추가 테스트 계정 (옵션)
-- =============================================

-- 일반 관리자 (권한 제한)
INSERT OR IGNORE INTO admins (
  username,
  email,
  password_hash,
  name,
  role,
  created_at
) VALUES (
  'moderator',
  'moderator@ur-team.com',
  'IfqvDOc4FxiF7m9hwgbJwQ==$vSTw9LaDbGKEM/cHnAZ8VpkzmlwP9gfULizMG4tKQXU=',
  '운영자',
  'admin',
  datetime('now')
);

-- 승인 대기 중인 셀러
INSERT OR IGNORE INTO sellers (
  username,
  email,
  password_hash,
  name,
  business_name,
  business_number,
  phone,
  status,
  commission_rate,
  created_at,
  updated_at
) VALUES (
  'pending_seller',
  'pending@ur-team.com',
  'itUVt4fdTdIdveuBvEh7iQ==$fiOwHhE6D+RBRi3cEQPsB5hc1z74K6dQYhq3/D+dbKM=',
  '대기 셀러',
  '대기 상점',
  '987-65-43210',
  '010-9876-5432',
  'pending',
  10.00,
  datetime('now'),
  datetime('now')
);

-- =============================================
-- 완료!
-- =============================================
-- 
-- 생성된 계정:
-- 1. Admin (super_admin): admin@ur-team.com / admin123
-- 2. Seller (approved): seller@ur-team.com / seller123
-- 3. Moderator (admin): moderator@ur-team.com / admin123
-- 4. Pending Seller: pending@ur-team.com / seller123
--
-- 로그인 URL:
-- - 관리자: https://live.ur-team.com/admin/login
-- - 셀러: https://live.ur-team.com/seller/login
-- - 사용자 (카카오): https://live.ur-team.com/login
--
-- =============================================
