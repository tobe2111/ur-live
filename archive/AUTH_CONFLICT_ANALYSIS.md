# 🚨 유저/셀러/어드민 인증 충돌 분석 보고서

**날짜**: 2026-03-11  
**우선순위**: 🔴 HIGH (데이터 무결성 위험)  
**상태**: ⚠️ 문제 발견, 수정 필요

---

## 🔍 발견된 심각한 문제들

### 1. 🚨 **user_type 충돌 위험** (Critical)

#### 문제 상황
**3가지 로그인 시스템이 같은 localStorage 키를 공유**:

```typescript
// 1️⃣ User (Firebase - Kakao/Email/Google)
// LoginPage.tsx - user_type 설정 없음!
await loginWithEmailAction(email, password)
// → user_type이 설정되지 않음

// LivePageV2.tsx:1319 - 장바구니 추가 시에만 설정
if (!existingUserType) {
  localStorage.setItem('user_type', 'user')  // ← 너무 늦음!
}

// 2️⃣ Seller (JWT)
// SellerLoginPage.tsx:44
localStorage.clear()  // ← 모든 데이터 삭제!
localStorage.setItem('user_type', 'seller')
localStorage.setItem('user_name', seller.name)

// 3️⃣ Admin (JWT)
// AdminLoginPage.tsx:54
localStorage.setItem('user_type', 'admin')
localStorage.setItem('user_name', admin.name)
```

#### 충돌 시나리오

**시나리오 A: User → Seller 로그인**
```
1. User가 카카오 로그인
   - Firebase Auth ✅
   - user_type: (설정 안 됨!) ❌
   
2. User가 /seller/login 접근
   - 별도 탭에서 Seller 로그인
   
3. SellerLoginPage.tsx:44
   localStorage.clear()  // 🚨 User의 Firebase 세션도 삭제!
   
4. User 탭으로 돌아가면:
   - Firebase는 로그인 상태
   - 하지만 localStorage 모두 삭제됨
   - getUserName() → null
   - 사용자 정보 사라짐 ❌
```

**시나리오 B: Seller → User 충돌**
```
1. Seller 로그인
   - localStorage: { user_type: 'seller', seller_token: 'xxx' }
   
2. 같은 브라우저에서 User 페이지 접근
   - Firebase 로그인 시도
   
3. api.ts:122 interceptor
   if (url.startsWith('/api/seller/')) {
     const sellerToken = localStorage.getItem('seller_token')  // ← 있음!
     // Seller API로 오인 ❌
   }
   
4. User API에 seller_token 전송
   - 401 Unauthorized
   - User 로그인 실패 ❌
```

---

### 2. 🚨 **localStorage.clear() 너무 과격함** (Critical)

#### 문제 코드
**SellerLoginPage.tsx:44**
```typescript
// Clear ALL old sessions to avoid conflicts
localStorage.clear()  // 🚨 모든 데이터 삭제!
sessionStorage.clear()

// Store JWT tokens
localStorage.setItem('seller_token', accessToken)
// ...
```

#### 영향 범위
`localStorage.clear()`는 **모든 키를 삭제**합니다:
- ✅ 의도: 이전 세션 정리 (seller_token, admin_token)
- ❌ 부작용: 다른 탭의 User 세션도 삭제
  - `firebase_token` 삭제
  - `user_name` 삭제
  - `hasCartItems` 삭제 (장바구니 상태)
  - `tempCartItem` 삭제
  - 기타 모든 사용자 데이터

#### 실제 사례
```
User A:
  Tab 1: /live/1 (User 로그인 - 장바구니에 상품 3개)
  Tab 2: /seller/login (Seller 로그인 시도)
  
Tab 2에서 Seller 로그인 → localStorage.clear()
Tab 1로 돌아가면:
  - 장바구니 비어있음 ❌
  - 사용자 이름 없음 ❌
  - 로그인 상태 불안정
```

---

### 3. ⚠️ **User 로그인 시 user_type 미설정** (High)

#### 문제 코드
**LoginPage.tsx:197-201**
```typescript
// ✅ Zustand action 직접 호출
await loginWithEmailAction(email, password)

// ❌ user_type 설정 없음!
sessionStorage.removeItem('returnUrl')
navigate(returnUrl, { replace: true })
```

**useAuthKR.ts:58-86**
```typescript
loginWithEmail: async (email, password) => {
  // ... Firebase 로그인 ...
  
  set({
    user,
    userRole: role,
    isLoading: false,
    isAuthReady: true,
    error: null,
  })
  
  // ❌ localStorage에 user_type 저장 없음!
}
```

#### 결과
- User 로그인 성공
- `auth.currentUser` 존재
- 하지만 `localStorage.getItem('user_type')` → **null**
- API 요청 시 혼란:
  ```typescript
  // api.ts:166
  const userType = localStorage.getItem('user_type')
  console.log(`Notifications API - user_type: ${userType}`)
  // → null 출력, 어떤 토큰을 쓸지 모름
  ```

