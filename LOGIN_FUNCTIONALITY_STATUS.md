# 🔐 UR-Live 로그인 기능 구현 현황

## 📊 **전체 요약**

| 로그인 타입 | 구현 상태 | 프론트엔드 | 백엔드 API | 완성도 |
|-------------|-----------|------------|------------|--------|
| 👤 일반 사용자 (카카오) | ✅ 완료 | ✅ 완벽 | ✅ 완벽 | 100% |
| 👤 일반 사용자 (이메일) | ✅ 완료 | ✅ 완벽 | ✅ Firebase | 100% |
| 👤 일반 사용자 (Google) | ✅ 완료 | ✅ 완벽 | ✅ 완벽 | 100% |
| 🏪 판매자 (JWT) | ⚠️ 부분 | ✅ 완벽 | ❌ **미구현** | 50% |
| 👨‍💼 관리자 (JWT) | ⚠️ 부분 | ✅ 완벽 | ❌ **미구현** | 50% |

---

## 1️⃣ **일반 사용자 로그인 (100% 완료)** ✅

### **구현된 기능**

#### **A. 카카오 로그인 (완벽 ✅)**
- **파일**: `src/pages/LoginPage.tsx` (504줄)
- **백엔드 API**: `src/features/auth/api/kakao.routes.ts` (277줄)
- **인증 방식**: Firebase Custom Token (카카오 OAuth 2.0 → Firebase)

**플로우**:
```
1. 사용자 "카카오로 시작하기" 클릭
2. 카카오 인증 페이지로 리다이렉트
3. 카카오 인증 완료 → Authorization Code 받기
4. 백엔드 `/auth/kakao/sync/callback` 호출
5. 백엔드: Code → Kakao Access Token 교환
6. 백엔드: 카카오 사용자 정보 조회
7. 백엔드: D1 DB에 사용자 저장/업데이트
8. 백엔드: Firebase Custom Token 생성
9. 프론트엔드: Firebase signInWithCustomToken 호출
10. ✅ 로그인 완료 → 홈페이지 또는 returnUrl로 리다이렉트
```

**핵심 코드**:
```typescript
// LoginPage.tsx (92-183줄)
async function handleKakaoLogin() {
  const KAKAO_REST_API_KEY = import.meta.env.VITE_KAKAO_REST_API_KEY
  const REDIRECT_URI = 'https://live.ur-team.com/auth/kakao/sync/callback'
  
  const kakaoAuthUrl = `https://kauth.kakao.com/oauth/authorize?client_id=${KAKAO_REST_API_KEY}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&state=${encodeURIComponent(returnUrl)}`
  
  window.location.href = kakaoAuthUrl
}

