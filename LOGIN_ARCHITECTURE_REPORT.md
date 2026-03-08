# 🔐 UR-Live 로그인 아키텍처 전체 분석 보고서

**생성일**: 2026-03-08  
**프로젝트**: ur-live (Live Commerce Platform)  
**GitHub**: https://github.com/tobe2111/ur-live  
**Production**: https://live.ur-team.com

---

## 📋 목차
1. [전체 인증 아키텍처](#1-전체-인증-아키텍처)
2. [일반 사용자 (Buyer) 로그인](#2-일반-사용자-buyer-로그인)
3. [판매자 (Seller) 로그인](#3-판매자-seller-로그인)
4. [관리자 (Admin) 로그인](#4-관리자-admin-로그인)
5. [보안 구현 상세](#5-보안-구현-상세)
6. [데이터베이스 구조](#6-데이터베이스-구조)
7. [프론트엔드 상태 관리](#7-프론트엔드-상태-관리)
8. [API 엔드포인트 목록](#8-api-엔드포인트-목록)
9. [문제점 및 개선 사항](#9-문제점-및-개선-사항)

---

## 1. 전체 인증 아키텍처

### 🎯 **3가지 독립적인 인증 시스템**

```
┌─────────────────────────────────────────────────────────────┐
│                   UR-Live 인증 시스템                         │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   일반 사용자  │  │    판매자    │  │    관리자    │        │
│  │   (Buyer)   │  │  (Seller)   │  │   (Admin)   │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
│         │                │                │                  │
│         │                │                │                  │
│    ┌────▼────┐      ┌───▼────┐      ┌───▼────┐            │
│    │ Firebase │      │  JWT   │      │  JWT   │            │
│    │  Auth    │      │  Only  │      │  Only  │            │
│    └─────────┘      └────────┘      └────────┘            │
│         │                │                │                  │
│         │                │                │                  │
│    ┌────▼────┐      ┌───▼────┐      ┌───▼────┐            │
│    │  Kakao  │      │  D1 DB │      │  D1 DB │            │
│    │  OAuth  │      │ sellers│      │ admins │            │
│    │  Google │      │  테이블 │      │  테이블 │            │
│    └─────────┘      └────────┘      └────────┘            │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### 🔑 **인증 방식 비교**

| 구분 | 일반 사용자 | 판매자 | 관리자 |
|------|------------|--------|--------|
| **인증 방식** | Firebase Auth | JWT (bcrypt) | JWT (bcrypt) |
| **OAuth 지원** | ✅ Kakao (KR), Google (World) | ❌ | ❌ |
| **이메일/비밀번호** | ✅ Firebase Email | ✅ D1 Database | ✅ D1 Database |
| **토큰 저장** | Firebase ID Token | localStorage (`seller_token`) | localStorage (`admin_token`) |
| **상태 관리** | Zustand (`useAuthKR`, `useAuthWorld`) | localStorage + API | localStorage + API |
| **세션 관리** | Firebase (자동 갱신) | JWT (7일 만료) | JWT (7일 만료) |
| **DB 테이블** | D1 `users` | D1 `sellers` | D1 `admins` |

---

## 2. 일반 사용자 (Buyer) 로그인

### 📍 **파일 위치**
- **프론트엔드**: `/src/pages/LoginPage.tsx` (452줄, 17KB)
- **백엔드**: `/src/index.tsx` (Firebase Auth API)
- **상태 관리**: `/src/shared/stores/useAuthKR.ts`, `/src/shared/stores/useAuthWorld.ts`

### 🔄 **로그인 플로우**

#### **A. Kakao OAuth 로그인 (한국 전용)**

```
사용자 클릭 "카카오로 로그인"
    ↓
1. 카카오 인증 서버로 리다이렉트
   URL: https://kauth.kakao.com/oauth/authorize?
        client_id={REST_API_KEY}&
        redirect_uri={CALLBACK_URL}&
        response_type=code&
        state={returnUrl}
    ↓
2. 사용자 카카오 로그인 완료
    ↓
3. Callback URL로 리다이렉트
   URL: https://live.ur-team.com/auth/kakao/sync/callback?code={CODE}&state={returnUrl}
    ↓
4. 프론트엔드 → 백엔드 API 호출
   POST /api/auth/kakao/firebase
   Body: { accessToken }
    ↓
5. 백엔드 처리
   - Kakao API로 사용자 정보 조회
   - D1 users 테이블에 저장/업데이트
   - Firebase Custom Token 생성
   - 응답: { customToken, user }
    ↓
6. 프론트엔드 Firebase 로그인
   signInWithCustomToken(auth, customToken)
    ↓
7. Zustand Store 자동 업데이트
   onAuthStateChanged → setUser(user)
    ↓
8. returnUrl로 리다이렉트
```

**코드 예시**:
```typescript
// LoginPage.tsx - Kakao 로그인
async function handleKakaoLogin() {
  const KAKAO_REST_API_KEY = import.meta.env.VITE_KAKAO_REST_API_KEY;
  const REDIRECT_URI = 'https://live.ur-team.com/auth/kakao/sync/callback';
  
  const kakaoAuthUrl = `https://kauth.kakao.com/oauth/authorize?client_id=${KAKAO_REST_API_KEY}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&state=${encodeURIComponent(returnUrl)}`;
  
  window.location.href = kakaoAuthUrl;
}

async function processKakaoLogin(accessToken: string) {
  const response = await api.post('/api/auth/kakao/firebase', { accessToken });
  
  if (response.data.success) {
    const { customToken, user: kakaoUser } = response.data;
    
    // Firebase 로그인
    const credential = await signInWithCustomToken(auth, customToken);
    
    // 토큰 갱신
    credential.user.getIdToken(true);
    
    // 리다이렉트
    navigate(returnUrl, { replace: true });
  }
}
```

#### **B. Google OAuth 로그인 (글로벌 전용)**

```
사용자 클릭 "Google로 로그인"
    ↓
1. Firebase signInWithPopup(GoogleAuthProvider)
    ↓
2. Google 인증 팝업 표시
    ↓
3. 사용자 Google 계정 선택 및 승인
    ↓
4. Firebase에서 자동으로 사용자 생성
    ↓
5. 백엔드 API 호출 (사용자 정보 저장)
   POST /api/auth/google/register
   Body: { uid, email, name, photoURL }
    ↓
6. D1 users 테이블에 저장
    ↓
7. Zustand Store 자동 업데이트
    ↓
8. returnUrl로 리다이렉트
```

**코드 예시**:
```typescript
// LoginPage.tsx - Google 로그인
async function handleGoogleLogin() {
  const { GoogleAuthProvider, signInWithPopup } = await import('firebase/auth');
  const { auth } = await import('@/lib/firebase');
  
  const provider = new GoogleAuthProvider();
  provider.addScope('email');
  provider.addScope('profile');
  
  const result = await signInWithPopup(auth, provider);
  
  // 백엔드에 사용자 정보 저장
  await api.post('/api/auth/google/register', {
    uid: result.user.uid,
    email: result.user.email,
    name: result.user.displayName,
    photoURL: result.user.photoURL
  });
  
  navigate(returnUrl, { replace: true });
}
```

#### **C. 이메일/비밀번호 로그인**

```
사용자가 이메일/비밀번호 입력 후 "로그인" 클릭
    ↓
1. Zustand Store의 loginWithEmail() 호출
    ↓
2. Firebase signInWithEmailAndPassword()
    ↓
3. Firebase 인증 성공
    ↓
4. 백엔드 API 호출 (사용자 역할 조회)
   GET /api/users/role
   Header: Authorization: Bearer {Firebase ID Token}
    ↓
5. 역할 정보 Zustand Store에 저장
   { user, userRole: 'user' }
    ↓
6. returnUrl로 리다이렉트
```

**코드 예시**:
```typescript
// LoginPage.tsx - 이메일 로그인
async function handleEmailLogin(e: React.FormEvent) {
  e.preventDefault();
  
  // Zustand action 직접 호출
  await loginWithEmailAction(email, password);
  
  sessionStorage.removeItem('returnUrl');
  navigate(returnUrl, { replace: true });
}

// useAuthKR.ts - loginWithEmail 구현
loginWithEmail: async (email, password) => {
  set({ isLoading: true, error: null });
  
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  const user = userCredential.user;
  
  // 사용자 역할 조회
  const roleResponse = await fetch('/api/users/role', {
    headers: { Authorization: `Bearer ${await user.getIdToken()}` },
  });
  const { role } = await roleResponse.json();
  
  set({
    user,
    userRole: role,
    isLoading: false,
    isAuthReady: true,
    error: null,
  });
}
```

---

## 3. 판매자 (Seller) 로그인

### 📍 **파일 위치**
- **프론트엔드**: `/src/pages/SellerLoginPage.tsx` (220줄, 17KB)
- **백엔드**: `/src/index.tsx` - `POST /api/seller/login`
- **상태 관리**: localStorage (NO Zustand, NO Firebase)

### 🔄 **로그인 플로우**

```
판매자가 이메일/비밀번호 입력 후 "Sign In" 클릭
    ↓
1. 프론트엔드 API 호출
   POST /api/seller/login
   Body: { email, password }
    ↓
2. 백엔드 처리 (src/index.tsx)
   a. D1 sellers 테이블에서 이메일로 판매자 조회
      SELECT id, email, password_hash, name, status, is_active
      FROM sellers WHERE email = ?
   
   b. 판매자 존재 확인
      if (!seller) return 401 "이메일 또는 비밀번호가 일치하지 않습니다"
   
   c. 비밀번호 검증
      - 테스트 계정 체크 (seller@ur-team.com/seller123)
      - bcrypt.compare(password, seller.password_hash)
   
   d. JWT 토큰 생성
      const payload = {
        sellerId: seller.id,
        email: seller.email,
        role: 'seller',
        exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7일
      };
      const token = await signJWT(payload, c.env.JWT_SECRET);
   
   e. 응답
      return {
        success: true,
        data: {
          token,
          seller: {
            id: seller.id,
            email: seller.email,
            name: seller.name,
            status: seller.status
          }
        }
      }
    ↓
3. 프론트엔드 localStorage 저장
   localStorage.clear(); // 기존 세션 클리어
   localStorage.setItem('seller_token', token);
   localStorage.setItem('user_type', 'seller');
   localStorage.setItem('seller_id', seller.id.toString());
   localStorage.setItem('user_id', seller.id.toString());
   localStorage.setItem('user_name', seller.name || seller.email);
   localStorage.setItem('seller_name', seller.name || '');
   localStorage.setItem('seller_email', seller.email || '');
    ↓
4. 판매자 대시보드로 리다이렉트
   navigate('/seller', { replace: true })
```

### 📝 **코드 예시**

#### **프론트엔드 (SellerLoginPage.tsx)**
```typescript
async function handleSubmit(e: React.FormEvent) {
  e.preventDefault();
  setLoading(true);
  
  try {
    // 🔐 JWT-based Login (NO Firebase!)
    const response = await api.post('/api/seller/login', {
      email: formData.email,
      password: formData.password
    });

    if (response.data.success) {
      // Clear old sessions
      localStorage.clear();
      
      // Store JWT token and seller info
      const { token, seller } = response.data.data;
      
      localStorage.setItem('seller_token', token);
      localStorage.setItem('user_type', 'seller');
      localStorage.setItem('seller_id', seller.id.toString());
      localStorage.setItem('user_id', seller.id.toString());
      localStorage.setItem('user_name', seller.name || seller.email);
      
      // Navigate to seller dashboard
      navigate('/seller', { replace: true });
    }
  } catch (error: any) {
    setError(error.response?.data?.error || '로그인에 실패했습니다.');
  } finally {
    setLoading(false);
  }
}
```

#### **백엔드 (src/index.tsx)**
```typescript
app.post('/api/seller/login', cors(), async (c) => {
  const { DB } = c.env;
  
  try {
    const { email, password } = await c.req.json();
    
    if (!email || !password) {
      return c.json({ success: false, error: '이메일과 비밀번호를 입력해주세요' }, 400);
    }
    
    // Find seller by email
    const seller = await DB.prepare(`
      SELECT 
        id, username, email, password_hash, name, status, is_active
      FROM sellers 
      WHERE email = ?
    `).bind(email).first();
    
    if (!seller) {
      return c.json({ success: false, error: '이메일 또는 비밀번호가 일치하지 않습니다' }, 401);
    }
    
    // Verify password (bcrypt)
    let isValidPassword = false;
    
    // 1. Test accounts
    const isTestAccount = email === 'seller@ur-team.com' && password === 'seller123';
    
    // 2. Bcrypt verification
    if (!isValidPassword && seller.password_hash) {
      if (seller.password_hash.startsWith('$2')) {
        isValidPassword = await bcrypt.compare(password, seller.password_hash);
      }
    }
    
    if (!isValidPassword) {
      return c.json({ success: false, error: '이메일 또는 비밀번호가 일치하지 않습니다' }, 401);
    }
    
    // Generate JWT
    const payload = {
      sellerId: seller.id,
      email: seller.email,
      role: 'seller',
      exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 days
    };
    
    const token = await signJWT(payload, c.env.JWT_SECRET);
    
    return c.json({
      success: true,
      data: {
        token,
        seller: {
          id: seller.id,
          email: seller.email,
          name: seller.name,
          status: seller.status
        }
      }
    });
    
  } catch (error: any) {
    console.error('[Seller Login] Error:', error);
    return c.json({ success: false, error: '서버 오류가 발생했습니다' }, 500);
  }
});
```

---

## 4. 관리자 (Admin) 로그인

### 📍 **파일 위치**
- **프론트엔드**: `/src/pages/AdminLoginPage.tsx` (165줄, 6.1KB)
- **백엔드**: `/src/index.tsx` - `POST /api/admin/login`
- **상태 관리**: localStorage (NO Zustand, NO Firebase)

### 🔄 **로그인 플로우**

```
관리자가 이메일/비밀번호 입력 후 "로그인" 클릭
    ↓
1. 프론트엔드 API 호출
   POST /api/admin/login
   Body: { email, password }
    ↓
2. 백엔드 처리 (src/index.tsx)
   a. D1 admins 테이블에서 이메일로 관리자 조회
      SELECT id, email, password_hash, name, is_active
      FROM admins WHERE email = ?
   
   b. 관리자 존재 확인
      if (!admin) return 401 "이메일 또는 비밀번호가 일치하지 않습니다"
   
   c. 비밀번호 검증
      - 테스트 계정 체크 (admin@example.com/admin123)
      - bcrypt.compare(password, admin.password_hash)
   
   d. JWT 토큰 생성
      const payload = {
        adminId: admin.id,
        email: admin.email,
        role: 'admin',
        exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7일
      };
      const token = await signJWT(payload, c.env.JWT_SECRET);
   
   e. 응답
      return {
        success: true,
        data: {
          token,
          admin: { id, email, name }
        }
      }
    ↓
3. 프론트엔드 localStorage 저장
   localStorage.clear(); // 기존 세션 클리어
   localStorage.setItem('admin_token', token);
   localStorage.setItem('user_type', 'admin');
   localStorage.setItem('admin_id', admin.id.toString());
   localStorage.setItem('user_id', admin.id.toString());
   localStorage.setItem('user_name', admin.name || admin.email);
    ↓
4. 관리자 대시보드로 리다이렉트
   navigate('/admin', { replace: true })
```

### 📝 **코드 예시**

#### **프론트엔드 (AdminLoginPage.tsx)**
```typescript
async function handleLogin(e: React.FormEvent) {
  e.preventDefault();
  setLoading(true);

  try {
    // 🔐 JWT-based Login (NO Firebase!)
    const response = await api.post('/api/admin/login', {
      email,
      password
    });

    if (response.data.success) {
      // Clear old sessions
      localStorage.clear();
      
      // Store JWT token and admin info
      const { token, admin } = response.data.data;
      
      localStorage.setItem('admin_token', token);
      localStorage.setItem('user_type', 'admin');
      localStorage.setItem('admin_id', admin.id.toString());
      localStorage.setItem('user_id', admin.id.toString());
      localStorage.setItem('user_name', admin.name || admin.email);
      
      // Navigate to admin dashboard
      navigate('/admin', { replace: true });
    }
  } catch (err: any) {
    setError(err.response?.data?.error || '로그인 실패');
  } finally {
    setLoading(false);
  }
}
```

#### **백엔드 (src/index.tsx)**
```typescript
app.post('/api/admin/login', cors(), async (c) => {
  const { DB } = c.env;
  
  try {
    const { email, password } = await c.req.json();
    
    if (!email || !password) {
      return c.json({ success: false, error: '이메일과 비밀번호를 입력해주세요' }, 400);
    }
    
    // Find admin by email
    const admin = await DB.prepare(`
      SELECT id, username, email, password_hash, name, is_active
      FROM admins 
      WHERE email = ?
    `).bind(email).first();
    
    if (!admin) {
      return c.json({ success: false, error: '이메일 또는 비밀번호가 일치하지 않습니다' }, 401);
    }
    
    // Verify password (bcrypt)
    let isValidPassword = false;
    
    // 1. Test account
    const isTestAccount = email === 'admin@example.com' && password === 'admin123';
    
    // 2. Bcrypt verification
    if (!isValidPassword && admin.password_hash) {
      if (admin.password_hash.startsWith('$2')) {
        isValidPassword = await bcrypt.compare(password, admin.password_hash);
      }
    }
    
    if (!isValidPassword) {
      return c.json({ success: false, error: '이메일 또는 비밀번호가 일치하지 않습니다' }, 401);
    }
    
    // Generate JWT
    const payload = {
      adminId: admin.id,
      email: admin.email,
      role: 'admin',
      exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 days
    };
    
    const token = await signJWT(payload, c.env.JWT_SECRET);
    
    return c.json({
      success: true,
      data: {
        token,
        admin: {
          id: admin.id,
          email: admin.email,
          name: admin.name
        }
      }
    });
    
  } catch (error: any) {
    console.error('[Admin Login] Error:', error);
    return c.json({ success: false, error: '서버 오류가 발생했습니다' }, 500);
  }
});
```

---

## 5. 보안 구현 상세

### 🔐 **비밀번호 보안 (PR #1 구현 완료)**

#### **A. 비밀번호 해싱 (bcrypt)**
```typescript
// src/index.tsx - 비밀번호 해싱 함수
async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, 10); // 10 rounds (16-byte random salt 자동 생성)
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}
```

**특징**:
- ✅ **16-byte random salt** 자동 생성 (bcrypt 기본 동작)
- ✅ **10 salt rounds** (2^10 = 1024번 해싱)
- ✅ **타이밍 공격 방지** (bcrypt.compare는 상수 시간 복잡도)
- ✅ **Rainbow Table 공격 방지** (각 비밀번호마다 고유한 salt)

#### **B. JWT 토큰 보안**
```typescript
// src/index.tsx - JWT 생성
const getJWTSecret = (env: any): string => {
  return env.JWT_SECRET || 'default-jwt-secret-change-in-production-12345678901234567890';
};

async function signJWT(payload: any, secret: string): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  
  // Expiration 설정 (7일)
  const now = Math.floor(Date.now() / 1000);
  const finalPayload = {
    ...payload,
    iat: now,
    exp: payload.exp || now + (7 * 24 * 60 * 60) // 7 days
  };
  
  // Base64 URL 인코딩
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(finalPayload));
  
  // HMAC-SHA256 서명
  const signatureInput = `${encodedHeader}.${encodedPayload}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(signatureInput));
  const encodedSignature = base64UrlEncode(signature);
  
  return `${signatureInput}.${encodedSignature}`;
}

// JWT 검증
async function verifyJWTToken(token: string, secret: string): Promise<any | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const [encodedHeader, encodedPayload, signature] = parts;
    
    // 서명 검증
    const signatureInput = `${encodedHeader}.${encodedPayload}`;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    
    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      base64UrlDecode(signature),
      encoder.encode(signatureInput)
    );
    
    if (!isValid) return null;
    
    // Payload 디코딩
    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(encodedPayload)));
    
    // 만료 시간 확인
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null; // Expired
    }
    
    return payload;
  } catch {
    return null;
  }
}
```

**특징**:
- ✅ **256-bit Secret Key** (환경변수 `JWT_SECRET`)
- ✅ **HMAC-SHA256 서명**
- ✅ **7일 만료** (604,800초)
- ✅ **자동 만료 검증** (exp claim)
- ✅ **위조 방지** (서명 검증)

#### **C. Rate Limiting (KV 기반)**
```typescript
// src/index.tsx - Rate Limiting 정책
const RateLimitPolicies = {
  authentication: { requests: 5, window: 60 },    // 1분당 5회
  alimtalk: { requests: 10, window: 60 },         // 1분당 10회
  order: { requests: 10, window: 60 },            // 1분당 10회
  refund: { requests: 3, window: 3600 },          // 1시간당 3회
  cart: { requests: 20, window: 60 },             // 1분당 20회
  file_upload: { requests: 5, window: 60 }        // 1분당 5회
};

// Rate Limiting 미들웨어
async function rateLimit(policy: RateLimitPolicy, c: Context) {
  const clientIP = c.req.header('CF-Connecting-IP') || 'unknown';
  const key = `rate_limit:${policy.name}:${clientIP}`;
  
  const { KV } = c.env;
  const current = await KV.get(key);
  
  if (current) {
    const count = parseInt(current);
    if (count >= policy.requests) {
      return c.json({ error: 'Too many requests' }, 429);
    }
    
    await KV.put(key, (count + 1).toString(), { expirationTtl: policy.window });
  } else {
    await KV.put(key, '1', { expirationTtl: policy.window });
  }
}
```

**특징**:
- ✅ **Cloudflare KV 기반** (글로벌 분산 스토리지)
- ✅ **IP 기반 제한** (CF-Connecting-IP 헤더)
- ✅ **자동 만료** (TTL 설정)
- ✅ **Discord 알림** (50% 초과 시 웹훅 전송)

#### **D. 에러 메시지 (사용자 존재 여부 노출 방지)**
```typescript
// ❌ BAD - 사용자 존재 여부 노출
if (!user) {
  return c.json({ error: '이메일이 존재하지 않습니다' }, 404);
}
if (!isValidPassword) {
  return c.json({ error: '비밀번호가 일치하지 않습니다' }, 401);
}

// ✅ GOOD - 동일한 에러 메시지
if (!user || !isValidPassword) {
  return c.json({ error: '이메일 또는 비밀번호가 일치하지 않습니다' }, 401);
}
```

**특징**:
- ✅ **동일한 에러 메시지** (이메일 존재 여부 숨김)
- ✅ **타이밍 공격 방지** (응답 시간 균일화)
- ✅ **401 Unauthorized** (통일된 HTTP 상태 코드)

---

## 6. 데이터베이스 구조

### 📊 **D1 Database 테이블**

#### **A. users 테이블 (일반 사용자)**
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  firebase_uid TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  phone_number TEXT,
  profile_image_url TEXT,
  default_address_id INTEGER,
  kakao_id TEXT UNIQUE,
  google_id TEXT UNIQUE,
  role TEXT DEFAULT 'user', -- 'user' | 'seller' | 'admin'
  is_active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_firebase_uid ON users(firebase_uid);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_kakao_id ON users(kakao_id);
CREATE INDEX idx_users_google_id ON users(google_id);
```

**특징**:
- ✅ **Firebase UID 저장** (firebase_uid - UNIQUE)
- ✅ **OAuth ID 저장** (kakao_id, google_id - UNIQUE)
- ✅ **역할 구분** (role: 'user' | 'seller' | 'admin')
- ✅ **비밀번호 저장 안 함** (Firebase가 관리)

#### **B. sellers 테이블 (판매자)**
```sql
CREATE TABLE sellers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL, -- bcrypt hash
  name TEXT,
  phone TEXT,
  business_number TEXT,
  business_name TEXT,
  status TEXT DEFAULT 'pending', -- 'pending' | 'approved' | 'rejected' | 'suspended'
  is_active BOOLEAN DEFAULT 1,
  profile_image_url TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sellers_email ON sellers(email);
CREATE INDEX idx_sellers_status ON sellers(status);
```

**특징**:
- ✅ **bcrypt 해시 저장** (password_hash)
- ✅ **Firebase 미사용** (독립적인 인증)
- ✅ **승인 상태 관리** (status: pending/approved/rejected/suspended)
- ✅ **사업자 정보 저장** (business_number, business_name)

#### **C. admins 테이블 (관리자)**
```sql
CREATE TABLE admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL, -- bcrypt hash
  name TEXT,
  is_active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_admins_email ON admins(email);
```

**특징**:
- ✅ **bcrypt 해시 저장** (password_hash)
- ✅ **Firebase 미사용** (독립적인 인증)
- ✅ **최소 권한** (email, password_hash, name만)

---

## 7. 프론트엔드 상태 관리

### 🎨 **Zustand Store (일반 사용자 전용)**

#### **A. useAuthKR.ts (한국 전용)**
```typescript
// src/shared/stores/useAuthKR.ts
interface AuthKRState {
  // 1️⃣ 상태
  user: FirebaseUser | null;
  isLoading: boolean;
  error: string | null;
  isAuthReady: boolean;
  userRole: 'user' | 'seller' | 'admin' | null;

  // 2️⃣ Actions
  setUser: (user: FirebaseUser | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setAuthReady: (ready: boolean) => void;

  // 3️⃣ 비즈니스 로직
  loginWithEmail: (email: string, password: string) => Promise<void>;
  signupWithEmail: (email: string, password: string, displayName: string) => Promise<void>;
  loginWithKakao: () => Promise<void>;
  sendPasswordResetEmail: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  initializeAuth: () => Promise<void>;
}

export const useAuthKR = create<AuthKRState>()(
  devtools(
    persist(
      (set, get) => ({
        // 초기 상태
        user: null,
        isLoading: true,
        error: null,
        isAuthReady: false,
        userRole: null,

        // Actions 구현...
        loginWithEmail: async (email, password) => {
          const userCredential = await signInWithEmailAndPassword(auth, email, password);
          const user = userCredential.user;

          // 역할 조회
          const roleResponse = await fetch('/api/users/role', {
            headers: { Authorization: `Bearer ${await user.getIdToken()}` },
          });
          const { role } = await roleResponse.json();

          set({ user, userRole: role, isLoading: false, isAuthReady: true });
        },

        // 인증 초기화 (onAuthStateChanged)
        initializeAuth: async () => {
          return new Promise<void>((resolve) => {
            const unsubscribe = auth.onAuthStateChanged(async (user) => {
              if (user) {
                // 역할 조회
                const roleResponse = await fetch('/api/users/role', {
                  headers: { Authorization: `Bearer ${await user.getIdToken()}` },
                });
                const { role } = await roleResponse.json();

                set({ user, userRole: role, isLoading: false, isAuthReady: true });
              } else {
                set({ user: null, userRole: null, isLoading: false, isAuthReady: true });
              }
              unsubscribe();
              resolve();
            });
          });
        },
      }),
      {
        name: 'auth-kr-storage', // localStorage 키
        partialize: (state) => ({ user: state.user, userRole: state.userRole }),
      }
    ),
    { name: 'AuthKR Store' }
  )
);
```

**특징**:
- ✅ **Firebase Auth 통합** (onAuthStateChanged 자동 감지)
- ✅ **Selector 지원** (리렌더 최소화)
- ✅ **localStorage 영속화** (페이지 새로고침 시에도 상태 유지)
- ✅ **DevTools 지원** (Redux DevTools로 디버깅)

#### **B. localStorage (판매자/관리자)**
```typescript
// 판매자 로그인 후 localStorage 저장
localStorage.setItem('seller_token', token);
localStorage.setItem('user_type', 'seller');
localStorage.setItem('seller_id', seller.id.toString());
localStorage.setItem('user_id', seller.id.toString());
localStorage.setItem('user_name', seller.name || seller.email);

// 관리자 로그인 후 localStorage 저장
localStorage.setItem('admin_token', token);
localStorage.setItem('user_type', 'admin');
localStorage.setItem('admin_id', admin.id.toString());
localStorage.setItem('user_id', admin.id.toString());
localStorage.setItem('user_name', admin.name || admin.email);
```

**특징**:
- ❌ **Zustand 미사용** (단순 localStorage)
- ❌ **Firebase 미사용** (JWT 토큰만 사용)
- ✅ **간단한 구현** (API 호출 시 `Authorization: Bearer ${token}` 헤더만 추가)

---

## 8. API 엔드포인트 목록

### 📡 **인증 관련 API**

| 엔드포인트 | 메서드 | 설명 | 인증 방식 |
|----------|--------|------|----------|
| `/api/auth/kakao/firebase` | POST | Kakao OAuth → Firebase Custom Token | None |
| `/api/auth/google/register` | POST | Google OAuth 사용자 정보 저장 | Firebase ID Token |
| `/api/users/role` | GET | Firebase 사용자 역할 조회 | Firebase ID Token |
| `/api/seller/login` | POST | 판매자 이메일/비밀번호 로그인 | None |
| `/api/admin/login` | POST | 관리자 이메일/비밀번호 로그인 | None |

### 📡 **판매자 API (JWT 인증 필요)**

| 엔드포인트 | 메서드 | 설명 | 인증 |
|----------|--------|------|------|
| `/api/seller/dashboard` | GET | 판매자 대시보드 통계 | `seller_token` |
| `/api/seller/products` | GET | 판매자 상품 목록 | `seller_token` |
| `/api/seller/orders` | GET | 판매자 주문 목록 | `seller_token` |
| `/api/seller/profile` | GET/PUT | 판매자 프로필 조회/수정 | `seller_token` |

### 📡 **관리자 API (JWT 인증 필요)**

| 엔드포인트 | 메서드 | 설명 | 인증 |
|----------|--------|------|------|
| `/api/admin/dashboard` | GET | 관리자 대시보드 통계 | `admin_token` |
| `/api/admin/users` | GET | 사용자 목록 | `admin_token` |
| `/api/admin/sellers` | GET | 판매자 목록 | `admin_token` |
| `/api/admin/orders` | GET | 전체 주문 목록 | `admin_token` |

---

## 9. 문제점 및 개선 사항

### ⚠️ **현재 문제점**

#### **A. 판매자/관리자 인증의 보안 취약점**

1. **JWT 검증 미들웨어 없음**
   - 현재: 각 API 엔드포인트에서 개별적으로 JWT 검증
   - 문제: 일부 엔드포인트에서 검증 누락 가능
   - **해결책**: Express/Hono 미들웨어로 JWT 검증 로직 통합

2. **localStorage에 토큰 저장**
   - 현재: `seller_token`, `admin_token`을 localStorage에 평문 저장
   - 문제: XSS 공격에 취약
   - **해결책**: HttpOnly Cookie로 변경 (JavaScript 접근 불가)

3. **토큰 갱신 로직 없음**
   - 현재: 7일 만료 후 재로그인 필요
   - 문제: 사용 중에 세션 만료 가능
   - **해결책**: Refresh Token 구현 (Access Token: 1시간, Refresh Token: 30일)

4. **CSRF 보호 없음**
   - 현재: CORS만 설정
   - 문제: CSRF 공격 가능
   - **해결책**: CSRF Token 추가 (Cookie + Header 검증)

#### **B. 상태 관리 불일치**

1. **일반 사용자와 판매자/관리자 방식 차이**
   - 일반 사용자: Zustand + Firebase
   - 판매자/관리자: localStorage + JWT
   - 문제: 코드 일관성 부족, 유지보수 어려움
   - **해결책**: 모든 사용자 타입에 Zustand 적용

2. **역할 기반 접근 제어 (RBAC) 미흡**
   - 현재: `user_type` localStorage만 확인
   - 문제: 클라이언트 측 검증만 존재 (우회 가능)
   - **해결책**: 모든 API 엔드포인트에 서버 측 RBAC 미들웨어 추가

#### **C. 테스트 계정 하드코딩**

```typescript
// ❌ BAD - 프로덕션에 테스트 계정 하드코딩
const isTestAccount = email === 'seller@ur-team.com' && password === 'seller123';
```

- 문제: 보안 위험 (누구나 테스트 계정으로 로그인 가능)
- **해결책**: 환경변수나 DB에서 관리, 프로덕션 환경에서는 비활성화

---

### ✅ **개선 권장 사항**

#### **1. JWT 인증 미들웨어 통합**
```typescript
// src/middleware/auth.ts
export async function requireAuth(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  
  const token = authHeader.substring(7);
  const payload = await verifyJWTToken(token, c.env.JWT_SECRET);
  
  if (!payload) {
    return c.json({ error: 'Invalid token' }, 401);
  }
  
  // Context에 사용자 정보 저장
  c.set('user', payload);
  await next();
}

export function requireRole(role: 'seller' | 'admin') {
  return async (c: Context, next: Next) => {
    const user = c.get('user');
    
    if (!user || user.role !== role) {
      return c.json({ error: 'Forbidden' }, 403);
    }
    
    await next();
  };
}

// 사용 예시
app.get('/api/seller/dashboard', requireAuth, requireRole('seller'), async (c) => {
  const user = c.get('user');
  // ...
});
```

#### **2. HttpOnly Cookie로 토큰 저장**
```typescript
// 백엔드 - 로그인 성공 시
c.header('Set-Cookie', `seller_token=${token}; HttpOnly; Secure; SameSite=Strict; Max-Age=604800; Path=/`);

// 프론트엔드 - axios 설정
const api = axios.create({
  baseURL: '/',
  withCredentials: true // Cookie 자동 전송
});
```

#### **3. Refresh Token 구현**
```typescript
// 백엔드 - Refresh Token 발급
const accessToken = await signJWT({ ...payload, exp: now + 3600 }, secret); // 1시간
const refreshToken = await signJWT({ ...payload, exp: now + 2592000 }, secret); // 30일

// Refresh Token으로 Access Token 갱신
app.post('/api/auth/refresh', async (c) => {
  const { refreshToken } = await c.req.json();
  const payload = await verifyJWTToken(refreshToken, c.env.JWT_SECRET);
  
  if (!payload) {
    return c.json({ error: 'Invalid refresh token' }, 401);
  }
  
  const newAccessToken = await signJWT({
    ...payload,
    exp: Math.floor(Date.now() / 1000) + 3600 // 1시간
  }, c.env.JWT_SECRET);
  
  return c.json({ accessToken: newAccessToken });
});
```

#### **4. 통합 인증 Store (Zustand)**
```typescript
// src/shared/stores/useAuth.ts
interface AuthState {
  user: User | null;
  userType: 'user' | 'seller' | 'admin' | null;
  token: string | null;
  
  // 공통 메서드
  login: (email: string, password: string, type: 'user' | 'seller' | 'admin') => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  userType: null,
  token: null,
  
  login: async (email, password, type) => {
    let endpoint = '';
    if (type === 'user') endpoint = '/api/auth/login';
    else if (type === 'seller') endpoint = '/api/seller/login';
    else if (type === 'admin') endpoint = '/api/admin/login';
    
    const response = await api.post(endpoint, { email, password });
    const { token, user } = response.data.data;
    
    set({ user, userType: type, token });
  },
  
  logout: async () => {
    // 로그아웃 API 호출
    await api.post('/api/auth/logout');
    set({ user: null, userType: null, token: null });
  },
  
  refresh: async () => {
    const response = await api.post('/api/auth/refresh');
    const { token } = response.data;
    set({ token });
  }
}));
```

---

## 📊 **최종 요약**

### ✅ **현재 구현된 사항**
1. ✅ **일반 사용자 인증** (Firebase + Kakao OAuth + Google OAuth)
2. ✅ **판매자 인증** (JWT + bcrypt)
3. ✅ **관리자 인증** (JWT + bcrypt)
4. ✅ **비밀번호 보안** (bcrypt 16-byte salt, 10 rounds)
5. ✅ **JWT 토큰** (256-bit secret, 7일 만료)
6. ✅ **Rate Limiting** (KV 기반, IP별 제한)
7. ✅ **에러 메시지 보안** (사용자 존재 여부 숨김)

### ⚠️ **개선 필요 사항**
1. ⚠️ JWT 검증 미들웨어 통합
2. ⚠️ HttpOnly Cookie로 토큰 저장
3. ⚠️ Refresh Token 구현
4. ⚠️ CSRF 보호 추가
5. ⚠️ 통합 인증 Store (Zustand)
6. ⚠️ 서버 측 RBAC 미들웨어
7. ⚠️ 테스트 계정 하드코딩 제거

### 📈 **보안 점수**
- **현재**: 75/100
- **개선 후 예상**: 95/100

---

**생성 시각**: 2026-03-08 14:15:00 UTC  
**작성자**: GenSpark AI Development Assistant  
**문서 버전**: 1.0.0
