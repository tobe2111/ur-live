# 🔍 로그인 디버깅 가이드

## 📊 현재 상황
- SQL 실행 완료 (계정 추가됨)
- 여전히 401 에러 발생
- 디버그 로깅 추가 (빌드: afbba2ed9cf584c0)

---

## 🚀 배포 대기 중

**자동 배포**: GitHub 푸시 후 Cloudflare Pages가 자동으로 배포합니다.

**배포 확인**:
1. https://github.com/tobe2111/ur-live/actions 확인
2. 또는 Cloudflare Dashboard → Workers & Pages → ur-live → Deployments

**예상 시간**: 2-3분

---

## 🔍 Cloudflare Workers 로그 확인 방법

### **방법 1: Cloudflare Dashboard (실시간)**

1. **Dashboard 접속**
   - https://dash.cloudflare.com
   - Workers & Pages 클릭
   - `ur-live` 선택

2. **Logs 탭 클릭**
   - 실시간 로그 스트림 확인
   - 또는 "Logs" → "Real-time Logs"

3. **로그인 시도**
   - https://live.ur-team.com/admin/login 접속
   - `tobe2111@naver.com` / `358533aa!!` 입력
   - 로그인 버튼 클릭

4. **로그 확인**
   ```
   [Admin Login] Verifying password for: tobe2111@naver.com
   [Admin Login] Password hash found: Yes
   [Admin Login] Hash prefix: $2b$10$3Wo
   [Admin Login] Attempting bcrypt verification...
   [Admin Login] Bcrypt result: true (또는 false)
   [Admin Login] ✅ Password verified successfully
   ```

### **방법 2: Wrangler CLI (터미널)**

```bash
# 실시간 로그 스트리밍
npx wrangler pages deployment tail

# 또는 특정 프로젝트
npx wrangler pages deployment tail --project-name=ur-live
```

---

## 🧪 예상 로그 시나리오

### **시나리오 A: 계정 없음** ❌
```
[Admin Login] Verifying password for: tobe2111@naver.com
(계정 조회 실패)
응답: 401 "이메일 또는 비밀번호가 일치하지 않습니다"
```

**해결**: SQL을 다시 실행하거나 DB 확인

### **시나리오 B: 비밀번호 해시 틀림** ❌
```
[Admin Login] Verifying password for: tobe2111@naver.com
[Admin Login] Password hash found: Yes
[Admin Login] Hash prefix: placeholder
(bcrypt 검증 시도 안 함)
[Admin Login] ❌ Password verification failed
응답: 401
```

**해결**: 올바른 bcrypt 해시로 업데이트

### **시나리오 C: bcrypt 검증 실패** ❌
```
[Admin Login] Verifying password for: tobe2111@naver.com
[Admin Login] Password hash found: Yes
[Admin Login] Hash prefix: $2b$10$...
[Admin Login] Attempting bcrypt verification...
[Admin Login] Bcrypt result: false
[Admin Login] ❌ Password verification failed
응답: 401
```

**해결**: 비밀번호가 틀림 또는 해시가 잘못됨

### **시나리오 D: 성공!** ✅
```
[Admin Login] Verifying password for: tobe2111@naver.com
[Admin Login] Password hash found: Yes
[Admin Login] Hash prefix: $2b$10$3Wo
[Admin Login] Attempting bcrypt verification...
[Admin Login] Bcrypt result: true
[Admin Login] ✅ Password verified successfully
[JWT Login] ✅ Admin tobe2111@naver.com logged in with JWT
응답: 200 {success: true, data: {...}}
```

---

## 🔧 추가 디버깅 단계

### **1. 데이터베이스 재확인**

Cloudflare Dashboard → D1 → lister-db → Console:

```sql
-- 어드민 계정 확인
SELECT 
  id,
  email,
  password_hash,
  LENGTH(password_hash) as hash_length,
  SUBSTR(password_hash, 1, 15) as hash_start,
  is_active
FROM admins 
WHERE email = 'tobe2111@naver.com';
```

**기대 결과**:
```
id: 1
email: tobe2111@naver.com
password_hash: $2b$10$3WoWNsMd./fG2mMCL3ZlEut5lNMSF7omSONsQwBzDYnfPwE6RptuO
hash_length: 60
hash_start: $2b$10$3WoWNsM
is_active: 1
```

### **2. 로컬 bcrypt 테스트**

터미널에서:

```bash
node -e "
const bcrypt = require('bcryptjs');
const password = '358533aa!!';
const adminHash = '\$2b\$10\$3WoWNsMd./fG2mMCL3ZlEut5lNMSF7omSONsQwBzDYnfPwE6RptuO';

bcrypt.compare(password, adminHash).then(result => {
  console.log('Password verification:', result ? '✅ SUCCESS' : '❌ FAIL');
  process.exit(result ? 0 : 1);
});
"
```

**기대 출력**:
```
Password verification: ✅ SUCCESS
```

**실패 시**:
```
Password verification: ❌ FAIL
```
→ 해시가 잘못되었거나 비밀번호가 다름

### **3. 새 해시 생성 (필요시)**

```bash
node -e "
const bcrypt = require('bcryptjs');
bcrypt.hash('358533aa!!', 10).then(hash => {
  console.log('New admin hash:', hash);
});
"
```

그리고 새 해시로 업데이트:

```sql
UPDATE admins 
SET password_hash = '<new_hash_here>' 
WHERE email = 'tobe2111@naver.com';
```

---

## 📋 체크리스트

배포 후 확인:

- [ ] GitHub Actions 배포 완료 확인
- [ ] Cloudflare Pages 배포 상태 확인
- [ ] 로그인 재시도
- [ ] Cloudflare Workers 로그 확인
- [ ] 예상 로그 출력 여부 확인
- [ ] 성공/실패 메시지 확인

---

## 🎯 다음 단계

### **배포 후 (2-3분 대기)**

1. **로그인 재시도**
   - https://live.ur-team.com/admin/login
   - `tobe2111@naver.com` / `358533aa!!`

2. **로그 확인**
   - Cloudflare Dashboard → Workers & Pages → ur-live → Logs
   - 실시간 로그 스트림 모니터링

3. **결과에 따라**
   - ✅ 성공: 완료!
   - ❌ 실패: 로그 분석 → 추가 디버깅

---

## 🚨 긴급 해결 방법

### **만약 여전히 안 되면**

**임시 하드코딩 방식** (개발 전용):

`src/index.tsx:2242` 수정:

```typescript
// 임시: 하드코딩된 계정 추가
const isTestAccount = email === 'admin@example.com' && password === 'admin123';
const isMainAccount = email === 'tobe2111@naver.com' && password === '358533aa!!';

let isValidPassword = isTestAccount || isMainAccount;
```

이렇게 하면 **bcrypt 없이** 비밀번호를 평문으로 비교합니다 (보안 취약, 임시용).

---

## 📞 추가 지원

### **로그가 보이지 않으면**

1. 배포가 완료되지 않았을 수 있음
2. 이전 빌드가 캐시되어 있을 수 있음
3. Cloudflare Workers 로그가 활성화되지 않았을 수 있음

### **해시가 계속 틀리면**

가능성:
1. 비밀번호에 특수문자 이스케이프 필요
2. 해시가 잘못 복사됨 (공백, 줄바꿈 포함)
3. bcrypt 라이브러리 버전 차이

---

**현재 빌드**: afbba2ed9cf584c0  
**배포 상태**: ⏳ 대기 중 (2-3분)  
**다음 작업**: 배포 완료 후 로그인 재시도 및 로그 확인

---

**마지막 업데이트**: 2026-03-03  
**커밋**: ae9ff6e