// 백엔드: kakao.routes.ts (35-144줄)
kakaoRoutes.get('/sync/callback', async (c) => {
  const code = c.req.query('code')
  const state = c.req.query('state') || '/'
  
  // 1. Code → Access Token
  const accessToken = await kakaoService.exchangeCode(code, REDIRECT_URI)
  
  // 2. 사용자 정보 조회
  const kakaoUser = await kakaoService.getUserInfo(accessToken)
  
  // 3. DB 저장
  const user = await kakaoService.upsertUser(kakaoUser)
  
  // 4. Firebase Custom Token 생성
  const customToken = await firebaseService.createCustomToken(firebaseUID, {...})
  
  // 5. 리다이렉트 (token 포함)
  return c.redirect(`${state}?firebase_token=${customToken}&userName=${user.name}`)
})
```

**환경 변수**:
- `VITE_KAKAO_REST_API_KEY=5dd74bccb797640b0efd070467f3bafd`
- `KAKAO_REST_API_KEY` (Cloudflare Worker 환경 변수)
- `FIREBASE_PROJECT_ID`, `FIREBASE_PRIVATE_KEY`, `FIREBASE_CLIENT_EMAIL`

**테스트 방법**:
```
1. https://live.ur-team.com/login 접속
2. "카카오로 시작하기" 버튼 클릭
3. 카카오 계정으로 로그인
4. 자동으로 홈페이지로 리다이렉트
```

---

#### **B. 이메일 로그인 (완벽 ✅)**
- **파일**: `src/pages/LoginPage.tsx` (186-208줄)
- **백엔드 API**: Firebase Authentication (자동)
- **인증 방식**: Firebase Email/Password

**플로우**:
```
1. 사용자 이메일/비밀번호 입력
2. Firebase signInWithEmailAndPassword 호출
3. Firebase 자동 인증
4. ✅ 로그인 완료 → returnUrl로 리다이렉트
```

**핵심 코드**:
```typescript
// LoginPage.tsx (186-208줄)
async function handleEmailLogin(e: React.FormEvent) {
  e.preventDefault()
  
  // Zustand action 호출
  await loginWithEmailAction(email, password)
  
  sessionStorage.removeItem('returnUrl')
  navigate(returnUrl, { replace: true })
}
```

**테스트 방법**:
```
1. https://live.ur-team.com/login 접속
2. "이메일로 로그인" 버튼 클릭
3. 이메일/비밀번호 입력
4. ✅ 로그인 완료
```

---

#### **C. Google 로그인 (완벽 ✅)**
- **파일**: `src/pages/LoginPage.tsx` (233-266줄)
- **백엔드 API**: `src/features/auth/api/google.routes.ts`
- **인증 방식**: Firebase Google OAuth

**플로우**:
```
1. 사용자 "Google로 로그인" 클릭
2. Google 팝업 인증
3. Firebase signInWithPopup 호출
4. 백엔드 `/api/auth/google/register` 호출 (사용자 정보 저장)
5. ✅ 로그인 완료 → returnUrl로 리다이렉트
```

**핵심 코드**:
```typescript
// LoginPage.tsx (233-266줄)
async function handleGoogleLogin() {
  const { GoogleAuthProvider, signInWithPopup } = await import('firebase/auth')
  
  const provider = new GoogleAuthProvider()
  const result = await signInWithPopup(auth, provider)
  
  // 백엔드에 사용자 정보 저장
  await api.post('/api/auth/google/register', {
    uid: result.user.uid,
    email: result.user.email,
    name: result.user.displayName,
    photoURL: result.user.photoURL
  })
  
  navigate(returnUrl, { replace: true })
}
```

**테스트 방법**:
```
1. https://live.ur-team.com/login?region=world 접속
2. "Sign in with Google" 버튼 클릭
3. Google 계정 선택
4. ✅ 로그인 완료
```

---

## 2️⃣ **판매자 로그인 (50% 완료)** ⚠️

### **구현된 것** ✅

#### **프론트엔드 (완벽)**
- **파일**: `src/pages/SellerLoginPage.tsx` (220줄)
- **기능**: 이메일/비밀번호 로그인 폼, JWT 토큰 저장, 로컬스토리지 관리

**핵심 코드**:
```typescript
// SellerLoginPage.tsx (40-86줄)
async function handleSubmit(e: React.FormEvent) {
  e.preventDefault()
  
  // 🔐 JWT-based Login (NO Firebase!)
  const response = await api.post('/api/seller/login', {
    email: formData.email,
    password: formData.password
  })

  if (response.data.success) {
    // Store JWT token and seller info
    const { token, seller } = response.data.data
    
    localStorage.setItem('seller_token', token)
    localStorage.setItem('user_type', 'seller')
    localStorage.setItem('seller_id', seller.id.toString())
    localStorage.setItem('user_id', seller.id.toString())
    localStorage.setItem('user_name', seller.name || seller.email)
    
    // Navigate to seller dashboard
    navigate('/seller', { replace: true })
  }
}
```

---

### **미구현 부분** ❌

#### **백엔드 API (완전히 없음!)**
- **필요한 엔드포인트**: `POST /api/seller/login`
- **현재 상태**: ❌ **존재하지 않음**
- **파일 위치**: 만들어야 할 파일 `src/features/auth/api/seller.routes.ts` (존재하지 않음)

**만들어야 할 API**:
```typescript
// src/features/auth/api/seller.routes.ts (NEW FILE!)