---

### 4. ⚠️ **Google 로그인 시 user_type 미설정** (High)

#### 문제 코드
**LoginPage.tsx:241-254**
```typescript
const result = await signInWithGoogle()

// 백엔드에 사용자 정보 저장 (D1 DB)
await api.post('/api/auth/google/register', {
  uid: result.user.uid,
  email: result.user.email,
  name: result.user.displayName,
  photoURL: result.user.photoURL
})

console.log('[Google Login] ✅ 성공:', result.user.email)

// ❌ user_type 설정 없음!
sessionStorage.removeItem('returnUrl')
navigate(returnUrl, { replace: true })
```

---

### 5. ⚠️ **Kakao 로그인 시 user_type 미설정** (High)

#### 문제 코드
**KakaoCallbackPage.tsx**
```typescript
const userCredential = await signInWithCustomToken(customToken)

// ✅ Zustand Store 업데이트
setUser(userCredential.user)
setAuthReady(true)

// ❌ localStorage에 user_type 저장 없음!
navigate(returnUrl, { replace: true })
```

---

## ✅ 해결 방안

### 1. **localStorage.clear() 대신 선택적 삭제**

**SellerLoginPage.tsx 수정**:
```typescript
// Before: 너무 과격
localStorage.clear()
sessionStorage.clear()

// After: 선택적 삭제
function clearAuthData(type: 'seller' | 'admin') {
  // 🔴 삭제할 키 목록 (명시적)
  const keysToRemove = [
    'seller_token',
    'seller_refresh_token',
    'seller_id',
    'seller_name',
    'seller_email',
    'admin_token',
    'admin_refresh_token',
    'admin_id',
    'admin_name',
    'admin_email',
    'access_token',  // 레거시
    'refresh_token', // 레거시
  ]
  
  keysToRemove.forEach(key => localStorage.removeItem(key))
  
  // ✅ 유지할 키 (User 세션 보호)
  // - firebase_token
  // - user_name
  // - hasCartItems
  // - tempCartItem
}

// 사용
clearAuthData('seller')
```

---

### 2. **모든 User 로그인에 user_type 설정**

#### A. useAuthKR.ts 수정
```typescript
loginWithEmail: async (email, password) => {
  // ... Firebase 로그인 ...
  
  // ✅ user_type 설정
  localStorage.setItem('user_type', 'user')
  localStorage.setItem('user_name', user.email?.split('@')[0] || 'User')
  
  set({
    user,
    userRole: role,
    isLoading: false,
    isAuthReady: true,
    error: null,
  })
}
```

#### B. LoginPage.tsx - Google 로그인
```typescript
const result = await signInWithGoogle()

// ✅ user_type 설정
localStorage.setItem('user_type', 'user')
localStorage.setItem('user_name', result.user.displayName || result.user.email?.split('@')[0] || 'User')

await api.post('/api/auth/google/register', { ... })
```

#### C. KakaoCallbackPage.tsx
```typescript
const userCredential = await signInWithCustomToken(customToken)

// ✅ user_type 설정
localStorage.setItem('user_type', 'user')
localStorage.setItem('user_name', user.name)

setUser(userCredential.user)
setAuthReady(true)
```

---

### 3. **API Interceptor 로직 강화**

**api.ts 수정**:
```typescript
api.interceptors.request.use(async (config) => {
  const url = config.url || ''
  
  // 공개 API는 토큰 불필요
  if (isPublicAPI(url)) return config
  
  // ✅ user_type 명확히 체크
  const userType = localStorage.getItem('user_type')
  console.log(`[API] Request: ${url}, user_type: ${userType}`)
  
  // 🔐 SELLER API
  if (url.startsWith('/api/seller/') || url.startsWith('/api/youtube/')) {
    // ✅ user_type 검증
    if (userType !== 'seller') {
      console.error('[API] ❌ Seller API requires user_type=seller, but got:', userType)
      throw new Error('Seller authentication required')
    }
    
    const sellerToken = localStorage.getItem('seller_token')
    if (!sellerToken) {
      throw new Error('Seller token missing')
    }
    
    config.headers['Authorization'] = `Bearer ${sellerToken}`
    return config
  }
  
  // 🔐 ADMIN API
  if (url.startsWith('/api/admin/')) {
    // ✅ user_type 검증
    if (userType !== 'admin') {
      console.error('[API] ❌ Admin API requires user_type=admin, but got:', userType)
      throw new Error('Admin authentication required')
    }
    
    const adminToken = localStorage.getItem('admin_token')
    if (!adminToken) {
      throw new Error('Admin token missing')
    }
    
    config.headers['Authorization'] = `Bearer ${adminToken}`
    return config
  }
  
  // 🔥 USER API (Firebase)
  // ✅ user_type이 null이거나 'user'일 때만 Firebase 사용
  if (!userType || userType === 'user') {
    console.log('[API] 👤 User API - using Firebase ID Token')
    
    const auth = await getFirebaseAuth()
    let user = auth.currentUser
    
    if (user) {
      const idToken = await user.getIdToken(true)
      config.headers['Authorization'] = `Bearer ${idToken}`
    } else {
      console.warn('[API] ⚠️ No Firebase user for protected API:', url)
    }
  } else {
    console.error('[API] ❌ Unknown user_type:', userType)
  }
  
  return config
})
```

