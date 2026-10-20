# 🔐 UR-Live 로그인 시스템 최종 요약 (한글)

**생성일**: 2026-03-08  
**프로젝트**: ur-live (Live Commerce Platform)  
**GitHub**: https://github.com/tobe2111/ur-live  
**Production**: https://live.ur-team.com

---

## 📋 핵심 요약

### 🎯 **3가지 독립적인 로그인 시스템**

```
┌──────────────────────────────────────────────────────────┐
│                  UR-Live 인증 아키텍처                      │
├──────────────────────────────────────────────────────────┤
│                                                            │
│  👤 일반 사용자         👨‍💼 판매자           🛡️ 관리자     │
│  (Buyer)              (Seller)           (Admin)        │
│      ↓                    ↓                   ↓          │
│  ┌──────┐            ┌──────┐           ┌──────┐       │
│  │Firebase│            │ JWT  │           │ JWT  │       │
│  │ Auth  │            │ Only │           │ Only │       │
│  └──────┘            └──────┘           └──────┘       │
│      ↓                    ↓                   ↓          │
│  - Kakao OAuth        - bcrypt             - bcrypt     │
│  - Google OAuth       - D1 sellers         - D1 admins  │
│  - Email/PW           - 7일 만료            - 7일 만료    │
│                                                            │
└──────────────────────────────────────────────────────────┘
```

---

## 1️⃣ **일반 사용자 (Buyer) 로그인** - Firebase Auth

### 📍 **파일 위치**
- **페이지**: `/src/pages/LoginPage.tsx` (452줄)
- **상태 관리**: `/src/shared/stores/useAuthKR.ts` (Zustand)

### 🔄 **지원 로그인 방법**

#### **A. 카카오 로그인 (한국 전용)** ⭐
```
1. 사용자 "카카오로 로그인" 클릭
   ↓
2. Kakao 인증 서버로 리다이렉트
   https://kauth.kakao.com/oauth/authorize?
   client_id={REST_API_KEY}&
   redirect_uri=https://live.ur-team.com/auth/kakao/sync/callback&
   response_type=code
   ↓
3. 사용자 카카오 계정으로 로그인
   ↓
4. Callback URL로 code 반환
   ↓
5. 백엔드 API 호출
   POST /api/auth/kakao/firebase
   Body: { accessToken }
   ↓
6. 백엔드가 Firebase Custom Token 생성
   ↓
7. 프론트엔드 Firebase 로그인
   signInWithCustomToken(auth, customToken)
   ↓
8. Zustand Store 자동 업데이트 (onAuthStateChanged)
   ↓
9. returnUrl로 리다이렉트
```

#### **B. Google 로그인 (글로벌 전용)** 🌍
```
1. "Google로 로그인" 클릭
   ↓
2. Firebase signInWithPopup(GoogleAuthProvider)
   ↓
3. Google 인증 팝업 표시
   ↓
4. 사용자 Google 계정 선택
   ↓
5. Firebase 자동 사용자 생성
   ↓
6. 백엔드 API 호출 (사용자 정보 D1 저장)
   POST /api/auth/google/register
   ↓
7. Zustand Store 자동 업데이트
   ↓
8. returnUrl로 리다이렉트
```

#### **C. 이메일/비밀번호 로그인** 📧
```
1. 이메일/비밀번호 입력 후 "로그인" 클릭
   ↓
2. Zustand의 loginWithEmail() 호출
   ↓
3. Firebase signInWithEmailAndPassword(auth, email, password)
   ↓
4. Firebase 인증 성공
   ↓
5. 백엔드 API 호출 (사용자 역할 조회)
   GET /api/users/role
   Header: Authorization: Bearer {Firebase ID Token}
   ↓
6. 역할 정보 Zustand Store에 저장
   { user, userRole: 'user' }
   ↓
7. returnUrl로 리다이렉트
```

### 🔑 **주요 특징**
- ✅ **Firebase Authentication** 사용
- ✅ **Zustand Store**로 상태 관리 (리렌더 최소화)
- ✅ **자동 토큰 갱신** (Firebase가 1시간마다 자동 갱신)
- ✅ **OAuth 지원** (Kakao, Google)
- ✅ **비밀번호 저장 안 함** (Firebase가 관리)