import { Hono } from 'hono';
import { verifyPassword } from '@/lib/password'; // PBKDF2 검증
import { sign } from 'hono/jwt'; // JWT 생성

type Bindings = {
  DB: D1Database;
  JWT_SECRET: string;
};

export const sellerRoutes = new Hono<{ Bindings: Bindings }>();

/**
 * POST /api/seller/login
 * 판매자 로그인 (JWT 기반)
 */
sellerRoutes.post('/login', async (c) => {
  const { DB, JWT_SECRET } = c.env;
  const { email, password } = await c.req.json();

  // 1. Validation
  if (!email || !password) {
    return c.json({ 
      success: false, 
      error: 'Email and password are required' 
    }, 400);
  }

  try {
    // 2. DB에서 판매자 조회
    const seller = await DB.prepare(
      'SELECT * FROM sellers WHERE email = ? AND status = ?'
    ).bind(email, 'approved').first();

    if (!seller) {
      return c.json({ 
        success: false, 
        error: 'Invalid credentials or seller not approved' 
      }, 401);
    }

    // 3. 비밀번호 검증 (PBKDF2)
    const isValidPassword = await verifyPassword(password, seller.password_hash);

    if (!isValidPassword) {
      return c.json({ 
        success: false, 
        error: 'Invalid credentials' 
      }, 401);
    }

    // 4. JWT 생성
    const payload = {
      sellerId: seller.id,
      email: seller.email,
      name: seller.name,
      role: 'seller',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 7) // 7 days
    };

    const token = await sign(payload, JWT_SECRET);

    // 5. 응답 반환
    return c.json({
      success: true,
      data: {
        token: token,
        seller: {
          id: seller.id,
          email: seller.email,
          name: seller.name,
          business_name: seller.business_name,
          business_number: seller.business_number,
          phone: seller.phone,
          status: seller.status,
          commission_rate: seller.commission_rate
        }
      }
    }, 200);

  } catch (error) {
    console.error('[Seller Login] Error:', error);
    return c.json({ 
      success: false, 
      error: 'Internal server error' 
    }, 500);
  }
});

export default sellerRoutes;
```

**Worker에 라우트 추가**:
```typescript
// src/worker/index.ts

import { sellerRoutes } from '@/features/auth/api/seller.routes'; // 추가

// ...

app.route('/api/seller', sellerRoutes); // 추가
```

---

## 3️⃣ **관리자 로그인 (50% 완료)** ⚠️

### **구현된 것** ✅

#### **프론트엔드 (완벽)**
- **파일**: `src/pages/AdminLoginPage.tsx` (165줄)
- **기능**: 이메일/비밀번호 로그인 폼, JWT 토큰 저장, 로컬스토리지 관리

**핵심 코드**:
```typescript
// AdminLoginPage.tsx (44-90줄)
async function handleLogin(e: React.FormEvent) {
  e.preventDefault()

  // 🔐 JWT-based Login (NO Firebase!)
  const response = await api.post('/api/admin/login', {
    email,
    password
  })

  if (response.data.success) {
    // Store JWT token and admin info
    const { token, admin } = response.data.data
    
    localStorage.setItem('admin_token', token)
    localStorage.setItem('user_type', 'admin')
    localStorage.setItem('admin_id', admin.id.toString())
    localStorage.setItem('user_id', admin.id.toString())
    localStorage.setItem('user_name', admin.name || admin.email)
    
    // Navigate to admin dashboard
    navigate('/admin', { replace: true })
  }
}
```

---

### **미구현 부분** ❌

#### **백엔드 API (완전히 없음!)**
- **필요한 엔드포인트**: `POST /api/admin/login`
- **현재 상태**: ❌ **존재하지 않음**
- **파일 위치**: 만들어야 할 파일 `src/features/auth/api/admin.routes.ts` (존재하지 않음)

**만들어야 할 API**:
```typescript
// src/features/auth/api/admin.routes.ts (NEW FILE!)

