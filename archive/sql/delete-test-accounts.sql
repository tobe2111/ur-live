-- ============================================
-- 운영 DB 테스트 계정 삭제
-- 실행 위치: Cloudflare Dashboard > D1 > toss-live-commerce-db > Console
-- 날짜: 2026-03-25
-- ============================================

-- [1단계] 삭제 전 확인 (먼저 이걸 실행해서 존재 여부 확인)
SELECT 'SELLER' as type, id, email, name, status
FROM sellers
WHERE email IN (
  'seller1@example.com',
  'seller@ur-team.com',
  'pending@example.com'
)
UNION ALL
SELECT 'ADMIN' as type, id, email, name, 'N/A' as status
FROM admins
WHERE email = 'admin@example.com';

-- ============================================
-- 위 결과 확인 후 아래 DELETE 실행
-- ============================================

-- [2단계] 테스트 셀러 삭제
DELETE FROM sellers
WHERE email IN (
  'seller1@example.com',
  'seller@ur-team.com',
  'pending@example.com'
);

-- [3단계] 테스트 어드민 삭제
DELETE FROM admins
WHERE email = 'admin@example.com';

-- [4단계] 삭제 확인
SELECT 'SELLER' as type, COUNT(*) as remaining
FROM sellers
WHERE email IN ('seller1@example.com', 'seller@ur-team.com', 'pending@example.com')
UNION ALL
SELECT 'ADMIN' as type, COUNT(*) as remaining
FROM admins
WHERE email = 'admin@example.com';
-- 모든 remaining이 0이면 완료
