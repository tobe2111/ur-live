-- Update Admin account to tobe2111@naver.com
-- This will update the existing admin account or insert if not exists

-- Delete old admin account if exists
DELETE FROM admins WHERE email = 'admin@ur-team.com';

-- Insert new admin account
INSERT OR REPLACE INTO admins (
  id,
  username,
  email,
  password_hash,
  name,
  role,
  created_at
) VALUES (
  1,  -- Keep ID as 1 (primary admin)
  'admin',
  'tobe2111@naver.com',
  'kab8FgvYmXuY1XHG45TP6w==$mcP6dhIWmFbCRJ620KVEJwu34F+mKAbRVUWOdEHLIP4=',
  '관리자',
  'super_admin',
  datetime('now')
);

-- Verify the update
SELECT id, username, email, name, role, created_at 
FROM admins 
WHERE email = 'tobe2111@naver.com';