import { Hono } from 'hono';
import { verifyPassword } from '@/lib/password'; // PBKDF2 검증
import { sign } from 'hono/jwt'; // JWT 생성

type Bindings = {
  DB: D1Database;
  JWT_SECRET: string;
};

export const adminRoutes = new Hono<{ Bindings: Bindings }>();

/**
 * POST /api/admin/login
 * 관리자 로그인 (JWT 기반)
 */
adminRoutes.post('/login', async (c) => {
  const { DB, JWT_SECRET } = c.env;
  const { email, password } = await c.req.json();

  // 1. Validation
  if (!email || !password) {
    return c.json({ 
      success: false, 
      error: 'Email and password are required' 
    }, 400);
  }

  try {
    // 2. DB에서 관리자 조회
    const admin = await DB.prepare(
      'SELECT * FROM admins WHERE email = ?'
    ).bind(email).first();

    if (!admin) {
      return c.json({ 
        success: false, 
        error: 'Invalid credentials' 
      }, 401);
    }

    // 3. 비밀번호 검증 (PBKDF2)
    const isValidPassword = await verifyPassword(password, admin.password_hash);

    if (!isValidPassword) {
      return c.json({ 
        success: false, 
        error: 'Invalid credentials' 
      }, 401);
    }

    // 4. JWT 생성
    const payload = {
      adminId: admin.id,
      email: admin.email,
      name: admin.name,
      role: admin.role || 'admin',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 7) // 7 days
    };

    const token = await sign(payload, JWT_SECRET);

    // 5. 응답 반환
    return c.json({
      success: true,
      data: {
        token: token,
        admin: {
          id: admin.id,
          email: admin.email,
          name: admin.name,
          role: admin.role,
          username: admin.username
        }
      }
    }, 200);

  } catch (error) {
    console.error('[Admin Login] Error:', error);
    return c.json({ 
      success: false, 
      error: 'Internal server error' 
    }, 500);
  }
});

export default adminRoutes;
```

**Worker에 라우트 추가**:
```typescript
// src/worker/index.ts

import { adminRoutes } from '@/features/auth/api/admin.routes'; // 추가

// ...

app.route('/api/admin', adminRoutes); // 추가
```

---

## 📝 **필요한 환경 변수**

### **Cloudflare Pages (프로덕션)**
```bash
# 일반 사용자 로그인 (✅ 이미 설정됨)
VITE_KAKAO_REST_API_KEY=5dd74bccb797640b0efd070467f3bafd
VITE_TOSS_CLIENT_KEY=test_gck_P9BRQmyarYPA5lOO6OXaVJ07KzLN
VITE_SENTRY_DSN=https://08caf64e8e7955f09acc2b0551fdb049@o4510992097935360.ingest.us.sentry.io/4510992127295488
VITE_SENTRY_ENVIRONMENT=production

# Worker 환경 변수 (✅ 이미 설정됨)
KAKAO_REST_API_KEY=5dd74bccb797640b0efd070467f3bafd
FIREBASE_PROJECT_ID=ur-live-demo
FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----...
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@ur-live-demo.iam.gserviceaccount.com
FIREBASE_DATABASE_URL=https://ur-live-demo.firebaseio.com

# 판매자/관리자 로그인 (❌ 설정 필요!)
JWT_SECRET=your-super-secret-jwt-key-min-32-characters
```

**JWT_SECRET 생성 방법**:
```bash
# Node.js 환경에서
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## ✅ **완료 체크리스트**

### **일반 사용자 로그인** ✅
- [x] 카카오 로그인 프론트엔드
- [x] 카카오 로그인 백엔드 API
- [x] 이메일 로그인 프론트엔드
- [x] 이메일 로그인 백엔드 (Firebase 자동)
- [x] Google 로그인 프론트엔드
- [x] Google 로그인 백엔드 API
- [x] Firebase 인증 통합
- [x] Zustand 상태 관리
- [x] returnUrl 리다이렉트
- [x] 비밀번호 재설정 기능

