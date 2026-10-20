-- 전체 사용자 계정 조회
SELECT 'USERS' as type, 
       id, 
       name, 
       email, 
       phone, 
       kakao_id,
       toss_user_id,
       created_at,
       updated_at
FROM users
ORDER BY created_at DESC;

-- 전체 관리자 계정 조회
SELECT 'ADMINS' as type,
       id,
       username,
       email,
       name,
       role,
       created_at
FROM admins
ORDER BY created_at DESC;

-- 전체 셀러 계정 조회
SELECT 'SELLERS' as type,
       id,
       username,
       email,
       name,
       business_name,
       business_number,
       phone,
       status,
       commission_rate,
       created_at,
       updated_at
FROM sellers
ORDER BY created_at DESC;