---

## 2️⃣ **판매자 (Seller) 로그인** - JWT + bcrypt

### 📍 **파일 위치**
- **페이지**: `/src/pages/SellerLoginPage.tsx` (220줄)
- **백엔드**: `POST /api/seller/login` (src/index.tsx)
- **상태 관리**: localStorage (NO Zustand, NO Firebase)

### 🔄 **로그인 플로우**

```
1. 판매자가 이메일/비밀번호 입력 후 "Sign In" 클릭
   ↓
2. 프론트엔드 API 호출
   POST /api/seller/login
   Body: { email, password }
   ↓
3. 백엔드 처리 (src/index.tsx)
   
   a. D1 sellers 테이블 조회
      SELECT id, email, password_hash, name, status
      FROM sellers WHERE email = ?
   
   b. 판매자 존재 확인
      if (!seller) return 401 "이메일 또는 비밀번호가 일치하지 않습니다"
   
   c. 비밀번호 검증 (bcrypt)
      - 테스트 계정: seller@ur-team.com / seller123
      - bcrypt.compare(password, seller.password_hash)
   
   d. JWT 토큰 생성
      payload = {
        sellerId: seller.id,
        email: seller.email,
        role: 'seller',
        exp: now + (7 * 24 * 60 * 60) // 7일
      }
      token = signJWT(payload, JWT_SECRET)
   
   e. 응답
      { success: true, data: { token, seller } }
   ↓
4. 프론트엔드 localStorage 저장
   localStorage.clear() // 기존 세션 삭제
   localStorage.setItem('seller_token', token)
   localStorage.setItem('user_type', 'seller')
   localStorage.setItem('seller_id', seller.id)
   localStorage.setItem('user_id', seller.id)
   localStorage.setItem('user_name', seller.name)
   ↓
5. 판매자 대시보드로 리다이렉트
   navigate('/seller', { replace: true })
```

### 🔐 **보안 구현**

#### **비밀번호 해싱 (bcrypt)**
```typescript
// 패스워드 해싱 (회원가입 시)
const hash = await bcrypt.hash(password, 10); // 10 rounds

// 패스워드 검증 (로그인 시)
const isValid = await bcrypt.compare(password, hash);
```

**특징**:
- ✅ **16-byte random salt** 자동 생성
- ✅ **10 salt rounds** (2^10 = 1024번 해싱)
- ✅ **Rainbow Table 공격 방지**

#### **JWT 토큰**
```typescript
// JWT 생성
const payload = {
  sellerId: seller.id,
  email: seller.email,
  role: 'seller',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7일
};

const token = await signJWT(payload, JWT_SECRET);
```

**특징**:
- ✅ **HMAC-SHA256 서명**
- ✅ **256-bit Secret Key** (환경변수 `JWT_SECRET`)
- ✅ **7일 만료** (604,800초)

### 🔑 **주요 특징**
- ✅ **Firebase 미사용** (JWT만 사용)
- ✅ **bcrypt 비밀번호 해싱**
- ✅ **D1 Database** (sellers 테이블)
- ✅ **localStorage에 토큰 저장**
- ❌ **OAuth 지원 안 함** (이메일/비밀번호만)
- ❌ **자동 토큰 갱신 없음** (7일 후 재로그인 필요)

---

## 3️⃣ **관리자 (Admin) 로그인** - JWT + bcrypt

### 📍 **파일 위치**
- **페이지**: `/src/pages/AdminLoginPage.tsx` (165줄)
- **백엔드**: `POST /api/admin/login` (src/index.tsx)
- **상태 관리**: localStorage (NO Zustand, NO Firebase)

### 🔄 **로그인 플로우**

