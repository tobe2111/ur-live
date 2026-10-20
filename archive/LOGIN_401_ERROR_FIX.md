# 🚨 로그인 401 에러 해결 가이드

**날짜**: 2026-03-03  
**에러**: 셀러/어드민 로그인 시 `401 Unauthorized`  
**원인**: 데이터베이스에 계정이 없거나 마이그레이션 미실행

---

## 🔍 에러 분석

### **셀러 로그인 에러**
```
POST https://live.ur-team.com/api/seller/login 401 (Unauthorized)
[SellerLogin] Error: AxiosError: Request failed with status code 401
```

### **어드민 로그인 에러**
```
Failed to load resource: the server responded with a status of 401 ()
[AdminLogin] Error: AxiosError: Request failed with status code 401
```

### **로그인 시도 정보**
- **셀러**: `tobe2111@naver.com` / `358533aa!!`
- **어드민**: `tobe2111@naver.com` / `358533aa!!`

---

## 🎯 원인

401 에러는 다음 중 하나의 문제입니다:

1. ❌ 데이터베이스에 계정이 없음
2. ❌ 비밀번호 해시가 틀림
3. ❌ 마이그레이션이 실행되지 않음
4. ❌ bcrypt 해시 검증 실패

---

## ✅ 즉시 해결 방법

### **방법 1: Cloudflare Dashboard에서 직접 SQL 실행** (추천)

1. **Cloudflare Dashboard 접속**
   - https://dash.cloudflare.com 로그인
   - Workers & Pages 선택
   - D1 데이터베이스 선택
   - `lister-db` 클릭

2. **Console 탭에서 SQL 실행**
   
   ```sql
   -- 1. 현재 계정 확인
   SELECT id, email, name, status, is_active 
   FROM sellers 
   WHERE email = 'tobe2111@naver.com';
   
   SELECT id, email, name, role, is_active 
   FROM admins 
   WHERE email = 'tobe2111@naver.com';
   ```

3. **계정이 없으면 추가**
   
   ```sql
   -- 셀러 계정 추가
   INSERT OR REPLACE INTO sellers (
     id, username, email, password_hash, name, phone,
     business_number, company_name, status, is_active,
     commission_rate, created_at, updated_at
   ) VALUES (
     1, 'tobe2111', 'tobe2111@naver.com',
     '$2b$10$ECEIHTgi3Ge1p3g0qre6a.iGbYDPLytQOlrqjBaHB.Qu.GEECEYZi',
     '토비', '010-1234-5678', '123-45-67890', '리스터코퍼레이션',
     'approved', 1, 10.0, datetime('now'), datetime('now')
   );
   
   -- 어드민 계정 추가
   INSERT OR REPLACE INTO admins (
     id, username, email, password_hash, name,
     is_active, role, created_at, updated_at
   ) VALUES (
     1, 'tobe2111', 'tobe2111@naver.com',
     '$2b$10$3WoWNsMd./fG2mMCL3ZlEut5lNMSF7omSONsQwBzDYnfPwE6RptuO',
     '토비', 1, 'super_admin', datetime('now'), datetime('now')
   );
   ```

4. **검증**
   
   ```sql
   -- 비밀번호 해시 확인
   SELECT 
     'SELLER' as type,
     email,
     CASE 
       WHEN password_hash LIKE '$2b$10$ECEIHTgi3Ge1p3g0qre6a.%' THEN '✅ OK'
       WHEN password_hash LIKE '$2%' THEN '⚠️ Wrong hash'
       ELSE '❌ Invalid'
     END as hash_check
   FROM sellers 
   WHERE email = 'tobe2111@naver.com';
   
   SELECT 
     'ADMIN' as type,
     email,
     CASE 
       WHEN password_hash LIKE '$2b$10$3WoWNsMd.%' THEN '✅ OK'
       WHEN password_hash LIKE '$2%' THEN '⚠️ Wrong hash'
       ELSE '❌ Invalid'
     END as hash_check
   FROM admins 
   WHERE email = 'tobe2111@naver.com';
   ```

5. **로그인 재시도**
   - https://live.ur-team.com/seller/login
   - https://live.ur-team.com/admin/login
   - `tobe2111@naver.com` / `358533aa!!`

---

### **방법 2: Wrangler CLI로 마이그레이션 실행**

