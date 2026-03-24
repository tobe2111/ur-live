# 🔬 초정밀 감사 결과: 숨겨진 문제들

## 🚨 발견된 문제들

### 1. **미사용 상태 변수 (코드 혼란)**
**파일:** `src/contexts/AuthContext.tsx:56`
```typescript
const [syncAttempted, setSyncAttempted] = useState(false)  // ❌ 선언되었지만 사용 안 함
```

**문제:**
- `syncAttemptedUidsRef`로 대체했지만 옛날 코드가 남아있음
- 혼란을 줄 수 있음

---

### 2. **중복 user_id 저장 (불필요한 코드)**
**파일:** `src/contexts/AuthContext.tsx:117-128, 152-160`

```typescript
// 첫 번째 저장 (Line 117-128)
const userIdFromClaims = idTokenResult.claims.userId
if (userIdFromClaims) {
  localStorage.setItem('user_id', userIdFromClaims.toString())
}

// 두 번째 저장 (Line 152-160) - D1 sync 성공 시
if (syncResponse.data?.success && syncResponse.data?.user) {
  localStorage.setItem('user_id', userData.id?.toString() || '')  // ❌ 중복!
}
```

**문제:**
- 같은 데이터를 두 번 저장
- 불필요한 코드

---

### 3. **실행되지 않는 조회 API (데드 코드)**
**파일:** `src/contexts/AuthContext.tsx:196-220`

```typescript
const existingUserId = localStorage.getItem('user_id')
if (!existingUserId && ...) {
  // user_id 조회 API
}
```

**문제:**
- Line 121에서 이미 `user_id`를 저장했음
- 이 조건은 **절대 true가 될 수 없음**
- 데드 코드

---

### 4. **LoginPage의 리다이렉트 지연 (경쟁 상태)**
**파일:** `src/pages/LoginPage.tsx`

```typescript
if (isLoggedIn && !hasRedirected.current) {
  setTimeout(() => {
    navigate('/', { replace: true })
  }, 100)  // ❌ 100ms 지연
}
```

**문제:**
- `setTimeout`으로 리다이렉트를 지연
- AuthContext의 리다이렉트와 **경쟁 상태**
- 둘 다 실행될 수 있음

---

### 5. **백엔드 Rate Limit이 너무 엄격 (운영 이슈)**
**파일:** `src/index.tsx`

```typescript
// Rate Limiting: 동일 UID당 1분에 1회
if (elapsed < 60000) {
  return c.json({ error: 'Rate limited' }, 429)
}
```

**문제:**
- **1분에 1회**만 허용
- 개발 중 테스트 시 매우 불편
- 실제 문제가 아니라 개발 환경 문제일 수 있음

---

### 6. **Custom Claims의 userId가 없을 경우 처리 부재**
**파일:** `src/contexts/AuthContext.tsx:117-123`

```typescript
const userIdFromClaims = idTokenResult.claims.userId as number | undefined
const userNameFromFirebase = firebaseUser.displayName

if (userIdFromClaims) {
  localStorage.setItem('user_id', userIdFromClaims.toString())
}
// ❌ else 처리 없음
```

**문제:**
- `userIdFromClaims`가 `undefined`이면 `user_id`가 저장되지 않음
- 백엔드가 Custom Claims에 `userId`를 포함시키지 않았을 가능성
- 조용히 실패함

---

### 7. **onAuthStateChanged가 logout 후에도 트리거 (로그 혼란)**
**파일:** `src/contexts/AuthContext.tsx:94-249`

```typescript
const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
  if (firebaseUser) {
    // ... 로그인 처리
  } else {
    console.log('로그아웃 상태')
    setUser(null)
    setIsAuthReady(true)  // ✅ 로그아웃도 ready
  }
})
```

**문제:**
- 로그아웃 시에도 `onAuthStateChanged`가 트리거됨
- `firebaseUser === null`
- `setIsAuthReady(true)` 실행
- → UserProfilePage가 리렌더링 → `isAuthReady && !user` → `/login`으로 리다이렉트
- **이것이 무한 루프의 진짜 원인일 수 있음!**

---

### 8. **UserProfilePage의 로그인 체크 타이밍 (근본 문제)**
**파일:** `src/pages/UserProfilePage.tsx:14-26`

```typescript
useEffect(() => {
  if (!isAuthReady) return  // ✅ 가드
  
  if (!isLoggedIn) {
    navigate('/login?returnUrl=/user/profile')  // ❌ 여기로 리다이렉트
    return
  }
  // ...
}, [isAuthReady, isLoggedIn, user, navigate])
```

