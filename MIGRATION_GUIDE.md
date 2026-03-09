# 🔐 계정 DB 마이그레이션 가이드

**생성일**: 2026-03-09  
**목적**: 하드코딩된 계정을 DB에 bcrypt 해시로 안전하게 저장

---

## ✅ 완료된 작업

1. ✅ bcrypt 해시 생성 완료
2. ✅ SQL 마이그레이션 파일 생성 완료
3. ⚠️ **DB 적용 필요** (아래 방법 중 하나 선택)

---

## 📋 마이그레이션할 계정

### 판매자 계정
```
Email: tobe2111@naver.com
Password: 358533aa!!
Status: approved (즉시 로그인 가능)
```

### 관리자 계정
```
Email: admin@ur-team.com
Password: admin123
Status: active (즉시 로그인 가능)
```

---

## 🚀 방법 1: Cloudflare Dashboard (권장)

### 1단계: SQL 파일 내용 복사

아래 SQL을 복사하세요:

```sql
-- 1. Seller 계정 생성/업데이트
INSERT INTO sellers (
  email, password_hash, username, name, phone, status, is_active, created_at
)
SELECT 
  'tobe2111@naver.com',
  '$2b$10$BUSsiWWnjymT/Ry0RFygHOn/bmgYVhijHIGmv48x4nxWjhvezuys6',
  'tobe2111',
  '메인 판매자',
  '010-0000-0000',
  'approved',
  1,
  datetime('now')
WHERE NOT EXISTS (
  SELECT 1 FROM sellers WHERE email = 'tobe2111@naver.com'
);

UPDATE sellers 
SET 
  password_hash = '$2b$10$BUSsiWWnjymT/Ry0RFygHOn/bmgYVhijHIGmv48x4nxWjhvezuys6',
  status = 'approved',
  is_active = 1
WHERE email = 'tobe2111@naver.com';

-- 2. Admin 계정 생성/업데이트
INSERT INTO admins (
  email, password_hash, username, name, is_active, created_at
)
SELECT 
  'admin@ur-team.com',
  '$2b$10$e92ksFWeLK2g.1ABgeiUqObbXVSrGXkqUO6x4FkQ1NABiPaOPb15q',
  'admin',
  '관리자',
  1,
  datetime('now')
WHERE NOT EXISTS (
  SELECT 1 FROM admins WHERE email = 'admin@ur-team.com'
);

UPDATE admins 
SET 
  password_hash = '$2b$10$e92ksFWeLK2g.1ABgeiUqObbXVSrGXkqUO6x4FkQ1NABiPaOPb15q',
  is_active = 1
WHERE email = 'admin@ur-team.com';

-- 3. 결과 확인
SELECT 'seller' as type, id, email, name, status, is_active, substr(password_hash, 1, 20) as hash_preview
FROM sellers WHERE email = 'tobe2111@naver.com'
UNION ALL
SELECT 'admin' as type, id, email, name, NULL as status, is_active, substr(password_hash, 1, 20) as hash_preview
FROM admins WHERE email = 'admin@ur-team.com';
```

### 2단계: Cloudflare Dashboard에서 실행

1. **Cloudflare Dashboard 접속**
   - URL: https://dash.cloudflare.com/

2. **D1 Database로 이동**
   - 좌측 메뉴: Workers & Pages > D1
   - Database 선택: `toss-live-commerce-db`

3. **Console 탭 열기**
   - 상단 탭에서 "Console" 클릭

4. **SQL 붙여넣기 및 실행**
   - 위에서 복사한 SQL을 붙여넣기
   - "Execute" 버튼 클릭

5. **결과 확인**
   - 2개의 행이 반환되어야 함:
     ```
     type   | id | email                  | name       | status   | is_active | hash_preview
     -------|----|-----------------------|------------|----------|-----------|------------------
     seller |  1 | tobe2111@naver.com    | 메인 판매자 | approved |     1     | $2b$10$BUSsiWWnjym
     admin  |  1 | admin@ur-team.com     | 관리자      | NULL     |     1     | $2b$10$e92ksFWeLK2
     ```

---

## 🔧 방법 2: Wrangler CLI (선택)

Cloudflare API 토큰이 있는 경우:

```bash
# 1. API 토큰 설정
export CLOUDFLARE_API_TOKEN="your-api-token"

# 2. 마이그레이션 실행
npx wrangler d1 execute toss-live-commerce-db \
  --remote \
  --file=scripts/migrate-accounts-generated.sql

# 3. 결과 확인
npx wrangler d1 execute toss-live-commerce-db \
  --remote \
  --command="SELECT * FROM sellers WHERE email = 'tobe2111@naver.com'"
```