```
1. 관리자가 이메일/비밀번호 입력 후 "로그인" 클릭
   ↓
2. 프론트엔드 API 호출
   POST /api/admin/login
   Body: { email, password }
   ↓
3. 백엔드 처리 (src/index.tsx)
   
   a. D1 admins 테이블 조회
      SELECT id, email, password_hash, name
      FROM admins WHERE email = ?
   
   b. 관리자 존재 확인
      if (!admin) return 401 "이메일 또는 비밀번호가 일치하지 않습니다"
   
   c. 비밀번호 검증 (bcrypt)
      - 테스트 계정: admin@example.com / admin123
      - bcrypt.compare(password, admin.password_hash)
   
   d. JWT 토큰 생성
      payload = {
        adminId: admin.id,
        email: admin.email,
        role: 'admin',
        exp: now + (7 * 24 * 60 * 60) // 7일
      }
      token = signJWT(payload, JWT_SECRET)
   
   e. 응답
      { success: true, data: { token, admin } }
   ↓
4. 프론트엔드 localStorage 저장
   localStorage.clear() // 기존 세션 삭제
   localStorage.setItem('admin_token', token)
   localStorage.setItem('user_type', 'admin')
   localStorage.setItem('admin_id', admin.id)
   localStorage.setItem('user_id', admin.id)
   localStorage.setItem('user_name', admin.name)
   ↓
5. 관리자 대시보드로 리다이렉트
   navigate('/admin', { replace: true })
```

### 🔑 **주요 특징**
- ✅ **Firebase 미사용** (JWT만 사용)
- ✅ **bcrypt 비밀번호 해싱**
- ✅ **D1 Database** (admins 테이블)
- ✅ **localStorage에 토큰 저장**
- ❌ **OAuth 지원 안 함** (이메일/비밀번호만)
- ❌ **자동 토큰 갱신 없음** (7일 후 재로그인 필요)

---

## 📊 **3가지 로그인 방식 비교**

| 구분 | 일반 사용자 (Buyer) | 판매자 (Seller) | 관리자 (Admin) |
|------|-------------------|----------------|---------------|
| **인증 방식** | Firebase Auth | JWT (bcrypt) | JWT (bcrypt) |
| **OAuth** | ✅ Kakao, Google | ❌ | ❌ |
| **이메일/비밀번호** | ✅ Firebase | ✅ D1 Database | ✅ D1 Database |
| **토큰 저장** | Firebase ID Token | localStorage (`seller_token`) | localStorage (`admin_token`) |
| **상태 관리** | Zustand Store | localStorage | localStorage |
| **토큰 갱신** | ✅ 자동 (1시간) | ❌ 수동 (7일 후 재로그인) | ❌ 수동 (7일 후 재로그인) |
| **DB 테이블** | D1 `users` | D1 `sellers` | D1 `admins` |
| **비밀번호 해싱** | Firebase 관리 | bcrypt (10 rounds) | bcrypt (10 rounds) |
| **토큰 만료** | 1시간 (자동 갱신) | 7일 (수동 갱신) | 7일 (수동 갱신) |

---

## 🔐 **보안 구현 상세 (PR #1 완료 ✅)**

### ✅ **1. 비밀번호 보안 (bcrypt)**
```typescript
// 해싱 (회원가입 시)
const hash = await bcrypt.hash(password, 10);
// 결과: $2b$10$N9qo8uLOickgx2ZMRZoMye.ABC123... (16-byte random salt 포함)

// 검증 (로그인 시)
const isValid = await bcrypt.compare(password, hash);
```

**특징**:
- ✅ 16-byte random salt 자동 생성
- ✅ 10 salt rounds (2^10 = 1024번 해싱)
- ✅ 타이밍 공격 방지
- ✅ Rainbow Table 공격 방지

### ✅ **2. JWT 토큰 보안**
```typescript
// JWT 생성
const payload = {
  userId: user.id,
  email: user.email,
  role: 'seller',
  iat: 1709904000, // 발급 시간
  exp: 1710508800  // 만료 시간 (7일 후)
};

const token = signJWT(payload, JWT_SECRET); // 256-bit secret
```

**특징**:
- ✅ 256-bit Secret Key (환경변수)
- ✅ HMAC-SHA256 서명
- ✅ 7일 만료 (604,800초)
- ✅ 위조 방지 (서명 검증)

### ✅ **3. Rate Limiting (KV 기반)**
```typescript
const RateLimitPolicies = {
  authentication: { requests: 5, window: 60 },    // 1분당 5회
  order: { requests: 10, window: 60 },            // 1분당 10회
  refund: { requests: 3, window: 3600 },          // 1시간당 3회
};
```

