# 🚨 계정 분리 시스템 완전 분석 및 문제점

## 📋 목차
1. [현재 인증 시스템 아키텍처](#현재-인증-시스템-아키텍처)
2. [발견된 치명적 문제점](#발견된-치명적-문제점)
3. [localStorage 키 충돌 분석](#localstorage-키-충돌-분석)
4. [세션 충돌 시나리오](#세션-충돌-시나리오)
5. [완벽한 해결 방안](#완벽한-해결-방안)

---

## 현재 인증 시스템 아키텍처

### 4가지 독립적 로그인 시스템

#### 1️⃣ 일반 사용자 - Kakao OAuth + Firebase
- **인증 방식**: Firebase Custom Token
- **localStorage 키**:
  - `firebase_token` (자동 갱신)
  - `user_type: 'user'`
  - `user_id`
  - `user_name`
  - `user_email`
- **API 토큰**: Firebase ID Token (Bearer)

#### 2️⃣ 일반 사용자 - Email/Password + Firebase
- **인증 방식**: Firebase Email Auth
- **localStorage 키**: (Kakao와 동일)
- **API 토큰**: Firebase ID Token (Bearer)

#### 3️⃣ 셀러 - Email/Password + JWT
- **인증 방식**: 자체 JWT (Firebase 사용 안 함)
- **localStorage 키**:
  - `seller_token` (PRIMARY)
  - `access_token` (FALLBACK)
  - `seller_refresh_token`
  - `user_type: 'seller'`
  - `seller_id`
  - `seller_name`
  - `seller_email`
- **API 토큰**: `seller_token` (Bearer)

#### 4️⃣ 어드민 - Email/Password + JWT
- **인증 방식**: 자체 JWT (Firebase 사용 안 함)
- **localStorage 키**:
  - `admin_token` (PRIMARY)
  - `access_token` (FALLBACK)
  - `admin_refresh_token`
  - `user_type: 'admin'`
  - `admin_id`
  - `admin_name`
  - `admin_email`
- **API 토큰**: `admin_token` (Bearer)

---

## 발견된 치명적 문제점

### 🔴 문제 1: localStorage 키 충돌

#### 공유되는 키
```typescript
// ❌ 충돌 발생: 모든 계정이 이 키를 사용
'user_type'        // 'user', 'seller', 'admin'
'access_token'     // Seller/Admin이 공유
```

#### 시나리오: Seller 로그인 → User 로그인
1. **Seller 로그인 후 상태**:
   ```javascript
   localStorage = {
     'seller_token': 'seller_jwt_token',
     'access_token': 'seller_jwt_token',  // 셀러 토큰
     'user_type': 'seller',
     'seller_id': '123',
     'seller_name': 'Seller Name'
   }
   ```

2. **User (Kakao) 로그인 시**:
   ```javascript
   // loginWithKakaoToken() 실행
   localStorage.setItem('user_type', 'user')  // ✅ 최근 수정으로 해결됨
   // 하지만 seller_token, access_token은 남아있음!
   ```

3. **결과**:
   ```javascript
   localStorage = {
     'seller_token': 'seller_jwt_token',     // ❌ 남아있음
     'access_token': 'seller_jwt_token',     // ❌ 남아있음
     'user_type': 'user',                    // ✅ 올바르게 설정
     'seller_id': '123',                     // ❌ 남아있음
     'firebase_token': 'user_firebase_token' // ✅ 추가됨
   }
   ```

### 🔴 문제 2: API 인터셉터 토큰 선택 로직 오류

`src/lib/api.ts` (라인 96-250):

```typescript
// /api/seller/* 요청 시
if (url.startsWith('/api/seller/')) {
  const userType = localStorage.getItem('user_type');
  
  // ⚠️ 문제: user_type이 'user'인데 seller_token이 남아있으면?
  if (userType !== 'seller') {
    // Firebase Token 사용 (올바름)
  } else {
    const sellerToken = localStorage.getItem('seller_token');
    // seller_token 사용
  }
}
```

**시나리오**: User가 Seller 공개 페이지 방문 시
- `user_type='user'` ✅
- 하지만 `seller_token`이 남아있으면 혼란 발생 가능

### 🔴 문제 3: 로그아웃 시 불완전한 정리

`src/features/auth/login-flow.service.ts` (라인 261-344):

```typescript
export async function logout(): Promise<void> {
  // ❌ 문제: 모든 세션 삭제 (타입 구분 없음)
  const keysToRemove = [
    'user_name',
    'loginReturnUrl',
    'seller_token',
    'admin_token',
    'user_type',
    // ...
  ]
  
  // Firebase 로그아웃도 무조건 실행
  const { signOut } = await import('@/lib/firebase-auth')
  await signOut()
}
```

**문제점**:
- User 로그아웃 시 Seller 토큰도 삭제
- Seller 로그아웃 시 User Firebase도 로그아웃
- 완전 분리가 안 됨!

### 🔴 문제 4: 선택적 clearAuthData 미사용

`src/utils/auth.ts`에 `clearAuthData(type)` 함수가 있지만:

**사용하는 곳**:
- ✅ `SellerLoginPage` (라인 61)
- ✅ `AdminLoginPage` (라인 58)
- ✅ `api.ts` 401 핸들러 (라인 320, 369)

**사용하지 않는 곳**:
- ❌ `loginWithKakaoToken()` - user_type만 설정
- ❌ `loginWithFirebaseToken()` - user_type만 설정
- ❌ `logout()` - 전체 삭제

### 🔴 문제 5: getUserId() 로직의 한계

`src/utils/auth.ts` (라인 183-219):

```typescript
export async function getUserId(): Promise<string | null> {
  const userType = localStorage.getItem('user_type')
  
  // ✅ user_type='seller'이면 localStorage user_id 안 읽음
  if (userType === 'user' || !userType) {
    const userId = localStorage.getItem('user_id')
    if (userId) return userId
  } else {
    console.log(`[Auth] getUserId: Skipping localStorage (user_type=${userType})`)
  }
  
  // ✅ Firebase Custom Claims에서 userId 추출
  // ...
}
```

**이슈**: 
- `user_type='seller'`이고 `user_id`가 남아있어도 안전하게 무시함 ✅
- 하지만 `seller_token`은 여전히 남아있어 API 호출 시 혼란 가능 ⚠️

---

## localStorage 키 충돌 분석

### 충돌 가능한 시나리오

#### 시나리오 1: Seller → User 로그인
```javascript
// 1. Seller 로그인
localStorage = {
  'seller_token': 'JWT_SELLER',
  'access_token': 'JWT_SELLER',
  'user_type': 'seller',
  'seller_id': '10'
}

// 2. User (Kakao) 로그인 (브라우저 새로 고침 없이)
// loginWithKakaoToken() 실행
localStorage.setItem('user_type', 'user')  // ✅ 최근 수정
localStorage.setItem('lastLoginUid', 'kakao_123')

// 3. 결과 상태
localStorage = {
  'seller_token': 'JWT_SELLER',      // ❌ 오염
  'access_token': 'JWT_SELLER',      // ❌ 오염
  'user_type': 'user',               // ✅ 올바름
  'seller_id': '10',                 // ❌ 오염
  'lastLoginUid': 'kakao_123',       // ✅ 올바름
  'firebase_token': 'FB_USER_TOKEN'  // ✅ 올바름 (Zustand)
}
```

**영향**:
- `getUserId()`: ✅ 올바르게 작동 (user_type 체크)
- API `/api/seller/*`: ✅ 올바르게 작동 (user_type 체크)
- 하지만 localStorage 오염으로 디버깅 어려움 ⚠️

#### 시나리오 2: User → Seller 로그인
```javascript
// 1. User (Firebase) 로그인
localStorage = {
  'user_type': 'user',
  'user_id': '50',
  'user_name': 'John',
  'lastLoginUid': 'kakao_50'
}
// + Firebase Auth state (auth.currentUser)

// 2. Seller 로그인 (clearAuthData('seller') 실행)
// SellerLoginPage.tsx (라인 61)
clearAuthData('seller')  // user_id, user_name은 삭제 안 함!

// 3. 결과 상태
localStorage = {
  'seller_token': 'JWT_SELLER',
  'access_token': 'JWT_SELLER',
  'user_type': 'seller',
  'seller_id': '10',
  'user_id': '50',           // ❌ User ID 남아있음
  'user_name': 'John',       // ❌ User Name 남아있음
  'lastLoginUid': 'kakao_50' // ❌ User UID 남아있음
}
// + Firebase Auth state (auth.currentUser) 여전히 존재!
```

**치명적 영향**:
- Firebase `auth.currentUser`가 남아있음! 🔴
- User 세션이 완전히 정리되지 않음 🔴
- Seller API 호출 시 혼란 가능 🔴

#### 시나리오 3: Admin → User 로그인
(Seller → User와 동일한 문제)

#### 시나리오 4: 동시 다중 세션
```javascript
// 사용자가 의도적으로 두 계정 유지하려는 경우
// 예: User 장바구니 유지하면서 Seller 대시보드 접근

// 현재 시스템: 불가능 (마지막 로그인이 모두 덮어씀)
```

---

## 세션 충돌 시나리오

### 1. 로그인 체인 오염

```
User (Kakao) 로그인
  ↓
  user_type='user', Firebase auth, user_id=50
  ↓
Seller 로그인 (같은 브라우저)
  ↓
  clearAuthData('seller') 실행
  ↓
  seller_token 추가, user_type='seller'
  ↓
  ❌ Firebase auth.currentUser 여전히 존재!
  ↓
  ❌ user_id, user_name 남아있음!
  ↓
API 호출 혼란 발생 가능
```

### 2. 로그아웃 체인 오염

```
User 로그아웃 (일반 logout() 호출)
  ↓
  Firebase signOut() 실행
  ↓
  모든 localStorage 삭제 (seller_token 포함)
  ↓
  ❌ Seller 세션도 파괴됨!
  ↓
Seller가 401 에러 발생
```

### 3. API 인터셉터 혼란

```
user_type='user'
seller_token='JWT_SELLER' (남아있음)
firebase_token='FB_TOKEN'
  ↓
/api/seller/products 호출
  ↓
API 인터셉터: user_type !== 'seller'
  ↓
Firebase Token 사용 (올바름) ✅
  ↓
하지만 seller_token이 localStorage에 남아있어 혼란
```

---

## 완벽한 해결 방안

### Solution 1: 로그인 시 완전한 정리

#### Before (loginWithKakaoToken):
```typescript
// ❌ 불완전
localStorage.setItem('lastLoginUid', credential.user.uid)
localStorage.setItem('user_type', 'user')
```

#### After (제안):
```typescript
// ✅ 완전 정리
// 1. 먼저 다른 세션 정리
clearAuthData('seller')
clearAuthData('admin')

// 2. 그 다음 User 세션 설정
localStorage.setItem('lastLoginUid', credential.user.uid)
localStorage.setItem('user_type', 'user')
localStorage.setItem('user_id', userId)  // Custom Claims에서 추출
localStorage.setItem('user_name', userName)  // Custom Claims에서 추출
```

### Solution 2: 로그아웃 시 타입별 선택적 정리

#### Before (logout):
```typescript
// ❌ 전체 삭제
export async function logout(): Promise<void> {
  const keysToRemove = ['user_name', 'seller_token', 'admin_token', ...]
  keysToRemove.forEach(key => localStorage.removeItem(key))
  await signOut()  // Firebase도 무조건 로그아웃
}
```

#### After (제안):
```typescript
// ✅ 타입별 선택적 삭제
export async function logout(userType?: 'user' | 'seller' | 'admin'): Promise<void> {
  if (!userType) {
    // userType 자동 감지
    userType = localStorage.getItem('user_type') as any || 'user'
  }
  
  console.log(`[Logout] 🚪 ${userType} 로그아웃 시작`)
  
  if (userType === 'user') {
    // User만 정리
    clearAuthData('user')
    await signOut()  // Firebase 로그아웃
  } else if (userType === 'seller') {
    // Seller만 정리
    clearAuthData('seller')
    // Firebase 로그아웃 안 함!
  } else if (userType === 'admin') {
    // Admin만 정리
    clearAuthData('admin')
    // Firebase 로그아웃 안 함!
  }
  
  window.location.href = '/'
}
```

### Solution 3: Seller/Admin 로그인 시 Firebase 정리

#### SellerLoginPage 개선:
```typescript
// ✅ Firebase 세션 완전 정리
async function handleSubmit(e: React.FormEvent) {
  e.preventDefault()
  setLoading(true)
  
  try {
    // 1. ✅ 기존 User 세션 완전 정리 (Firebase 포함)
    clearAuthData('user')
    
    // 2. ✅ Firebase 로그아웃
    try {
      const { signOut } = await import('@/lib/firebase-auth')
      await signOut()
      console.log('[SellerLogin] ✅ Firebase 로그아웃 완료')
    } catch (err) {
      console.warn('[SellerLogin] Firebase 로그아웃 실패 (무시):', err)
    }
    
    // 3. ✅ Seller 로그인 진행
    const response = await api.post('/api/seller/login', { ... })
    
    // 4. ✅ Seller 세션 설정
    localStorage.setItem('seller_token', accessToken)
    localStorage.setItem('user_type', 'seller')
    // ...
  }
}
```

### Solution 4: clearAuthData 개선

#### Before:
```typescript
export function clearAuthData(type: 'seller' | 'admin' | 'user') {
  const keysToRemove: string[] = []
  
  if (type === 'seller') {
    keysToRemove.push('seller_token', 'seller_id', ...)
  }
  // user_id, user_name 삭제 안 함! ❌
}
```

#### After (제안):
```typescript
export function clearAuthData(type: 'seller' | 'admin' | 'user') {
  console.log(`[Auth] Clearing ${type} auth data`)
  
  const keysToRemove: string[] = []
  
  if (type === 'seller') {
    keysToRemove.push(
      'seller_token',
      'seller_refresh_token',
      'seller_id',
      'seller_name',
      'seller_email',
      'access_token',  // 셀러가 사용하는 fallback
      'user_type'
    )
  } else if (type === 'admin') {
    keysToRemove.push(
      'admin_token',
      'admin_refresh_token',
      'admin_id',
      'admin_name',
      'admin_email',
      'access_token',  // 어드민이 사용하는 fallback
      'user_type'
    )
  } else if (type === 'user') {
    keysToRemove.push(
      'firebase_token',
      'user_type',
      'user_id',
      'user_name',
      'user_email',
      'user_profile_image',
      'lastLoginUid',
      'hasCartItems',
      'tempCartItem',
      'loginReturnUrl',
      'auth-kr-storage',
      'auth-world-storage'
    )
  }
  
  // ✅ 선택적 삭제
  keysToRemove.forEach(key => {
    localStorage.removeItem(key)
  })
  
  console.log(`[Auth] Removed ${keysToRemove.length} keys`)
}
```

### Solution 5: API 인터셉터 개선 (이미 올바름)

현재 `/src/lib/api.ts`의 로직은 올바릅니다:
- ✅ `user_type` 체크로 토큰 선택
- ✅ Early return으로 Firebase 혼용 방지

---

## 구현 우선순위

### 🔴 Priority 1 (즉시 수정 필요):
1. **loginWithKakaoToken, loginWithFirebaseToken**:
   - 로그인 전 `clearAuthData('seller')`, `clearAuthData('admin')` 호출
   - `user_id`, `user_name` localStorage 설정 추가

2. **SellerLoginPage, AdminLoginPage**:
   - 로그인 전 `clearAuthData('user')` 호출
   - Firebase `signOut()` 명시적 호출

3. **logout() 함수**:
   - `userType` 파라미터 추가
   - 타입별 선택적 삭제 로직 구현

### 🟡 Priority 2 (중요):
4. **clearAuthData() 개선**:
   - `user` 타입 처리 로직 추가
   - 모든 관련 키 완전 삭제

5. **UserProfilePage, SellerPage, AdminPage**:
   - 로그아웃 버튼에서 올바른 타입 전달

### 🟢 Priority 3 (개선):
6. **로그 강화**:
   - localStorage 상태 출력
   - 세션 충돌 감지 경고

7. **단위 테스트**:
   - 각 로그인 시나리오 테스트
   - localStorage 정리 검증

---

## 테스트 시나리오

### Test 1: User → Seller 로그인
```
1. User (Kakao) 로그인
2. localStorage 확인: user_type='user', firebase_token 존재
3. /seller/login 이동
4. Seller 로그인
5. localStorage 확인:
   ✅ user_type='seller'
   ✅ seller_token 존재
   ✅ firebase_token 삭제됨
   ✅ user_id, user_name 삭제됨
   ✅ Firebase auth.currentUser = null
```

### Test 2: Seller → User 로그인
```
1. Seller 로그인
2. localStorage 확인: user_type='seller', seller_token 존재
3. /login 이동
4. User (Kakao) 로그인
5. localStorage 확인:
   ✅ user_type='user'
   ✅ firebase_token 존재
   ✅ seller_token 삭제됨
   ✅ seller_id 삭제됨
   ✅ Firebase auth.currentUser 존재
```

### Test 3: User 로그아웃
```
1. User 로그인 상태
2. /user/profile에서 로그아웃 클릭
3. logout('user') 실행
4. localStorage 확인:
   ✅ user_type 삭제됨
   ✅ firebase_token 삭제됨
   ✅ Firebase auth.currentUser = null
   ✅ 만약 seller_token이 있었다면 그대로 유지 (분리 확인)
```

### Test 4: Seller 로그아웃
```
1. Seller 로그인 상태
2. /seller 대시보드에서 로그아웃
3. logout('seller') 실행
4. localStorage 확인:
   ✅ user_type 삭제됨
   ✅ seller_token 삭제됨
   ✅ Firebase auth.currentUser는 영향 없음
```

---

## 결론

### 현재 상태
- ✅ API 인터셉터: 올바르게 구현됨
- ✅ clearAuthData(): 부분적으로 구현됨
- ⚠️ 로그인 함수들: user_type만 설정, 다른 세션 정리 안 함
- ❌ 로그아웃 함수: 전체 삭제 (타입 구분 없음)

### 핵심 문제
**로그인 시 이전 세션 정리가 불완전하여 localStorage 오염 발생**

### 해결 방법
1. **모든 로그인 함수**에 `clearAuthData()` 호출 추가
2. **logout() 함수**에 타입별 선택적 삭제 구현
3. **clearAuthData('user')** 구현 완성
4. **테스트 시나리오** 전체 검증

이렇게 하면 **100% 확률로 계정이 완전히 분리**됩니다. 🎯