---

## ✅ 마이그레이션 완료 확인

### 1. 판매자 로그인 테스트

```bash
curl -X POST https://live.ur-team.com/api/seller/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "tobe2111@naver.com",
    "password": "358533aa!!"
  }'
```

**예상 응답**:
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1...",
    "refreshToken": "eyJhbGciOiJIUzI1...",
    "expiresIn": 900,
    "seller": {
      "id": 1,
      "username": "tobe2111",
      "email": "tobe2111@naver.com",
      "name": "메인 판매자",
      "status": "approved"
    }
  }
}
```

### 2. 관리자 로그인 테스트

```bash
curl -X POST https://live.ur-team.com/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@ur-team.com",
    "password": "admin123"
  }'
```

**예상 응답**:
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1...",
    "refreshToken": "eyJhbGciOiJIUzI1...",
    "expiresIn": 900,
    "admin": {
      "id": 1,
      "username": "admin",
      "email": "admin@ur-team.com",
      "name": "관리자"
    }
  }
}
```

### 3. 브라우저 테스트

**판매자**:
1. https://live.ur-team.com/seller/login 접속
2. Email: `tobe2111@naver.com`
3. Password: `358533aa!!`
4. 로그인 성공 → `/seller` 페이지로 이동

**관리자**:
1. https://live.ur-team.com/admin/login 접속
2. Email: `admin@ur-team.com`
3. Password: `admin123`
4. 로그인 성공 → `/admin` 페이지로 이동

---

## ❌ 문제 해결

### 문제 1: "이메일 또는 비밀번호가 일치하지 않습니다"

**원인**: 계정이 DB에 없음

**해결**:
1. Cloudflare Dashboard에서 SQL 다시 실행
2. 결과 확인 쿼리 실행:
   ```sql
   SELECT * FROM sellers WHERE email = 'tobe2111@naver.com';
   SELECT * FROM admins WHERE email = 'admin@ur-team.com';
   ```

### 문제 2: "JWT_SECRET is required"

**원인**: 환경 변수 미설정

**해결**:
1. Cloudflare Pages 설정 확인
2. Settings > Environment Variables > Production
3. `JWT_SECRET` 값 확인 (32자 이상)

### 문제 3: "승인 대기 중인 계정입니다"

**원인**: Seller status가 'approved'가 아님

**해결**:
```sql
UPDATE sellers 
SET status = 'approved' 
WHERE email = 'tobe2111@naver.com';
```

---

## 🔒 보안 주의사항

### ⚠️ 중요!

1. **이 파일을 Git에 커밋하지 마세요**
   - `.gitignore`에 추가됨
   - `scripts/*-generated.sql` 패턴

2. **마이그레이션 후 즉시 삭제**
   ```bash
   rm scripts/migrate-accounts-generated.sql
   rm scripts/migrate-accounts.js
   rm MIGRATION_GUIDE.md
   ```

3. **비밀번호 주기적 변경**
   - 최소 3개월마다 변경
   - 새 bcrypt 해시 생성:
     ```bash
     node -e "const bcrypt = require('bcryptjs'); (async () => { console.log(await bcrypt.hash('new-password', 10)); })()"
     ```

4. **로그 모니터링**
   - 실패한 로그인 시도 확인
   - Rate Limiting 동작 확인
   - 의심스러운 IP 차단

---

## 📊 마이그레이션 체크리스트

- [ ] SQL 파일 복사 완료
- [ ] Cloudflare Dashboard Console에서 실행
- [ ] 결과 확인 (2개 행 반환)
- [ ] 판매자 로그인 테스트 성공
- [ ] 관리자 로그인 테스트 성공
- [ ] 브라우저에서 로그인 테스트 성공
- [ ] 마이그레이션 파일 삭제
- [ ] JWT_SECRET 환경 변수 확인

---

## 🎉 완료!

마이그레이션이 성공적으로 완료되면:

1. ✅ 하드코딩 계정 제거 완료
2. ✅ bcrypt 해시로 안전하게 저장
3. ✅ 프로덕션 오픈 준비 완료

**다음 단계**: https://live.ur-team.com에서 로그인 테스트!

---

**문의**: 
- 보안 이슈: security@ur-team.com
- 긴급: jiwon@ur-team.com