---

### 4. **로그아웃 시 선택적 삭제**

**통합 로그아웃 함수**:
```typescript
// src/utils/auth.ts

export async function logout() {
  const userType = localStorage.getItem('user_type')
  
  if (userType === 'seller') {
    // Seller 전용 키 삭제
    ['seller_token', 'seller_refresh_token', 'seller_id', 'seller_name', 'seller_email', 'user_type'].forEach(key => 
      localStorage.removeItem(key)
    )
    window.location.href = '/seller/login'
    
  } else if (userType === 'admin') {
    // Admin 전용 키 삭제
    ['admin_token', 'admin_refresh_token', 'admin_id', 'admin_name', 'admin_email', 'user_type'].forEach(key => 
      localStorage.removeItem(key)
    )
    window.location.href = '/admin/login'
    
  } else {
    // User: Firebase 로그아웃 + User 전용 키 삭제
    const auth = await getFirebaseAuth()
    await auth.signOut()
    
    ['user_type', 'user_name', 'hasCartItems', 'tempCartItem', 'loginReturnUrl'].forEach(key => 
      localStorage.removeItem(key)
    )
    window.location.href = '/login'
  }
}
```

---

## 📊 우선순위별 수정 계획

### 🔴 Priority 1 (즉시 수정 필요)
1. ✅ `localStorage.clear()` → 선택적 삭제로 변경
   - **파일**: SellerLoginPage.tsx, AdminLoginPage.tsx
   - **위험도**: Critical (User 세션 파괴)

2. ✅ User 로그인 시 `user_type='user'` 설정
   - **파일**: useAuthKR.ts, useAuthWorld.ts, KakaoCallbackPage.tsx, LoginPage.tsx
   - **위험도**: High (API 라우팅 오류)

### 🟡 Priority 2 (단기 수정)
3. ✅ API Interceptor user_type 검증 강화
   - **파일**: api.ts
   - **위험도**: Medium (잘못된 토큰 전송)

4. ✅ 통합 로그아웃 함수 구현
   - **파일**: auth.ts
   - **위험도**: Medium (세션 정리 불완전)

### 🟢 Priority 3 (장기 개선)
5. ⚡ 멀티 계정 동시 로그인 지원
   - User, Seller, Admin 동시 로그인 허용
   - 서로 다른 namespace 사용

6. 📊 세션 관리 대시보드
   - 현재 로그인 상태 시각화
   - 세션 충돌 감지 및 경고

---

## 🧪 테스트 시나리오

### ✅ 테스트 체크리스트

#### 1. User 로그인 후 Seller 로그인
- [ ] Tab 1: User 카카오 로그인
- [ ] Tab 2: Seller 로그인
- [ ] Tab 1 확인: User 세션 유지됨, 장바구니 유지됨

#### 2. Seller 로그인 후 User 로그인
- [ ] Tab 1: Seller 로그인
- [ ] Tab 2: User 이메일 로그인
- [ ] 두 세션 독립적으로 작동

#### 3. user_type 일관성
- [ ] User 로그인 → `localStorage.getItem('user_type')` === 'user'
- [ ] Seller 로그인 → `localStorage.getItem('user_type')` === 'seller'
- [ ] Admin 로그인 → `localStorage.getItem('user_type')` === 'admin'

#### 4. API 라우팅
- [ ] User가 `/api/cart` 호출 → Firebase ID Token 전송
- [ ] Seller가 `/api/seller/products` 호출 → seller_token 전송
- [ ] Admin이 `/api/admin/users` 호출 → admin_token 전송

---

## 🎯 결론

### 발견된 문제 요약
1. 🚨 **localStorage.clear()가 다른 탭의 User 세션 파괴**
2. 🚨 **User 로그인 시 user_type 미설정으로 API 라우팅 혼란**
3. ⚠️ **Seller/Admin/User 세션 충돌 가능성**
4. ⚠️ **API Interceptor의 user_type 검증 부족**

### 수정 필요성
- **즉시 수정 필요**: localStorage.clear() 제거, user_type 설정
- **예상 작업 시간**: 2-3시간
- **테스트 시간**: 1-2시간
- **배포 위험도**: Medium (철저한 테스트 필요)

---

**작성자**: AI Developer  
**우선순위**: 🔴 HIGH  
**다음 단계**: 수정 구현 승인 대기