#### **사전 준비**
```bash
# Cloudflare API 토큰 설정 필요
export CLOUDFLARE_API_TOKEN="your-api-token-here"
```

#### **Quick Fix SQL 실행**
```bash
npx wrangler d1 execute lister-db --remote --file=QUICK_FIX_LOGIN.sql
```

#### **또는 전체 마이그레이션 실행**
```bash
# 테스트 계정 추가
npx wrangler d1 execute lister-db --remote \
  --file=migrations/0103_add_bcrypt_test_accounts.sql

# 어드민 계정 업데이트
npx wrangler d1 execute lister-db --remote \
  --file=migrations/0104_update_admin_account.sql
```

#### **검증**
```bash
npx wrangler d1 execute lister-db --remote \
  --command="SELECT email, name, status FROM sellers WHERE email='tobe2111@naver.com'"

npx wrangler d1 execute lister-db --remote \
  --command="SELECT email, name, role FROM admins WHERE email='tobe2111@naver.com'"
```

---

## 🔍 디버깅 단계

### **1단계: 계정 존재 여부 확인**

**SQL 쿼리**:
```sql
SELECT * FROM sellers WHERE email = 'tobe2111@naver.com';
SELECT * FROM admins WHERE email = 'tobe2111@naver.com';
```

**기대 결과**:
- 셀러: 1행 반환 (status='approved', is_active=1)
- 어드민: 1행 반환 (role='super_admin', is_active=1)

**실제 결과**:
- 0행 반환 → **계정 없음** → 방법 1 또는 2로 계정 추가

### **2단계: 비밀번호 해시 확인**

**SQL 쿼리**:
```sql
SELECT 
  email,
  password_hash,
  LENGTH(password_hash) as hash_length,
  SUBSTR(password_hash, 1, 10) as hash_prefix
FROM sellers 
WHERE email = 'tobe2111@naver.com';
```

**기대 결과**:
```
email: tobe2111@naver.com
password_hash: $2b$10$ECEIHTgi3Ge1p3g0qre6a.iGbYDPLytQOlrqjBaHB.Qu.GEECEYZi
hash_length: 60
hash_prefix: $2b$10$ECE
```

**문제 시나리오**:

| 결과 | 문제 | 해결 |
|------|------|------|
| `placeholder_hash_for_...` | 평문 저장 | bcrypt 해시로 교체 |
| 해시 길이 ≠ 60 | 잘못된 해시 | 올바른 bcrypt 해시 사용 |
| 다른 prefix | 다른 비밀번호 | 정확한 해시 확인 |

### **3단계: 계정 상태 확인**

**SQL 쿼리**:
```sql
SELECT 
  email,
  status,
  is_active,
  CASE 
    WHEN status = 'approved' AND is_active = 1 THEN '✅ 로그인 가능'
    WHEN status = 'pending' THEN '⏳ 승인 대기'
    WHEN is_active = 0 THEN '❌ 비활성'
    ELSE '❌ 문제 있음'
  END as login_status
FROM sellers 
WHERE email = 'tobe2111@naver.com';
```

**기대 결과**:
```
status: approved
is_active: 1
login_status: ✅ 로그인 가능
```

### **4단계: 백엔드 로그 확인**

로그인 시도 시 백엔드에서 다음 로그가 출력됩니다:

```
[JWT Login] ✅ Seller tobe2111@naver.com logged in with JWT (NO Firebase)
```

로그가 없으면:
- ❌ 계정을 찾지 못함
- ❌ 비밀번호 불일치
- ❌ 상태 검증 실패

---

## 📋 정확한 비밀번호 해시

### **셀러 계정**
```
이메일: tobe2111@naver.com
비밀번호: 358533aa!!
Bcrypt Hash: $2b$10$ECEIHTgi3Ge1p3g0qre6a.iGbYDPLytQOlrqjBaHB.Qu.GEECEYZi
```

**생성 명령어**:
```bash
node -e "const bcrypt = require('bcryptjs'); bcrypt.hash('358533aa!!', 10).then(console.log)"
```

### **어드민 계정**
```
이메일: tobe2111@naver.com
비밀번호: 358533aa!!
Bcrypt Hash: $2b$10$3WoWNsMd./fG2mMCL3ZlEut5lNMSF7omSONsQwBzDYnfPwE6RptuO
```

**생성 명령어**:
```bash
node -e "const bcrypt = require('bcryptjs'); bcrypt.hash('358533aa!!', 10).then(console.log)"
```

