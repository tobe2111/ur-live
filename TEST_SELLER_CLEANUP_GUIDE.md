# 테스트 셀러 계정 삭제 가이드

## 문제
프로덕션 DB에 테스트 셀러 계정들이 등록되어 있습니다:
- finalcheck01@test.com
- verifytest99@test.com
- signuptest001@test.com
- finaltest123@example.com
- testsellerv4@example.com

## 삭제 방법

### 옵션 1: Cloudflare Dashboard에서 직접 삭제
1. Cloudflare Dashboard → D1 Database → toss-live-commerce-db
2. 콘솔에서 실행:
```sql
-- 테스트 이메일 패턴 확인
SELECT id, email, business_name, created_at 
FROM sellers 
WHERE email LIKE '%test%' OR email LIKE '%example.com';

-- 삭제
DELETE FROM sellers 
WHERE email LIKE '%test%' 
   OR email LIKE '%@example.com'
   OR email IN (
     'finalcheck01@test.com',
     'verifytest99@test.com', 
     'signuptest001@test.com',
     'finaltest123@example.com',
     'testsellerv4@example.com'
   );
```

### 옵션 2: Wrangler CLI (CLOUDFLARE_API_TOKEN 필요)
```bash
# 환경변수 설정 후
export CLOUDFLARE_API_TOKEN=your_token

# 실행
npx wrangler d1 execute DB --remote --command "
DELETE FROM sellers 
WHERE email LIKE '%test%' 
   OR email LIKE '%@example.com';
"
```

### 옵션 3: Admin API 추가 (권장)
Admin 페이지에서 셀러를 직접 삭제할 수 있는 API를 추가:
- DELETE /api/admin/sellers/:id

## 주의사항
- 테스트 계정과 연결된 products, orders, live_streams 데이터도 함께 정리해야 할 수 있습니다
- 실제 운영 계정을 삭제하지 않도록 주의하세요
- 백업을 먼저 해두는 것을 권장합니다

## 현재 상태
로컬 DB에는 2개의 셀러만 있음 (seller-001, seller-002)
프로덕션 DB에는 최소 7개 이상의 셀러가 있음 (테스트 계정 포함)