**흐름:**
1. 카카오 로그인 성공 → URL에 `firebase_token`
2. AuthContext: `signInWithCustomToken` 호출
3. Firebase: 로그인 성공 → `onAuthStateChanged` 트리거
4. AuthContext: `setUser(firebaseUser)`, `setIsAuthReady(true)`
5. UserProfilePage: `isAuthReady === true`, `isLoggedIn === true` → 정상
6. **하지만**: URL에서 `/login`으로 이동하면?
7. AuthContext는 여전히 `user !== null`
8. LoginPage: `isLoggedIn === true` → `/`로 리다이렉트
9. `/` 페이지에서 `/user/profile` 링크 클릭
10. UserProfilePage: `isAuthReady && isLoggedIn` → 정상
11. **하지만**: 갑자기 `onAuthStateChanged`가 다시 트리거되면?
12. → 무한 루프

---

## 🎯 진짜 근본 원인

### **onAuthStateChanged가 예상치 못하게 여러 번 트리거되는 이유**

1. **React Strict Mode (Dev 모드)**
   - useEffect가 2번 실행
   - `onAuthStateChanged` 리스너가 2번 등록될 수 있음

2. **Firebase 토큰 갱신**
   - ID Token이 1시간마다 갱신
   - 갱신 시 `onAuthStateChanged` 트리거 가능

3. **네트워크 재연결**
   - 네트워크가 끊겼다가 다시 연결되면
   - Firebase가 재인증 → `onAuthStateChanged` 트리거

4. **탭 간 동기화**
   - 여러 탭에서 로그인/로그아웃
   - localStorage 변경 감지 → `onAuthStateChanged` 트리거

5. **signInWithCustomToken 자체**
   - 이 함수가 내부적으로 `onAuthStateChanged`를 트리거
   - 예상된 동작이지만, 타이밍이 문제

---

## ✅ 진짜 해결책

### 1. **미사용 상태 제거**
```typescript
// ❌ 제거
const [syncAttempted, setSyncAttempted] = useState(false)
```

### 2. **중복 user_id 저장 제거**
```typescript
// D1 sync 성공 시 user_id 저장 코드 제거
// Custom Claims에서만 저장
```

### 3. **데드 코드 제거**
```typescript
// Line 196-220 조회 API 코드 제거
// Custom Claims가 없을 때만 필요
```

### 4. **LoginPage 리다이렉트 즉시 실행**
```typescript
if (isLoggedIn && !hasRedirected.current) {
  hasRedirected.current = true
  navigate('/', { replace: true })  // ✅ 즉시 실행
}
```

### 5. **백엔드 Rate Limit 완화 (개발용)**
```typescript
// 개발 환경: 10초
// 프로덕션: 60초
const rateLimitMs = c.env.ENVIRONMENT === 'development' ? 10000 : 60000
```

### 6. **Custom Claims 없을 때 fallback**
```typescript
if (userIdFromClaims) {
  localStorage.setItem('user_id', userIdFromClaims.toString())
} else {
  // ✅ Custom Claims에 userId가 없으면 D1에서 조회
  console.warn('[AuthContext] ⚠️ Custom Claims에 userId 없음 - D1 sync 필수')
}
```

### 7. **onAuthStateChanged 중복 트리거 방지**
```typescript
const lastAuthState = useRef<'loading' | 'logged-in' | 'logged-out'>('loading')

onAuthStateChanged(auth, async (firebaseUser) => {
  const currentState = firebaseUser ? 'logged-in' : 'logged-out'
  
  // ✅ 상태가 실제로 변경되었을 때만 처리
  if (lastAuthState.current === currentState && lastAuthState.current !== 'loading') {
    console.log('[AuthContext] ⏭️ 상태 변경 없음 - 스킵')
    return
  }
  
  lastAuthState.current = currentState
  // ... 나머지 로직
})
```

### 8. **UserProfilePage isLoggedIn 체크 제거**
```typescript
// ❌ 제거
if (!isLoggedIn) {
  navigate('/login')
  return
}

// ✅ user 객체만 체크
if (!user) {
  navigate('/login')
  return
}
```

---

## 📊 우선순위

| 우선순위 | 문제 | 영향도 |
|---------|------|--------|
| 🔥 P0 | onAuthStateChanged 중복 트리거 방지 | CRITICAL |
| 🔥 P0 | UserProfilePage isLoggedIn 체크 제거 | CRITICAL |
| ⚠️ P1 | LoginPage 리다이렉트 즉시 실행 | HIGH |
| ⚠️ P1 | Custom Claims fallback 추가 | HIGH |
| 📝 P2 | 미사용 상태/데드 코드 제거 | MEDIUM |
| 📝 P2 | 중복 user_id 저장 제거 | MEDIUM |
| 🛠️ P3 | 백엔드 Rate Limit 완화 | LOW |

---

## 🎯 예상 결과

이 수정들을 모두 적용하면:
1. ✅ onAuthStateChanged가 정확히 필요할 때만 트리거
2. ✅ 무한 루프 완전 제거
3. ✅ 429 에러 최소화
4. ✅ 코드 가독성 향상
5. ✅ 유지보수성 향상