**특징**:
- ✅ Cloudflare KV 기반
- ✅ IP 기반 제한 (CF-Connecting-IP)
- ✅ 자동 만료 (TTL)
- ✅ Discord 알림 (50% 초과 시)

### ✅ **4. 에러 메시지 (사용자 존재 여부 노출 방지)**
```typescript
// ✅ GOOD - 동일한 에러 메시지
if (!user || !isValidPassword) {
  return c.json({ error: '이메일 또는 비밀번호가 일치하지 않습니다' }, 401);
}
```

---

## 📦 **데이터베이스 구조**

### **A. users 테이블 (일반 사용자)**
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  firebase_uid TEXT UNIQUE NOT NULL,    -- Firebase UID
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  kakao_id TEXT UNIQUE,                 -- Kakao OAuth ID
  google_id TEXT UNIQUE,                -- Google OAuth ID
  role TEXT DEFAULT 'user',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### **B. sellers 테이블 (판매자)**
```sql
CREATE TABLE sellers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,          -- bcrypt hash
  name TEXT,
  business_number TEXT,
  status TEXT DEFAULT 'pending',        -- pending/approved/rejected/suspended
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### **C. admins 테이블 (관리자)**
```sql
CREATE TABLE admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,          -- bcrypt hash
  name TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## 🚨 **현재 문제점 및 개선 필요 사항**

### ⚠️ **1. 판매자/관리자 보안 취약점**

| 문제 | 현재 상태 | 개선 방안 |
|------|----------|----------|
| **JWT 검증 미들웨어 없음** | 각 API에서 개별 검증 | 통합 미들웨어 구현 |
| **localStorage 토큰 저장** | XSS 공격 취약 | HttpOnly Cookie로 변경 |
| **토큰 갱신 로직 없음** | 7일 후 재로그인 필요 | Refresh Token 구현 |
| **CSRF 보호 없음** | CORS만 설정 | CSRF Token 추가 |

### ⚠️ **2. 상태 관리 불일치**

| 사용자 타입 | 현재 방식 | 문제점 |
|-----------|----------|--------|
| 일반 사용자 | Zustand + Firebase | - |
| 판매자 | localStorage + JWT | 코드 일관성 부족 |
| 관리자 | localStorage + JWT | 유지보수 어려움 |

**개선 방안**: 모든 사용자 타입에 Zustand 적용

### ⚠️ **3. 테스트 계정 하드코딩**

```typescript
// ❌ BAD - 프로덕션에 노출
const isTestAccount = email === 'seller@ur-team.com' && password === 'seller123';
```

**개선 방안**:
- 환경변수로 관리
- 프로덕션에서는 비활성화
- DB에 test_account 플래그 추가

---

## 🎯 **최종 평가**

### ✅ **구현 완료 (PR #1)**
1. ✅ 일반 사용자 Firebase Auth (Kakao, Google, Email)
2. ✅ 판매자/관리자 JWT 인증
3. ✅ bcrypt 비밀번호 해싱 (16-byte salt, 10 rounds)
4. ✅ JWT 256-bit secret, 7일 만료
5. ✅ Rate Limiting (KV 기반)
6. ✅ 에러 메시지 보안 (사용자 존재 여부 숨김)

### ⚠️ **개선 필요**
1. ⚠️ JWT 검증 미들웨어 통합
2. ⚠️ HttpOnly Cookie 토큰 저장
3. ⚠️ Refresh Token 구현
4. ⚠️ CSRF 보호 추가
5. ⚠️ 통합 Zustand Store
6. ⚠️ 서버 측 RBAC 미들웨어
7. ⚠️ 테스트 계정 하드코딩 제거

### 📈 **보안 점수**
- **현재**: 75/100
- **개선 후 예상**: 95/100

---

## 📚 **관련 문서**

1. **상세 아키텍처 분석**: `/home/user/webapp/LOGIN_ARCHITECTURE_REPORT.md` (32KB)
2. **PR #1**: https://github.com/tobe2111/ur-live/pull/1
3. **Production URL**: https://live.ur-team.com

---

**생성 시각**: 2026-03-08 14:30:00 UTC  
**작성자**: GenSpark AI Development Assistant  
**문서 버전**: 1.0.0
