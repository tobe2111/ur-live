# 🚀 Seller & Admin Login - 완전 구현 및 배포 가이드

## ✅ 완료된 작업 (2026-03-08)

### **1. 백엔드 API 구현**
- ✅ `src/features/auth/api/seller.routes.ts` (240줄) - 판매자 로그인 API
- ✅ `src/features/auth/api/admin.routes.ts` (234줄) - 관리자 로그인 API
- ✅ `src/features/auth/index.ts` - Export 업데이트
- ✅ `src/worker/index.ts` - 라우트 등록

### **2. API 엔드포인트**

#### **판매자 API**
- `POST /api/seller/login` - 판매자 로그인 (JWT)
- `POST /api/seller/register` - 판매자 회원가입
- `GET /api/seller/me` - 판매자 프로필 조회 (JWT 인증)

#### **관리자 API**
- `POST /api/admin/login` - 관리자 로그인 (JWT)
- `POST /api/admin/register` - 관리자 회원가입 (슈퍼 관리자만)
- `GET /api/admin/me` - 관리자 프로필 조회 (JWT 인증)

### **3. 보안 기능**
- ✅ PBKDF2 비밀번호 해싱 (100,000 iterations)
- ✅ JWT 토큰 인증 (7일 유효)
- ✅ 판매자 상태 검증 (approved만 로그인 가능)
- ✅ 관리자 권한 분리 (admin / super_admin)
- ✅ CORS 설정
- ✅ 에러 처리 및 로깅

### **4. 테스트 계정 생성**
- ✅ `generate-password-hashes.mjs` - PBKDF2 해시 생성 스크립트
- ✅ `create-test-accounts-hashed.sql` - 실제 해시로 계정 생성 SQL
- ✅ JWT_SECRET 생성 완료

---

## 🔑 **생성된 보안 키**

### **JWT Secret** (Cloudflare 환경 변수 설정 필요)
```
JWT_SECRET=933a7dd8858abf61df9eedada8322c1fa9b2ff3dc4ee4cff0053aa4dfe602b90
```

### **테스트 계정 비밀번호 해시**

**Admin (admin@ur-team.com / admin123)**:
```
IfqvDOc4FxiF7m9hwgbJwQ==$vSTw9LaDbGKEM/cHnAZ8VpkzmlwP9gfULizMG4tKQXU=
```

**Seller (seller@ur-team.com / seller123)**:
```
itUVt4fdTdIdveuBvEh7iQ==$fiOwHhE6D+RBRi3cEQPsB5hc1z74K6dQYhq3/D+dbKM=
```

---

## 📋 **배포 체크리스트**

### **Step 1: Cloudflare 환경 변수 설정** (5분)

1. Cloudflare 대시보드 접속: https://dash.cloudflare.com
2. **Workers & Pages** → **ur-live** 프로젝트 선택
3. **Settings** → **Environment variables**
4. **Production** 탭에서 다음 변수 추가:

```bash
JWT_SECRET=933a7dd8858abf61df9eedada8322c1fa9b2ff3dc4ee4cff0053aa4dfe602b90
```

5. **Save** 클릭

---

### **Step 2: D1 데이터베이스에 테스트 계정 생성** (5분)

1. Cloudflare 대시보드에서 **Workers & Pages** → **D1 Database**
2. `toss-live-commerce-db` 선택
3. **Console** 탭 클릭
4. 다음 SQL 실행:

```sql
-- Admin account (admin@ur-team.com / admin123)
INSERT OR IGNORE INTO admins (username, email, password_hash, name, role, created_at)
VALUES ('admin', 'admin@ur-team.com', 'IfqvDOc4FxiF7m9hwgbJwQ==$vSTw9LaDbGKEM/cHnAZ8VpkzmlwP9gfULizMG4tKQXU=', '관리자', 'super_admin', datetime('now'));

-- Seller account (seller@ur-team.com / seller123)
INSERT OR IGNORE INTO sellers (username, email, password_hash, name, business_name, business_number, phone, status, commission_rate, created_at, updated_at)
VALUES ('testseller', 'seller@ur-team.com', 'itUVt4fdTdIdveuBvEh7iQ==$fiOwHhE6D+RBRi3cEQPsB5hc1z74K6dQYhq3/D+dbKM=', '테스트 셀러', '테스트 상점', '123-45-67890', '010-1234-5678', 'approved', 10.00, datetime('now'), datetime('now'));
```

5. **Execute** 클릭
6. 확인 쿼리 실행:

```sql
SELECT * FROM admins WHERE email = 'admin@ur-team.com';
SELECT * FROM sellers WHERE email = 'seller@ur-team.com';
```

---

### **Step 3: 코드 빌드 및 배포** (5분)

```bash
# 1. 의존성 확인
cd /home/user/webapp
npm install

# 2. TypeScript 타입 체크
npx tsc --noEmit

# 3. 프로덕션 빌드
npm run build

# 4. Cloudflare Pages 배포
npx wrangler pages deploy dist --project-name=ur-live

# 또는 Git push로 자동 배포
git add -A
git commit -m "feat: implement complete seller and admin login backend APIs"
git push origin main
```

---

### **Step 4: 로그인 테스트** (10분)

#### **A. 관리자 로그인 테스트**
1. https://live.ur-team.com/admin/login 접속
2. 이메일: `admin@ur-team.com`
3. 비밀번호: `admin123`
4. "로그인" 버튼 클릭
5. ✅ 관리자 대시보드로 리다이렉트 확인 (`/admin`)