### **판매자 로그인** ⚠️
- [x] 로그인 페이지 UI
- [x] 이메일/비밀번호 폼
- [x] JWT 토큰 저장 로직
- [x] 로컬스토리지 관리
- [ ] **❌ 백엔드 API 구현 (`POST /api/seller/login`)**
- [ ] **❌ Worker 라우트 추가**
- [ ] **❌ JWT SECRET 환경 변수 설정**
- [ ] **❌ 테스트 계정 비밀번호 해싱**

### **관리자 로그인** ⚠️
- [x] 로그인 페이지 UI
- [x] 이메일/비밀번호 폼
- [x] JWT 토큰 저장 로직
- [x] 로컬스토리지 관리
- [ ] **❌ 백엔드 API 구현 (`POST /api/admin/login`)**
- [ ] **❌ Worker 라우트 추가**
- [ ] **❌ JWT SECRET 환경 변수 설정**
- [ ] **❌ 테스트 계정 비밀번호 해싱**

---

## 🚨 **즉시 해야 할 일 (Critical)**

### **1. 판매자/관리자 로그인 API 구현** (2-3시간)

**Step 1**: 파일 생성
```bash
touch src/features/auth/api/seller.routes.ts
touch src/features/auth/api/admin.routes.ts
```

**Step 2**: API 코드 작성 (위 예시 코드 참고)

**Step 3**: Worker에 라우트 추가
```typescript
// src/worker/index.ts
import { sellerRoutes } from '@/features/auth/api/seller.routes';
import { adminRoutes } from '@/features/auth/api/admin.routes';

app.route('/api/seller', sellerRoutes);
app.route('/api/admin', adminRoutes);
```

**Step 4**: JWT SECRET 생성 및 환경 변수 설정
```bash
# JWT Secret 생성
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Cloudflare Pages에서 설정
# Settings → Environment Variables → Add Variable
# JWT_SECRET=<생성된 키>
```

**Step 5**: 테스트 계정 비밀번호 해싱
```typescript
// Node.js 환경에서 실행
import { hashPassword } from './src/lib/password'

const adminHash = await hashPassword('admin123')
const sellerHash = await hashPassword('seller123')

console.log('Admin password hash:', adminHash)
console.log('Seller password hash:', sellerHash)
```

**Step 6**: Cloudflare D1에 테스트 계정 생성
```sql
-- 해싱된 비밀번호로 교체!
INSERT INTO admins (username, email, password_hash, name, role, created_at)
VALUES ('admin', 'admin@ur-team.com', '<adminHash>', '관리자', 'super_admin', datetime('now'));

INSERT INTO sellers (username, email, password_hash, name, business_name, business_number, phone, status, commission_rate, created_at, updated_at)
VALUES ('testseller', 'seller@ur-team.com', '<sellerHash>', '테스트 셀러', '테스트 상점', '123-45-67890', '010-1234-5678', 'approved', 10.00, datetime('now'), datetime('now'));
```

**Step 7**: 빌드 및 배포
```bash
npm run build
npx wrangler pages deploy dist --project-name=ur-live
```

**Step 8**: 로그인 테스트
```
- 관리자: https://live.ur-team.com/admin/login
  - admin@ur-team.com / admin123
  
- 판매자: https://live.ur-team.com/seller/login
  - seller@ur-team.com / seller123
```

---

## 📞 **문의**

- **Email**: tobe2111@naver.com
- **GitHub**: https://github.com/tobe2111/ur-live
- **Production**: https://live.ur-team.com

---

**마지막 업데이트**: 2026-03-08  
**작성자**: GenSpark AI Developer  
**상태**: ⚠️ 판매자/관리자 로그인 API 미구현 (백엔드 50%)