**중요**: 
- ✅ 해시는 매번 다르게 생성됨 (솔트가 포함되기 때문)
- ✅ 위 해시들은 이미 생성된 값이므로 그대로 사용
- ⚠️ 새로 생성하면 다른 해시가 나옴 (하지만 검증은 성공)

---

## 🧪 로컬 테스트

### **비밀번호 검증 테스트**

```bash
# Node.js로 bcrypt 검증
node -e "
const bcrypt = require('bcryptjs');
const password = '358533aa!!';
const sellerHash = '\$2b\$10\$ECEIHTgi3Ge1p3g0qre6a.iGbYDPLytQOlrqjBaHB.Qu.GEECEYZi';
const adminHash = '\$2b\$10\$3WoWNsMd./fG2mMCL3ZlEut5lNMSF7omSONsQwBzDYnfPwE6RptuO';

bcrypt.compare(password, sellerHash).then(result => {
  console.log('Seller password check:', result ? '✅ OK' : '❌ FAIL');
});

bcrypt.compare(password, adminHash).then(result => {
  console.log('Admin password check:', result ? '✅ OK' : '❌ FAIL');
});
"
```

**기대 출력**:
```
Seller password check: ✅ OK
Admin password check: ✅ OK
```

---

## 📝 체크리스트

배포 후 확인 사항:

- [ ] Cloudflare Dashboard에서 SQL 실행
- [ ] 셀러 계정 존재 확인
- [ ] 어드민 계정 존재 확인
- [ ] 비밀번호 해시 확인 (bcrypt 형식)
- [ ] 계정 상태 확인 (approved, is_active=1)
- [ ] 셀러 로그인 테스트 (브라우저)
- [ ] 어드민 로그인 테스트 (브라우저)
- [ ] API 응답 확인 (JWT 토큰 반환)
- [ ] 대시보드 접근 확인

---

## 🎯 예상 결과

### **로그인 성공 시**

**셀러 로그인 응답**:
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "seller": {
      "id": 1,
      "username": "tobe2111",
      "email": "tobe2111@naver.com",
      "name": "토비",
      "status": "approved"
    }
  }
}
```

**어드민 로그인 응답**:
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "admin": {
      "id": 1,
      "username": "tobe2111",
      "email": "tobe2111@naver.com",
      "name": "토비"
    }
  }
}
```

### **로그인 실패 시 에러**

| 에러 코드 | 메시지 | 원인 | 해결 |
|----------|--------|------|------|
| 401 | 이메일 또는 비밀번호가 일치하지 않습니다 | 계정 없음 또는 비밀번호 틀림 | 계정 추가 또는 해시 확인 |
| 403 | 비활성화된 계정입니다 | is_active = 0 | `UPDATE sellers SET is_active = 1` |
| 403 | 승인 대기 중인 계정입니다 | status = 'pending' | `UPDATE sellers SET status = 'approved'` |

---

## 🚀 빠른 해결 (1분 내)

### **Cloudflare Dashboard 방식** (가장 빠름)

1. https://dash.cloudflare.com 로그인
2. Workers & Pages → D1 → lister-db
3. Console 탭 클릭
4. `QUICK_FIX_LOGIN.sql` 내용 복사/붙여넣기
5. Execute 클릭
6. 로그인 재시도

### **SQL 스크립트 다운로드**

프로젝트 루트에 `QUICK_FIX_LOGIN.sql` 파일 있음:
- 셀러 계정 추가
- 어드민 계정 추가
- 자동 검증 쿼리 포함

---

## 📞 추가 지원

### **문제가 계속되면**

1. **계정 정보 재확인**
   ```sql
   SELECT * FROM sellers WHERE email = 'tobe2111@naver.com';
   SELECT * FROM admins WHERE email = 'tobe2111@naver.com';
   ```

2. **비밀번호 해시 재생성**
   ```bash
   node -e "require('bcryptjs').hash('358533aa!!', 10).then(console.log)"
   ```

3. **수동으로 업데이트**
   ```sql
   UPDATE sellers 
   SET password_hash = '<new_hash>', 
       status = 'approved', 
       is_active = 1 
   WHERE email = 'tobe2111@naver.com';
   ```

---

**마지막 업데이트**: 2026-03-03  
**상태**: 🚨 즉시 해결 필요  
**우선순위**: ⚠️ HIGH