**예상 결과**:
- localStorage에 `admin_token`, `user_type=admin`, `admin_id`, `user_name` 저장됨
- Console에 `[Admin Login] ✅ Login successful: admin@ur-team.com` 출력

#### **B. 판매자 로그인 테스트**
1. https://live.ur-team.com/seller/login 접속
2. 이메일: `seller@ur-team.com`
3. 비밀번호: `seller123`
4. "Sign In" 버튼 클릭
5. ✅ 판매자 대시보드로 리다이렉트 확인 (`/seller`)

**예상 결과**:
- localStorage에 `seller_token`, `user_type=seller`, `seller_id`, `user_name` 저장됨
- Console에 `[Seller Login] ✅ Login successful: seller@ur-team.com` 출력

#### **C. API 직접 테스트 (선택)**

**관리자 로그인 API**:
```bash
curl -X POST https://live.ur-team.com/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@ur-team.com","password":"admin123"}'
```

**판매자 로그인 API**:
```bash
curl -X POST https://live.ur-team.com/api/seller/login \
  -H "Content-Type: application/json" \
  -d '{"email":"seller@ur-team.com","password":"seller123"}'
```

**예상 응답**:
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "admin": {
      "id": 1,
      "email": "admin@ur-team.com",
      "name": "관리자",
      "role": "super_admin"
    }
  }
}
```

---

## 🐛 **트러블슈팅**

### **문제 1: 로그인 시 "Server configuration error"**
**원인**: JWT_SECRET 환경 변수가 설정되지 않음
**해결**:
1. Cloudflare 대시보드 → ur-live → Settings → Environment variables
2. `JWT_SECRET` 추가
3. Redeploy 필요 (자동 재배포 대기 또는 수동 재배포)

---

### **문제 2: 로그인 시 "Invalid credentials"**
**원인**: DB에 테스트 계정이 없거나 비밀번호 해시가 잘못됨
**해결**:
1. D1 Console에서 계정 확인:
```sql
SELECT * FROM admins WHERE email = 'admin@ur-team.com';
```
2. 없으면 `create-test-accounts-hashed.sql` 재실행
3. 비밀번호 해시 확인: 반드시 `$`로 구분된 salt$hash 형식

---

### **문제 3: 로그인 후 404 Not Found**
**원인**: 판매자/관리자 대시보드 페이지가 빌드되지 않음
**해결**:
1. 빌드 로그 확인:
```bash
npm run build 2>&1 | grep -E "SellerPage|AdminPage"
```
2. 페이지 파일 존재 확인:
```bash
ls -la src/pages/SellerPage.tsx
ls -la src/pages/AdminPage.tsx
```

---

### **문제 4: CORS 에러**
**원인**: CORS 설정 누락
**해결**: 이미 `seller.routes.ts`, `admin.routes.ts`에 `cors()` 미들웨어 추가됨 ✅

---

## 📊 **구현 상태 최종 확인**

### **프론트엔드**
- [x] LoginPage.tsx (504줄) - 카카오, 이메일, Google 로그인
- [x] SellerLoginPage.tsx (220줄) - 판매자 로그인 UI
- [x] AdminLoginPage.tsx (165줄) - 관리자 로그인 UI
- [x] RegisterPage.tsx (339줄) - 회원가입 UI
- [x] SellerRegisterPage.tsx (256줄) - 판매자 회원가입 UI

### **백엔드**
- [x] kakao.routes.ts (277줄) - 카카오 OAuth 로그인
- [x] google.routes.ts - Google OAuth 로그인
- [x] **seller.routes.ts (240줄)** - ✅ **새로 구현됨!**
- [x] **admin.routes.ts (234줄)** - ✅ **새로 구현됨!**
- [x] password.ts (109줄) - PBKDF2 해싱

### **인프라**
- [x] Worker 라우트 등록 (`src/worker/index.ts`)
- [x] D1 Database 스키마 (admins, sellers 테이블)
- [x] JWT_SECRET 생성 완료
- [x] 테스트 계정 해시 생성 완료

---

## 🎉 **완료!**

### **구현된 기능**
1. ✅ 판매자 로그인/회원가입/프로필 조회
2. ✅ 관리자 로그인/회원가입/프로필 조회
3. ✅ JWT 인증 (7일 유효)
4. ✅ PBKDF2 비밀번호 해싱 (100,000 iterations)
5. ✅ 판매자 상태 검증 (approved만 로그인)
6. ✅ 관리자 권한 분리 (admin / super_admin)
7. ✅ 에러 처리 및 상세 로깅
8. ✅ CORS 설정

### **다음 단계**
- [ ] Cloudflare 환경 변수 설정 (`JWT_SECRET`)
- [ ] D1 DB에 테스트 계정 생성
- [ ] 빌드 및 배포
- [ ] 로그인 테스트 (관리자/판매자)
- [ ] 프로덕션 모니터링

---

## 📞 **문의**

- **Email**: tobe2111@naver.com
- **GitHub**: https://github.com/tobe2111/ur-live
- **Production**: https://live.ur-team.com

---

**작성일**: 2026-03-08  
**작성자**: GenSpark AI Developer  
**상태**: ✅ 완전 구현 완료 - 배포 준비됨!
